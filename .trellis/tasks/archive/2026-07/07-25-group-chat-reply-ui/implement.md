# 群聊回复与前端交互 执行计划

按顺序实现，每完成一段跑对应验证。后端先行（契约 → provider → reply → repository → service → route），前端后接（api → query → 组件）。

## 后端

### 1. Contract（packages/contracts/src/chat/group-chat.contract.ts + index.ts）

- [ ] 加 `SendAgentGroupChatMessageRequestSchema`（`message` trim 1-2000，不含 llmConfig / groupChatId）。
- [ ] 加 `SendAgentGroupChatMessageResponseSchema`（`userMessage` + `agentMessages[]` + `groupChat`，复用 `AgentGroupChatMessageSchema` / `AgentGroupChatListItemSchema`）。
- [ ] 导出两个 schema + `SendAgentGroupChatMessageRequest` / `SendAgentGroupChatMessageResponse` 类型，并确认从 `packages/contracts/src/index.ts` 透出。
- 验证：`pnpm --filter @repo/contracts type-check`（无则 `pnpm -w exec tsc --noEmit`）。

### 2. provider（apps/api/src/modules/group-chat/group-chat.provider.ts 新建）

- [ ] `createGroupChatText({ messages, providerConfig, signal }): Promise<string>`：`stream:false` POST `{baseURL}/chat/completions`，解析 `choices[0].message.content`。
- [ ] 超时 90s → `AppError(SYSTEM_UPSTREAM_TIMEOUT, 504)`；连接失败 → `AppError(SYSTEM_INTERNAL_ERROR, 503)`；非 2xx / 空 content → `AppError(SYSTEM_INTERNAL_ERROR, 503)`（照 `chat.provider.ts` 的 `createCompanionTextStream` 错误映射）。
- [ ] 复用 `ChatCompletionMessage` / `ChatProviderConfig`（从 `chat.service.ts` import）。
- 风险：response schema 用 zod 校验 `choices[0].message.content` 为非空字符串，避免上游异常结构。

### 3. reply（apps/api/src/modules/group-chat/group-chat.reply.ts 新建）

- [ ] `groupReplyAgentLimit = 3` 常量。
- [ ] `selectAgentsForReply({ agents, userText })`：点名 → 群体关键词 `/(你们|大家|一起|分别|都说|怎么看|意见)/` → 默认单个，切上限 3，保持 displayOrder。
- [ ] `buildAgentReply({ providerConfig, groupChat, agent, allAgents, recentMessages, userText, activeMemories, signal })`：拼 system（角色 + 群聊约束 + 只该 agent 记忆）+ user（标题 / 其他成员 / 简介 / 最近历史 / userText），调 `createGroupChatText`。
- [ ] `formatGroupHistory(recentMessages)` 辅助函数。
- 约束：记忆只用传入的 `activeMemories`（调用方按 agentId 查），禁止跨 agent。

### 4. repository（group-chat.repository.ts 改）

- [ ] `insertGroupChatMessages({ database, messages })`：`db.batch` 批量插 `agent_group_chat_messages`。
- [ ] `updateGroupChatStats({ database, groupChatId, addedCount, lastMessageAtMs })`：`message_count += addedCount`、`last_message_at_ms`、`updated_at_ms`，summary 不动。
- [ ] `NewGroupChatMessage` 类型（id/groupChatId/senderType/agentId/content/status/turnIndex/metadataJson/createdAtMs）。
- 复用 `getGroupChatWithMemberCount` 拿响应用列表项。

### 5. service（group-chat.service.ts 改）

