# API AI Provider 技术设计

## Design summary

MoodMate 属于带 Agent 能力的 Web App monorepo。本次不复制 Pi 的 package 结构，只采用它的分层方式：统一类型描述模型请求和结果，Provider 转换外部协议，runtime 管生成过程，业务模块决定 prompt、工具权限和结果用途。

AI 模块留在 `apps/api`，因为只有 API 会调用模型，且连接配置依赖 API 的运行环境。`packages/contracts` 只增加管理端需要读取或提交的 `api` 字段，不存放 Provider 内部类型。

## Dependency direction

```text
chat / group-chat / llm-config
  -> apps/api/src/infra/ai public API

apps/api/src/infra/ai/runtime
  -> apps/api/src/infra/ai/provider-registry
  -> apps/api/src/infra/ai/types

apps/api/src/infra/ai/providers/openai-compatible
  -> official openai SDK
  -> apps/api/src/infra/ai/types

llm-config
  -> D1 + encryption
  -> constructs AiModel connection data

openai-compatible provider
  -/-> D1, Hono, AppError, chat, group-chat, contracts DTO

runtime
  -/-> Hono, D1, chat, group-chat, LangGraph
```

禁止反向依赖：AI 模块不能 import `modules/chat`、`modules/group-chat` 或 `modules/llm-config`。业务错误码和用户文案由调用 AI 模块的 service 转换，不能进入 Provider。

## Directory

```text
apps/api/src/infra/
├── db/
│   └── d1.ts
└── ai/
    ├── index.ts
    ├── types.ts
    ├── errors.ts
    ├── provider-registry.ts
    ├── stream.ts
    ├── runtime/
    │   ├── generate-text.ts
    │   ├── generate-object.ts
    │   └── execute-tools.ts
    └── providers/
        └── openai-compatible/
            ├── index.ts
            ├── openai-compatible.provider.ts
            └── openai-compatible.mapper.ts
```

- `infra/ai/index.ts` 是业务模块唯一允许使用的入口。
- `types.ts` 定义规范化消息、模型连接、生成选项、结果、事件、工具和 Provider 接口。
- `errors.ts` 定义 `AiError` 与稳定错误 code。
- `provider-registry.ts` 保存只读的协议实现映射。新增协议时在这里注册，不修改业务模块。
- `stream.ts` 提供内部事件流和转纯文本字节流的适配器。
- `runtime/*` 组合 Provider、Zod schema 和工具执行，不知道具体协议字段。
- `openai-compatible.provider.ts` 创建官方 SDK client 并调用 `chat.completions.create()`。
- `openai-compatible.mapper.ts` 负责内部类型与 SDK 类型之间的转换，SDK 类型不离开该目录。

若实际实现发现 `openai-compatible.mapper.ts` 只有少量直观转换，可以合并回 Provider 文件；不能为了满足目录图保留空抽象。

## Core contracts

### Protocol and model

```ts
type AiApi = "openai-chat-completions";

interface AiModel {
  api: AiApi;
  providerName: string;
  model: string;
  baseURL: string;
  apiKey: string;
  providerOptions?: {
    "openai-chat-completions"?: {
      disableThinking?: boolean;
    };
  };
}
```

`providerName` 用于日志和管理端识别，不参与实现选择。`api` 才是 registry key。`apiKey` 只存在于请求期内存，不进入事件、错误 metadata 或持久化日志。

### Messages and results

消息使用可判别联合，覆盖文本、assistant tool call 和 tool result。业务层不能构造 OpenAI `ChatCompletionMessageParam`。

```ts
type AiMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: AiToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

interface AiGenerationResult {
  message: AiAssistantMessage;
  usage: AiUsage | null;
  finishReason: AiFinishReason;
}
```

`AiFinishReason` 只保留 runtime 会处理的稳定值，例如 `stop`、`length`、`tool-calls`、`content-filter`、`error`、`unknown`。原始 SDK finish reason 在 Provider 边界映射。

