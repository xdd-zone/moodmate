# API Agent 群聊

## 1. 适用范围

修改 Agent 群聊的创建、成员管理、消息历史、发送与多 Agent 回复生成时使用本规范。实现位于 `apps/api/src/modules/group-chat/`，共享契约在 `packages/contracts/src/chat/group-chat.contract.ts`，数据库迁移是 `apps/api/migrations/0014_*.sql`（三张表：`agent_group_chats` / `agent_group_chat_members` / `agent_group_chat_messages`）。群聊成员指向多 Agent 体系的 `user_agents`，与单聊 `companion_*` 链路无关。

发言权判断已从 v1 关键词规则升级为 LangGraph 编排图（`group-chat.orchestration.ts`），v1 规则（`selectAgentsForReply`）保留为降级兜底。见第 8 节。

与单聊的核心差异：群聊回复**非流式**，一次返回完整的 `agentMessages` 数组；**不接收请求级 `llmConfig`**，服务端固定用平台默认模型。

## 2. 公开签名

```text
GET    /rpc/chat/group
POST   /rpc/chat/group
GET    /rpc/chat/group/:groupChatId
GET    /rpc/chat/group/:groupChatId/messages?cursor=<createdAtMs>
POST   /rpc/chat/group/:groupChatId/members
DELETE /rpc/chat/group/:groupChatId/members/:memberId
POST   /rpc/chat/group/:groupChatId/send

Authorization: Bearer <web access token>
```

模块入口 `createGroupChatRoute()`；route 处理鉴权和 Zod 校验，service 组装业务与越权校验，repository 只读写 D1，presenter 把 record 转 DTO。全部接口返回统一 JSON 响应（无流式）。`send` 是本规范重点，其余为群聊底座。

## 3. 合同

- 所有接口先经 `requireWebAccess`，再校验。`send` 用 path param `groupChatId` + `SendAgentGroupChatMessageRequestSchema`（只含 `message`，trim 1-2000，**不含 llmConfig / groupChatId**）。
- 归属校验：`requireGroupChat` 确认群聊属当前 `userId`，否则 403；返回群聊记录供后续复用。
- 成员上限：一个群最多 6 个 Agent；每轮最多 3 个 Agent 回复（`groupReplyAgentLimit = 3`），上限在后端 `selectAgentsForReply` 里兜底，不依赖前端。
- 发言权判断：正常走 LangGraph 编排（第 8 节），失败逐级回退到 v1 规则 `selectAgentsForReply`。v1 规则（也是 fallback）：点名（`userText` 含成员 name）→ 返回被点名成员（≤3）；群体关键词 `/(你们|大家|一起|分别|都说|怎么看|意见)/` → 返回前 min(3, 成员数) 个；否则默认单个。均保持 `displayOrder` 顺序。
- 人设补拉：`listActiveMembers` 只返回展示字段（name/headline/imageKey/displayOrder）与一对一会话统计（`conversationMessageCount` / `conversationLastMessageAtMs`，见 8.7），**没有人设 prompt**。选中成员后必须用 `listOwnedUserAgentsByIds` 按 agentId 拉完整 `UserAgentRecord`，`buildAgentReply` 用完整记录构造 prompt。会话统计字段仅供编排层发言权判断，presenter 不透传给前端契约。
- 记忆隔离：每个 Agent 回复只注入自己的 `listActiveAgentMemories({ userId, agentId, limit: 6 })`，禁止跨 Agent 记忆污染。
- 生成方式由编排 `selection.mode` 决定：`single`/`multi_serial` 串行生成，把已生成回复累积进下一轮 `recentMessages`（`[...recent, userMsg, ...已生成 agentMsgs]`），让后一个 Agent 看到同轮前面 Agent 说了什么；`multi_parallel`（明确"分别/各自/轮流"类意图）才用 `Promise.all` 并发，各 Agent 只看 `[...recent, userMsg]`，互不可见。默认路径仍是串行。
- 单 Agent 失败降级：某个 Agent 的 LLM 调用失败时，该条落 `status: 'failed'` + 占位文案，不中断整轮，其余 Agent 继续。
- provider：`resolveActiveLlmProviderConfig(bindings)` 解析一次平台默认配置，循环复用。`createGroupChatText` 用 `stream: false` 调 `{baseURL}/chat/completions`，解析 `choices[0].message.content`。
- 落库：一轮内 1 条 user + N 条 agent 用 `insertGroupChatMessages` 批量 `db.batch` 一次写入；同轮消息 `createdAtMs` 逐条 +1ms 递增，配合 `(created_at_ms, id)` 索引保证回看顺序稳定；共用同一 `turnIndex = (recent.at(-1)?.turnIndex ?? 0) + 1`。
- 统计更新：`updateGroupChatStats` 只更新 `messageCount(+本轮条数)` / `lastMessageAtMs` / `updatedAtMs`，**不动 summary，不抽记忆**。
- 消息 metadata：user 记 `source: group_chat_user`；agent 记 `source: group_chat_agent` / `selectedBy`（正常编排 `langgraph_v1`，整图兜底 `v1_rules_fallback`）/ `model` / `providerName` / `orchestration: { intent, selection, quality, crossReplyPlan, speakingContext }`（编排轨迹只进 metadata，不入契约；`speakingContext` 见 8.7）/ 每条 agent 消息另记 `replyKind`（`primary` / `cross_agent`）/ `respondToAgentId` / `crossReplyReason` / `crossReplyRound`（补充回应见 8.6）。补充回应**不新增 `selectedBy` 取值**，靠 `replyKind: cross_agent` 区分。**无 wireApi**，该字段是 bobo 结构，moodmate provider 不存在。
- 历史分页：首屏取最近 50 条（正序）；`messages?cursor=` 取 `createdAtMs < cursor` 的最近 50 条正序；`nextCursor` 仅当返回数达上限时给最早一条的 `createdAtMs`，否则 null。
- 无 active 成员：跳过生成循环，仍写用户消息并更新统计，返回空 `agentMessages`，不报错。

