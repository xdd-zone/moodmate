# LangGraph 回复编排 技术设计

## 架构与边界

把 reply-ui 阶段的规则版发言权（`selectAgentsForReply`）升级为一张线性 LangGraph 图，图产出「参与回复的 Agent + 每条回复内容 + 编排轨迹」。`sendGroupChatMessage` 负责落库与统计，不承担编排逻辑。

新增单文件 `apps/api/src/modules/group-chat/group-chat.orchestration.ts`，地位对齐 `modules/chat/chat.analysis.ts`：图定义、节点、结构化输出、归一化、降级都在这一个文件里。

图结构（线性，与草稿 58 一致）：

```
START -> classifyIntent -> selectAgents -> generateReplies -> checkQuality -> END
```

对外只导出一个入口：

```ts
orchestrateGroupChatReplies(params): Promise<GroupChatOrchestrationResult>
```

### 职责切分

- `group-chat.orchestration.ts`（新增）：意图判断、Agent 选择、回复生成调度、质量检查、全链路降级。
- `group-chat.reply.ts`（改）：`buildAgentReply` 扩展可选入参（intent / 被选中原因），把编排信号注入回复 prompt；`selectAgentsForReply` 保留为 fallback，不删。
- `group-chat.service.ts`（改）：`sendGroupChatMessage` 把「选 Agent + 逐个生成回复」的手写循环替换为一次 `orchestrateGroupChatReplies` 调用；落库、统计、越权校验保持不变。
- `group-chat.provider.ts`：不改，回复生成继续走 `createGroupChatText`（fetch，非结构化）。

## 关键偏离草稿 58

草稿 58 基于 bobo 的 `ChatProviderConfig`，含 `wireApi` / `reasoningEffort` / `useResponsesApi` / `zdrEnabled`，并据此按协议选结构化输出优先级。**modmate 的 `ChatProviderConfig` 没有这些字段**（只有 `providerName` / `baseURL` / `model` / `apiKey` / `disableThinking`，见 `chat.service.ts:75` 与 `companion-chat.contract.ts:15`）。

因此：

- 不引入 `wireApi` 分支和 Responses API 逻辑。
- `buildLangChainChatModel` 用最简构造（`model` / `apiKey` / `temperature: 0` / `configuration.baseURL`），与 `chat.analysis.ts:311` 完全一致。
- 结构化输出方法用固定顺序 `["functionCalling", "jsonSchema", "jsonMode"]` + 每 method 循环回退，与 `chat.analysis.ts:29` 一致，不按协议分优先级。

## 状态设计

```ts
const GroupChatOrchestrationState = Annotation.Root({
  providerConfig: Annotation<ChatProviderConfig>(),
  groupChat: Annotation<AgentGroupChatRecord>(),
  agents: Annotation<GroupChatMemberWithAgentRow[]>(),        // 当前活跃成员，按 displayOrder
  recentMessages: Annotation<GroupChatMessageWithAgentRow[]>(),
  userMessage: Annotation<GroupChatMessageWithAgentRow>(),
  userText: Annotation<string>(),
  agentMemoriesByAgentId: Annotation<Record<string, AgentMemoryRecord[]>>(),
  agentRecordsById: Annotation<Record<string, UserAgentRecord>>(), // 生成回复需要的人设字段
  intent: Annotation<GroupChatIntent | null>(),
  selection: Annotation<GroupChatAgentSelection | null>(),
  selectedAgents: Annotation<GroupChatMemberWithAgentRow[]>(),
  replies: Annotation<PlannedAgentReply[]>(),
  quality: Annotation<GroupChatReplyQuality | null>(),
  signal: Annotation<AbortSignal>(),
});
```

`PlannedAgentReply = { agent: GroupChatMemberWithAgentRow; content: string; status: "completed" | "failed" }`。

设计取舍：memory 与 agentRecord 在进图前由 service 预取好塞进状态（service 已持有 DB binding），图内节点不碰数据库，只做纯计算与 LLM 调用。这样图可测、无副作用，降级也简单。

## 节点设计

### 1. classifyIntent

结构化 schema（贴合草稿 58）：

```ts
const GroupChatIntentSchema = z.object({
  intent: z.enum([
    "direct_mention", "group_opinion", "emotional_support", "planning",
    "roleplay", "casual_chat", "conflict_repair", "memory_or_preference", "unknown",
  ]),
  targetAgentNames: z.array(z.string().trim().min(1).max(120)).max(6),
  shouldUseMultipleAgents: z.boolean(),
  replyMode: z.enum(["single", "multi_serial", "multi_parallel"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().max(500),
});
```

`normalizeGroupChatIntent`：把 LLM 输出拉回产品规则——只有出现明确多人表达（`shouldUseMultipleAgents` 或 `targetAgentNames > 1` 或命中 `/你们|大家|一起|分别|都说|怎么看|意见/`）才允许多人；多人默认 `multi_serial`，除非模型明确 `multi_parallel`；`confidence` 夹到 0-1；`targetAgentNames` 去重截断到 6。

失败降级：`buildFallbackGroupChatIntent`，用 `selectAgentsForReply` 的关键词逻辑推出 intent。

### 2. selectAgents

结构化 schema：

```ts
const GroupChatAgentSelectionSchema = z.object({
  selectedAgentIds: z.array(z.string().trim().min(1)).min(1).max(groupReplyAgentLimit),
  mode: z.enum(["single", "multi_serial", "multi_parallel"]),
  reason: z.string().trim().max(500),
});
```