### Provider interface

```ts
interface AiProvider<TApi extends AiApi> {
  readonly api: TApi;
  generate(input: AiProviderRequest<TApi>): Promise<AiGenerationResult>;
  stream(input: AiProviderRequest<TApi>): AiEventStream;
}
```

Registry 是只读映射，不提供运行时修改方法。协议扩展步骤是新增 `AiApi`、实现 Provider、加入 registry，并补 Provider contract tests。

### Public runtime API

```ts
generateText(options): Promise<AiGenerationResult>
streamText(options): AiEventStream
generateObject(options): Promise<{ value: T; usage: AiUsage | null }>
```

业务只从 `@/infra/ai` import 这些入口及必要类型。Provider 实现不从 `index.ts` 反向 import，避免循环依赖。

## Stream events

内部事件建议使用可异步迭代的 `AiEventStream`，便于 runtime 组合工具循环并在测试中逐项断言。事件至少包括：

```text
start
text-delta
tool-call-delta
tool-call
usage
finish
error
```

Provider 负责把 SDK stream chunk 转成事件，并按 tool call id/index 合并增量参数。完成的工具参数进入 runtime 前必须解析为 `unknown`，再由对应 Zod schema 校验。

现有 chat route 不直接返回内部事件。`stream.ts` 提供纯文本适配器，只把 `text-delta` 编码成 `Uint8Array`。`onComplete` 所需完整文本在适配器内累计，保持现有消息写库时机。

## Generation flows

### Text stream

```text
chat service 构造 AiMessage[] 和 AiModel
  -> streamText()
  -> registry 按 model.api 选择 Provider
  -> openai SDK chat.completions.create({ stream: true })
  -> Provider 规范化 SDK chunks
  -> runtime 输出 AiEventStream
  -> chat 纯文本适配器转发 text-delta
  -> 流结束后 chat service 保存完整 assistant 文本
```

### Non-streaming text

群聊回复改用 `generateText()`。业务仍负责构造 Agent prompt、限制文本长度和保存消息；`group-chat.provider.ts` 删除后，业务不再解析 OpenAI response。

### Structured output

```text
LangGraph node 准备 prompt values
  -> ChatPromptTemplate formatMessages() 或等价格式化
  -> 转成 AiMessage[]
  -> generateObject({ schema, schemaName, messages })
  -> Zod 4 转 JSON Schema
  -> Provider 发送 OpenAI structured output 请求
  -> runtime 解析文本或工具参数
  -> 原 Zod schema parse
  -> Graph node 执行业务 normalize / fallback
```

兼容模式由 OpenAI-compatible Provider 内部管理，按明确顺序尝试 `json_schema`、function tool、`json_object`。只有“上游明确不支持该方法”才能尝试下一种；认证、限流、超时、取消和网络错误不得重复请求。最终 Zod 校验失败返回 `invalid_output`。现有业务 fallback 仍在 Graph 节点外层执行。

### Tool loop

```text
业务传入本轮 tools
  -> runtime 将工具声明转成 JSON Schema
  -> Provider 返回一个或多个 AiToolCall
  -> runtime 按返回顺序查找工具并校验参数
  -> 顺序执行工具，生成 AiToolResultMessage
  -> 追加 assistant tool calls 与 tool results
  -> 继续生成，最多 5 轮
  -> 得到最终文本或返回 max_steps 错误
```

工具定义包含 `name`、`description`、Zod input schema 和 `execute(input, context)`。`context` 只含调用方显式提供的业务能力和 `AbortSignal`，不能让工具取得整个 Hono context 或可变 registry。

未注册、参数无效和执行异常都生成失败 tool result，使模型有机会修正；取消请求直接中止，不包装成 tool result。达到 5 轮仍只有 tool calls 时返回 `max_steps`，由业务决定用户文案。

## Configuration and migration