## 4. 校验与错误矩阵

| 条件                           | 错误码                    | HTTP |
| ------------------------------ | ------------------------- | ---- |
| 缺少或无效 Web access token    | 现有 `AUTH.*`             | 401  |
| 请求 schema 或游标无效         | `COMMON.INVALID_REQUEST`  | 400  |
| 群聊不属于当前用户             | `AUTH.FORBIDDEN`          | 403  |
| 创建/加成员时 Agent 不属于用户 | `AUTH.FORBIDDEN`          | 403  |
| 加成员后 active 总数超过 6     | `COMMON.INVALID_REQUEST`  | 422  |
| 平台模型配置缺失（无 active）  | `SYSTEM.INTERNAL_ERROR`   | 503  |
| 上游连接失败或 HTTP 失败       | `SYSTEM.INTERNAL_ERROR`   | 503  |
| 上游响应超时（90s）            | `SYSTEM.UPSTREAM_TIMEOUT` | 504  |
| 单 Agent 生成失败              | 该条落 `status: failed`   | 200  |

单 Agent 失败不影响整轮 HTTP 状态；只有整体链路（无模型配置、归属失败等）才返回错误码。服务端日志只记上游状态码，不记 API Key、Authorization、请求正文或上游响应正文。

## 5. 正常、基础、错误案例

- 正常：登录用户发普通消息，编排 `classifyIntent` 判为单人意图、`selectAgents` 选 1 个 Agent（图内用进图前预取的人设 + 自己的记忆），生成回复，1 条 user + 1 条 agent 批量落库，返回完整数组。
- 基础：发"你们怎么看"触发多人意图，选 min(3, 成员数) 个 Agent 串行生成，后者能看到前者本轮回复；发"你们分别说"命中 `GROUP_PARALLEL_PATTERN`，走 `multi_parallel` 并发生成。
- 错误：在图内节点里查 DB（破坏"图内无副作用"约定，降级路径拿不到数据）；或 catch 里不判 `signal.aborted`，把用户取消当 LLM 失败吞成 fallback 再生成（见 8.5）。

## 6. 必做检查

- `pnpm --filter api check-types` 和 `pnpm --filter api lint`。
- 越权检查：他人群聊 send / 详情 / 历史都返回 403；创建/加成员选他人 Agent 返回 403。
- 上限检查：`selectAgentsForReply` 无论成员多少每轮回复数 ≤3；加成员超过 6 返回 422。
- 人设检查：选中成员的 prompt 来自 `listOwnedUserAgentsByIds` 的完整记录，不是 `listActiveMembers` 的展示行。
- 记忆隔离检查：每个 Agent 的 prompt 只含自己的 `listActiveAgentMemories`（编排版进图前按 agentId 预取，不跨 Agent）。
- 生成方式检查：`single`/`multi_serial` 串行 + 累积 `recentMessages`；仅 `multi_parallel` 用 `Promise.all`；同轮消息 `createdAtMs` 严格递增。
- 降级检查：单 Agent 上游失败时该条 `status: failed` + 占位文案；intent/selection 节点失败回 v1 规则；整图失败走 `runFallbackOrchestration` 且 metadata 记 `v1_rules_fallback`。
- 取消语义检查：请求 abort 时四处 catch 都 `throw`，不落 `failed` 占位、不走兜底再生成、不写半截数据（见 8.5）。
- 统计检查：send 后 `messageCount` 增本轮条数，`lastMessageAtMs`/`updatedAtMs` 更新，`summary` 不变。
- 分页检查：首屏 50 条正序；`nextCursor` 只在达上限时非空，前端 prepend 去重无重复。

