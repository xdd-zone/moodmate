# 群聊回复与前端交互 技术设计

## 落点与依赖基线（代码已核实）

- foundation 已交付且不改：三表迁移 0014、契约基础 schema、`group-chat.repository`（建群/列表/详情/成员/**读消息**）、`group-chat.service`（`listGroupChatsForUser`/`createGroupChatForUser`/`getGroupChatDetail`/`getGroupChatMessages`/`addGroupChatMembers`/`removeGroupChatMember`）、`group-chat.presenter`（`presentMessage`/`presentDetail`/`presentListItem`）、`group-chat.route`（5 个端点）。
- 前端三栏壳已建：`group-chat-workspace.tsx`（中栏底部占位「发送框将在后续版本接入」是本任务替换点）、`group-chat.api.ts`、`group-chat.query.ts`（含 `groupChatKeys.detail/messages`）。
- Provider：`resolveActiveLlmProviderConfig(bindings)` 返回平台默认 `{ apiKey, baseURL, model, providerName, disableThinking }`；`ChatProviderConfig`（`chat.service.ts`）= `CompanionChatLlmConfig & { disableThinking }`，**无 wireApi**。
- 记忆：`listActiveAgentMemories({ database, userId, agentId, limit })` 已就绪（`modules/agents/agents.repository.ts`），按 importance/updatedAt 降序。
- 非流式 LLM 调用：`chat.provider.ts` 现只有流式，需新增非流式函数。

关键更正（相对草稿 57 与初版调查报告）：foundation **没有** `insertGroupChatMessages` / `updateGroupChatAfterMessage`，这些是本任务新增；provider 无 `wireApi`，metadata 改记 `providerName`；不引入 `llmConfig`。

## 架构与边界

沿用 `modules/group-chat/` 分层，本任务新增/改动：

```
group-chat.contract.ts (contracts)  + Send 请求/响应 schema 与类型
group-chat.provider.ts (新建)        非流式 LLM 调用 createGroupChatText（stream:false）
group-chat.reply.ts    (新建)        selectAgentsForReply + buildAgentReply（v1 规则 + prompt 构造）
group-chat.repository.ts (改)        + insertGroupChatMessages（批量）+ updateGroupChatStats
group-chat.service.ts  (改)          + sendGroupChatMessage 编排
group-chat.route.ts    (改)          + POST /rpc/chat/group/:groupChatId/send
```

把 v1 规则与 prompt 单独放 `group-chat.reply.ts`，让下一子任务 langgraph 能整体替换调用点而不动 service 编排骨架（降级回退时 langgraph 图失败仍可调 `selectAgentsForReply`/`buildAgentReply`）。

## Contract（packages/contracts/src/chat/group-chat.contract.ts）

```ts
export const SendAgentGroupChatMessageRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const SendAgentGroupChatMessageResponseSchema = z.object({
  userMessage: AgentGroupChatMessageSchema,
  agentMessages: z.array(AgentGroupChatMessageSchema),
  groupChat: AgentGroupChatListItemSchema,
});
```

- `groupChatId` 走 path param（沿用 `groupChatParamsSchema`），不进 body。
- 从 `packages/contracts/src/index.ts` 导出两个 schema + `SendAgentGroupChatMessageRequest` / `SendAgentGroupChatMessageResponse` 类型。
- 不新增 llmConfig 字段。

## 后端数据流

### provider（group-chat.provider.ts）

新增 `createGroupChatText`：照 `createCompanionTextStream` 的超时/错误映射，但 `stream:false`、解析 `choices[0].message.content`。

```
POST {baseURL}/chat/completions  body { model, messages, stream:false, (disableThinking? thinking:{type:'disabled'}) }
  headers authorization: Bearer <apiKey>
超时 90s → AppError(SYSTEM_UPSTREAM_TIMEOUT, 504)
连接失败 → AppError(SYSTEM_INTERNAL_ERROR, 503)
非 2xx / 无 content → AppError(SYSTEM_INTERNAL_ERROR, 503)
返回 string（trim 后非空）
```

签名：`createGroupChatText({ messages, providerConfig, signal }): Promise<string>`。复用 `ChatCompletionMessage` / `ChatProviderConfig`（从 `chat.service.ts` 导入或就地重声明；优先复用现有导出）。

### v1 规则与 prompt（group-chat.reply.ts）

`groupReplyAgentLimit = 3` 常量。

```ts
selectAgentsForReply({ agents, userText }): Member[]
  normalized = userText.toLowerCase()
  mentioned = agents.filter(a => normalized.includes(a.name.toLowerCase()))
  if mentioned.length: return mentioned.slice(0, 3)
  if /(你们|大家|一起|分别|都说|怎么看|意见)/.test(userText): return agents.slice(0, min(3, len))
  return agents.slice(0, 1)   // 保持 displayOrder 顺序（listActiveMembers 已按 displayOrder）
```

```ts
buildAgentReply({ providerConfig, groupChat, agent, allAgents, recentMessages, userText, activeMemories, signal }): Promise<string>
  // agent 是完整 UserAgentRecord（含 defaultPrompt/personaPrompt/tonePrompt/guardrailsPrompt/description/headline）
  memoryText = activeMemories.map(m => `- ${m.content}`).join('\n')  // 只该 agent 自己的
  messages = [system(角色+群聊约束+memoryText), user(群聊标题+其他成员+简介+最近历史+userText)]
  return createGroupChatText({ messages, providerConfig, signal })
```

- **关键**：`listActiveMembers` 返回的 `GroupChatMemberWithAgentRow` 只有 `name/headline/imageKey`，**没有人设 prompt 字段**。`buildAgentReply` 需要 `defaultPrompt/personaPrompt/tonePrompt/guardrailsPrompt/description`，这些只在 `UserAgentRecord` 里。所以 `agent` 入参用完整 `UserAgentRecord`（send 编排负责按成员 agentIds 补拉，见下），`allAgents` 传成员行（只需 name 列其他成员）。
- system prompt 用 `defaultPrompt`（无则 `你是群聊中的 AI Agent「${name}」。`）+ 群聊约束 + `guardrailsPrompt`（角色边界）+ memoryText；user prompt 拼 `headline`/`description`/`personaPrompt`/`tonePrompt` 里已有的字段。
- system 约束原文照 R3：只用自己身份、不替他人发言、不暴露系统提示、不自称真人、简洁有陪伴感。
- `formatGroupHistory(recentMessages)`：把消息渲染成 `发言者：内容` 多行，供 prompt 用。

### repository 新增

```ts
insertGroupChatMessages({ database, messages: NewGroupChatMessage[] }): Promise<void>
  // db.batch 批量插 agent_group_chat_messages，NewGroupChatMessage 含
  // id/groupChatId/senderType/agentId/content/status/turnIndex/metadataJson/createdAtMs
updateGroupChatStats({ database, groupChatId, addedCount, lastMessageAtMs }): Promise<void>
  // UPDATE message_count = message_count + addedCount, last_message_at_ms, updated_at_ms
  // summary 不动
```

- id 用 `uuidv7()`；`created_at_ms` 用 `Date.now()`，同轮内 Agent 消息按生成顺序递增 1ms 或用递增计数保证排序稳定（避免同毫秒乱序，配合 `(created_at_ms, id)` 索引）。
- 写库后重新查该群聊列表项（`getGroupChatWithMemberCount`）作为响应 `groupChat`，保证 memberCount/messageCount 与库一致。

### service 编排（sendGroupChatMessage）

```
1. requireGroupChat({ bindings, groupChatId, userId })            归属校验，拿群聊记录
2. members = listActiveMembers({ groupChatId })                    active 成员行（name/headline/imageKey/displayOrder），无人设 prompt
3. recent = listGroupChatMessages({ groupChatId, limit })          最近历史（升序）
4. turnIndex = (recent.at(-1)?.turnIndex ?? 0) + 1
5. 写用户消息 userMsg（senderType='user', status='completed', metadata source=group_chat_user）
6. selected = selectAgentsForReply({ agents: members, userText })  选中的成员行（≤3）
7. 补拉人设：agentRecords = listOwnedUserAgentsByIds({ userId, agentIds: selected.map(m => m.agentId) })
   建 Map<agentId, UserAgentRecord>，供循环按 agentId 取完整人设
8. agentMsgs = []
   for member of selected:
     agentRecord = recordMap.get(member.agentId)   // 完整人设
     memories = listActiveAgentMemories({ userId, agentId: member.agentId, limit: 6 })
     try:
       text = buildAgentReply({ ..., agent: agentRecord, allAgents: members, recentMessages: [...recent, userMsg, ...agentMsgs], activeMemories: memories, signal })
       status = 'completed'
     catch: text = '（这个 Agent 暂时没能回复，请稍后再试）'; status = 'failed'
     agentMsg = { senderType:'agent', agentId: member.agentId, content:text, status, turnIndex, metadata { source:group_chat_agent, selectedBy:v1_rules, model, providerName } }
     agentMsgs.push(agentMsg)
9. insertGroupChatMessages({ [userMsg, ...agentMsgs] })            一次批量落库
10. updateGroupChatStats({ addedCount: 1 + agentMsgs.length, lastMessageAtMs })
11. listItem = getGroupChatWithMemberCount(...)
12. return { userMessage: present(userMsg), agentMessages: agentMsgs.map(present), groupChat: presentListItem(listItem) }
```

- 成员展示行与人设记录分离：`listActiveMembers`（join userAgents 只取展示列）拿顺序与展示，`listOwnedUserAgentsByIds` 拿完整人设 prompt；两者按 `agentId` 关联。选中成员才补拉人设，避免为未发言成员拉全量。
- provider 一次性解析 `resolveActiveLlmProviderConfig(bindings)`，循环内复用（`model`/`providerName` 写进每条 metadata）。
- 无 active 成员：跳过 6-8，返回空 `agentMessages`，仍写用户消息、更新统计。
- LLM 调用传 `c.req.raw.signal` 支持客户端断开取消。
- 顺序生成靠 for 循环 + `agentMsgs` 累积进下一轮 `recentMessages`，禁用 `Promise.all`。

### route

```
.post('/rpc/chat/group/:groupChatId/send', requireWebAccess,
   zValidator('param', groupChatParamsSchema),
   zValidator('json', SendAgentGroupChatMessageRequestSchema),
   handler → sendGroupChatMessage → buildSuccess(parse 响应))
```

错误码沿用：归属失败 403（`assertGroupChatOwnedByUser`）；模型错误由 provider 抛 503/504。

## 前端数据流（apps/web）

### api（group-chat.api.ts 新增）

```ts
sendGroupChatMessage(groupChatId, payload: SendAgentGroupChatMessageRequest)
  → http.post<SendAgentGroupChatMessageResponse>(`/rpc/chat/group/${groupChatId}/send`, payload)
getGroupChatMessages(groupChatId, cursor: number)
  → http.get<AgentGroupChatMessagesResponse>(`/rpc/chat/group/${groupChatId}/messages?cursor=${cursor}`)
```

### query（group-chat.query.ts 新增 sendGroupChatMessageMutationOptions）

乐观更新，key = `groupChatKeys.detail(groupChatId)`。注意：`chat.query.ts` 与整个 `apps/web/src` 目前**没有任何 onMutate 先例**（现有 mutation 只用 onSuccess invalidate），本任务是首个乐观更新实现，按标准 react-query onMutate/onError/onSuccess 三段式自建：

```
onMutate({ groupChatId, message }):
  cancelQueries(detail)
  previous = getQueryData(detail)
  optimistic = { id:`optimistic-${Date.now()}`, senderType:'user', content:message,
                 status:'completed', turnIndex:(previous.recentMessages.at(-1)?.turnIndex ?? 0)+1,
                 createdAtMs:Date.now(), agentId:null, agentName:null, agentImageKey:null, groupChatId }
  setQueryData(detail, d => ({ ...d, recentMessages:[...d.recentMessages, optimistic] }))
  return { optimisticId: optimistic.id, previous }
onSuccess(res, _vars):
  setQueryData(detail, d => ({
    ...d,
    groupChat: res.groupChat,     // messageCount/lastMessageAt 用服务端真实值
    recentMessages: [
      ...d.recentMessages.filter(m => m.id !== ctx.optimisticId
        && m.id !== res.userMessage.id
        && !res.agentMessages.some(a => a.id === m.id)),
      res.userMessage, ...res.agentMessages,
    ],
  }))
  invalidateQueries(groupChatKeys.list())   // 左栏列表消息数/时间刷新
onError(_e, _vars, ctx):
  if ctx.previous: setQueryData(detail, ctx.previous)
  // 草稿恢复在组件层用 onError 回调 setDraft(message)
```

- detail query 数据形态是 `AgentGroupChatDetail`（`{ groupChat, members, recentMessages }`），乐观更新只动 `recentMessages` 和 `groupChat`。
- 排序：追加后按 `createdAtMs` 保持升序（服务端已保证 agentMessages 顺序）。

### 组件（group-chat-workspace.tsx 改 MessageColumn）

- 中栏底部占位替换成受控 `<textarea>` + 发送按钮：Enter 发送、Shift+Enter 换行、空串禁发、`mutation.isPending` 时禁用并显示 loading。
- `MessageColumn` 接收 `groupChatId`，内部 `useMutation(sendGroupChatMessageMutationOptions)`，草稿 state 在组件内；`onError` 里 `setDraft(variables.message)`。
- 历史分页：中栏消息区顶部「加载更早消息」按钮，本地 state 存 `nextCursor`（首屏由 detail.recentMessages 是否达上限推断，或统一改成点击时先请求一次拿 nextCursor）。点击调 `getGroupChatMessages`，把 items 去重后 prepend 进 detail 的 recentMessages（`setQueryData(detail)`），更新本地 `nextCursor`；为 null 时隐藏按钮。
- 失败 Agent 消息（`status==='failed'`）气泡加淡红边或「发送失败」标记，与正常气泡区分。

## 兼容与回滚

- 纯新增 + 局部改：新增 contract schema、新增 `group-chat.provider.ts`/`group-chat.reply.ts`、repository 加两个函数、service 加一个编排、route 加一个端点、前端加 api/mutation/输入框/分页交互。
- 不改 foundation 已有链路与 `companion_*`/单聊；无新迁移（复用 0014 三表）。
- 回滚 = 撤销上述新增函数/端点/契约导出 + 前端还原占位。
- 顺序生成、上限 3、记忆隔离都是本任务代码内约束，回滚不留残留数据结构。

## 关键取舍

- v1 规则与 prompt 独立成 `group-chat.reply.ts`：为 langgraph 子任务保留"整图失败回退到 v1 规则"的干净调用点。
- 非流式独立函数而非复用流式：群聊要一次性完整数组，流式对多 Agent 顺序拼接无收益且复杂。
- summary 不更新、不抽记忆（已确认）：把 v1 范围收敛到"能聊 + 能回看"，摘要与记忆沉淀交给后续。
- metadata 记 `providerName` 而非草稿的 `wireApi`：贴合 moodmate 真实 provider 结构，为后续编排分析留真实模型轨迹。
- 同轮 Agent 消息 `created_at_ms` 递增去重：配合 `(created_at_ms, id)` 索引保证回看顺序稳定。
