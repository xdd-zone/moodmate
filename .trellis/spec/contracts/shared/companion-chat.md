# 伴侣聊天合同

## 1. 适用范围

新增或修改 MoodMate 固定伴侣的消息结构、请求级 OpenAI-compatible 配置或聊天请求时使用本规范。合同位于 `packages/contracts/src/chat/companion-chat.contract.ts`，不包含 React 状态、Worker binding 或模型响应流。

## 2. 公开签名

```ts
CompanionChatPartSchema;
CompanionChatMessageSchema;
CompanionChatLlmConfigSchema;
CompanionChatRequestSchema;
```

请求接口是 `POST /rpc/chat/companion`。响应是纯文本流，不定义成功响应 DTO；失败响应继续使用统一 `ApiFailure`。

## 3. 合同

- `messages`：1 到 20 条消息。
- `message.role`：只接受 `user` 或 `assistant`。
- `message.parts`：1 到 50 个 part；每个 part 必须有非空 `type`，其他 AI SDK 字段允许透传。
- `llmConfig`：可选，包含 `providerName`、HTTP(S) `baseURL`、`model` 和 `apiKey`。
- `apiKey` 最长 400 字符，只能出现在请求体，不能进入响应 DTO。

## 4. 校验与错误矩阵

| 条件                        | 结果                     |
| --------------------------- | ------------------------ |
| `messages` 缺失或超过 20 条 | `COMMON.INVALID_REQUEST` |
| role 不是允许值             | `COMMON.INVALID_REQUEST` |
| part 缺少非空 `type`        | `COMMON.INVALID_REQUEST` |
| `baseURL` 不是 HTTP(S) URL  | `COMMON.INVALID_REQUEST` |
| `llmConfig` 不完整          | `COMMON.INVALID_REQUEST` |

## 5. 正常、基础、错误案例

- 正常：文本 part 与文件 part 同时出现，合同接受请求，API 只提取文本。
- 基础：只传 `messages`，API 使用平台 DeepSeek 配置。
- 错误：页面自行定义另一份 `ChatRequest`，导致 API 与 AI SDK 消息字段不一致。

## 6. 必做检查

- `pnpm --filter @repo/contracts check-types`：schema 推导和导出通过。
- `pnpm --filter @repo/contracts lint`：没有运行环境依赖或类型断言。
- 合同检查：文本和非文本 part 可以共存；非 HTTP(S) Base URL 被拒绝。
- 跨包检查：API 和 Web 从 `@repo/contracts` 导入类型，不重复定义。

## 7. 错误与正确写法

```ts
// 错误：页面私自定义请求结构
type ChatRequest = { messages: unknown[] };

// 正确：从共享 schema 推导
type ChatRequest = z.infer<typeof CompanionChatRequestSchema>;
```
