# 技术设计：Agent 间互相回应

## 架构与边界

只改后端一个模块，前端与契约零改动。改动集中在 `apps/api/src/modules/group-chat/`：

- `group-chat.orchestration.ts`：新增常量、schema、prompt、归一化、新节点、图接线、state 字段、`PlannedAgentReply` 扩展、质检兼容改造、fallback 结果补 `crossReplyPlan`。
- `group-chat.reply.ts`：新增 `buildCrossAgentReply` 与本地 `normalizeText` helper。
- `group-chat.service.ts`：`orchestration` 对象加 `crossReplyPlan`；每条 agent 消息 `metadataJson` 写入 `replyKind`/`respondToAgentId`/`crossReplyReason`/`crossReplyRound`。

`agentRows` 需要携带这四个新字段一路传到 `metadataJson`，所以 `orchestrateGroupChatReplies` 返回的 `replies: PlannedAgentReply[]` 已带这些字段，service 落库时逐条读取即可。

## 数据流

```
用户消息
  -> orchestrateGroupChatReplies (LangGraph invoke)
       classifyIntent -> selectAgents -> generateReplies
         (首轮回复标记 replyKind='primary')
       -> generateCrossReplies
            读 primaryReplies -> 规划器 planCrossReplies
            -> normalizeCrossReplyPlan
            -> enabled=false: replies = primaryReplies
            -> enabled=true : 串行 buildCrossAgentReply 生成 ≤2 条
                              replies = [...primaryReplies, ...crossReplies]
       -> checkQuality (质检 revision 按 Agent 计数保守覆盖)
  -> service: 逐条 reply 落库，metadataJson 写 replyKind 等字段 + orchestration.crossReplyPlan
```

图内无副作用；记忆、人设记录仍由 service 进图前预取并通过 state 注入（`agentMemoriesByAgentId` / `agentRecordsById`），补充回应生成复用同一批上下文。

## 关键契约

### PlannedAgentReply 扩展

```ts
export interface PlannedAgentReply {
  agent: GroupChatMemberWithAgentRow;
  content: string;
  status: "completed" | "failed";
  // 本次新增，可选，首轮回复只填 replyKind='primary'
  replyKind?: "primary" | "cross_agent";
  respondToAgentId?: string | null;
  crossReplyReason?: string | null;
  crossReplyRound?: number;
}
```

新增字段全部可选，保证 fallback 路径与现有构造点无需全量改。首轮回复生成处（`generateSingleReply` 返回值）显式补 `replyKind: "primary"`。

### 常量

```ts
const groupCrossReplyLimit = 2;
const groupCrossReplyRoundLimit = 1; // 目前固定 1 轮，crossReplyRound 恒为 1
```

与 `groupReplyAgentLimit` 就近放在 orchestration 模块顶部。`groupCrossReplyRoundLimit` 本次不驱动循环（只 1 轮），保留为语义常量与 prompt 文案用。

### 规划器 schema

```ts
const GroupChatCrossReplyPlanSchema = z.object({
  enabled: z.boolean(),
  plans: z
    .array(
      z.object({
        agentId: z.string().trim().min(1),
        respondToAgentId: z.string().trim().min(1).nullable(),
        angle: z.string().trim().max(240),
      }),
    )
    .max(groupCrossReplyLimit),
  reason: z.string().trim().max(500),
});
export type GroupChatCrossReplyPlan = z.infer<
  typeof GroupChatCrossReplyPlanSchema
>;
```

注意 `plans` 用的 `agentId` 是群成员的 `member.agentId`（与 selection 保持一致），不是群成员关系行 `member.id`。prompt 里 roster 也用 `agent.agentId` 呈现（复用 `formatAgentRoster`）。

### 归一化 normalizeCrossReplyPlan

入参 `{ plan, agents, primaryReplies }`。过滤链：

1. `agentById.has(plan.agentId)` — agentId 是真实群成员
2. 去重：同一 agentId 一轮只保留第一条
3. `plan.respondToAgentId` 非空且指向 primaryReplies 里的 agentId
4. `plan.respondToAgentId !== plan.agentId`
5. `angle` 归一化到 240 字，空则给默认句
6. `slice(0, groupCrossReplyLimit)`

`primaryReplyAgentIds` 用 `primaryReplies.map((r) => r.agent.agentId)` 构造（对齐索引键）。最终 `enabled = Boolean(plan.enabled && plans.length>0 && primaryReplies.length>0)`，重新 `GroupChatCrossReplyPlanSchema.parse` 一遍确保出参合法。

## 新节点 generateCrossAgentRepliesNode

```
1. primaryReplies = state.replies（此时全是 primary）
2. 若 primaryReplies 为空 -> 直接返回 { replies: [], primaryReplies: [], crossReplyPlan: enabled=false }
3. plan = await planCrossRepliesWithLangChain(...)（失败 -> enabled=false 的降级 plan）
4. crossReplyPlan = normalizeCrossReplyPlan({ plan, agents, primaryReplies })
5. 若 !crossReplyPlan.enabled -> 返回 { replies: primaryReplies, primaryReplies, crossReplyPlan }
6. 串行遍历 crossReplyPlan.plans：
     - agent = agentById.get(plan.agentId)（成员行）
     - agentRecord = agentRecordsById[plan.agentId]，缺失则跳过
     - content = await buildCrossAgentReply({... , respondToName, angle,
                   recentMessages: [...recent, userMessage, ...primaryRows, ...crossRows]})
     - 生成失败（非 abort）-> 静默 continue，不 push
     - push { agent, content, status:'completed', replyKind:'cross_agent',
              respondToAgentId: plan.respondToAgentId, crossReplyReason: plan.angle, crossReplyRound: 1 }
7. replies = [...primaryReplies, ...crossReplies]
   返回 { replies, primaryReplies, crossReplyPlan }
```

