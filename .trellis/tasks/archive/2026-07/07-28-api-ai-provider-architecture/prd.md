# API AI Provider 架构设计

## Goal

参考 `/Users/wuwanzhu/Code/pi/packages/ai` 的 Provider 设计方法，在 `apps/api` 内建立独立 AI 接入层。业务模块只负责 prompt、业务流程和结果处理，不再自行创建模型客户端或解析上游协议。

## Background

- API 运行在 Cloudflare Workers，使用 Hono、D1 和 Web Streams API。
- `apps/api/src/modules/llm-config` 已负责 LLM 配置、活动配置选择和 API Key 加密存储，同一时间只有一条活动配置。
- 单聊流式调用位于 `apps/api/src/modules/chat/chat.provider.ts`，群聊非流式调用位于 `apps/api/src/modules/group-chat/group-chat.provider.ts`，两处分别实现 OpenAI-compatible 请求。
- `apps/api/src/modules/chat/chat.analysis.ts` 和 `apps/api/src/modules/group-chat/group-chat.orchestration.ts` 直接创建 `ChatOpenAI`，共包含多处 structured output 调用。
- `ChatCompletionMessage` 和 `ChatProviderConfig` 定义在 `chat.service.ts`，导致群聊依赖单聊业务类型。
- 当前上游使用 OpenAI Chat Completions 兼容协议，支持自定义 `baseURL`、`model`、`apiKey` 和 `disableThinking`。
- 项目已有 `docs/architecture.md` 和 `docs/apps/api.md`，本次只补 AI 模块相关边界。

## Requirements

### Module boundary

- AI 模块放在 `apps/api/src/infra/ai`，符合项目“外部资源接入放在 `infra`”的目录约定，不新增只被 API 使用的共享 package。
- `llm-config` 继续负责持久化、加密和活动配置选择，不执行上游请求。
- AI Provider 负责认证参数、协议请求、流解析、超时、取消和上游错误规范化，不读取 D1 或业务配置。
- AI runtime 负责文本生成、structured output、工具执行循环和统一事件，不依赖 chat、group-chat 或 Hono route。
- chat、group-chat 和 LangGraph 节点只调用 AI runtime，不直接依赖 `openai` SDK 或 OpenAI 协议类型。

### Protocol and provider

- 首版只实现 `openai-chat-completions` 协议，保留按协议标识注册其他实现的入口。
- 协议标识、Provider 定义和连接配置分开建模；Provider registry 按 `api` 选择实现，不按 `providerName` 写分支。
- 使用官方 `openai` SDK，不自行实现 HTTP、SSE parser 或 SDK 内部网络行为。
- 只有 `apps/api/src/infra/ai/providers/openai-compatible` 可以引用 `openai` SDK 类型，导出边界全部转换为 MoodMate 内部类型。
- Provider 向 SDK 传入后台保存的 `apiKey`、`baseURL`，并保持 90 秒超时、`maxRetries: 0` 和调用方 `AbortSignal`。
- LLM 配置继续允许任意 OpenAI-compatible `baseURL`、`model` 和 `apiKey`，不限制为代码内静态服务商清单。
- LLM 配置持久化 `api` 字段；现有记录迁移为 `openai-chat-completions`，无需重新录入 API Key。

### Generation contract

- 统一消息支持 `system`、`user`、`assistant`、工具调用和工具结果。
- 统一生成参数至少支持 `temperature`、`maxTokens`、`AbortSignal` 和受控的 Provider 特有选项。
- 非流式结果包含 assistant 内容、tool calls、usage 和 finish reason。
- 内部流事件至少包含 `start`、`text-delta`、`tool-call-delta`、`tool-call`、`usage`、`finish` 和 `error`。
- 现有 Web chat 接口继续返回纯文本 `ReadableStream<Uint8Array>`；chat 边界只转发内部 `text-delta`，本次不修改 Web 流协议。

### Structured output

- `generateObject<T>()` 接受 Zod 4 schema，AI runtime 将其转成 JSON Schema 后交给 Provider。
- Provider 的 structured output 协议只依赖 JSON Schema，不依赖 Zod。
- 模型返回后必须用原 Zod schema 再次校验；无效结果返回统一的 `invalid_output` 错误。
- 保留现有 OpenAI-compatible 服务的兼容策略，允许按明确顺序尝试受支持的 structured output 方法。

### Tool calling

- 工具由业务在每次生成调用时显式传入，不使用全局可变工具注册表。
- 工具参数使用 Zod schema，执行前必须校验。
- runtime 默认最多执行 5 轮模型调用；同一轮的多个工具调用顺序执行。
- 未注册工具、参数无效和执行失败转换为规范化 tool result，可交回模型继续生成。
- `AbortSignal` 同时中止模型请求和尚未开始的工具执行。
- 工具日志只记录名称、耗时和结果状态，不记录完整参数与返回值。

### Existing orchestration

- 保留 `@langchain/langgraph` 负责聊天分析和群聊业务流程，可继续使用 `@langchain/core` prompt 工具。
- 移除业务模块中的 `ChatOpenAI` 和 `withStructuredOutput()`；Graph 节点改用 `ai/runtime.generateObject()`。
- 完成迁移后从 `apps/api` 移除 `@langchain/openai`。
- 业务层继续拥有 prompt、记忆、会话、Agent 选择、失败时的业务默认结果和用户可见文案。

## Out Of Scope

- 将 AI 模块提取到 `packages/*` 或发布成 SDK。
- 首版接入 Anthropic、Gemini 等原生协议。
- 图片、音频、embedding、rerank、reasoning 展示和前端结构化事件协议。
- Pi 的模型目录、OAuth、CLI、TUI、session 和插件系统。
- 全局动态工具市场、后台配置工具、并行执行有副作用的工具。
- 重写 LangGraph 业务流程、聊天记忆和数据库领域模型。

## Acceptance Criteria

- [ ] `design.md` 写清 `apps/api/src/infra/ai` 的目录、公开接口和禁止依赖方向。
- [ ] `design.md` 写清普通生成、structured output、流式生成和工具循环的数据流。
- [ ] `design.md` 写清 `llm-config`、AI 模块、chat、group-chat 和 LangGraph 的职责。
- [ ] `design.md` 写清上游错误分类、业务错误转换位置、日志字段和敏感信息保护。
- [ ] `design.md` 写清 `api` 字段迁移、现有调用替换顺序和各阶段回滚方式。
- [ ] `implement.md` 列出文件级实施步骤和对应验证。
- [ ] 规划覆盖现有单聊流、群聊文本、配置测试和全部 `ChatOpenAI` 调用点。
- [ ] 现有 Web 纯文本流、90 秒超时、请求取消和业务默认结果保持不变。
- [ ] 用户审阅 `prd.md`、`design.md` 和 `implement.md` 后，才启动实现。
