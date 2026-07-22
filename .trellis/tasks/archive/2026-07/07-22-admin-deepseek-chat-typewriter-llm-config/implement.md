# 实施清单

## 1. Contract 与依赖

- [x] 新增 companion chat Contract，并从 `packages/contracts/src/index.ts` 导出 schema 和类型。
- [x] 在 workspace catalog 和 `apps/web/package.json` 增加 AI SDK、流式消息渲染与图标所需的最小依赖。
- [x] 运行 `pnpm install` 更新 lockfile。

## 2. API 配置

- [x] 给 `ApiBindings`、`ApiEnv` 和 `getApiEnv()` 增加可选 `DEEPSEEK_*` 字段。
- [x] 在 `wrangler.jsonc` 写入 `https://api.deepseek.com` 和 `deepseek-v4-flash`。
- [x] 在 `.dev.vars.example` 增加 DeepSeek Key 占位说明，不读取或输出本地真实 Key。

## 3. 聊天 API

- [x] 创建 `apps/api/src/modules/chat`，按 route、service、provider 分开。
- [x] 路由复用 `requireWebAccess` 并使用共享 Contract 校验请求。
- [x] service 提取文本消息、构造非医疗 AI 伴侣提示词并按优先级选择 LLM 配置。
- [x] provider 调用 OpenAI-compatible `/chat/completions`；平台 DeepSeek 显式关闭思考模式，处理上游错误并把 SSE 转成纯文本流。
- [x] 在 `apps/api/src/routes/index.ts` 挂载 `/rpc/chat/companion`。

## 4. 浏览器 LLM 配置

- [x] 新增版本化 localStorage 模块，完成读取、校验、规范化、保存、启用读取、删除和变更事件。
- [x] 新增 LLM 设置视图，完成 Provider、Base URL、Model、API Key、启用、保存和删除交互。
- [x] 确认页面、日志、URL 和 Contract 响应没有输出 API Key。

## 5. 聊天 App UI

- [x] 把 `WebDashboardGuard` 登录成功视图替换为聊天 App shell，保留 profile 校验、主题切换和退出。
- [x] 增加对话列表、消息气泡、输入框、发送、停止、连接中和错误状态。
- [x] 用 `TextStreamChatTransport` 调用 API 子站，并在每次发送时读取最新 access token 和本地 LLM 配置。
- [x] assistant 消息增加 Unicode 安全的逐字显示；减少动态效果模式直接显示全文。
- [x] 完成桌面侧栏、移动顶部栏和移动视图切换，源码检查确认固定区域使用稳定尺寸和可滚动主区。

## 6. 验证

- [x] 没有 token 时请求 `/rpc/chat/companion`，确认返回 401 统一错误。
- [ ] 登录后不配置任何 LLM Key，确认返回明确的平台配置缺失错误。
- [ ] 使用可用的 DeepSeek 或本地 OpenAI-compatible 配置，确认能收到 `text/plain` 流并逐字显示。
- [ ] 发送中点击停止，确认浏览器和上游请求结束。
- [ ] 保存、刷新、关闭和删除本地配置，确认优先级和 localStorage 行为正确。
- [ ] 依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。
- [x] 使用本机 OpenAI-compatible SSE 服务，确认登录请求收到 `text/plain` 流和 Unicode 正文。
- [x] 运行 `pnpm --filter web build`。
- [x] 不运行浏览器测试；用源码检查和可执行的命令行请求覆盖鉴权、错误、流式 header 与取消信号边界。

全仓 `pnpm format:check` 只剩 3 个本任务开始前已有的 Trellis archive/workspace 文件不合规。本任务文件已单独通过 Prettier 检查，未修改这些既有文件。

## 7. 检查点

- [x] 对照三个章节，确认没有遗漏最终状态需要的 DeepSeek、SSE、typewriter 和本地 LLM 配置能力。
- [x] 对照 bobo 参考实现，确认没有复制后续 Agent、memory、群聊、Responses API 或多配置能力。
- [x] 只修复本任务引入的类型、Lint、Format 和构建问题。
