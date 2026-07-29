# 实现 AI 其他协议

## Goal

参考 `/Users/wuwanzhu/Code/pi/packages/ai` 的 wire protocol 分层，为 `apps/api/src/infra/ai` 增加原生协议实现。业务模块继续只调用现有 AI runtime，通过模型配置的 `api` 字段选择协议，不解析上游请求或响应。

## Background

- 当前 `AiApi`、`packages/contracts` 和 Provider registry 只支持 `openai-chat-completions`，对应 Pi 的 `openai-completions` API。
- 当前连接配置只有 `apiKey`、`baseURL`、`model`、`providerName`，另有 OpenAI-compatible 专用的 `disableThinking`。
- Admin 模型配置表单当前不提交 `api`，create、update 和 test 都使用服务端默认的 `openai-chat-completions`；若不增加协议选择控件，新增协议无法通过现有管理流程启用。
- 本次只新增 `anthropic-messages` 和 `openai-responses`。二者可以沿用当前 API Key、Base URL 和模型名配置。
- 现有 AI runtime 已统一普通生成、文本流、structured output、工具调用、usage、finish reason 和错误模型；新增协议应适配这些内部契约，不改变 chat、group-chat 的调用方式。

## Requirements

- Provider registry 继续只按 `api` 选择协议实现，不按 `providerName` 分支。
- 每个新增 Provider 把内部 `AiMessage`、工具、structured output 和生成参数转换为对应协议，并把普通响应、流事件、usage、finish reason 和错误映射回内部类型。
- 保持现有 `generateText()`、`streamText()`、`generateObject()` 和工具循环公开签名；协议差异限制在 `infra/ai/providers/*` 与受控的 `providerOptions`。
- LLM 配置的 create、update、list、test、activate 和活动配置解析必须接受本次支持的协议值；连接测试继续走 AI runtime。
- Admin 模型配置表单增加协议选择，创建、编辑和连接测试都提交所选 `api`；编辑已有配置时显示其实际协议。
- `disableThinking` 只适用于 `openai-chat-completions`，Admin 仅在该协议下显示并提交此选项。
- 现有 `openai-chat-completions` 配置和行为保持兼容，不要求重新录入 API Key。
- `anthropic-messages` 使用官方 `@anthropic-ai/sdk`，`openai-responses` 复用现有官方 `openai` SDK；不自行实现 SDK 已提供的 SSE parser。
- 错误和日志不得包含 API Key、Authorization、完整 prompt、完整工具参数、完整工具结果或原始上游错误体。
- 本次只实现文本、structured output 和 function/tool calling；不增加图片生成、音频、embedding、rerank、模型目录或动态 Provider 注册。

## Acceptance Criteria

- [ ] `AiApi`、contracts 和 Provider registry 同时包含 `openai-chat-completions`、`anthropic-messages` 和 `openai-responses`。
- [ ] `anthropic-messages` 和 `openai-responses` 都支持非流式文本生成、流式文本、工具调用、usage 与 finish reason 映射。
- [ ] 每个新增协议按自身能力支持 structured output；不支持的方法返回可识别错误，由 runtime 按既定顺序切换。
- [ ] 管理端可以选择并保存新增协议，连接测试按所选协议发出请求。
- [ ] 现有 OpenAI Chat Completions 配置、Web 纯文本流和业务 runtime 调用不变。
- [ ] 新增依赖可在 Cloudflare Workers 构建目标中使用。
- [ ] 按顺序通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。
- [ ] 对无法连接真实上游的协议，至少完成可检查的 mapper/stream contract 验证，并明确记录未做的真实请求验证。

## Out Of Scope

- `google-generative-ai`、`mistral-conversations`、`openai-codex-responses`、`azure-openai-responses`、`google-vertex`、`bedrock-converse-stream`。
- Pi 的模型 catalog、Provider catalog、凭据仓库、OAuth CLI、session 和跨模型 handoff。
- 修改 chat、group-chat 的业务 prompt、工作流、数据库领域模型或前端流协议。
- 自动发现上游模型。
