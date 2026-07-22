# 实现 DeepSeek 对话、打字机输出与 LLM 配置

## Goal

在 Moodmate 用户端加入受登录保护的 AI 对话能力。用户可以使用平台 DeepSeek 配置，也可以只在当前浏览器保存并启用自己的 OpenAI-compatible LLM 配置；模型回复同时具备网络流式传输和前端逐字显示效果。

## Background

- Moodmate 的产品方向是面向消费者的 AI 伴侣聊天应用。用户注册、订阅后，通过对话框与可定制的 AI 人物长期交流，把它作为虚拟朋友使用。
- Moodmate 不是医疗产品，本次界面和模型提示词不得表达诊断、治疗、疗效或医疗替代关系。
- 课程范围来自 `docs/temp/35-deepseek-chat.txt`、`docs/temp/36-typewriter-output.txt` 和 `docs/temp/38-llm-configuration.txt`。
- 课程参考实现位于 `/Users/wuwanzhu/Code/bobo/ai-agent`，用于核对 Web、Contract、Hono API、鉴权、SSE 转换和本地 LLM 配置的调用关系。
- DeepSeek 中文官方文档确认：OpenAI-compatible Base URL 为 `https://api.deepseek.com`，对话接口为 `POST /chat/completions`，V4 Flash 模型 ID 为 `deepseek-v4-flash`。旧模型名 `deepseek-chat` 和 `deepseek-reasoner` 将于 2026-07-24 23:59 弃用，本次不使用旧名称。
- Moodmate 当前 `/app` 只有登录态恢复与账号信息，没有聊天组件、聊天 Contract、LLM 配置入口或 LLM API 路由。
- Moodmate 已有 Web access token、refresh token、统一 HTTP 请求模块和 `WebDashboardGuard`，聊天请求需要复用这套登录态，不能新增第二套认证方式。
- `07-21-admin-course-map` 已明确：课程阶段复现参考项目的模块边界、请求流和权限判断，不逐像素复制参考项目，也不复制它的 Agent、收件箱或商业业务数据。

## Requirements

- 在 `packages/contracts` 定义聊天消息、可选用户 LLM 配置和聊天请求 schema；AI SDK 的消息 part 只要求合法 `type`，其余字段允许透传。
- 在 `apps/api` 增加受 Web access token 保护的聊天路由，路由位于 API 子站，不使用 Next.js API Route。
- API 优先使用当前请求携带的 OpenAI-compatible 配置；未携带时回退到平台 `DEEPSEEK_*` 环境变量；两者都不可用时返回明确的统一 API 错误。
- 平台 DeepSeek 默认模型固定为 `deepseek-v4-flash`，并显式使用非思考模式；用户自定义 OpenAI-compatible 配置只发送标准 Chat Completions 字段。
- API 调用上游 `/chat/completions` 流式接口，把 SSE 中的 `delta.content` 转成 `text/plain` 流，不记录或返回 API Key 和上游响应正文。
- 在 Moodmate `/app` 中提供可实际发送、停止和查看错误状态的聊天界面；页面业务内容适配 Moodmate，不复制 bobo 的 Agent/收件箱数据。
- 页面使用消费者聊天 App 的信息层级：对话是主操作，账号与本地 LLM 配置是辅助操作；首个固定 AI 伴侣用于承接当前三章的聊天链路。
- AI 回复定位为虚拟朋友式日常交流，不显示医疗诊断、治疗建议或疗效承诺。
- 前端使用 AI SDK 管理消息和流式状态，并在显示层按 Unicode 字符逐步展示 assistant 文本；网络分块较大时仍保留逐字效果。
- 提供当前浏览器的 LLM 配置入口，至少包含启用状态、Provider 名称、Base URL、Model、API Key、保存和删除操作。
- 用户 LLM API Key 只存当前浏览器 `localStorage`，不写 D1、日志、URL、响应或仓库文件；聊天发送时临时传给 API 子站。
- 所有新增界面继续使用现有 Catppuccin 主题 token、共享 UI 组件和 `/app` 路由边界，同时支持桌面端、移动端和减少动态效果模式。

## Acceptance Criteria

- [ ] 未登录请求聊天接口时返回统一未授权错误，登录用户可以发起聊天请求。
- [ ] Contract 能接受 AI SDK 的文本和非文本 message part，API 只把非空文本传给模型。
- [ ] 配置 `DEEPSEEK_API_KEY` 后，未启用用户 LLM 配置也可以通过平台 `deepseek-v4-flash` 完成对话。
- [ ] 启用完整的本地 LLM 配置后，请求优先使用该配置；关闭或删除后恢复平台配置。
- [ ] 上游 SSE 被转换为 `text/plain; charset=utf-8`，响应包含禁止缓存和代理缓冲的 header，并支持前端停止请求。
- [ ] assistant 回复按 Unicode 字符逐步显示；内容替换、重试或大块到达时不会显示损坏字符。
- [ ] 本地配置刷新页面后仍可读取，API Key 不进入服务端持久化、日志、URL 或可提交配置。
- [ ] 聊天提交、生成中、停止、失败、配置缺失和空输入状态都有明确且可操作的界面反馈。
- [ ] 桌面端和移动端主要流程可用，键盘焦点清晰，减少动态效果模式不会强制播放逐字动画。
- [ ] 依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`，并通过 `pnpm --filter web build`。

## Out of Scope

- 不实现聊天记录、消息、LLM 配置的数据库持久化或多设备同步。
- 不实现 GitHub OAuth、图片生成、群聊、Agent、memory、tool calling、LangGraph 或 bobo 后续章节能力。
- 不实现注册、订阅计费、AI 人物创建与编辑、长期记忆；这些属于后续产品能力，本次只保留可继续扩展的页面位置和请求边界。
- 不实现多个本地 LLM 配置、连接测试接口、Responses API 自动回退或模型供应商目录。
- 不改 Admin 页面，也不把本次用户端 LLM 配置放进 Admin 系统设置。
- 不做浏览器自动化或手动浏览器测试；本次使用类型、Lint、Format、构建和命令行接口验证。
