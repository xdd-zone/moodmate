# 执行计划

- [x] 按 `login.html` 重构 `LoginForm` 的登录面板，增加分段切换、密码显隐、键盘交互和稳定的忙碌状态。
- [x] 调整 `moodmate.css` 中登录页样式，逐项核对原型的尺寸、间距、动画、响应式和两种主题。
- [x] 恢复 `github-auth.api.ts`，使用现有 contracts schema 调用 authorize 与 ticket login。
- [x] 扩展 `login-client.ts`，保存和消费 OAuth state、跳转 GitHub、兑换 ticket 并保存 Web session。
- [x] 恢复 `/login/github/callback`，处理成功、失败、参数缺失、state 不匹配和重复 effect；成功后进入 `/chats`。
- [x] 删除静态 `/auth/callback/github`，更新 Web 规范中已经过时的“GitHub 暂未开放”和旧路由说明。
- [x] 依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`，修正本任务引入的问题。
- [x] 运行 `pnpm --filter web build`。
- [x] 启动 `pnpm dev:web`；如需验证接口错误路径，同时启动 `pnpm dev:api`。
- [x] 在 1440×900、1280×720、390×844 检查欢迎页、登录面板、分段切换、密码显隐、GitHub 等待与失败、Google 未开放、callback 错误、Latte、Mocha 和减少动态效果。
- [x] 检查浏览器控制台、网络请求、资源加载和页面像素，确认没有新增运行错误、hydration warning、空白区域或内容重叠。

## 验证记录

- `pnpm check` 通过，包括类型检查、ESLint 和 Prettier。
- `pnpm --filter web build` 通过，构建路由包含 `/login/github/callback`。
- `http://localhost:6153/`、`http://localhost:6153/login/github/callback?error=test` 和 `http://localhost:6155/health` 返回 200；`http://localhost:6153/auth/callback/github` 返回 404。
- 浏览器已检查三个目标视口、Latte、Mocha、减少动态效果、键盘切换、密码显隐、Google 未开放和 callback 错误状态。
- 未执行真实 GitHub 用户授权，外部完整流程需要可用的 GitHub OAuth 配置和用户授权。

## 风险文件与回退点

- `login-form.tsx` 同时承载邮箱和 GitHub 登录，必须保证任一请求失败不会锁死另一种方式。
- `login-client.ts` 继续共用 `saveClientSession`，不能修改本地 session 格式。
- `/login/github/callback` 必须和 API 的 `WEB_ORIGIN`、`GITHUB_OAUTH_CALLBACK_URL` 约定一起验证，不能私自改 API 返回路径。
- `moodmate.css` 是多个 Web 页面共用文件，本次只修改 `moodmate-auth` 选择器。

## 启动实现前检查

- [x] `prd.md`、`design.md` 和 `implement.md` 已经由用户审阅。
- [x] `python3 ./.trellis/scripts/task.py validate 07-31-web-login-github-oauth` 通过。
- [x] 用户明确批准运行 `task.py start`。