## 7. 错误与正确写法

```ts
// 错误：catch 不区分用户取消，abort 被当成 LLM 失败，落 failed 占位或走兜底再生成
try {
  return { agent, content: await buildAgentReply({ ..., signal }), status: "completed" };
} catch (error) {
  return { agent, content: AGENT_REPLY_FALLBACK, status: "failed" }; // abort 也被吞进这里
}

// 正确：先判 signal.aborted，命中就向上抛，取消不触发降级生成（见 8.5）
try {
  return { agent, content: await buildAgentReply({ ..., signal }), status: "completed" };
} catch (error) {
  if (signal.aborted) {
    throw error; // 用户主动取消，交给上层，不落占位、不写库
  }
  console.warn("群聊 Agent 回复失败", { agentId: agent.agentId });
  return { agent, content: AGENT_REPLY_FALLBACK, status: "failed" };
}
```

## 8. LangGraph 编排（group-chat.orchestration.ts）

发言权与回复生成的正常路径是一张线性图，v1 规则降为兜底。

### 8.1 入口签名

```ts
orchestrateGroupChatReplies(params: {
  providerConfig: ChatProviderConfig;
  groupChat: AgentGroupChatRecord;
  agents: GroupChatMemberWithAgentRow[];          // 当前活跃成员，按 displayOrder
  recentMessages: GroupChatMessageWithAgentRow[];  // 含本轮 userMessage
  userMessage: GroupChatMessageWithAgentRow;
  userText: string;
  agentMemoriesByAgentId: Record<string, AgentMemoryRecord[]>;  // 按 agentId 隔离
  agentRecordsById: Record<string, UserAgentRecord>;            // 人设完整记录
  signal: AbortSignal;
}): Promise<{
  intent: GroupChatIntent;
  selection: GroupChatAgentSelection;
  replies: PlannedAgentReply[];         // { agent, content, status, replyKind?, respondToAgentId?, crossReplyReason?, crossReplyRound? }
  quality: GroupChatReplyQuality | null;
  crossReplyPlan: GroupChatCrossReplyPlan | null;  // Agent 间补充回应计划，见 8.6
  speakingContext: GroupSpeakingContext | null;    // 发言权上下文，见 8.7
  usedFallback: boolean;                 // 整图兜底时 true，供 metadata 标 selectedBy
}>
```

图结构：`START -> classifyIntent -> detectEmotion -> selectAgents -> generateReplies -> generateCrossReplies -> checkQuality -> END`。`detectEmotion` 是发言权前置的轻量情绪识别节点，见 8.7；`generateCrossReplies` 是 Agent 间补充回应节点，见 8.6。

### 8.2 图内无副作用（关键约定）

图内节点不碰 DB。记忆（`agentMemoriesByAgentId`）与人设（`agentRecordsById`）由 service 进图前对**全体活跃成员**预取好塞进 state。代价是给未被选中的 Agent 也取了记忆（一群最多 6×6 条，可接受），换来图可测、降级简单。记忆预取仍按 agentId 隔离，不破坏记忆隔离约束。

### 8.3 三个决策节点

- 结构化输出复用 `chat.analysis.ts` 范式：`ChatPromptTemplate.pipe(model.withStructuredOutput(schema, { name, method }))`，method 走**固定顺序** `["functionCalling","jsonSchema","jsonMode"]` 循环回退。`buildLangChainChatModel` 用最简构造（model/apiKey/temperature:0/configuration.baseURL），**不加 wireApi/reasoning 分支**（moodmate 的 `ChatProviderConfig` 无这些字段）。
- `classifyIntent`：输出意图枚举 + `targetAgentNames` + `shouldUseMultipleAgents` + `replyMode` + confidence。`normalizeGroupChatIntent` 把 LLM 输出拉回产品规则——只有明确多人表达（`shouldUseMultipleAgents` / 点名>1 / 命中 `GROUP_QUESTION_PATTERN`）才放开多人，多人默认 `multi_serial`，仅命中 `GROUP_PARALLEL_PATTERN`（`分别|各自|各说|轮流|逐个|每个人`）才 `multi_parallel`；confidence 夹 0-1；targetAgentNames 去重截断到 6。
- `selectAgents`：输出 `selectedAgentIds`（≤ `groupReplyAgentLimit`）+ mode。`normalizeAgentSelection` 校验 id 真实存在于当前成员、去重截断到 3，过滤后为空则回退 `selectAgentsForReply`。这是"模型可参与判断但不能突破系统边界"的护栏。
- `checkQuality`：LLM 结构化检查越界项（暴露系统提示/冒充真人/替他人发言/过长说教刷屏/偏离意图/违反角色边界），返回 `approved/score/issues/revisions/reason`。**保守应用**：只有某 Agent 有非空 `revision` 文本时才替换其回复，否则保留原文。补充回应上线后同一 Agent 一轮可能有 2 条消息（首轮 + cross_agent），`applyQualityRevisions` 先按 `agentId` 统计条数，**只有该 Agent 本轮恰好 1 条回复时才允许 revision 覆盖**，多条时整体跳过，避免首轮与补充回应被同一段修订文本混改（本次按 Agent 粒度保守处理，未做 replyId 级精修）。

