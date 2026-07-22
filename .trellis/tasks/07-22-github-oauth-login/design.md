# GitHub OAuth 登录技术设计

## 边界

- `packages/contracts` 定义授权 URL 和 ticket 登录的跨端协议。
- `apps/api/src/modules/auth` 负责 OAuth 配置、GitHub HTTP 调用、账号归属、ticket 和 moodmate session。
- `apps/web/src/api` 负责 typed HTTP 调用，`apps/web/src/auth` 负责浏览器 state 和 session，`app/(auth)` 与登录组件负责交互。
- D1 保存 OAuth 绑定和 ticket 摘要；GitHub access token 只存在于 API callback 的内存中。

## 数据流

```text
登录按钮
  -> API authorize
  -> sessionStorage 保存 state
  -> GitHub authorize
  -> API callback 校验 state
  -> GitHub code 换 token
  -> GitHub profile + emails
  -> 查找、绑定或创建用户
  -> D1 保存 ticket 摘要
  -> Web callback 收到 ticket + state
  -> Web 校验浏览器 state
  -> API 原子消费 ticket
  -> 创建 auth_session + refresh_token
  -> Web 保存统一登录响应
  -> /app
```

## 数据库

- `oauth_accounts` 保存 provider、GitHub user id、当前 login 和关联邮箱。唯一键为 `(provider, provider_user_id)`。
- `oauth_login_tickets` 保存 ticket 的 SHA-256 base64url 摘要、用户、应用、provider、创建时间、过期时间和使用时间。
- ticket 消费通过 D1 batch 的条件更新与结果检查完成，避免并发请求重复使用。
- migration 同时启用 Web 应用的 GitHub 登录方式，并保留重复执行时的确定行为。

## OAuth 与会话

- state 格式为 `nonce.issuedAtMs.signature`，签名使用 `AUTH_REFRESH_SECRET` 的 HMAC-SHA256，有效期 10 分钟。
- ticket 使用 UUIDv7 原文，有效期 2 分钟；D1 只保存摘要。
- GitHub 邮箱按“已验证主邮箱、任意已验证邮箱、GitHub profile 邮箱”选择。没有可用邮箱时拒绝登录。
- 用户匹配顺序固定为 OAuth 绑定、规范化邮箱、创建新用户。
- ticket 登录调用与密码登录相同的 Web session/token 签发路径，保持 `WebAuthTokenResponse` 不变。

## 配置

- API 新增 `WEB_ORIGIN`、`GITHUB_OAUTH_CLIENT_ID`、`GITHUB_OAUTH_CLIENT_SECRET` 和 `GITHUB_OAUTH_CALLBACK_URL`。
- `WEB_ORIGIN` 和 callback URL 按 HTTP URL 校验并去除末尾斜杠。
- GitHub client id 和 secret 只在使用 GitHub 登录端点时要求存在，不能阻止未配置 OAuth 的 API 启动。
- Wrangler 只保存非敏感默认值；secret 只写在忽略提交的 `.dev.vars` 或 Cloudflare secret。

## 错误处理

- authorize 和 ticket/login 使用统一 JSON 失败响应。
- callback 无论 GitHub 拒绝、参数错误还是服务失败，都重定向到 Web callback，并通过 `error` query 返回可显示的中文说明。
- 外部 GitHub 响应按 HTTP 状态与必要字段检查，不信任未经校验的 JSON。

## 兼容与回滚

- 不改变密码登录、refresh、profile 的合同。
- 新表和新路由是增量能力；回滚代码不会影响原有密码登录，但已应用 migration 时保留新表和数据。
