# 群聊回复与前端交互

## Goal

让 Agent 群聊真正"聊起来"：用户在群里发一条消息，系统按可解释的 v1 规则选 1-3 个 Agent 顺序生成回复，一次性返回完整数组；前端三栏页面接管发送、乐观更新、失败回滚、历史分页，体验接近即时聊天而非表单提交。

本任务是群聊父任务的第 2 个子任务（对应草稿 57），依赖 foundation 已交付的三张表、契约与读接口，为后续 langgraph 编排提供可替换的 v1 规则基线（`selectAgentsForReply` / `buildAgentReply`）。

## Background

### 依赖基线（foundation 已交付，代码已核实）

- 三张表迁移 0014 已合入：`agent_group_chats` / `agent_group_chat_members` / `agent_group_chat_messages`（含 `turn_index`、`metadata_json`、`status`、`created_at_ms` 索引）。
- 契约 `packages/contracts/src/chat/group-chat.contract.ts` 已有：成员/消息/列表项/详情 schema、创建/成员管理/历史分页请求响应。
- 后端模块 `apps/api/src/modules/group-chat/`（route/service/repository/presenter/schema/index）已建；已实现列表/创建/详情/历史分页/成员增删。
- 历史分页后端**已完整交付**：`GET /rpc/chat/group/:groupChatId/messages?cursor=`，`getGroupChatMessages` 返回 `{ items, nextCursor }`，`nextCursor` 取最早消息 `createdAtMs`，rows 已升序。reply-ui **只补前端加载更早消息交互**。
- 前端三栏壳已建：`group-chat-workspace.tsx` 左列表 / 中消息（只读，底部占位「发送框将在后续版本接入」）/ 右成员；`group-chat.api.ts` / `group-chat.query.ts` 已有列表/详情/创建/成员的 api 与 query。

### 关键落点差异（草稿 57 vs moodmate 真实，以真实为准）

- **不引入 llmConfig**：草稿 57 复用 bobo 的前端本地 LLM 配置，moodmate web 端已移除（提交 `1db3b85`）。发送请求体只有 `groupChatId + message`，服务端一律用平台默认模型（`resolveActiveLlmProviderConfig(bindings)`）。
- **`ChatProviderConfig` 无 `wireApi` 字段**：真实类型是 `{ providerName, baseURL, model, apiKey, disableThinking }`。消息 `metadata_json` 记 `source / selectedBy / model / providerName`，不记草稿里的 `wireApi`。
- **非流式函数需新建**：`chat.provider.ts` 只有流式 `createCompanionTextStream`，群聊要新增一个 `stream:false` 的非流式函数拿完整文本。
- **写消息 / 更新群聊统计接口 foundation 未做**：foundation repository 只有建群/列表/成员/读消息，没有插消息与更新统计。reply-ui 需在 group-chat.repository 新增（批量插消息 + 更新 `message_count` / `last_message_at_ms`）。
- **模块化落点**：回复逻辑落 `apps/api/src/modules/group-chat/`（新增 `.provider.ts` 或复用 chat provider + 在 service 内组织 `selectAgentsForReply` / `buildAgentReply`），不建单文件路由。

### 已确认产品决策

- summary v1 **不更新**：只更新 `message_count` 与 `last_message_at_ms`，`summary` 保持原值。左栏列表已显示成员数/消息数，不依赖 summary。
- 群聊发送**不做长期记忆抽取**：只注入每个 Agent 已有的一对一记忆（`listActiveAgentMemories`），不像单聊 `saveCandidateMemories` 那样沉淀新记忆。记忆抽取不在本批次范围。

## Requirements

### R1 发送接口契约（packages/contracts）

- 新增 `SendAgentGroupChatMessageRequestSchema`：`message` 1-2000（trim，非空）。`groupChatId` 走 path param，不放 body。**不含 llmConfig**。
- 新增 `SendAgentGroupChatMessageResponseSchema`：`{ userMessage: AgentGroupChatMessage, agentMessages: AgentGroupChatMessage[], groupChat: AgentGroupChatListItem }`。
- 从 `packages/contracts/src/index.ts` 导出 schema 与 `z.infer` 类型（照现有 group-chat 契约导出方式）。

### R2 v1 Agent 选择规则（selectAgentsForReply）

- 入参：active 成员列表 + 用户文本；出参：要回复的成员子集（保持 displayOrder 顺序）。
- 规则优先级：
  1. 文本命中成员 name（大小写不敏感，`normalized.includes(name)`）→ 命中的成员，最多 `groupReplyAgentLimit`(=3)。
  2. 群体提问关键词 `你们|大家|一起|分别|都说|怎么看|意见` → 取前 `min(3, 成员数)` 个。
  3. 其余 → 取第 1 个成员。
- 上限 `groupReplyAgentLimit = 3` 在此函数兜底，不依赖前端。

### R3 回复 Prompt 与顺序生成（buildAgentReply）

