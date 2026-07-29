# AI 其他协议技术设计

## Design Summary

在现有 `apps/api/src/infra/ai` 内新增两个静态 Provider：`anthropic-messages` 和 `openai-responses`。两者都适配现有 `AiProvider` 契约，runtime、chat、group-chat 和 LangGraph 调用方式不变。

现有 D1 `api` 列是无 CHECK 约束的文本字段，不需要 migration。`packages/contracts` 扩展协议枚举，Admin 表单增加协议选择并把 `api` 传给 create、update 和 test。

## Boundaries

```text
Admin form
  -> contracts LlmConfigApi
  -> llm-config 持久化、解密、构造 AiModel
  -> AI runtime
  -> provider-registry 按 model.api 选择 Provider
  -> Anthropic Messages / OpenAI Responses SDK
```

- 业务模块仍只从 `@/infra/ai` 调用 `generateText()`、`streamText()` 和 `generateObject()`。
- Provider 不读取 D1、不依赖 Hono、contracts、chat 或 group-chat。
- `providerName` 只用于管理端展示和安全日志；协议选择只看 `api`。
- 不引入 Pi 的 Provider catalog、模型 catalog、OAuth 或 credential store。

## Protocol IDs

```ts
type AiApi =
  | "openai-chat-completions"
  | "anthropic-messages"
  | "openai-responses";
```

`LlmConfigApiSchema` 使用相同三个值。默认值继续是 `openai-chat-completions`，旧请求和旧记录不变。

## Dependencies And Files

- `openai-responses` 复用 `apps/api` 已有的 `openai@7.0.0`，调用 `client.responses.create()`。
- `anthropic-messages` 新增官方 `@anthropic-ai/sdk@0.91.1`，版本与参考 Pi 项目一致。
- 两个 SDK client 都显式使用 90 秒超时、`maxRetries: 0`、请求期 API Key、后台配置的 Base URL 和调用方 `AbortSignal`。

新增目录：

```text
apps/api/src/infra/ai/providers/
├── anthropic-messages/
│   ├── index.ts
│   ├── anthropic-messages.mapper.ts
│   └── anthropic-messages.provider.ts
├── openai-compatible/
├── openai-responses/
│   ├── index.ts
│   ├── openai-responses.mapper.ts
│   └── openai-responses.provider.ts
└── openai-sdk-error.ts
```

`openai-sdk-error.ts` 保存 Chat Completions 与 Responses 共用的 OpenAI SDK 错误映射。现有 mapper 不再拥有这段共用逻辑，避免复制认证、限流、超时和网络错误分类。

## Anthropic Messages Mapping

### Request

- 收集全部 `system` 消息，按原顺序用换行连接后放入 Anthropic 顶层 `system`。
- `user` 文本映射为 Anthropic user message。
- `assistant.content` 映射为 text block；`assistant.toolCalls` 映射为 `tool_use` block。
- 连续 tool result 合并成一个 user message，内容为多个 `tool_result` block，保持原顺序。
- 工具声明映射为 `name`、`description` 和 `input_schema`。
- 普通工具调用不设置 `tool_choice`；structured output 的 `function` 方法注册单个工具并用 `{ type: "tool", name }` 强制调用。
- Anthropic 要求 `max_tokens`。调用方未提供时使用 4096；连接测试传入的 1 保持为 1。
- `temperature`、`model`、`AbortSignal` 按现有统一参数传递。

### Structured Output

Anthropic Messages 没有 OpenAI 的 `json_schema` 和 `json_object` response format。本次只支持 runtime 的 `function` 方法：

- `json_schema`、`json_object` 在发送请求前抛 `AiError("invalid_response")`。
- `function` 把 schema 作为单个 tool 的 `input_schema` 并强制选择该工具。
- 响应中的 `tool_use.input` 序列化为内部 `AiToolCall.arguments`，由现有 `generateObject()` 解析和 Zod 校验。

`generateObject()` 在已有 `invalid_output` 后遇到后续“不支持该方法”时保留 `invalid_output`，不让最后一个本地能力错误覆盖模型实际返回的无效结果。

### Response And Stream

