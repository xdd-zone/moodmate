# 技术设计

- `LoginForm` 重构为欢迎状态和登录状态两个视图，继续保持单个客户端组件。
- `app/(site)/page.tsx` 挂载登录组件；删除旧 `app/(auth)/login/page.tsx`。
- 新 `app/(auth)/auth/callback/github/page.tsx` 渲染静态说明；删除旧回调页面。
- 邮箱表单作为登录面板内的次级方式，不在欢迎首屏展示。
- 继续使用 `readClientSession`、`loginWeb` 和现有错误类型。删除路由后用 `rg` 检查 GitHub OAuth 客户端代码；没有调用方的旧 state、跳转和 ticket 兑换代码随本任务删除。