`groupReplyAgentLimit = 3`（复用 `group-chat.reply.ts` 已导出的常量，父 PRD 硬上限）。

`normalizeAgentSelection`：校验 `selectedAgentIds` 是否真实存在于当前成员（`agentById.has`），去重、截断到 3；若过滤后为空，回退到 `selectAgentsForReply` 本地规则。这是「模型可参与判断，但不能突破系统边界」的工程护栏。

失败降级：`selectAgentsForReply` + intent 推出的 mode。

### 3. generateReplies

按 `selection.mode` 决定生成方式，两种都调用现有 `buildAgentReply`（走 `createGroupChatText`，非结构化）：

- `multi_parallel`：`Promise.all` 并行，每个 Agent 只看 `[...recentMessages, userMessage]`，互不依赖。
- `single` / `multi_serial`：顺序 `await`，把已生成但未落库的回复拼进 `recentMessages` 传给下一个 Agent（reply-ui 的 service 已用同一手法），形成群聊接力。

单个 Agent 生成失败：该条 `status = "failed"`、`content = AGENT_REPLY_FALLBACK`，不阻断其他 Agent（保持 reply-ui 现有容错）。

### 4. checkQuality（LLM 结构化 + 保守 revision）

结构化 schema：

```ts
const GroupChatReplyQualitySchema = z.object({
  approved: z.boolean(),
  score: z.number().min(0).max(1),
  issues: z.array(z.string().trim().max(160)).max(6),
  revisions: z.array(z.object({
    agentId: z.string().trim().min(1),
    content: z.string().trim().max(4000),
  })).max(groupReplyAgentLimit),
  reason: z.string().trim().max(500),
});
```

检查群聊安全与体验边界：是否暴露系统提示/技术元数据、是否冒充真人、是否替其他 Agent 发言、是否过长说教刷屏、是否偏离意图、是否违反角色边界。

保守应用：只有当某 Agent 有非空 `revision` 文本时才替换原回复，否则保留原文，避免质检模型过度干预。质检节点失败：`quality = null`，回复原样保留。

## 结构化输出与降级

三个决策节点（intent / selection / quality）复用 `chat.analysis.ts` 范式：`ChatPromptTemplate.pipe(model.withStructuredOutput(schema, { name, method }))`，method 走固定顺序循环，全失败落 fallback。

**全链路降级**（父 PRD 硬约束）：

1. 单节点内失败 -> 该节点 fallback（intent/selection 回 v1 规则，quality 回 null）。
2. 整图 `invoke` 抛错 -> `orchestrateGroupChatReplies` 顶层 `try/catch`：用 `buildFallbackGroupChatIntent` + `selectAgentsForReply` 选 Agent，直接 `buildAgentReply` 生成回复，`quality = null` 返回。保证 LangGraph 挂掉时基础群聊仍能回。

## 数据流与集成点

`sendGroupChatMessage` 改动（`group-chat.service.ts:397-499`）：

1. 保存点前不变：`requireGroupChat` -> `listActiveMembers` -> `listGroupChatMessages`(REPLY_HISTORY_LIMIT) -> 构造 `userRow` / `turnIndex`。
2. 预取上下文：对每个成员 `listActiveAgentMemories`（`AGENT_MEMORY_INJECTION_LIMIT = 6`，按 Agent 隔离），`listOwnedUserAgentsByIds` 取人设记录，组成 `agentMemoriesByAgentId` / `agentRecordsById`。
3. 调 `orchestrateGroupChatReplies`，拿回 `{ intent, selection, replies, quality }`。
4. 把 `replies` 映射为 `agentRows`，落库、更新统计（同现有逻辑）。
5. `metadata_json` 写编排轨迹。

预取记忆的时机变化：现状是「选完 Agent 再按需取记忆」，改为「进图前对全体成员预取」。代价是可能给未被选中的 Agent 也取了记忆（一次群聊最多 6 个，每个 limit 6，可接受），换来图内无副作用。

## metadata

Agent 回复 `metadata_json`（父 PRD acceptance 要求记录编排轨迹）：

```ts
JSON.stringify({
  source: "group_chat_agent",
  selectedBy: "langgraph_v1",   // 降级时写 "v1_rules_fallback"
  model: providerConfig.model,
  providerName: providerConfig.providerName,
  orchestration: { intent, selection, quality },
})
```

## 契约与兼容性

- **契约零改动**：`SendAgentGroupChatMessageResponse` 结构不变（仍是 `userMessage` + `agentMessages[]` + `groupChat`）。编排轨迹只进 `metadata_json`（内部字段，不在契约暴露）。
- **前端零改动**：响应形态不变，reply-ui 的三栏页面与乐观更新照常工作。
- **DB 零改动**：不加表、不改 schema。`summary` 字段本任务不动（scope 决策）。
- **单聊零改动**：`chat.analysis.ts` 及单聊链路不碰，编排范式是复制小函数而非改 chat 模块导出。

## 取舍

- 图保持线性、不用条件边：当前只需把关键词规则升级为可解释编排，条件边留给后续 cross-agent / smart-speaker 子任务。
- 生成回复不走结构化输出：回复是自由文本，只有决策节点需要结构化，避免无谓的 function calling 开销。
- 记忆预取全体成员：用少量多余查询换图的纯函数性与降级简单性。