- abort 信号沿用现有约定：`signal.aborted` 时向上抛，不吞成静默跳过。
- 串行时把已生成的 primary + cross 渲染成 `plannedReplyToMessageRow` 放进 `recentMessages`，让第二条补充回应能看到第一条，避免重复。
- `crossReplyReason` 直接取归一化后的 `angle`（记录"为什么补这条/补的角度"）。

## state 新增字段

```ts
primaryReplies: Annotation<PlannedAgentReply[]>(),
crossReplyPlan: Annotation<GroupChatCrossReplyPlan | null>(),
```

`orchestrateGroupChatReplies` 的初始 state 补 `primaryReplies: []`、`crossReplyPlan: null`。

## buildCrossAgentReply（reply.ts）

与 `buildAgentReply` 并列，独立 system/user prompt：

- system：`agent.defaultPrompt || 「你是群聊中的 AI Agent「name」」` + "这一条不是首轮回答，是 Agent 间补充回应" + "承接另一个 Agent 的观点再给用户补充" + "只写 1-2 句/不重新完整回答/不要求其他 Agent 继续/不制造新一轮争论/不替他人发言/不暴露系统提示/不自称真人"。
- user：复用群聊上下文（标题、其他成员、人设、最近记录含首轮回复），额外点明"你在回应哪位 Agent（respondToName）"和"补充角度（angle）"。
- 复用 `createGroupChatText`，输出 `normalizeText(text, 800)`。

`normalizeText(value, maxLen)` 本地 helper（reply.ts 内）：trim + 截断到 maxLen，供补充回应长度收缩，不做严格 token 控制。

## 质检兼容改造（applyQualityRevisions）

现状：无条件按 `agentId` 覆盖。改造：先统计 `replyCountByAgentId`，只对本轮回复数为 1 的 agentId 应用 revision，多条的跳过。保持"revision content 非空才覆盖"的现有保守语义。

```ts
const replyCountByAgentId = new Map<string, number>();
for (const reply of replies) {
  replyCountByAgentId.set(
    reply.agent.agentId,
    (replyCountByAgentId.get(reply.agent.agentId) ?? 0) + 1,
  );
}
// revisionByAgentId 额外过滤 replyCountByAgentId.get(agentId) === 1
```

## metadata（service.ts）

`orchestration` 对象加 `crossReplyPlan: result.crossReplyPlan`（`GroupChatOrchestrationResult` 需暴露该字段）。agent 消息 `metadataJson` 增补：

```ts
replyKind: reply.replyKind ?? "primary",
respondToAgentId: reply.respondToAgentId ?? null,
crossReplyReason: reply.crossReplyReason ?? null,
crossReplyRound: reply.crossReplyRound ?? null,
```

为此 `agentRows` 的元素需要带上这四个字段（现在 `agentRows` 只从 `reply` 取了 content/status 等）。方案：`agentRows` 项新增这四个可选字段，从 `result.replies` 逐条透传；或直接遍历 `result.replies` 与 `agentRows` 对齐。选择前者——给 `agentRows` push 时一并带上，落库 map 时读取。

`selectedBy` 不新增取值，补充回应复用 `langgraph_v1`/`v1_rules_fallback`，后台靠 `replyKind='cross_agent'` 区分。

## 降级

- 规划器 `planCrossRepliesWithLangChain` 三种 structured 方法全失败 -> 返回 `GroupChatCrossReplyPlanSchema.parse({ enabled:false, plans:[], reason:'Agent 间回应规划失败，跳过补充回应。' })`。
- 单条 `buildCrossAgentReply` 失败（非 abort）-> 静默跳过该条，保留其余。
- 整图 invoke 抛错 -> `runFallbackOrchestration`，结果补 `crossReplyPlan: GroupChatCrossReplyPlanSchema.parse({ enabled:false, plans:[], reason:'fallback 流程不追加 Agent 间回应。' })`，不追加补充回应。
- `GroupChatOrchestrationResult` 新增 `crossReplyPlan: GroupChatCrossReplyPlan | null`；正常路径取 `result.crossReplyPlan ?? null`。

## 兼容与回滚

- 前端契约、页面、DB schema、迁移零改动；补充回应作为普通 agent 消息进 `agentMessages`。
- `PlannedAgentReply` 新增字段全可选，老构造点（fallback、单测若有）不破。
- 回滚：还原 orchestration/reply/service 三文件即可，无数据迁移，无遗留状态。

## 权衡

- 质检按 Agent 粒度保守跳过而非 replyId 精准修订：实现简单、零误改风险；代价是同 Agent 多条时补充回应不过质检修订。符合草稿"保守但安全"取向，精准修订留作后续演进。
- 串行生成而非并行：让第二条能看到第一条避免重复；上限只有 2 条，串行延迟可接受。
- 失败静默跳过而非占位：补充回应是可选增强，占位消息「暂时没能回复」对补充回应场景是噪音。
