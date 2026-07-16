# 实现 Hono Admin 认证 API

## Goal

基于已验证的 D1 认证表，实现 Admin 密码登录、access 鉴权、session 查询、refresh rotation 和 logout 的 Hono API。

## Dependency

- 父任务：`07-16-auth-schema`。
- 前置任务：`07-16-auth-d1-schema` 必须完成并通过 rotation 并发验证。
- `07-16-admin-auth-bff` 必须等本任务 contracts 和端点稳定后再启动。

## Requirements

- 在 `packages/contracts` 定义 Admin auth schema、DTO 和错误码。
- 使用 Workers 原生 PBKDF2-HMAC-SHA-256 验证密码，对不存在账号执行 dummy hash。
- 使用 `jose` 签发和验证 access/refresh JWT，claims、TTL 和 secret 边界遵循父任务设计。
- 登录检查 application、password method、用户状态、凭证锁定和 active `admin_owner`。
- 登录原子创建 30 天绝对 session 和首个 refresh token。
- 受保护 route 验 access JWT，并检查 D1 session 未撤销、未过期。
- refresh 重新检查用户状态和 `admin_owner`，调用前置任务提供的原子 rotation。
- replay 或并发抢占失败撤销整个 session，不提供宽限。
- logout 撤销 session 和该 session 下仍有效的 refresh token。
- 日志、错误详情和响应不包含密码、hash、JWT、`jti`、secret 或完整邮箱。

## Acceptance Criteria

- [x] 登录、refresh、session 和 logout contracts 可以被 API 与 Admin server-only 代码共同解析。
- [x] 错误密码、不存在邮箱、非 active 用户、凭证锁定和无角色不会泄漏账号状态。
- [x] access 与 refresh token 不能互换，错误算法、issuer、audience、app、type 和篡改 token 都被拒绝。
- [x] access 最长 15 分钟；refresh 和 session 共用 30 天绝对截止时间。
- [x] refresh 后 session 截止时间不变，roles 来自当前 D1 状态。
- [x] 同一 refresh token 第一次 rotation 后不可再次使用；再次使用会撤销 session。
- [x] logout 后旧 access 的 D1 session 检查失败，旧 refresh 不能续签。
- [x] 密码 hash 和 verify 在本地 workerd 可运行并记录耗时，不把本地结果描述成生产性能。
- [x] 所有端点返回统一 `ApiResponse`，业务错误码和 HTTP 状态一致。
- [x] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 依次通过。

## Out Of Scope

- Admin cookie、页面、React 状态和浏览器 refresh 合并。
- Web、注册、OAuth、密码重置和权限管理。
- Cloudflare 全局 IP 限流和 production 发布。
