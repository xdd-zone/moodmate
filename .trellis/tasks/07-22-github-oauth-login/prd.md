# 实现 GitHub OAuth 登录

## Goal

为 Web 用户端增加 GitHub OAuth 登录。GitHub 只负责确认外部身份，API 最终仍签发 moodmate 自己的 access token、refresh token 和 Web session。

## Background

- 需求来源：`docs/temp/37-github-oauth-login.txt`。
- 课程参考仓库：`/Users/wuwanzhu/Code/bobo/ai-agent`。
- moodmate 已有 Web 密码登录、JWT、refresh rotation、`web_user` 角色和浏览器 session 保存。
- 当前认证 schema 已预留 `github` provider，但没有 OAuth 账号、登录 ticket、GitHub 路由和 Web 回调实现。
- 本地端口以 moodmate 为准：Web 使用 `6153`，API 使用 `6155`。

## Requirements

- `GET /auth/web/github/authorize` 返回由 API 生成的 GitHub 授权 URL 和带签名的短时 state。
- `GET /auth/web/github/callback` 校验 state，用 code 换 GitHub access token，并读取 GitHub 用户资料和已验证邮箱。
- GitHub callback 必须进入 API；API 完成身份处理后，只把短时一次性 ticket 和 state 放入 Web 回调 URL，不把 GitHub token 或 moodmate token 放入 URL。
- GitHub 账号已绑定时复用原用户；未绑定但已验证邮箱对应现有用户时自动绑定；全新邮箱创建用户并授予 `web_user` 角色。
- `POST /auth/web/github/ticket/login` 原子消费未使用且未过期的 ticket，再复用现有 Web token/session 机制签发登录态。
- Web 登录页提供“使用 GitHub 登录”按钮。发起登录时把 state 写入 `sessionStorage`。
- Web 回调页校验 URL state 与 `sessionStorage` 中的 state，成功后用 ticket 换登录态并进入 `/app`；失败时显示可操作的中文错误并提供返回登录页入口。
- 新增 GitHub OAuth 配置时同步 Worker binding、环境解析、Wrangler 非敏感变量和 `.dev.vars.example`。Client secret 只能放在 API 私密环境变量中。
- 新增 D1 migration 和 Drizzle schema，OAuth 账号按 provider + provider user id 唯一，ticket 只保存摘要并只能消费一次。
- 接口请求和响应使用 `@repo/contracts` 的 Zod schema，API 成功响应继续使用统一 envelope。

## Acceptance Criteria

- [x] GitHub 授权 URL 包含 `client_id`、API callback、`read:user user:email`、签名 state 和 `allow_signup=true`。
- [x] 缺少 GitHub 配置、登录方式被禁用、state 无效或过期、GitHub 返回错误、没有已验证邮箱时，API 拒绝登录且不签发 moodmate token。
- [x] 已绑定账号、同邮箱已有账号、全新账号三条路径都得到 active Web 用户和 `web_user` 角色。
- [x] OAuth callback URL 只包含 ticket/state 或 error，不包含 GitHub access token、moodmate access token 和 refresh token。
- [x] ticket 过期、已使用或摘要不匹配时返回 401；同一 ticket 不能成功消费两次。
- [x] ticket 登录响应能通过 `WebAuthTokenResponseSchema`，保存后现有 `/rpc/user/profile` 和 token refresh 流程继续可用。
- [x] Web 登录按钮、等待状态、callback 成功和失败状态在移动端及桌面端可用，键盘可以聚焦主要操作。
- [x] 所有 D1 migrations 能应用到隔离的本地数据库，`PRAGMA foreign_key_check` 没有结果。
- [x] 依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`，并通过 `pnpm --filter web build`。

## Out Of Scope

- Google OAuth。
- Admin GitHub 登录。
- 修改现有 Web token 在 `localStorage` 中的保存方式。
- 自动创建或配置真实 GitHub OAuth App、线上 secret 和生产 D1。

## Notes

- 用户已明确要求创建任务并完成本节内容，可在规划文件通过校验后直接进入实现。