### 8.4 两级降级

1. 单节点内失败 → 该节点各自 fallback：intent 回 `buildFallbackGroupChatIntent`（关键词推意图），selection 回 `selectAgentsForReply`，quality 回 `null`（保留原回复）。
2. 整图 `invoke` 抛错 → 顶层 try/catch 走 `runFallbackOrchestration`（`buildFallbackGroupChatIntent` + `selectAgentsForReply` + 直接 `buildAgentReply`），置 `usedFallback: true`。

两级都保证：LangGraph 挂掉时基础群聊仍能回，产出与正常路径同构（能落库、写 metadata）。

### 8.5 Gotcha：AbortSignal 不能被当成 LLM 失败吞掉

> **Warning**: 每一处 catch 都要先判 `signal.aborted`，命中就 `throw error`，不能走 fallback。
>
> 用户主动取消（`c.req.raw.signal` abort）和 LLM 真实失败都会进 catch。若不区分：单 Agent catch 会落 `status: failed` 占位并入库；整图 catch 会 abort 后再跑 `runFallbackOrchestration` 重新生成——都违背"取消不应触发降级生成"。所以 intent/selection 重试循环、单 Agent 生成、整图顶层四处 catch 都加 `if (signal?.aborted) throw error`。abort 抛到 service 层后，`insertGroupChatMessages` / `updateGroupChatStats` 被跳过，不写半截数据。checkQuality 循环失败已落 `quality=null`，取消由顶层守卫兜住。

### 8.6 Agent 间补充回应（generateCrossReplies）

首轮回复完成后，`generateCrossReplies` 判断是否值得追加一轮"非常克制"的 Agent 间补充回应（A 安慰用户、B 接话补一点）。用户始终是对话中心，补充回应是可选增强，不是基础链路依赖。

- 硬上限：`groupCrossReplyLimit = 2`（一轮最多追加 2 条补充回应）、`groupCrossReplyRoundLimit = 1`（只 1 轮）。这是产品体验边界，即使 LLM 想继续也不能突破，后端最终兜底。
- `PlannedAgentReply` 在 `{ agent, content, status }` 基础上新增 4 个可选字段：`replyKind?: 'primary' | 'cross_agent'`、`respondToAgentId?`、`crossReplyReason?`、`crossReplyRound?`。首轮回复（含 failed / 无人设降级三处）统一标 `replyKind: 'primary'`。
- 规划器 `planCrossRepliesWithLangChain`：结构化输出 `GroupChatCrossReplyPlanSchema`（`enabled` / `plans[{agentId, respondToAgentId, angle}]` / `reason`），只输出计划不输出聊天文本，全部结构化方法失败降级 `enabled=false`（`buildDisabledCrossReplyPlan`）。
- 归一化 `normalizeCrossReplyPlan`：索引键统一用 `member.agentId`（不是群成员关系行 `.id`）。做四层过滤——`agentId` 必须是当前成员、同 Agent 一轮只留一条、`respondToAgentId` 必须指向首轮已回复 Agent 且不等于 `agentId`、`slice` 到 2 条；`enabled` 还需 `plans.length>0 && primaryReplies.length>0`。
- 节点逻辑：`!enabled` 直接原样返回首轮回复（零额外生成）；`enabled` 则**串行**生成，后一条经 `plannedReplyToMessageRow` 把前一条塞进 `recentMessages` 避免重复，最终 `replies = [...primaryReplies, ...crossReplies]`。
- 补充回应生成 `buildCrossAgentReply`（`group-chat.reply.ts`）：独立 system prompt 强调"非首轮 / 承接某 Agent 观点再补充 / 只写 1-2 句 / 不重新完整回答 / 不要求他人继续 / 不制造新争论"，输出走本地 `normalizeText(text, 800)` 收缩。单条生成失败**静默跳过**（不落 failed 占位），已生成的其他补充回应保留；abort 仍向上抛。
- metadata：补充回应仍是普通 Agent 消息，进现有 `agentMessages` 数组，前端契约与页面零改动。`selectedBy` 不新增取值，靠 `metadata_json.replyKind: 'cross_agent'` 在后台区分；`orchestration.crossReplyPlan` 记规划轨迹。
- 降级：规划失败 → `enabled=false` 跳过补充；整图失败走 `runFallbackOrchestration` → 回填 `enabled=false` 计划，不追加补充回应。

