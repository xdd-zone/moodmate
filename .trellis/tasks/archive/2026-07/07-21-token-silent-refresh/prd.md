# 实现 Token 静默刷新

## Goal

按 `docs/temp/34-token-silent-refresh.txt` 完成 Web 用户端登录态与 Token 静默刷新。用户登录后进入 `/app`，access token 过期时由统一 HTTP 模块刷新登录态并重试原请求；refresh 失败时清除本地登录态并回到登录页。

## Confirmed Facts

- Web HTTP 模块位于 `apps/web/src/lib/http/index.ts`，当前使用原生 `fetch` 和 Zod 校验统一响应，不使用文档示例中的 Axios。
- API 已实现 Admin 密码登录、access 鉴权、refresh rotation 和 logout，Web 认证尚未实现。
- 当前认证错误码包含 `AUTH.ACCESS_EXPIRED`、`AUTH.ACCESS_INVALID`、`AUTH.ACCESS_MISSING`、`AUTH.REFRESH_INVALID`、`AUTH.REFRESH_REPLAYED` 和 `AUTH.SESSION_REVOKED`，没有 `AUTH.UNAUTHORIZED`。
- 数据库已有 `web` application 和 `web_user` role，但 `auth_sessions.session_type` 只允许 `admin`。
- 开发种子数据只给 Admin application 启用了 password，并且本地账号只绑定 `admin_owner`。
- `/app` 当前是服务端占位页；`/login`、Web 客户端 session、Web profile 和页面守卫尚不存在。

## Requirements

### R1. Web 认证合同

- 在 `@repo/contracts` 定义 Web 密码登录、refresh、safe session、token response 和用户 profile 的 Zod schema 与推导类型。
- Web 与 Admin DTO 分开导出；前端只通过 `@repo/contracts` 读取跨层协议。

### R2. API 登录与应用隔离

- 提供 `POST /auth/web/password/login`、`POST /auth/web/token/refresh` 和 `GET /rpc/user/profile`。
- Web 密码登录要求 application 为 `web`、password method 已启用、用户状态有效并拥有 active `web_user`。
- JWT 同时支持 `admin` 和 `web`，签发和校验时按 application 校验 `app` 与 audience；现有 Admin token 行为保持兼容。
- Web access 鉴权每次重新读取 D1 session、application、用户状态和 active Web roles，不只信任 JWT claims。
- Web refresh 复用现有原子 rotation 机制；旧 refresh token 重放时撤销整条 session。
- 数据库 schema 与迁移允许 `session_type` 为 `admin` 或 `web`；开发种子数据启用 Web password 并提供可验证的 `web_user` 账号。

### R3. 浏览器 session

- `apps/web/src/auth/client-session.ts` 统一管理内存与 `localStorage` 中的 access token、refresh token 和 safe session。
- 从 `localStorage` 恢复时执行运行时 schema 校验；损坏或过期结构直接删除。
- 登录、refresh 和清除登录态后发出统一 session changed 事件。
- refresh 成功后完整替换 access token、refresh token 和 session，不能保留已 rotation 的旧 refresh token。

### R4. HTTP 静默刷新

- 浏览器业务请求若未显式传入 `Authorization`，自动附加当前 access token；服务端请求不读取浏览器 session。
- 显式传入 `Authorization` 的请求不参与本地 session refresh，避免特殊请求意外改写当前登录态。
- 只有 `AUTH.ACCESS_EXPIRED` 触发 refresh。缺失、格式错误、权限不足和普通业务错误不能触发刷新。
- refresh 请求不附加旧 access token，也不能递归触发 refresh。
- 同一时间的多个过期请求共用一个 refresh Promise，成功后各自使用新 access token 重试一次。
- 原请求显式传入的 `Authorization` 不被覆盖；AbortError 继续按现有语义向上传递。
- refresh 或重试失败时清除浏览器 session，并抛出可识别的请求错误。

### R5. 登录页与受保护页面

- 新增 `/login`，通过 Web 密码登录接口保存 session，成功后进入 `/app`。
- `/app` 由客户端 guard 保护：没有本地 session 时跳到 `/login`；有 session 时请求 profile。
- profile 请求同样走统一 HTTP 模块，因此页面刷新时 access token 过期可自动续签，不误跳登录页。
- refresh、session、角色或 profile 校验失败时清理本地 session 并跳到 `/login`。
- 页面保留现有主题能力、键盘焦点样式和移动端可用性。
- 页面面向日常记录情绪的个人用户，优先支持快速登录并继续记录；视觉和文案沿用公开站安静、克制的风格。

## Acceptance Criteria

- [ ] 使用开发种子账号调用 Web 密码登录接口，返回 Web token pair、safe session 和统一响应结构。
- [ ] Web token 不能访问 Admin 认证接口，Admin token 不能通过 Web profile 鉴权。
- [ ] 使用有效 Web access token 可以读取 `/rpc/user/profile`。
- [ ] access token 过期后，浏览器自动调用一次 Web refresh，保存 rotation 后的新 token，并完成原 profile 请求。
- [ ] 多个并发过期请求只发送一个 refresh 请求，所有原请求最多重试一次。
- [ ] refresh token 无效、过期、已使用，session 被撤销或 `web_user` 失效时，本地 session 被清除并回到 `/login`。
- [ ] 刷新浏览器后可从经过 schema 校验的 `web:client-session` 恢复登录态。
- [ ] 旧 refresh token 重放返回 `AUTH.REFRESH_REPLAYED`，对应服务端 session 被撤销。
- [ ] 依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter web build`。
- [ ] 使用隔离的本地 D1 应用全部 migration 与 seed，手动验证 login、profile、refresh、rotation、replay 和应用隔离。

## Out of Scope

- GitHub、Google 等 OAuth 登录。
- 用户注册、找回密码和修改密码。
- 把 Web token 改成 HttpOnly cookie 或新增 Web BFF。
- 新增业务数据接口；本次只用 profile 验证登录态与静默刷新。
