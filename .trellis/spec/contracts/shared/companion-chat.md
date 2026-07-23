# 伴侣聊天合同

## 1. 适用范围

新增或修改 MoodMate 固定伴侣的聊天请求、会话历史或长期记忆协议时使用本规范。合同位于 `packages/contracts/src/chat/companion-chat.contract.ts`，不包含数据库 record、React 状态、Worker binding 或模型响应流。

## 2. 公开签名

```ts
CompanionChatPartSchema;
CompanionChatMessageSchema;
CompanionChatLlmConfigSchema;
CompanionChatRequestSchema;
CompanionConversationMessageSchema;
CompanionConversationResponseSchema;
CompanionConversationMessagesResponseSchema;
CompanionMemorySchema;
CompanionMemoriesResponseSchema;
UpdateCompanionMemoryRequestSchema;
UpdateCompanionMemoryResponseSchema;
DeleteCompanionMemoryResponseSchema;
```

聊天发送响应是纯文本流，不定义成功响应 DTO。历史和记忆接口使用上述 DTO，失败响应继续使用统一 `ApiFailure`。

## 3. 合同

- `messages`：1 到 20 条消息。
- `conversationId`：可选非空字符串，用于兼容旧客户端；当前 Web 请求必须发送服务端返回的 ID。
- `message.role`：只接受 `user` 或 `assistant`。
- `message.parts`：1 到 50 个 part；每个 part 必须有非空 `type`，其他 AI SDK 字段允许透传。
- `llmConfig`：可选，包含 `providerName`、HTTP(S) `baseURL`、`model` 和 `apiKey`。
- `apiKey` 最长 400 字符，只能出现在请求体，不能进入响应 DTO。
- 历史消息包含 `id`、`conversationId`、`role`、完整 `content`、`status` 和 `createdAtMs`。
- 会话响应包含 `conversationId`、可空标题和摘要、非负 `messageCount`、消息数组与可空 `nextCursor`。
- 长期记忆包含 1 到 80 字符的 `type`、1 到 2000 字符的 `content`、1 到 5 的整数 `importance`、状态、来源和时间。
- 记忆响应可以返回 `active` 或 `disabled`；`deleted` 保留在公共 schema 中供更新结果和内部兼容使用，列表接口不得返回该状态。
- `sourceMessage` 可空；存在时只包含消息 ID、角色、内容和创建时间，不返回数据库归属字段。
- 更新请求至少提供一个字段，只允许 `type`、`content`、`importance` 和 `active | disabled` 状态。
- 删除响应固定为 `{ success: true }`。

## 4. 校验与错误矩阵

| 条件                         | 结果                     |
| ---------------------------- | ------------------------ |
| `messages` 缺失或超过 20 条  | `COMMON.INVALID_REQUEST` |
| role 不是允许值              | `COMMON.INVALID_REQUEST` |
| part 缺少非空 `type`         | `COMMON.INVALID_REQUEST` |
| `baseURL` 不是 HTTP(S) URL   | `COMMON.INVALID_REQUEST` |
| `llmConfig` 不完整           | `COMMON.INVALID_REQUEST` |
| 更新请求没有任何字段         | `COMMON.INVALID_REQUEST` |
| 类型或内容为空、超过长度限制 | `COMMON.INVALID_REQUEST` |
| 重要度不在 1 到 5            | `COMMON.INVALID_REQUEST` |
| 更新请求把状态设为 `deleted` | `COMMON.INVALID_REQUEST` |

## 5. 正常、基础、错误案例

- 正常：会话响应返回历史与游标，记忆响应带可空来源消息，Web 直接按推导类型渲染。
- 基础：只传 `messages`，API 创建或读取当前用户的默认会话。
- 错误：把 Drizzle record 当成响应 DTO，导致 snake_case、归属字段或内部元数据进入 Web。

## 6. 必做检查

- `pnpm --filter @repo/contracts check-types`：schema 推导和导出通过。
- `pnpm --filter @repo/contracts lint`：没有运行环境依赖或类型断言。
- 合同检查：文本和非文本 part 可以共存；非 HTTP(S) Base URL 被拒绝。
- 历史检查：时间非负、角色与状态受限、游标允许 `null`。
- 记忆检查：字段长度、重要度、更新至少一个字段、更新状态不能是 `deleted`。
- DTO 检查：来源消息可空，记忆归属和数据库 `metadataJson` 不进入公共响应。
- 跨包检查：API 和 Web 从 `@repo/contracts` 导入类型，不重复定义。

## 7. 错误与正确写法

```ts
// 错误：把数据库查询结果直接返回
return c.json(memoryRecord);

// 正确：presenter 转换后再由共享 schema 校验
const data = CompanionMemorySchema.parse(presentCompanionMemory(memoryRecord));
```