新增 migration `0015_add_llm_config_api.sql`：

- 给 `llm_provider_configs` 增加非空 `api` 字段，默认值为 `openai-chat-completions`。
- 给字段增加只接受当前协议值的 CHECK 时需考虑 SQLite 后续扩展成本；首版优先由 Zod 和 TypeScript 校验，避免新增协议时重建表。
- 更新 Drizzle schema、repository record、service mapper 和 `packages/contracts` 的配置 DTO。
- create/test 请求中的 `api` 可选并由服务端补默认值，避免当前 Admin 表单必须同步增加控件；响应返回实际 `api`。

`resolveActiveLlmProviderConfig()` 改为返回 AI 模块需要的 `AiModel` 连接形状，但该函数仍属于 `llm-config`。AI 模块不能自行读取活动配置。

连接测试也必须调用 AI 模块，不能继续单独 `fetch` 上游。使用最小非流式生成请求验证认证、协议和模型是否可用；接口继续返回 `ok`、`latencyMs` 和管理端可读消息。该请求可能产生极少量 token，需在 API 文档说明。

## Error model

`AiError` 使用稳定 code：

- `invalid_config`
- `authentication`
- `permission_denied`
- `rate_limited`
- `timeout`
- `aborted`
- `network`
- `invalid_response`
- `invalid_output`
- `tool_not_found`
- `tool_invalid_arguments`
- `tool_execution_failed`
- `max_steps`
- `upstream_error`

Provider 根据 SDK error 类型和 HTTP status 转换为 `AiError`，保留可安全记录的 `status`、`requestId`、`providerName`、`model` 和耗时。不得记录 API Key、Authorization header、完整 prompt、完整工具参数、完整工具结果或原始上游错误体。

AI runtime 不创建 `AppError`。chat、group-chat 和 llm-config service 在业务边界把 `AiError` 转成现有 `BizCode`、HTTP status 和中文文案。`aborted` 保持取消语义并向上抛，不转换为 503。

## Compatibility

- Web 端继续接收纯文本流，不修改 contracts 和 UI。
- 90 秒超时、`maxRetries: 0`、取消信号和 assistant 消息完成后写库的时机保持不变。
- `disableThinking` 作为 OpenAI-compatible Provider option 映射为当前上游接受的请求扩展字段。
- chat analysis 和 group-chat orchestration 的业务 fallback 保留；只替换模型调用方式。
- 配置迁移带默认值，旧数据和旧 Admin 请求继续可用。

## Testing

项目目前没有 API 测试框架。本次不自行安装测试框架，但实现时应把 Provider mapper、事件组装、structured output fallback 和工具循环写成可单测的纯逻辑。若用户同意引入 Vitest，优先补以下 contract tests：

- SDK 普通响应到规范化结果的映射。
- 分段文本与并行 tool call chunk 的事件合并。
- finish reason、usage 和 SDK error 映射。
- Zod structured output 成功、方法不支持时切换、无效输出。
- 未注册工具、参数无效、执行失败、取消和 5 轮上限。
- 纯文本流适配器只输出 `text-delta` 并正确累计完整文本。

无测试框架时，至少通过 TypeScript 类型检查、ESLint、Prettier 和手动开发环境请求验证。

## Rollout and rollback

按可独立验证的顺序迁移：

1. 加入 `api` 字段 migration 和 contracts，旧调用仍走原实现。
2. 建立 AI types、Provider、runtime 和配置测试，原 chat 路径不变。
3. 迁移群聊非流式文本和单聊流式文本，保留旧文件直到手动验证通过。
4. 迁移 chat analysis 与 group-chat orchestration 的 structured output。
5. 删除旧 Provider 文件与 `@langchain/openai`，补架构文档。

每一步都保持可单独回退。数据库新增字段有默认值，代码回退后旧版本会忽略该字段；不得在同一 migration 删除旧列或重加密 API Key。
