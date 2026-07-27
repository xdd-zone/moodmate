# LangGraph 回复编排 执行计划

## 前置

- 依赖已就位：`apps/api/package.json` 有 `@langchain/core` / `@langchain/langgraph` / `@langchain/openai`（catalog）。
- 参考范式：`apps/api/src/modules/chat/chat.analysis.ts`（StateGraph / Annotation.Root / withStructuredOutput / 固定 method 顺序 / 逐节点降级）。
- 硬约束：`groupReplyAgentLimit = 3`（已在 `group-chat.reply.ts:13` 导出）；每个 Agent 只注入自己的记忆；全链路降级回 v1 规则。

## 实现顺序

### 1. 新增 `group-chat.orchestration.ts`

落点 `apps/api/src/modules/group-chat/group-chat.orchestration.ts`。

- [ ] 定义 `GroupChatIntentSchema` / `GroupChatAgentSelectionSchema` / `GroupChatReplyQualitySchema`（见 design.md）及对应 `z.infer` 类型 `GroupChatIntent` / `GroupChatAgentSelection` / `GroupChatReplyQuality`。
- [ ] 定义 `PlannedAgentReply` 类型与 `GroupChatOrchestrationState = Annotation.Root({...})`。
- [ ] `buildLangChainChatModel(providerConfig)`：照抄 `chat.analysis.ts:311`，不加 wireApi/reasoning 分支。
- [ ] `STRUCTURED_OUTPUT_METHODS = ["functionCalling", "jsonSchema", "jsonMode"] as const`。
- [ ] intent prompt（`groupChatIntentPrompt`，ChatPromptTemplate）：给群聊标题/摘要/Agent 名单/最近历史/用户本轮消息，只输出结构化结果。
- [ ] `normalizeGroupChatIntent(intent, userText)`：多人表达归一化、mode 归一化、confidence 夹紧、targetAgentNames 去重截断。
- [ ] `buildFallbackGroupChatIntent({ agents, userText })`：用关键词逻辑推 intent。
- [ ] `classifyGroupIntentNode`：循环 method 调 `withStructuredOutput`，全失败落 fallback。
- [ ] selection prompt + `normalizeAgentSelection`（校验 id 真实存在、去重截断、空则回 `selectAgentsForReply`）+ `selectGroupAgentsNode`。
- [ ] `generateGroupRepliesNode`：按 `selection.mode` 并行/串行调 `buildAgentReply`；串行把已生成回复拼进 recentMessages；单条失败标 `failed` 不阻断。
- [ ] quality prompt + `checkGroupReplyQualityNode`：结构化检查，保守应用 revision（仅非空文本替换），失败落 `quality = null`。
- [ ] 组装 `groupChatOrchestrationGraph`（START->classifyIntent->selectAgents->generateReplies->checkQuality->END）并 `.compile()`。
- [ ] 导出 `orchestrateGroupChatReplies(params)`：顶层 try/catch，整图失败时用 fallback intent + `selectAgentsForReply` + 直接 `buildAgentReply` 兜底；返回 `{ intent, selection, replies, quality }`。

### 2. 改 `group-chat.reply.ts`

- [ ] `buildAgentReply` 增加可选入参 `intent?: GroupChatIntent` 与 `selectionReason?: string`，在 `buildUserPrompt` 里注入「本轮群聊意图 / 你被选中的原因」两段（可选，缺省不加）。保持向后兼容（现有 service 调用不传也能编译）。
- [ ] `selectAgentsForReply` 保持不变（作 fallback）。

### 3. 改 `group-chat.service.ts`

- [ ] `sendGroupChatMessage`：保存点前逻辑不变。
- [ ] 进图前预取：对全体活跃成员 `listActiveAgentMemories`（limit 6）组 `agentMemoriesByAgentId`；`listOwnedUserAgentsByIds` 组 `agentRecordsById`；`resolveGroupChatProviderConfig`。
- [ ] 调 `orchestrateGroupChatReplies`，用返回的 `replies` 映射 `agentRows`（含 status），删除原「selectAgentsForReply + 手写 for 循环 buildAgentReply」段。
- [ ] `metadata_json` 写 `selectedBy: "langgraph_v1"` + `orchestration: { intent, selection, quality }`（降级路径写 `"v1_rules_fallback"`）。
- [ ] 落库、`updateGroupChatStats`、返回结构不变。

## 验证命令

按项目质量门顺序（根目录）：

```bash
pnpm check-types
pnpm lint
pnpm format:check
```

三项全绿才算完成。只修本任务引入的问题，原有问题列出告知，不顺手改。

## 手动验证（dev）

`pnpm dev:api` 后，用已有群聊（≥2 Agent）打 `POST /rpc/chat/group/:id/send`：

- [ ] 普通消息（如「今天好累」）：默认 1 个 Agent 回复。
- [ ] 群体提问（「你们怎么看」）：多个（≤3）Agent 回复。
- [ ] 点名（「@某Agent」文本或直接叫名字）：该 Agent 优先回复。
- [ ] 查库看 `agent_group_chat_messages.metadata_json`：含 `orchestration.intent/selection/quality`。
- [ ] 临时把 baseURL 改错模拟 LLM 失败：仍能按 v1 规则返回回复（降级生效）。

## 风险与回滚点

- 风险文件：`group-chat.service.ts`（改动最大，涉及落库主链路）。回滚只需还原 `sendGroupChatMessage` 内编排段，`group-chat.orchestration.ts` 为纯新增可整体删除。
- 记忆预取范围从「选中 Agent」扩到「全体成员」，确认 `listActiveAgentMemories` 按 agentId 隔离，无跨 Agent 污染。
- 串行回复拼装 planned message 时，字段要凑齐 `GroupChatMessageWithAgentRow`，避免 prompt 渲染 undefined。
