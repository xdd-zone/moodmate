# 技术设计

## 范围

- `apps/web/src/components/auth/login-form.tsx` 负责欢迎页、登录面板、分段切换、邮箱表单、密码显隐和第三方登录按钮。
- `apps/web/src/components/moodmate/moodmate.css` 负责按原型还原登录页尺寸、间距、排版、状态、响应式和减少动态效果模式。
- `apps/web/src/api/github-auth.api.ts` 使用现有 typed HTTP 调用 GitHub authorize 和 ticket login 合同。
- `apps/web/src/auth/login-client.ts` 保存 OAuth state、发起浏览器跳转、兑换 ticket 并复用 `saveClientSession`。
- `apps/web/app/(auth)/login/github/callback/page.tsx` 处理 OAuth 返回状态；删除现有静态 `apps/web/app/(auth)/auth/callback/github/page.tsx`。
- API、数据库和 `@repo/contracts` 不需要修改。

## 页面状态

`LoginForm` 保留 `welcome` 与 `login` 两个阶段，并在登录阶段增加 `email` 与 `oauth` 两种方式。邮箱请求和 GitHub authorize 请求分别使用 transition 状态，统一派生当前是否忙碌。

- 从欢迎页进入登录面板时，先播放原型离场动画，再显示面板并聚焦邮箱输入。
- 返回欢迎页时清除本次错误和字段校验，恢复主按钮焦点。
- 登录请求期间不允许返回、切换方式或重复提交。
- Google 点击只设置说明文字，不进入忙碌状态。

## GitHub OAuth 数据流

```text
GitHub 按钮
  -> GET /auth/web/github/authorize
  -> sessionStorage 保存 state
  -> 跳转 GitHub authorize URL
  -> GitHub 返回 API /auth/web/github/callback
  -> API 校验 GitHub 并生成一次性 ticket
  -> API 重定向 Web /login/github/callback?ticket=...&state=...
  -> Web 比较 URL state 与 sessionStorage state
  -> POST /auth/web/github/ticket/login
  -> saveClientSession
  -> /chats
```

浏览器 URL 不接收 GitHub access token、MoodMate access token 或 refresh token。callback 先消费本地 state，再兑换一次性 ticket；`useRef` 防止 React Strict Mode 重复 effect 发出第二次兑换请求。

## 合同与错误

- `getWebGithubAuthUrl()` 使用 `WebGithubAuthUrlResponseSchema`。
- `loginWithWebGithubTicket()` 使用 `WebGithubTicketLoginResponseSchema`。
- authorize 与 ticket login 的 API 失败使用 `HttpRequestError.message`；其他浏览器错误使用写明失败动作的中文说明。
- callback URL 的 `error` 优先显示；没有 error 时再检查 ticket 和 state。
- callback 兑换失败但本地已经有有效 session 时直接进入 `/chats`，避免重复 effect 造成假失败页。

## 视觉实现

原型 `login.html` 是尺寸和交互基准。正式代码继续使用共享 Latte / Mocha token，将原型中的 `bg`、`surface`、`fg`、`muted`、`border` 和 `accent` 映射到现有语义变量。保留原型的 74px 导航、458px 登录面板、双竖线装饰、分段滑块、52px 第三方按钮、页脚位置和 760px / 650px 响应条件。

不复制原型内联 SVG；现有 `lucide-react`、`react-icons` 和 `@repo/ui` 有对应图标与控件时直接复用。

## 兼容与回退

- 邮箱登录、session schema、token refresh 和受保护页面不变。
- GitHub OAuth 前端代码是对现有 API 的恢复，不改变跨包合同。
- 出现回归时可以整体撤销 Web typed API、OAuth client action 和 callback 页面；邮箱登录仍可继续使用。
- 没有真实 GitHub client id 和 secret 时不能完成外部授权，浏览器验证覆盖页面、请求路径、无配置错误和 callback 错误状态。
