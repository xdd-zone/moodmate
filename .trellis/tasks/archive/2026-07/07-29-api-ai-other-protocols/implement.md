# AI 其他协议实施计划

## 1. Contracts And Admin

- [x] 在 `packages/contracts/src/llm/llm-config.contract.ts` 的 `LlmConfigApiSchema` 增加 `anthropic-messages` 和 `openai-responses`，保持默认协议不变。
- [x] 在 Admin 配置表单状态中加入 `api`，编辑时读取已有值，新建时使用默认值。
- [x] 增加协议 `<select>`，创建、更新和连接测试都提交 `api`。
- [x] 仅在 `openai-chat-completions` 下显示和提交 `disableThinking`，按协议显示 Base URL placeholder。
- [x] 更新表单中只支持 OpenAI 协议的旧说明。

验证：`pnpm --filter @repo/contracts check-types`（若无该脚本则由根 `pnpm check-types` 覆盖）、`pnpm --filter admin check-types`。

## 2. Protocol Types And Registry

- [x] 扩展 `AiApi` 为三个协议值。
- [x] 调整 `ResolvedLlmConnection` 与活动配置解析，只为 `openai-chat-completions` 构造 `disableThinking` provider option。
- [x] 在静态 Provider registry 注册 Anthropic Messages 和 OpenAI Responses。
- [x] 更新只提到首版单协议的局部注释和 AI code-spec。

验证：搜索 registry 与 contracts，三个协议值一致；`pnpm --filter api check-types`。

## 3. Shared OpenAI SDK Error Mapping

- [x] 把现有 OpenAI SDK 错误分类移到 `providers/openai-sdk-error.ts`。
- [x] 让 Chat Completions 与 Responses 共用同一实现，保持现有错误 code、中文消息和安全 metadata 不变。
- [x] 删除移动后产生的无用 import，不改其他 Chat Completions 映射逻辑。

验证：`pnpm --filter api check-types`。

## 4. Anthropic Messages Provider

- [x] 在 workspace catalog 和 `apps/api/package.json` 增加 `@anthropic-ai/sdk@0.91.1`，更新 lockfile。
- [x] 实现 system、user、assistant、tool use 和 tool result 消息转换。
- [x] 实现工具声明和强制 function structured output；对不支持的 response format 在请求前返回 `invalid_response`。
- [x] 实现非流式结果、usage、finish reason 和 Anthropic SDK 错误映射。
- [x] 实现文本与工具参数流式事件合并，保持 `start -> delta/tool -> usage -> finish` 顺序。
- [x] 使用配置的 API Key、Base URL、model，设置 90 秒超时、`maxRetries: 0` 和 AbortSignal。

验证：TypeScript 覆盖所有 SDK block/event 联合分支；`pnpm --filter api check-types`。

## 5. OpenAI Responses Provider

- [x] 实现 Responses input message、function call、function output 和工具声明转换。
- [x] 实现 `json_schema`、forced function 和 `json_object` 请求格式。
- [x] 实现非流式 output、usage、finish reason 映射。
- [x] 实现文本与 function arguments 流事件合并，处理 completed、incomplete 和 failed 终止事件。
- [x] 设置 `store: false`，把 `max_output_tokens` 最小值钳制为 16，并复用现有 OpenAI SDK 错误映射。

验证：TypeScript 覆盖相关 Responses output item 与 stream event；`pnpm --filter api check-types`。

## 6. Structured Output Runtime

- [x] 调整 `generateObject()` 的 fallback 错误保留规则：模型已返回但 Zod 校验失败后，后续协议能力不支持错误不能覆盖 `invalid_output`。
- [x] 确认 Anthropic function 与 Responses JSON Schema 返回值都进入现有 Zod 校验。

验证：检查三种 Provider 的 structured output 方法路径；`pnpm --filter api check-types`。

## 7. Full Validation

- [x] 运行 `pnpm check-types`。
- [x] 运行 `pnpm lint`。
- [x] 运行 `pnpm format:check`。
- [x] 运行 `pnpm --filter api exec wrangler deploy --dry-run`，检查 Cloudflare Workers 打包兼容性。
- [x] 检查 git diff，只保留本任务直接相关文件。
- [x] 如没有可用 Anthropic/OpenAI API Key，明确记录未执行真实上游连接测试。

验证结果：

- `pnpm check-types`、`pnpm lint`、Admin build 和 Wrangler dry run 通过。
- 本任务全部改动文件通过 Prettier。根 `pnpm format:check` 仍被 68 个本任务前已有的 `.pi`、历史 Trellis 任务和 workspace 文件阻塞，本任务未修改这些文件。
- 使用 SDK 类型一致的模拟事件检查了两种协议的 mapper、工具参数增量、usage 和 finish 顺序。
- 没有使用真实 Anthropic 或 OpenAI API Key，未执行真实上游请求。

回滚点：本次无数据库 migration。新增依赖、Provider registry、contracts 枚举和 Admin 选择可一起回退；旧 OpenAI Chat Completions 数据不需要迁移。
