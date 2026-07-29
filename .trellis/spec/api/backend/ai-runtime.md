# API AI 接入层

## 1. 适用范围

新增或修改 `apps/api/src/infra/ai` 的类型、Provider、runtime、错误模型、协议注册，或改动业务模块调用模型的方式时使用本规范。业务侧（chat / group-chat / llm-config）与 runtime 的桥接契约见 `companion-chat.md` 第 12 节。

实现位于 `apps/api/src/infra/ai`。它是 API 里调用上游模型的唯一位置，业务模块不自己创建模型客户端，也不解析 OpenAI 协议。

## 2. 目录与签名

```text
apps/api/src/infra/ai/
├── index.ts                 # 唯一对外入口，业务只从这里 import
├── types.ts                 # 规范化消息、模型连接、生成选项、结果、事件、工具、Provider 接口
├── errors.ts                # AiError 和稳定错误 code
├── provider-registry.ts     # 按 api 选实现的只读映射
├── stream.ts                # 事件流工具和转纯文本字节流的适配器
├── runtime/
│   ├── generate-text.ts     # generateText / streamText
│   ├── generate-object.ts   # generateObject
│   └── execute-tools.ts     # 工具执行循环
└── providers/
    └── openai-compatible/   # 唯一引用 openai SDK 的目录
```

公开 runtime API（业务唯一入口）：

```ts
generateText(options: GenerateTextOptions): Promise<AiGenerationResult>;
streamText(options: StreamTextOptions): AiEventStream;
generateObject<T>(options: GenerateObjectOptions<T>): Promise<GenerateObjectResult<T>>;

// stream.ts
toTextByteStream(stream: AiEventStream, options?: TextStreamAdapterOptions): ReadableStream<Uint8Array>;
```

Provider 接口与 registry：

```ts
interface AiProvider<TApi extends AiApi = AiApi> {
  readonly api: TApi;
  generate(request: AiProviderRequest): Promise<AiGenerationResult>;
  stream(request: AiProviderRequest): AiEventStream;
}

getAiProvider<TApi extends AiApi>(api: TApi): AiProvider<TApi>; // 未注册抛 invalid_config
```

## 3. 合同

`AiModel` 连接形状由 `llm-config` 构造后传入，AI 模块不读 D1：

```ts
interface AiModel {
  api: AiApi; // registry key，当前只有 "openai-chat-completions"
  providerName: string; // 仅用于日志和识别，不参与实现选择
  model: string;
  baseURL: string;
  apiKey: string; // 只存在于请求期内存，不进事件、错误 metadata 或日志
  providerOptions?: {
    "openai-chat-completions"?: { disableThinking?: boolean };
  };
}
```

- registry 按 `AiModel.api` 选实现，不按 `providerName` 写分支。
- `disableThinking` 只通过 `providerOptions["openai-chat-completions"]` 传，Provider 映射为上游 `thinking: { type: "disabled" }`。业务模块不拼原始 request body。
- Provider 向 SDK 显式传 90 秒 timeout、`maxRetries: 0` 和调用方 `AbortSignal`。

结构化输出：`generateObject()` 接收 Zod schema，转 JSON Schema 交给 Provider，返回后再用同一 Zod schema 校验。方法按固定顺序 `json_schema -> function -> json_object` 轮询，切换逻辑在 runtime，Provider 只忠实应用当前 method。

## 4. 校验与错误矩阵

`AiError` 稳定 code（Provider 依 SDK error 类型和 HTTP status 映射）：

| 上游情况                         | AiError code                |
| -------------------------------- | --------------------------- |
| 协议未注册 / 配置无效            | `invalid_config`            |
| 认证失败                         | `authentication`            |
| 拒绝访问                         | `permission_denied`         |
| 限流                             | `rate_limited`              |
| 响应头 / 连接超时                | `timeout`                   |
| 调用方取消                       | `aborted`                   |
| 无法连接                         | `network`                   |
| 400 / 422（含方法不被支持）      | `invalid_response`          |
| 无 choice / 空文本               | `invalid_response`          |
| 其余 SDK error                   | `upstream_error`            |
| 模型输出过不了 Zod               | `invalid_output`            |
| 工具未注册 / 参数无效 / 执行失败 | 转失败 tool result 交回模型 |
| 工具循环超过 5 轮                | `max_steps`                 |

规则：

- `generateObject` 只有 `invalid_response`（方法不被支持）或 `invalid_output` 才切下一种方法；认证 / 限流 / 超时 / 取消 / 网络错误立即向上抛，不重试、不切换。
- `aborted` 保持取消语义向上抛，工具执行中的取消不包装成 tool result。
- runtime 与 Provider 不创建 `AppError`，不依赖 Hono / D1 / contracts。业务边界（chat / group-chat / llm-config service）把 `AiError` 转成 `BizCode`、HTTP status 和中文文案。

日志只记录可安全字段（`status`、`requestId`、`providerName`、`model`、`durationMs`），工具日志只记名称、耗时和结果状态。禁止记录 API Key、Authorization、完整 prompt、完整工具参数、完整工具结果或原始上游错误体。

## 5. 正常、基础、错误案例

- 正常：单聊 `streamText()` + `toTextByteStream()` 逐字输出，流结束 `onComplete` 写库；群聊 `generateText()` 返回文本 `trim()` 后落库；`generateObject()` 首个方法即过 Zod。
- 基础：`generateObject()` 首方法返回无法过 Zod 的文本，切下一种方法后成功。
- 错误：错误 Key 抛 `authentication`；错误 baseURL 抛 `network`；上游 90 秒无响应抛 `timeout`；取消抛 `aborted`；工具连续 5 轮只返回 tool call 抛 `max_steps`。

## 6. 需要的测试

项目当前无 API 测试框架，以下为引入 Vitest 后优先补的纯逻辑用例与断言点：

- mapper：SDK 响应 → `AiGenerationResult`，断言 content、toolCalls、usage、finishReason。
- 流事件合并：分段文本与并行 tool call chunk，断言按 index 合并出完整 `AiToolCall`。
- error 映射：各 SDK error 类型 → 对应 `AiError` code，断言 metadata 只含安全字段。
- structured output：首方法成功、方法不被支持时切换、全部方法用尽抛 `invalid_output`。
- 工具循环：未注册、参数无效转失败 tool result；取消抛 `aborted`；5 轮上限抛 `max_steps`。
- 纯文本适配器：只编码 `text-delta`，`onComplete` 收到完整累计文本，空文本按 `errorOnEmpty` 断流。

## 7. 错误与正确写法

### 错误

```ts
// 业务模块直接建 SDK client、拼 request body、解析上游协议
import { OpenAI } from "openai";
const client = new OpenAI({ apiKey, baseURL });
const res = await client.chat.completions.create({ model, messages, thinking });
```

### 正确

```ts
// 业务只从 @/infra/ai import runtime API，传规范化类型
import { generateText } from "@/infra/ai";
const result = await generateText({ model, messages, maxTokens: 1, signal });
```

## 8. 新增协议

要接入除 OpenAI Chat Completions 以外的协议，按顺序：

1. 在 `types.ts` 的 `AiApi` 加协议标识。
2. 在 `providers/<new-protocol>` 实现 `AiProvider`，边界把 SDK 类型转成 `types.ts` 内部类型，SDK 类型不越过该目录。
3. 在 `provider-registry.ts` 的 `PROVIDERS` 静态注册新实现。
4. 补该协议的 Provider contract test。

registry 是只读映射，没有运行时注册方法。业务模块不需要改动。
