# API AI Provider 实施计划

## 1. Database and contracts

- [ ] 新增 `apps/api/migrations/0015_add_llm_config_api.sql`，为现有配置补 `openai-chat-completions`。
- [ ] 更新 `apps/api/src/modules/llm-config/llm-config.schema.ts` 和 repository record 映射。
- [ ] 更新 `packages/contracts/src/llm/llm-config.contract.ts`，响应返回 `api`，现有 create/update/test 请求可省略并由服务端补默认值。
- [ ] 更新 `llm-config.service.ts`，输出新的 AI model 连接形状，但继续负责解密与活动配置选择。
- [ ] 检查 Admin 的配置列表和表单类型，确认新增响应字段不会改变当前交互。

验证：

- `pnpm --filter api check-types`
- `pnpm --filter admin check-types`
- 对已有本地 D1 执行 migration，确认旧记录的 `api` 值正确且 API Key 无变化。

回滚点：migration 只加有默认值的字段，不删除旧列；此阶段旧模型调用仍可运行。

## 2. AI core contracts

- [ ] 新建 `apps/api/src/infra/ai/types.ts`，定义协议、模型、消息、结果、usage、finish reason、事件、工具和 Provider 接口。
- [ ] 新建 `apps/api/src/infra/ai/errors.ts`，实现稳定错误 code 和安全 metadata。
- [ ] 新建只读 `provider-registry.ts`，注册 `openai-chat-completions`。
- [ ] 新建 `stream.ts`，实现内部事件流和纯文本字节流适配器。
- [ ] 新建 `index.ts`，只导出业务需要的 runtime API 和类型。

验证：

- 搜索 `apps/api/src/infra/ai`，确认没有 import chat、group-chat、llm-config、Hono 或 D1。
- `pnpm --filter api check-types`

## 3. Official SDK provider

- [ ] 把官方 `openai` 版本加入 `pnpm-workspace.yaml` catalog 和 `apps/api/package.json`。
- [ ] 实现 `providers/openai-compatible`，使用 `chat.completions.create()` 处理普通与流式生成。
- [ ] 映射内部消息、工具、tool choice、structured output、usage、finish reason 和 SDK errors。
- [ ] 实现 tool call 流式增量合并，SDK 类型不得从 Provider 目录导出。
- [ ] 显式传入后台连接参数、90 秒 timeout、`maxRetries: 0` 和 `AbortSignal`。
- [ ] 仅通过受控 Provider options 发送 `disableThinking`，业务模块不拼原始 request body。

验证：

- 用本地 mock 或开发 Provider 验证普通文本、文本流、structured output 和 tool calls。
- 检查日志不含 API Key、Authorization、完整 prompt 或原始错误体。
- `pnpm --filter api check-types`

回滚点：Provider 此时尚未替换聊天主路径，可直接移除新目录和依赖。

## 4. Runtime

- [ ] 实现 `generateText()` 和 `streamText()`，统一 registry 查找、错误传播和事件输出。
- [ ] 实现 `generateObject()`：Zod 转 JSON Schema、兼容方法切换、最终 Zod 校验。
- [ ] 实现工具执行循环：每次调用显式工具、参数校验、顺序执行、失败 tool result、取消和默认 5 轮限制。
- [ ] 确保只有明确的 structured output 不支持错误会切换方法，认证、限流、超时、取消和网络错误不重复请求。
- [ ] 将 `llm-config` 连接测试迁移到 AI runtime，保持原响应 DTO。

验证：

- 手动验证连接成功、错误 Key、错误 baseURL、超时和取消。
- 手动验证 Zod 无效输出、工具参数错误、工具执行异常和 5 轮上限。
- `pnpm --filter api check-types`

## 5. Chat text migration

- [ ] 把 `ChatCompletionMessage` 和 `ChatProviderConfig` 的业务依赖替换为 `@/infra/ai` 类型。
- [ ] 单聊改用 `streamText()` 和纯文本适配器，保持 `onComplete` 写库时机。
- [ ] 群聊回复改用 `generateText()`，保持现有 prompt、文本限制和业务 metadata。
- [ ] 手动验证浏览器中断请求、正常流结束、空文本和上游错误。
- [ ] 验证完成后删除 `chat.provider.ts` 和 `group-chat.provider.ts`。

验证：

- 用户端单聊仍逐字显示，刷新后 assistant 消息已保存。
- 群聊单回复、多回复和补充回应仍能生成并保存。
- `rg -n "chat/completions|new OpenAI|from \"openai\"" apps/api/src/modules` 无结果。
- `pnpm --filter api check-types`

回滚点：删除旧 Provider 文件前保留单独提交或清晰 diff，手动验证失败时恢复业务 import，不回退数据库 migration。

## 6. Structured output migration

- [ ] 将 `chat.analysis.ts` 的 structured output 调用改为 `generateObject()`，保留所有 schema、normalize 和业务 fallback。
- [ ] 将 `group-chat.orchestration.ts` 的 structured output 调用改为 `generateObject()`，保留 LangGraph 状态和本地规则 fallback。
- [ ] 用 `ChatPromptTemplate.formatMessages()` 或等价方式生成消息，不再把 prompt pipe 到模型客户端。
- [ ] 从 `apps/api/package.json` 和 catalog 的仅用位置移除 `@langchain/openai`；保留 `@langchain/core` 与 `@langchain/langgraph`。

验证：

- 覆盖安全、意图、情绪、关系阶段、回复策略和群聊选择等现有流程。
- 人工制造 structured output 失败，确认业务默认结果仍生效；取消请求仍向上抛。
- `rg -n "ChatOpenAI|withStructuredOutput|@langchain/openai" apps/api` 无结果。
- `pnpm --filter api check-types`

## 7. Documentation and full quality gate

- [x] 在 `docs/architecture.md` 补充 AI Provider、runtime、配置和依赖方向。
- [x] 在 `docs/apps/api.md` 补充目录、配置测试会产生少量 token、错误排查和新增协议步骤。
- [x] 如本次未引入测试框架，记录未自动覆盖的 Provider contract 风险，不自行安装依赖。
- [x] 运行项目规定的完整检查，修复本次改动引入的问题。

按顺序执行：

1. `pnpm check-types`
2. `pnpm lint`
3. `pnpm format:check`

手动验收：

- Admin 原有配置可读取、测试和激活，自定义 `baseURL` 可用。
- Web 单聊纯文本流协议没有变化。
- 群聊回复与 LangGraph 分析均通过同一 AI runtime 调用模型。
- 请求取消、90 秒超时、错误 Key、限流和无效 structured output 的行为符合设计。
- 仓库中只有 `apps/api/src/infra/ai/providers/openai-compatible` 引用官方 `openai` SDK。
