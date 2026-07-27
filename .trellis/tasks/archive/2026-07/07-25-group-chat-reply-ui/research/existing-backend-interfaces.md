# reply-ui 依赖的现有后端接口（源码核对）

本文件是对 group-chat-foundation、chat、agents、llm-config 现有产物的实测核对。已直接读源码确认签名，纠正了规划期传闻里的接口名错误。以草稿 57 里的 bobo 命名（`insertAgentGroupChatMessage`、`wireApi` 字段等）为逻辑参考，不作为落点依据。

## 1. Provider 配置（平台默认，不引入 llmConfig）

- 解析入口：`resolveActiveLlmProviderConfig(bindings)`，位于 `apps/api/src/modules/llm-config/llm-config.service.ts:217`，从 `index.ts` 导出。
  - 读 D1 里 active 的一条 LLM 配置，解密 apiKey，返回 `ActiveLlmProviderConfig`。
  - 没有 active 配置时抛 `AppError(BizCode.SYSTEM_INTERNAL_ERROR, "尚未配置可用模型…", 503)`。
- 类型：`ChatProviderConfig`（`apps/api/src/modules/chat/chat.service.ts:75`）：
  ```ts
  interface ChatProviderConfig extends CompanionChatLlmConfig {
    disableThinking: boolean;
  }
  // 字段：providerName / baseURL / model / apiKey / disableThinking
  ```
- 关键更正：**没有 `wireApi` 字段**。草稿 57 与规划期传闻里的 `wireApi` 是 bobo 结构，moodmate 不存在。群聊消息 metadata 记 `model` + `providerName` 即可，不要写 `wireApi`。
- 单聊 `resolveProviderConfig(bindings)`（chat.service.ts:1079）就是薄封装 `resolveActiveLlmProviderConfig` + `normalizeBaseURL`。群聊照抄这个模式：直接调 `resolveActiveLlmProviderConfig`，baseURL 去尾斜杠。父 PRD 明确不引入前端 `llmConfig`，所以不接收第二参。

## 2. 非流式 LLM 调用（必须新增）

- 现有 `apps/api/src/modules/chat/chat.provider.ts` 只有 `createCompanionTextStream`（流式，返回 `ReadableStream<Uint8Array>`，`stream:true`）。
- 群聊要非流式一次拿完整文本，**必须新增**一个函数（建议放 `modules/group-chat/group-chat.provider.ts`）：
  - `POST ${baseURL}/chat/completions`，body `{ model, messages, stream:false, ...(disableThinking ? {thinking:{type:'disabled'}} : {}) }`。
  - 解析 `choices[0].message.content`（用 zod safeParse，照 provider 里 `DeepSeekStreamChunkSchema` 的严谨度）。
  - 超时 `UPSTREAM_TIMEOUT_MS = 90_000` + `AbortController` + `AbortSignal.any([signal, timeout])`，错误映射照 `createCompanionTextStream`：超时 → `SYSTEM_UPSTREAM_TIMEOUT` 504；连不上/非 2xx/空 body → `SYSTEM_INTERNAL_ERROR` 503。
- header：`authorization: Bearer <apiKey>`、`content-type: application/json`。

## 3. Agent 维度记忆注入（已就绪）

- `listActiveAgentMemories({ agentId, userId, database, limit })`，位于 `apps/api/src/modules/agents/agents.repository.ts:113`。
  - 按 `userId + agentId + status='active'` 查，`ORDER BY importance DESC, updatedAtMs DESC LIMIT limit`。
  - 返回 `agentMemories` 行（含 `content`、`importance` 等）。
- 每个 agent 只查自己的记忆，天然满足父 PRD「记忆隔离」。回复循环里每个 agent 单独调一次。

## 4. group-chat foundation 已交付 / 未交付（重要更正）

已交付（`apps/api/src/modules/group-chat/group-chat.repository.ts`）：

- `insertGroupChatWithMembers` — 建群 + 批量插成员（db.batch）。
- `listGroupChatsForUser` / `getGroupChatById` / `getGroupChatWithMemberCount`。
- `listActiveMembers({ database, groupChatId })` → `GroupChatMemberWithAgentRow[]`（join userAgents 只取 name/headline/imageKey/displayOrder，**没有人设 prompt 字段**）。
  - **关键缺口**：`buildAgentReply` 要 `defaultPrompt/personaPrompt/tonePrompt/guardrailsPrompt/description`，这些只在 `user_agents` 表（`UserAgentRecord`）里，成员行拿不到。send 编排必须对选中成员按 `agentId` 调 `listOwnedUserAgentsByIds({ userId, agentIds })` 补拉完整人设，再按 agentId 关联。`listOwnedUserAgentsByIds` 顺带做归属校验（返回数量 < 请求数量即有越权），成员本就来自本群 active，正常全部命中。