- text block 按顺序拼接为 `AiAssistantMessage.content`。
- `tool_use` 映射为 `AiToolCall`。
- `end_turn`、`stop_sequence` 映射为 `stop`；`max_tokens` 映射为 `length`；`tool_use` 映射为 `tool-calls`；其他值映射为 `unknown`。
- usage 使用 `input_tokens` 和 `output_tokens`，`totalTokens` 为两者之和。
- 流事件处理 `message_start`、`content_block_start`、`content_block_delta`、`content_block_stop`、`message_delta` 和 `message_stop`。
- 文本增量输出 `text-delta`；工具 JSON 增量输出 `tool-call-delta`，block 完成后输出 `tool-call`；结束时输出 usage 和 finish。

## OpenAI Responses Mapping

### Request

- `system` 映射为 Responses input 的 `developer` message。
- user、assistant 文本映射为 input/output message item。
- assistant tool call 映射为 `function_call`，tool result 映射为 `function_call_output`，共同使用内部 tool call id 作为 `call_id`。
- 工具声明映射为 Responses function tool。
- 非流式和流式请求都设置 `store: false`，不让 OpenAI 保存响应状态。
- `maxTokens` 映射为 `max_output_tokens`，最小值钳制为 16，保证当前连接测试的 `maxTokens: 1` 可执行。

### Structured Output

- `json_schema` 映射为 `text.format: { type: "json_schema", name, schema, strict: true }`。
- `function` 注册单个 function tool，并用 function tool choice 强制调用。
- `json_object` 映射为 `text.format: { type: "json_object" }`；若 SDK 或上游不支持，由统一错误映射返回 `invalid_response`。

### Response And Stream

- 普通响应遍历 `response.output`：message 的 `output_text` 拼成 content，`function_call` 映射为 tool call。
- `completed` 映射为 `stop`；`incomplete` 映射为 `length`；响应含 function call 时 finish reason 为 `tool-calls`；failed/cancelled 映射为 `error`。
- usage 映射 `input_tokens`、`output_tokens` 和 `total_tokens`。
- 流式处理 `response.output_text.delta`、`response.function_call_arguments.delta`、`response.output_item.done`、`response.completed`、`response.incomplete` 和 `response.failed`。
- 每个 function call 用 `output_index` 累积 id、name 和 arguments，完成后输出内部 `tool-call`。

## Error Mapping

两个 Provider 都只输出稳定 `AiError`：

- 用户取消或 SDK abort -> `aborted`
- SDK timeout -> `timeout`
- 连接错误 -> `network`
- 401 -> `authentication`
- 403 -> `permission_denied`
- 429 -> `rate_limited`
- 400 / 422 -> `invalid_response`
- 其他 SDK API 错误 -> `upstream_error`

metadata 只保留 `status`、`requestId`、`providerName`、`model` 和 `durationMs`。流式请求通过 `error` 事件返回映射后的错误，非流式请求直接抛出。

## Admin Behavior

- 配置表单增加原生 `<select>`，选项为 `OpenAI Chat Completions`、`Anthropic Messages`、`OpenAI Responses`。
- 新建配置默认选 `openai-chat-completions`；编辑配置使用记录中的 `api`。
- create、update、test payload 都提交当前 `api`。
- `disableThinking` 只在 `openai-chat-completions` 时显示和提交，其他协议不构造对应 `providerOptions`。
- 标题下说明改为支持三种协议；Base URL placeholder 根据协议变化，但不会自动改写用户已输入的值。

## Compatibility And Rollback

- 不修改数据库结构。旧记录仍读取为 `openai-chat-completions`。
- `DEFAULT_LLM_CONFIG_API` 不变，旧客户端省略 `api` 时行为不变。
- Web chat 仍只接收纯文本字节流，业务 prompt 和保存时机不变。
- 若新增 Provider 有问题，可移除 registry 项和 contracts 枚举；不需要回滚 migration。
- 若 Admin 改动需要单独回退，API 仍可通过 contracts 请求使用新增协议。

## Validation

按仓库质量门依次运行：

1. `pnpm check-types`
2. `pnpm lint`
3. `pnpm format:check`

再运行 `pnpm --filter api exec wrangler deploy --dry-run`，确认 Anthropic SDK 与 OpenAI Responses 能被 Cloudflare Workers 打包。没有真实 API Key 时不声称完成真实上游请求验证。
