# 实现 Admin BFF 与登录态

## Goal

让 Admin 浏览器通过同源 Next.js BFF 完成登录、session 恢复、静默 refresh 和 logout，token 始终留在 HttpOnly cookie 和服务端请求中。

## Dependency

- 父任务：`07-16-auth-schema`。
- 前置任务：`07-16-auth-d1-schema` 和 `07-16-admin-auth-api` 必须完成。
- 本任务完成后回到父任务执行 6154/6155 联调。

## Requirements

- `API_BASE_URL` 只供 Next.js 服务端使用，浏览器请求使用同源相对地址。
- 实现 login、session、refresh 和 logout Route Handler。
- token 只保存到两个 HttpOnly cookie，不保存 session JSON cookie。
- cookie 使用共同 helper，set/delete 的名称、Path、Secure 和 SameSite 一致。
- POST auth Route Handler 检查同源 `Origin`。
- BFF 调 Hono 受保护端点时附加 Bearer access token，不把 token 返回给浏览器。
- Next.js 16 `proxy.ts` 只按 cookie 存在性做快速跳转，不请求 Hono 或执行 refresh。
- 浏览器只对明确的 `AUTH.ACCESS_EXPIRED` 发起 refresh；同一标签页并发请求共享一个 refresh Promise。
- refresh 成功后原请求最多重试一次；其他 401 或 refresh 失败进入登录页。
- 提供可操作的登录页、受保护根页面和 logout 命令。

## Acceptance Criteria

- [ ] 浏览器 Network 中认证和受保护请求只访问 Admin 同源地址。
- [ ] access 和 refresh cookie 是 HttpOnly，浏览器 JavaScript 无法读取。
- [ ] BFF JSON、页面 props、React Query cache、URL 和 console 不出现 token。
- [ ] 登录成功进入受保护页面，刷新浏览器后能通过 session 接口恢复安全的用户信息。
- [ ] access 到期时同一标签页的并发请求只发起一次 refresh，各原请求最多重试一次。
- [ ] refresh 失败、session 撤销和非续期 401 不会形成请求循环。
- [ ] logout 无论 Hono 响应成功还是凭证已失效，都清除两个 cookie 并回到登录页。
- [ ] `proxy.ts` 没有 `fetch()`、JWT 验签、数据库访问或 refresh 逻辑。
- [ ] Route Handler 自己执行认证和授权，不依赖 `proxy.ts` 提供安全保证。
- [ ] 本地 6154/6155 完成登录、刷新页面、静默 refresh 和 logout 联调。
- [ ] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 依次通过。

## Out Of Scope

- Web 子站、注册、OAuth 和 session 管理页面。
- 多标签页 refresh 协调或 replay 宽限。
- 生产域名 cookie 验证和生产部署。
