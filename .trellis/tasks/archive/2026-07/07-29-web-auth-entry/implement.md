# 执行计划

- [x] 重构登录组件的欢迎与登录状态。
- [x] 让 `/` 成为唯一登录入口，删除 `/login` 和旧 GitHub 回调路由。
- [x] 新增静态 `/auth/callback/github` 页面。
- [x] 接回邮箱密码操作，增加 GitHub 和 Google 静态状态。
- [x] 删除失去调用方的 Web GitHub OAuth 客户端代码，不修改 API 服务。
- [x] 检查键盘、焦点、错误和减少动态效果。
- [x] 运行类型、Lint、本任务 Format 检查和 Web build。

## 验证记录

- `pnpm check-types`：通过。
- `pnpm lint`：通过。
- `pnpm exec prettier --check apps/web .trellis/spec/web/frontend .trellis/tasks/07-29-web-auth-entry`：通过。
- `pnpm --filter web build`：通过。
- `pnpm format:check`：被 70 个任务外既有文件阻塞；用户已批准本次忽略，不修改无关文件。
- 浏览器：检查 1440×900、1280×720 和 390×844；欢迎切换、焦点、Escape、静态 OAuth、旧路由 404 和回调静态状态均通过。