- [ ] `sendGroupChatMessage({ bindings, groupChatId, userId, message, signal })` 按 design 编排：归属校验 → active 成员（`listActiveMembers`，仅展示列）→ recent 历史 → turnIndex → 用户消息 → `selectAgentsForReply` → 补拉人设 `listOwnedUserAgentsByIds({ userId, agentIds: selected.map(m => m.agentId) })` 建 `Map<agentId, UserAgentRecord>` → for 循环顺序生成（按 agentId 取完整人设记录传 `buildAgentReply.agent`，`listActiveAgentMemories` limit 6，逐个 try/catch，失败落 `status:'failed'` + 占位文案）→ `insertGroupChatMessages` 批量 → `updateGroupChatStats` → 查列表项 → present 返回。
- [ ] 关键：`listActiveMembers` 返回的成员行没有 `defaultPrompt/personaPrompt/tonePrompt/guardrailsPrompt/description`，必须用 `listOwnedUserAgentsByIds` 补拉 `UserAgentRecord` 才能构造人设 prompt。
- [ ] provider 用 `resolveActiveLlmProviderConfig(bindings)` 解析一次，循环复用，`model`/`providerName` 写 metadata。
- [ ] 无 active 成员：跳过生成，返回空 agentMessages，仍写用户消息 + 更新统计。
- 硬约束：禁用 `Promise.all`，必须 for 循环把 `agentMsgs` 累积进下一轮 recentMessages。同轮 agent 消息 `createdAtMs` 递增去重。

### 6. route（group-chat.route.ts 改）

- [ ] `.post('/rpc/chat/group/:groupChatId/send', requireWebAccess, zValidator('param', groupChatParamsSchema), zValidator('json', SendAgentGroupChatMessageRequestSchema), handler)`。
- [ ] handler 调 `sendGroupChatMessage`，`buildSuccess` + `SendAgentGroupChatMessageResponseSchema.parse`，传 `c.req.raw.signal`。

后端验证：`pnpm --filter api type-check` + `pnpm --filter api lint`。手测：新建群聊 → 发普通消息（1 个回复）→ 发「你们怎么看」（多个回复）→ 点名某 agent（精准回复）。

## 前端（apps/web）

### 7. api（group-chat.api.ts 改）

- [ ] `sendGroupChatMessage(groupChatId, payload)` → `http.post<SendAgentGroupChatMessageResponse>`。
- [ ] `getGroupChatMessages(groupChatId, cursor)` → `http.get<AgentGroupChatMessagesResponse>`（分页拉更早）。

### 8. query（group-chat.query.ts 改）

- [ ] `sendGroupChatMessageMutationOptions(queryClient)`：onMutate 乐观插用户消息进 `detail.recentMessages`；onSuccess 用真实 userMessage/agentMessages 替换 + `groupChat` 用服务端值 + invalidate list；onError 回滚 previous。
- [ ] 注意：`chat.query.ts` 与整个 `apps/web/src` 均无 onMutate 先例，乐观更新按 react-query 标准 `onMutate/onError/onSuccess` 自写，别去找先例照抄。

### 9. 组件（group-chat-workspace.tsx 改 MessageColumn）

- [ ] 底部占位「发送框将在后续版本接入」换成受控 `<textarea>` + 发送按钮：Enter 发送、Shift+Enter 换行、空串禁发、pending 禁用 + loading。
- [ ] `MessageColumn` 收 `groupChatId`，内部 `useMutation`，草稿 state 在组件内，onError 回调 `setDraft(message)`。
- [ ] 历史分页：消息区顶部「加载更早消息」，本地存 `nextCursor`，点击调 `getGroupChatMessages`，去重 prepend 进 `detail.recentMessages`，`nextCursor` 为 null 隐藏按钮。
- [ ] `status==='failed'` 气泡加失败标记。

前端验证：`pnpm --filter web type-check` + `pnpm --filter web lint`。

## 最终质量门（全量）

- [ ] `pnpm -w type-check`（或各包 tsc --noEmit）零错误。
- [ ] `pnpm -w lint` 零错误。
- [ ] `pnpm -w format`（prettier --check）通过。
- [ ] 手测四条链路：普通消息单回复 / 群体提问多回复 / 点名精准回复 / 失败回滚 + 草稿恢复 / 加载更早消息。

## 回滚点

- 后端：删 `group-chat.provider.ts`、`group-chat.reply.ts`，还原 repository/service/route 新增段，撤契约导出。
- 前端：还原 `MessageColumn` 占位，删 api/query 新增。
- 无迁移改动，无数据结构残留。
