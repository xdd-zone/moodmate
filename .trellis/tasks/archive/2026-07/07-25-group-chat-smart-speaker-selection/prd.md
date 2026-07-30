# 智能发言权判断

## Goal

把群聊发言权判断从「点名 + 关键词」升级为「多信号上下文调度」：在选 Agent 之前先做一次轻量用户情绪识别，把 Agent 人设、关系阶段、最近发言频率、用户情绪汇总成发言权上下文，同时喂给 LLM 选择器和本地打分 fallback。点名仍然优先，但不再是非点名场景的唯一依据。能力全部发生在 API 编排层，前端协议与 UI 不变。

对应草稿：`docs/temp/60-agent-group-chat-smart-speaker-selection.txt`。

## Background

当前群聊编排（`apps/api/src/modules/group-chat/`）已是 LangGraph 图：
`classifyIntent -> selectAgents -> generateReplies -> generateCrossReplies -> checkQuality`。

- 选择器 `selectGroupAgentsWithLangChain` 只看意图 + 成员名单；本地 fallback `selectAgentsForReply`（`group-chat.reply.ts`）是纯关键词：点名 → 群体提问关键词 → 默认第一个。
- `listActiveMembers`（`group-chat.repository.ts:206`）只 `innerJoin(userAgents)`，未带一对一会话统计。
- `agent_conversations` 表（`agents.schema.ts`）已有 `messageCount`、`lastMessageAtMs`，可推导关系阶段，无需新迁移。
- `GroupChatMessageWithAgentRow` 已有 `turnIndex`，可算「距上次发言几轮」。
- 落库 metadata 的 `orchestration` 对象（`group-chat.service.ts`）当前含 `intent/selection/quality/crossReplyPlan`，缺 `speakingContext`。

moodmate 单聊 `chat.analysis.ts` 已有成熟 LLM 版关系阶段（8 态）与情绪链路，但绑定 companion 单聊体系，群聊 Agent 走独立 `agent_conversations`。本任务按草稿采用轻量版，不复用单聊复杂链路（见 Out of Scope）。

## Requirements

### R1 会话统计接入（走 A：改共享查询）

- `listActiveMembers` 加 `leftJoin(agentConversations)`（`userId` + `agentId` 双条件）。
- `GroupChatMemberWithAgentRow` 新增 `conversationMessageCount`（`coalesce(..., 0)`）与 `conversationLastMessageAtMs`。
- presenter（`presentMember` / `presentMessage`）不透传这两个字段给前端契约。
- 理由：`agent_conversations_user_agent_idx` 已存在，left join 走索引成本低，省一次 round-trip；其他调用方多两列无害。

### R2 关系阶段（消息数 4 档启发式）

- `getRelationshipStageFromMessageCount`：`>=80 close_bond` / `>=30 trusted` / `>=8 warming_up` / else `new_connection`。
- `getRelationshipScore`：`0.95 / 0.78 / 0.52 / 0.25`。
- 从 `conversationMessageCount` 直接推导，不复用单聊 8 态 LLM 关系阶段链路。理由：父任务 Out of Scope 已限定这版保持轻量；草稿《60》明确关系阶段暂从消息数推导是有意保留的边界；单聊那套链路绑死 companion 单用户体系，复用要拆耦合，违背最短路径。

### R3 用户情绪识别（群聊专用轻量 schema）

- 新建 `GroupChatUserEmotionSchema`：`primaryEmotion`（11 态）+ `intensity` / `needsComfort` / `needsAdvice` / `needsDeescalation` / `socialEnergy`（low/medium/high）/ `reason`。
- 配套独立情绪 prompt + `detectGroupUserEmotionWithLangChain`（三法结构化输出轮询，AbortSignal 取消向上抛）+ `buildFallbackGroupUserEmotion` 关键词兜底。
- 不复用单聊 `ConversationEmotion`。理由：`needsAdvice`/`socialEnergy` 是打分直接要用的信号，单聊 schema 没有；单聊的 `valence`/`arousal`/`secondaryEmotions` 群聊用不上；与本模块已有 `GroupChatIntentSchema` 风格一致。
- 落点偏离（实现确认）：`GroupChatUserEmotionSchema` / 情绪 prompt / `buildFallbackGroupUserEmotion` 下沉到 `group-chat.speaking.ts`，`orchestration.ts` 只保留 `detectGroupUserEmotionWithLangChain`（跑 LLM）与 `detectEmotionNode`（进图）。原计划放 orchestration，但 `buildGroupSpeakingContext` 缺省情绪要调 `buildFallbackGroupUserEmotion`，若留 orchestration 则 speaking↔orchestration 双向 import 成运行时环。下沉后依赖单向 `orchestration -> speaking`，彻底无环（design.md §4.1 已预留此回退）。

