# Agent 记忆系统技术设计

## 范围

本设计只实现 41-46 节。Moodmate 使用固定伴侣，因此每个登录用户只有一段默认会话，不增加 Agent 表、Agent 管理、群聊、向量检索或 LLM 记忆抽取。

## 数据模型

新增迁移 `apps/api/migrations/0008_companion_chat_memory.sql` 和聊天模块 Drizzle schema。

### `companion_conversations`

- `id`：会话 ID。
- `user_id`：当前登录用户，外键关联 `users.id`。
- `title`：固定伴侣会话标题。
- `summary`：滚动摘要。
- `message_count`：已保存消息数。
- `last_message_at_ms`：最近消息时间。
- `created_at_ms`、`updated_at_ms`：会话时间。
- `user_id` 唯一，保证每个用户只有一段默认会话。

### `companion_conversation_messages`

- `id`、`conversation_id`、`user_id`。
- `role` 只允许 `user` 和 `assistant`。
- `content` 保存完整文本。
- `status` 只允许 `completed` 和 `failed`。
- `metadata_json` 预留模型信息，不在本任务中写入业务字段。
- `created_at_ms` 用于排序和分页。

索引覆盖会话内的 `created_at_ms + id` 排序，以及按用户查询消息。v1 游标仍按章节要求只编码 `createdAtMs`。

### `companion_memories`

- `id`、`user_id`。
- `type`、`content`、`importance`。
- `status` 只允许 `active`、`disabled` 和 `deleted`。
- `source_message_id` 关联来源消息，来源删除时设为 `NULL`。
- `created_at_ms`、`updated_at_ms`。

索引覆盖用户、状态、重要度和更新时间排序；来源消息另建索引。

## API 契约

在 `CompanionChatRequestSchema` 增加可选 `conversationId`。正常 Web 请求必须带上服务端返回的会话 ID；可选只用于保留现有调用兼容性。

新增响应和请求 schema：

- `CompanionConversationMessageSchema`
- `CompanionConversationResponseSchema`
- `CompanionConversationMessagesResponseSchema`
- `CompanionMemorySchema`
- `CompanionMemoriesResponseSchema`
- `UpdateCompanionMemoryRequestSchema`
- `UpdateCompanionMemoryResponseSchema`
- `DeleteCompanionMemoryResponseSchema`

接口如下：

| 方法   | 路径                                      | 行为                                             |
| ------ | ----------------------------------------- | ------------------------------------------------ |
| GET    | `/rpc/chat/companion/conversation`        | 获取或创建当前用户的默认会话，返回最近 40 条消息 |
| GET    | `/rpc/chat/companion/messages?cursor=...` | 返回游标之前最多 40 条消息                       |
| POST   | `/rpc/chat/companion`                     | 保存用户消息，组装记忆上下文并流式回复           |
| GET    | `/rpc/chat/companion/memories`            | 返回未删除的长期记忆及来源消息                   |
| PATCH  | `/rpc/chat/companion/memories/:memoryId`  | 修改类型、内容、重要度或启用状态                 |
| DELETE | `/rpc/chat/companion/memories/:memoryId`  | 把状态改为 `deleted`                             |

所有接口使用 `requireWebAccess`，repository 查询同时带 `userId`。请求中的 `conversationId` 如果与当前用户默认会话不一致，返回无效请求，不按该 ID 读取数据。

## API 模块职责

- `chat.schema.ts`：Drizzle 表定义。
- `chat.repository.ts`：默认会话、消息分页、消息写入、摘要更新和记忆读写。
- `chat.presenter.ts`：数据库结果转换为 contracts DTO。
- `chat.service.ts`：提取消息文本、组装 prompt、生成摘要、规则提取候选记忆和保存一轮回复。
- `chat.provider.ts`：保持 DeepSeek SSE 到纯文本流的转换，并在完整文本结束时调用完成回调。
- `chat.route.ts`：鉴权、Zod 校验、HTTP 参数解析和统一响应。

## 聊天数据流

```text
Web 发送最近 UI 消息和 conversationId
  -> API 读取或创建当前用户默认会话
  -> API 读取最近 18 条服务端消息和 12 条启用记忆
  -> API 提取本轮最新用户文本并先写入消息表
  -> API 组装系统规则、长期记忆、摘要、最近消息和本轮输入
  -> Provider 流式转发文本并累积完整 assistant 文本
  -> 流正常结束后保存 assistant 消息
  -> 更新会话摘要、消息数和最近消息时间
  -> 尝试写入最多 2 条规则记忆
```

最近历史在保存本轮用户消息前读取，组装 prompt 时再追加本轮输入一次，避免重复注入。

用户消息写入失败时不调用 LLM。LLM 调用失败或流中断时保留已写入的用户消息，不写入不完整的 assistant 消息。记忆提取和写入单独捕获错误并记录日志，不改变已完成的聊天响应。

## 摘要与记忆规则

- 摘要输入为既有摘要、最近 8 条历史、本轮用户文本和 assistant 文本。
- 合并空白后保留末尾 1600 个字符。
- 用户文本包含“我、不喜欢、喜欢、希望、想要、以后、记住、别、不要、需要、习惯、倾向”之一时才生成候选。
- 类型按关键词分为“边界”“偏好”“关系目标”“对话风格”。
- 包含“记住、不要、不喜欢、边界、以后”的候选重要度为 5，其余为 3。
- 内容最多保留 500 个字符。
- 写入前读取最多 50 条有效记忆，按完整 `content` 去重。

## Web 状态流

`CompanionChatApp` 先通过 TanStack Query 读取默认会话。加载中和失败时显示明确状态；成功后用 `conversationId` 作为 `useChat` ID，并用服务端消息初始化。

- 没有历史消息时继续显示现有“我在。今天想聊点什么？”空状态，该文案不写入数据库。
- 历史 assistant 消息初始化为完整可见文本，不重新执行逐字显示。
- 新 assistant 消息保留现有逐字显示。
- “加载更早消息”把返回消息同时插入历史状态和 `useChat` 消息数组头部。
- 发送请求只提交最近 20 条 UI 消息，并附带 `conversationId`。
- 一轮聊天结束后使会话 query 失效，重新读取服务端数据和最新预览。

记忆管理放在现有设置菜单中，新增“记忆”区域。页面直接管理固定 MoodMate 的记忆，不显示 Agent 选择器。编辑、启用、停用和删除成功后使记忆 query 失效。

Web HTTP 模块增加 PATCH 和 DELETE。两种方法沿用现有 token 附加、过期刷新、统一响应校验和错误处理。

## 兼容与回退

- 数据库迁移只新增表和索引，不改现有认证或聊天字段。
- `conversationId` 在 contract 中保持可选，现有客户端请求仍能由服务端创建默认会话。
- 关闭新历史读取时，现有聊天接口仍可使用原有 UI messages 结构。
- 代码回退后新增表可以保留，不影响旧版本查询；不提供自动删除迁移。