> **Warning**（去重失效坑）：`normalizeCrossReplyPlan` 的同 Agent 去重必须在 `.filter()` 内 `usedAgentIds.add()`，不能放到后面的 `.map()` 里。JS 数组方法分两趟执行——所有 `.filter()` 先跑完，`.map()` 才开始，把 `add` 放 `.map()` 会让去重判断时集合恒空，两条同 `agentId` 计划双通过。

### 8.7 智能发言权判断（detectEmotion + 发言权上下文 + 打分 fallback）

发言权判断从「点名 + 关键词」升级为多信号调度：选 Agent 前先跑轻量情绪识别，把用户情绪 + 每个 Agent 的关系阶段 / 最近发言频率汇总成发言权上下文，同时喂给 LLM 选择器和本地打分 fallback。能力全在编排层，前端协议不变。相关代码在 `group-chat.speaking.ts`（新文件，纯函数 + schema，不 import orchestration，避免循环依赖）。

- 会话统计来源：`listActiveMembers` 加 `leftJoin(agentConversations)`（`userId` + `agentId` 双条件，走 `agent_conversations_user_agent_idx`），行增 `conversationMessageCount`（`coalesce(...,0)`）/ `conversationLastMessageAtMs`。这两字段**不进前端契约**（`presentMember` 不透传），仅供发言权判断。
- 情绪识别 `detectGroupUserEmotionWithLangChain`：独立 schema `GroupChatUserEmotionSchema`（`primaryEmotion` 11 态 / `intensity` / `needsComfort` / `needsAdvice` / `needsDeescalation` / `socialEnergy` / `reason`），三法轮询，失败回 `buildFallbackGroupUserEmotion`（关键词兜底），`signal.aborted` 向上抛不吞。**不复用单聊 `ConversationEmotion`**——`needsAdvice` / `socialEnergy` 是打分直接要用的信号，单聊 schema 没有。
- 关系阶段：`getRelationshipStageFromMessageCount` 用一对一消息数 4 档启发式（`>=80` close_bond / `>=30` trusted / `>=8` warming_up / else new_connection），`getRelationshipScore` 映射到分值。**非完整关系阶段模型**（不复用单聊 8 态 LLM 链路），是有意保留的轻量边界。
- 新鲜度：从 `recentMessages` 取最近 18 条 agent 消息，`freshnessScore = max(0, min(1, lastSpokeTurnsAgo/6) - min(0.75, recentReplyCount*0.16))`；刚发过话（`lastSpokeTurnsAgo===0`）打分再 -0.9，避免连续抢话。
- `buildGroupSpeakingContext`：纯函数、无 LLM、无 DB，`userEmotion` 缺省用关键词兜底。`detectEmotion` 节点调它，结果进 `state.speakingContext`，喂 `selectAgents` 的 prompt（`formatSpeakingContextForPrompt`）。
- 打分 fallback `scoreAgentForFallbackSelection`：`relationshipScore*1.6 + freshnessScore*1.8 - recentReplyCount*0.45`，再按 `needsComfort/needsAdvice/needsDeescalation` 匹配人设关键词加分。`selectAgentsForReply` 升级为「点名优先 → 有上下文则打分排序 → 缺上下文退回关键词」，新增可选 `speakingContext` / `agentRecordsById` 参数（打分要人设文本，来自 `UserAgentRecord`）。
- 降级一致性：**整图失败的 `runFallbackOrchestration` 也构造上下文再打分**（情绪走关键词兜底），不留「有时打分有时纯关键词」的分叉。`orchestration.speakingContext` 落 metadata。

> **Warning**（打分需人设文本）：`GroupChatMemberWithAgentRow` 只有 `name/headline/imageKey`，没有 persona/tone/guardrails。打分的情绪-人设关键词匹配依赖 `agentRecordsById` 里的完整 `UserAgentRecord`。fallback 路径必须先备好该 map 再打分，否则人设匹配项恒不加分，退化成只看关系/新鲜度。
