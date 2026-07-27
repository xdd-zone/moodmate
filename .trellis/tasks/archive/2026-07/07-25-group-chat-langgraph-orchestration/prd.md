# LangGraph 回复编排

## Goal

把群聊 v1 的关键词规则发言权（`selectAgentsForReply`）升级为一张可观察、可降级的 LangGraph 图：
`classifyIntent -> selectAgents -> generateReplies -> checkQuality`。让"谁该回复、单人还是多人、串行还是并行、回复是否越界"变成可解释的编排步骤，同时保证任一节点或整图失败都回退到 v1 规则，基础群聊不受影响。

对应父任务子任务 3（草稿 `docs/temp/58`）。

## Background

### 现状（reply-ui 已交付）

- `group-chat.reply.ts`：`selectAgentsForReply`（点名→群体提问关键词→默认第一个）、`buildAgentReply`（单条回复生成，走 `createGroupChatText` 原生 fetch，非结构化）、`formatGroupHistory`、`groupReplyAgentLimit = 3`、`GROUP_QUESTION_PATTERN = /你们|大家|一起|分别|都说|怎么看|意见/`。
- `group-chat.service.ts` 的 `sendGroupChatMessage`：串行 for 循环生成，metadata 写 `selectedBy: "v1_rules"`。每个 Agent 只注入自己的一对一记忆（`listActiveAgentMemories`，limit 6）。
- 回复历史窗口 `REPLY_HISTORY_LIMIT = 20`。

### 可复用范式（`chat.analysis.ts`）

- LangGraph 范式已成熟：`Annotation.Root` 定义状态、`buildLangChainChatModel`、`withStructuredOutput` + 多 method 循环回退、每节点 normalize + fallback、整图 try/catch 兜底。
- 结构化输出方式为**固定顺序** `STRUCTURED_OUTPUT_METHODS = ["functionCalling","jsonSchema","jsonMode"]`，逐个尝试直到成功，失败落 fallback。

### 与草稿的关键偏离（以本项目现状为准）

- moodmate 的 `ChatProviderConfig`（= `CompanionChatLlmConfig` + `disableThinking`）**只有** `providerName/baseURL/model/apiKey/disableThinking`。草稿里的 `wireApi/reasoningEffort/useResponsesApi/zdrEnabled` 字段**不存在**。
- 因此草稿的 `getStructuredOutputMethods`（按 `wireApi` 在 `jsonSchema`/`functionCalling` 间切优先级）和 `buildLangChainChatModel`（含 `useResponsesApi`/`reasoning`/`zdrEnabled`）**不照搬**，直接复用 `chat.analysis.ts` 的固定 method 顺序与最简 model 构造。草稿代码片段仅作逻辑与命名参考。

## Requirements

- R1 新建群聊编排模块 `apps/api/src/modules/group-chat/group-chat.orchestration.ts`，导出 `orchestrateGroupChatReplies`，内部是 LangGraph 图。
- R2 状态对象 `GroupChatOrchestrationState`（`Annotation.Root`）承载输入上下文（providerConfig/groupChat/agents/recentMessages/userMessage/userText/agentMemoriesByAgentId/signal）与各节点产物（intent/selection/selectedAgents/replies/quality）。
- R3 `classifyIntent` 节点：结构化输出用户群聊意图（意图枚举、目标 Agent 名、是否多人、回复模式 single/multi_serial/multi_parallel、置信度、原因）；带 `normalizeGroupChatIntent` 归一化，只在明确多人表达时放开多人、多人默认串行、置信度夹在 0-1。
- R4 `selectAgents` 节点：结构化输出被选中的 `selectedAgentIds`（≤ `groupReplyAgentLimit`）+ mode + 原因；`normalizeAgentSelection` 校验 id 真实存在，非法则回退 `selectAgentsForReply`。
- R5 `generateReplies` 节点：按 mode 分流——`multi_parallel` 用 `Promise.all` 并发生成（各 Agent 互不可见）；`single`/`multi_serial` 串行生成，后一个 Agent 能看到前面 Agent 尚未落库的计划回复（拼进 recentMessages）。回复生成继续用 `buildAgentReply`（自由文本，不结构化）。
- R6 `checkQuality` 节点：LLM 结构化检查群聊安全与体验边界（是否暴露系统提示/技术元数据、冒充真人、替他人发言、过长说教刷屏、偏离意图、违反角色边界），返回 `approved/score/issues/revisions/reason`。保守应用：仅当某 Agent 有非空 `revision` 文本时替换其回复，否则保留原文；节点失败落 `quality = null`，回复原样保留。
- R7 结构化输出适配复用 `chat.analysis.ts` 的固定 `STRUCTURED_OUTPUT_METHODS` 循环回退，不引入 `wireApi`。
- R8 全链路降级：意图判断失败→本地规则意图；Agent 选择失败→`selectAgentsForReply`；整图 try/catch 失败→本地规则选择 + 直接生成。回退路径产出与正常路径同构（都能落库、写 metadata）。
- R9 `sendGroupChatMessage` 改为调用 `orchestrateGroupChatReplies`；Agent 回复 metadata 从 `selectedBy: "v1_rules"` 升级为 `selectedBy: "langgraph_v1"`，并写入 orchestration 轨迹（intent/selection/quality/model）。
- R10 记忆隔离不变：每个 Agent 只注入自己与用户的一对一记忆。硬上限不变：一轮最多 3 个 Agent。
- R11 `selectAgentsForReply`/`buildAgentReply` 保留为 fallback 与生成器，不删除。

## Acceptance Criteria

- [ ] 普通消息默认 1 个 Agent 回复；群体提问触发多个（≤3）Agent 回复。
- [ ] 明确"分别/各自"类意图走并行，其余多人走串行；串行时后发 Agent 能感知先发 Agent 的回复内容。
- [ ] classifyIntent / selectAgents / checkQuality 任一结构化输出失败，回退到对应本地规则，群聊仍能正常返回回复数组。
- [ ] 整图 invoke 抛错时，`sendGroupChatMessage` 仍用 v1 规则完成本轮回复并落库。
- [ ] selectAgents 返回不存在的 agentId 时被过滤，最终选择仅含真实群成员且 ≤3。
- [ ] 每个 Agent 回复只注入自己的一对一记忆，无跨 Agent 污染。
- [ ] Agent 消息 `metadata_json` 含 `selectedBy: "langgraph_v1"` 与 intent/selection/quality/model 轨迹。
- [ ] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 全绿。

## Out of Scope

- 流式返回（本批次一律非流式，返回完整数组）。
- Agent 间互相追问/补充（子任务 4 cross-agent-replies）。
- 情绪/关系阶段驱动发言权（子任务 5 smart-speaker）。
- @ 提及识别（子任务 6 mentions）。
- 真正的 LangGraph 条件边/分支图（本版保持线性）。
- 群聊级长期记忆、后台编排分析页。
- 引入 `wireApi`/Responses API 适配。
- 群聊 `summary` 生成：现状 `updateGroupChatStats` 不动 `summary`，本任务保持不变，专注编排。草稿 58 流程图末步的"更新群聊摘要"不在本任务范围。

## Notes

- 命名取 `group-chat.orchestration.ts`（贴合父任务 orchestration 语义），对齐 chat 模块 `chat.analysis.ts` 的分层位置。
- 回复生成节点复用 `createGroupChatText`（自由文本）；仅三个决策节点用 LangChain 结构化输出。
