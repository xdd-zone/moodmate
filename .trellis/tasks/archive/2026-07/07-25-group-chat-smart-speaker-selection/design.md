# 智能发言权判断 — 技术设计

## 1. 架构总览

能力全部落在 API 编排层，前端协议（`agentMessages` 数组）与 UI 不变。改动分四块：

1. 仓库层：`listActiveMembers` 加 `leftJoin(agentConversations)`，成员行带一对一会话统计。
2. 新文件 `group-chat.speaking.ts`：发言权上下文类型、关系阶段/新鲜度推导、`buildGroupSpeakingContext`、fallback 打分 `scoreAgentForFallbackSelection`。
3. `group-chat.orchestration.ts`：新增 `GroupChatUserEmotionSchema` + 情绪 prompt + `buildFallbackGroupUserEmotion` + `detectEmotion` 节点，图结构插入该节点，选择器 prompt 纳入发言权上下文，state 增 `userEmotion`/`speakingContext`。
4. `group-chat.reply.ts`：`selectAgentsForReply` 升级为「点名优先 + 打分排序」，新增可选 `speakingContext` 参数。

## 2. 数据流

```
listActiveMembers(带会话统计)
   -> orchestrate: state.agents
classifyIntent -> detectEmotion -> selectAgents -> generateReplies -> generateCrossReplies -> checkQuality
                       |               |
                       v               v
             buildGroupSpeakingContext  LLM 选择器 prompt 注入 speakingContext
             (userEmotion + agentContexts)  失败 -> selectionFromLocalRules
                                                      -> selectAgentsForReply(带 speakingContext 打分)
```

整图 invoke 抛错 -> `runFallbackOrchestration`：先 `buildGroupSpeakingContext`（情绪走关键词兜底），再 `selectAgentsForReply` 打分。

## 3. 仓库层改动（group-chat.repository.ts）

`GroupChatMemberWithAgentRow` 增两字段：

```ts
conversationMessageCount: number;      // coalesce 到 0
conversationLastMessageAtMs: number | null;
```

`listActiveMembers` select 增：

```ts
conversationMessageCount: sql<number>`coalesce(${agentConversations.messageCount}, 0)`,
conversationLastMessageAtMs: agentConversations.lastMessageAtMs,
```

并 `leftJoin(agentConversations, and(eq(userId), eq(agentId)))`。走已有 `agent_conversations_user_agent_idx` 索引。presenter 不透传这两字段给前端契约。

## 4. 发言权上下文（group-chat.speaking.ts，新文件）

### 4.1 类型

```ts
export type GroupChatUserEmotion = { /* 见 orchestration schema 推导类型 */ };

export interface AgentSpeakingContext {
  agentId: string;
  conversationMessageCount: number;
  recentReplyCount: number;
  lastSpokeTurnsAgo: number | null;
  relationshipStage: "new_connection" | "warming_up" | "trusted" | "close_bond";
  relationshipScore: number;
  freshnessScore: number;
}

export interface GroupSpeakingContext {
  userEmotion: GroupChatUserEmotion;
  agentContexts: AgentSpeakingContext[];
}
```

`GroupChatUserEmotion` 类型从 orchestration 的 schema 推导后 import，避免两处定义。为防循环依赖：schema 定义在 orchestration，speaking 只 import 其 `type`（type-only import 不产生运行时环）。若 tsc 仍报环，则把 `GroupChatUserEmotionSchema` 下沉到 speaking，orchestration 反向 import。实现时以 type-only 优先。

### 4.2 关系阶段（消息数 4 档）

```ts
getRelationshipStageFromMessageCount(count): >=80 close_bond / >=30 trusted / >=8 warming_up / else new_connection
getRelationshipScore(stage): close_bond 0.95 / trusted 0.78 / warming_up 0.52 / new_connection 0.25
```

### 4.3 新鲜度

从 `recentMessages` 取 `senderType==='agent' && agentId` 的最近 18 条。对每个 Agent：

```ts
lastSpokeTurnsAgo = lastMsg ? max(0, maxTurnIndex - lastMsg.turnIndex) : null
freshnessBase = lastSpokeTurnsAgo === null ? 1 : min(1, lastSpokeTurnsAgo / 6)
freshnessPenalty = min(0.75, msgsByAgent.length * 0.16)
freshnessScore = max(0, round2(freshnessBase - freshnessPenalty))
recentReplyCount = msgsByAgent.length
```

### 4.4 buildGroupSpeakingContext

入参 `{ agents, recentMessages, userText, userEmotion? }`，返回 `GroupSpeakingContext`。`userEmotion` 缺省时用 `buildFallbackGroupUserEmotion(userText)`（从 orchestration import）。纯函数、无 LLM。