- `listGroupChatMessages({ database, groupChatId, limit, cursor? })` → `GroupChatMessageWithAgentRow[]`（desc 取 limit 条后 `.reverse()` 成正序；cursor 是 `createdAtMs`，取 `< cursor`）。
- `countActiveMembers` / `listAllMembers` / `getMaxDisplayOrder` / `addOrReviveMembers` / `removeMember`。

**未交付（reply-ui 必须新增到 repository）**：

- 写消息：foundation **没有** insert 消息的函数（规划期传闻的 `insertGroupChatMessages` 不存在）。reply-ui 新增 `insertGroupChatMessages`（批量插一轮：1 条 user + N 条 agent，用 `db.batch`）。
- 更新群聊统计：foundation **没有** `updateGroupChatAfterMessage`。reply-ui 新增，更新 `messageCount`（+本轮条数）、`lastMessageAtMs`、`updatedAtMs`。按已定决策 **v1 不动 summary**。
- 消息表 `agentGroupChatMessages` schema 已在 foundation 建好（`group-chat.schema.ts`），直接复用。

Service（`group-chat.service.ts`）已交付：`listGroupChatsForUser` / `createGroupChatForUser` / `getGroupChatDetail` / `getGroupChatMessages` / `addGroupChatMembers` / `removeGroupChatMember`；越权校验 `assertOwnedAgents`（内部用 `listOwnedUserAgentsByIds`）。reply-ui 新增 `sendGroupChatMessage`。

Presenter（`group-chat.presenter.ts`）已交付：`presentListItem` / `presentMember` / `presentMessage` / `presentDetail`。`presentMessage` 接收 `GroupChatMessageWithAgentRow`，reply-ui 拼响应时复用。

Route（`group-chat.route.ts`）已交付 6 端点（GET list、POST create、GET detail、GET messages、POST members、DELETE member）。reply-ui 追加 `POST /rpc/chat/group/:groupChatId/send`。

## 5. Contract（`packages/contracts/src/chat/group-chat.contract.ts`）

已有：Member / Message / ListItem / Detail schema + 创建/列表/详情/历史/成员增删的 req/resp，全部从 `index.ts` 导出。

reply-ui 新增（不含 llmConfig）：

- `SendAgentGroupChatMessageRequestSchema`：`{ message: z.string().trim().min(1).max(<上限>) }`（groupChatId 走 path param，不放 body）。
- `SendAgentGroupChatMessageResponseSchema`：`{ userMessage: AgentGroupChatMessageSchema, agentMessages: AgentGroupChatMessageSchema[], groupChat: AgentGroupChatListItemSchema }`。
- 复用现有 `AgentGroupChatMessageSchema` / `AgentGroupChatListItemSchema`，从 `index.ts` 导出新 schema/type。

## 6. 前端落点（`apps/web`）

- 三栏壳已建：`apps/web/src/components/group-chat/group-chat-workspace.tsx`。消息列底部现在是占位 `发送框将在后续版本接入`（workspace 内 `MessageColumn`），reply-ui 替换成发送框 + 乐观更新，并把 `recentMessages` 渲染升级为支持追加/去重/加载更早。
- 数据层：`apps/web/src/api/group-chat.api.ts`（已有 get/create/add/remove）+ `group-chat.query.ts`（已有 keys：all/list/detail/messages，及三个 mutation options）。reply-ui 新增 `sendGroupChatMessage` api + `sendGroupChatMessageMutationOptions`（onMutate 乐观更新 / onError 回滚 / onSuccess 替换）+ `getGroupChatMessages`(游标) api + 加载更早消息逻辑。
- 乐观更新先例：**没有**。`chat.query.ts` 与整个 `apps/web/src` 都无 onMutate（现有 mutation 只 onSuccess invalidate）。reply-ui 是首个乐观更新，按标准 react-query 三段式自建，不要引用不存在的先例。
- 路径别名 `@/src/...`；UI 依赖约束（无 Dialog/Avatar/ScrollArea，用手写遮罩 + `<span>`+lucide + 原生 overflow）foundation 已按此实现，reply-ui 沿用。
- `AgentGroupChatMessagesResponseSchema` 里 foundation 已定 `nextCursor`。核对：contract 里 messages 响应用的是 `{ items, nextCursor }`，前端加载更早消息 prepend + 按 id 去重。