### R4 发言权上下文（新文件 group-chat.speaking.ts）

- 新建 `group-chat.speaking.ts`，放：`AgentSpeakingContext` / `GroupSpeakingContext` 类型、`getRelationshipStageFromMessageCount` / `getRelationshipScore`、`buildGroupSpeakingContext`（纯函数：新鲜度 + 关系阶段汇总）、`scoreAgentForFallbackSelection`。
- 情绪 schema / prompt / detectEmotion 节点因要进图，留在 `orchestration.ts`。
- 上下文含每 Agent：关系阶段、`conversationMessageCount`、`recentReplyCount`、`lastSpokeTurnsAgo`、`relationshipScore`、`freshnessScore`；含用户：主情绪 / 强度 / 需求（安慰/建议/降温）/ 社交能量。

### R5 detectEmotion 节点入图

- 图升级为 `classifyIntent -> detectEmotion -> selectAgents -> generateReplies -> generateCrossReplies -> checkQuality`。
- state 增 `userEmotion` / `speakingContext`；`detectEmotionNode` 调情绪识别后 `buildGroupSpeakingContext` 写入 state。

### R6 选择器 + fallback 升级

- LLM 选择器 prompt 加 `{speakingContext}` 变量与「情绪/关系/发言频率」决策原则。
- `selectAgentsForReply`（reply.ts）增可选 `speakingContext` / `agentRecordsById`：点名优先不变，非点名从关键词升级为打分排序。
- 打分（`scoreAgentForFallbackSelection`）：`relationshipScore*1.6 + freshnessScore*1.8 - recentReplyCount*0.45`，刚发言过 `-0.9`；再按情绪-人设关键词匹配加分（needsComfort/needsAdvice/needsDeescalation）。

### R7 fallback 上下文兜底（走 A）

- `selectionFromLocalRules`（节点内兜底）从 state 取 `speakingContext` 传入。
- `runFallbackOrchestration`（整图失败，detectEmotion 没跑）先 `buildGroupSpeakingContext`（情绪走关键词兜底版）再打分，保证两条 fallback 路径行为一致。

### R8 metadata 追踪

- `GroupChatOrchestrationResult` 增 `speakingContext`；service 落库 metadata 的 `orchestration` 记录 `speakingContext`。

## Acceptance Criteria

- [ ] 图结构为 `classifyIntent -> detectEmotion -> selectAgents -> ...`，选 Agent 前已有完整发言权上下文。
- [ ] 情绪识别为独立轻量结构化节点，LLM 失败本地启发式兜底，不阻塞选择。
- [ ] 发言权上下文含每 Agent 关系阶段 / 一对一消息数 / 最近发言次数 / 距上次发言轮数 / 新鲜度，及用户主情绪 / 强度 / 陪伴需求 / 社交能量。
- [ ] 非点名场景 fallback 为打分排序；点名仍优先。
- [ ] LLM 选择器 prompt 纳入情绪、关系阶段、发言频率信号。
- [ ] 整图失败的 fallback 路径也走打分（情绪用关键词兜底），不退回纯关键词。
- [ ] Agent 消息 metadata 的 `orchestration` 记录 `speakingContext`。
- [ ] 前端协议与 UI 不变（仍返回 `agentMessages` 数组），会话统计字段不进契约。
- [ ] 任一节点或整图失败仍能回退返回回复。
- [ ] 通过类型检查 → lint → format。

## Out of Scope

- 复用单聊 `chat.analysis.ts` 的完整关系阶段 / 情绪链路（跨 companion/agent 体系，成本高）。
- embedding / 分类器做能力匹配（父任务已排除，仅用关键词 + 启发式打分）。
- 用户级群聊互动强度偏好（安静 / 均衡 / 热闹）。
- 长期发言统计（只看最近一段群聊消息）。
- 前端展示发言权上下文 / 后台编排分析页。
- 新增数据库表或迁移。

## Notes

- 草稿是 bobo 单文件 `group.route.ts` 写法；moodmate 按模块化分层落点（见 design.md）。
- 硬上限沿用父任务：每轮最多 `groupReplyAgentLimit = 3` 个 Agent 回复，打分排序后 `slice(0, limit)`。