### 4.5 fallback 打分 scoreAgentForFallbackSelection

```ts
score = 0
if (context) {
  score += relationshipScore * 1.6
  score += freshnessScore * 1.8
  score -= recentReplyCount * 0.45
  if (lastSpokeTurnsAgo === 0) score -= 0.9
}
if (needsComfort && /温柔|陪伴|情绪|安慰|稳定|倾听|治愈|共情/.test(profileText)) score += 2.4
if (needsAdvice && /理性|分析|建议|计划|复盘|清醒|判断|策略/.test(profileText)) score += 2.1
if (needsDeescalation && /克制|边界|冷静|稳定|成熟|安全/.test(profileText)) score += 2.2
```

`profileText` 由 agent 的 headline + description + persona/tone/guardrails 拼接。注意 `GroupChatMemberWithAgentRow` 只有 `name/headline/imageKey`，人设文本需从 `agentRecordsById` 取 `UserAgentRecord`。打分函数入参需能拿到人设，见 §7。

## 5. 情绪识别（orchestration.ts）

`GroupChatUserEmotionSchema`：`primaryEmotion`(neutral/happy/sad/anxious/angry/lonely/stressed/confused/romantic/playful/unknown) + `intensity`(0-1) + `needsComfort`/`needsAdvice`/`needsDeescalation`(bool) + `socialEnergy`(low/medium/high) + `reason`(≤400)。

独立 prompt：只判断情绪与陪伴需求，不生成回复、不选 Agent。`detectGroupUserEmotionWithLangChain` 沿用 `STRUCTURED_OUTPUT_METHODS` 三法轮询，失败 -> `buildFallbackGroupUserEmotion`（关键词兜底，规则见草稿）；`signal.aborted` 向上抛不吞。

## 6. 图与 state 改动

state 增：`userEmotion: GroupChatUserEmotion | null`、`speakingContext: GroupSpeakingContext | null`。

`detectEmotion` 节点：调 `detectGroupUserEmotionWithLangChain`，再 `buildGroupSpeakingContext`，返回 `{ userEmotion, speakingContext }`。

图结构：`classifyIntent -> detectEmotion -> selectAgents -> generateReplies -> generateCrossReplies -> checkQuality`。

选择器 prompt 增 human 变量 `{speakingContext}`（格式化文本：用户主情绪/强度/是否需安慰/是否需建议/是否需降温/社交能量；每个 Agent 的关系阶段/一对一消息数/最近发言次数/距上次发言轮数/新鲜度），system 增发言权决策原则（情绪低落选稳定温柔关系熟的、需分析选理性的、情绪激烈选边界感强的、高社交能量选活泼的、最近发言多的降权）。

## 7. selectAgentsForReply 升级（reply.ts）

签名增可选：

```ts
selectAgentsForReply(input: {
  agents: GroupChatMemberWithAgentRow[];
  userText: string;
  speakingContext?: GroupSpeakingContext;
  agentRecordsById?: Record<string, UserAgentRecord>;  // 打分要人设文本
})
```

逻辑：点名（name 命中）仍最优先，命中则直接返回（截断到 limit）。非点名场景：有 `speakingContext` + `agentRecordsById` 则打分排序（`score desc, displayOrder asc`）取前 limit（群体提问关键词命中时 limit=3，否则 1）；缺上下文则退回原关键词逻辑（保持向后兼容）。

调用点：
- `selectionFromLocalRules`（orchestration）：从 `state.speakingContext` + `state.agentRecordsById` 传入。
- `runFallbackOrchestration`：整图失败，先 `buildGroupSpeakingContext`（userEmotion 用 `buildFallbackGroupUserEmotion`）再传入。

## 8. metadata

`orchestration` 对象增 `speakingContext`（落 `sendGroupChatMessage` 的 metadataJson）。service 的 `orchestration` 类型增该字段，`OrchestrateGroupChatRepliesParams` 结果 `GroupChatOrchestrationResult` 增 `speakingContext: GroupSpeakingContext | null`。

## 9. 降级矩阵

| 失败点 | 行为 |
| --- | --- |
| 情绪 LLM 失败 | `buildFallbackGroupUserEmotion` 关键词兜底，上下文照常构建 |
| 选择器 LLM 失败 | `selectionFromLocalRules` -> 带上下文打分 |
| 整图 invoke 抛错 | `runFallbackOrchestration` -> 构造上下文 + 打分 |
| `signal.aborted` | 各处向上抛，不吞成兜底 |

## 10. 不改动

- 前端契约、UI、presenter 对前端的输出。
- 数据库表 / 迁移。
- `generateReplies` / `generateCrossReplies` / `checkQuality` 的核心逻辑（仅 state 多传字段）。