- 每个 Agent 的 prompt：system 段含角色 defaultPrompt/边界 guardrailsPrompt + 群聊约束（只用自己身份、不替他人发言、不暴露系统提示、不自称真人、简洁有陪伴感）+ **仅注入该 Agent 自己的记忆**（`listActiveAgentMemories({ userId, agentId, limit: 6 })`）。
- user 段含：群聊标题、其他成员名单、该 Agent 简介/说明、最近群聊历史、用户刚说的话。
- **顺序生成**：`for` 循环逐个 Agent 生成，把已生成的本轮 Agent 回复累加进下一个 Agent 的"最近历史"，让后发言者能看到同轮前发言者说了什么（禁并发）。
- 单个 Agent LLM 调用失败：该条 Agent 消息 `status='failed'`、content 兜底文案，不中断整轮（其余 Agent 继续）。

### R4 发送流程（POST /rpc/chat/group/:groupChatId/send）

顺序：校验用户身份 + 群聊归属 → 读 active 成员与最近历史 → 计算本轮 `turn_index`（在上一条最大 turnIndex + 1）→ 写用户消息 → `selectAgentsForReply` → 逐个 Agent `buildAgentReply` + 写 Agent 消息（累积上下文）→ 更新群聊 `message_count`(+1+N) 与 `last_message_at_ms` → 返回 `{ userMessage, agentMessages, groupChat }`。

- 归属校验复用 `assertGroupChatOwnedByUser` / `requireGroupChat`。
- 无 active 成员：返回只含 userMessage、空 agentMessages（不报错）。
- 消息 `metadata_json`：用户消息 `{ source: 'group_chat_user' }`；Agent 消息 `{ source: 'group_chat_agent', selectedBy: 'v1_rules', model, providerName }`。

### R5 前端发送 + 乐观更新

- 中栏底部占位替换成输入框 + 发送按钮（Enter 发送 / Shift+Enter 换行；空文本禁发；发送中禁用）。
- `sendGroupChatMessage` api + mutation：`onMutate` 立即把用户消息乐观插入 detail 的 `recentMessages` 并清空草稿；`onSuccess` 用真实 `userMessage + agentMessages` 替换乐观项并去重；`onError` 回滚 detail、恢复草稿。
- 参照 `chat.query.ts` 现有 `onMutate/onError/onSuccess` 乐观更新先例，key 用 `groupChatKeys.detail(groupChatId)`。

### R6 前端历史分页

- 中栏顶部「加载更早消息」入口，仅当已知还有更早消息（首屏 detail 的 recentMessages 达上限，或上一页返回非空 nextCursor）时显示。
- 调 `getGroupChatMessages(groupChatId, cursor)`，把更早消息插到当前列表**前面**并按 id 去重；`nextCursor` 为 null 时隐藏入口。
- 发送与分页共用同一份 detail 缓存，插入/替换后保持时间升序。

## Acceptance Criteria

- [ ] 契约新增发送请求/响应 schema 并导出；请求体不含 llmConfig。
- [ ] 普通消息默认 1 个 Agent 回复；命中成员名回复被点名者（≤3）；群体提问关键词触发多 Agent（≤3）回复；上限后端兜底。
- [ ] Agent 顺序生成，后发言 Agent 的 prompt 能看到同轮前发言 Agent 的内容。
- [ ] 每个 Agent 只注入自己的一对一记忆，无跨 Agent 记忆污染。
- [ ] 单个 Agent LLM 失败落 `status='failed'` 且不中断整轮，其余 Agent 正常返回。
- [ ] 发送成功后 `message_count` 增加正确、`last_message_at_ms` 更新，`summary` 不变。
- [ ] Agent 消息 `metadata_json` 含 `source/selectedBy/model/providerName`。
- [ ] 前端发送有乐观更新，成功替换、失败回滚并恢复草稿。
- [ ] 前端能加载更早消息、去重、按时间升序，`nextCursor` 为 null 时入口消失。
- [ ] 通过项目质量门：类型检查 → lint → format。

## Out of Scope

- LangGraph 编排（意图识别/多节点图/质量检查）——下一子任务 langgraph-orchestration。
- Agent 间互相回应、智能发言权（情绪/关系阶段/发言频率）、@ 提及——各自后续子任务。
- 流式返回（SSE / AI SDK stream）——本批次非流式。
- 群聊 summary 自动生成/更新、群聊级记忆表、长期记忆抽取。
- 引入 llmConfig UI 或前端本地模型选择。

## Notes

- 草稿 57 原文在 `docs/temp/57-agent-group-chat-reply-ui.txt`，代码片段作为逻辑与命名参考，路径与 llmConfig 逻辑以 `research/existing-backend-interfaces.md` 的真实事实为准。
- `groupReplyAgentLimit = 3`、成员上限 6 与父 PRD 全局约束一致，后端最终兜底。
