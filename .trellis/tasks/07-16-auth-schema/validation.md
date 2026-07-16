# 验收记录

## 结论

- 日期：2026-07-16。
- D1 Schema、Hono Admin Auth API、Admin BFF 三个子任务均已完成并归档。
- 父任务的 18 项验收条件全部通过。
- 验收范围只包含本地 D1、本地 API 和本地 Admin，不包含远程 D1 或生产部署。

## 子任务证据

### D1 Schema

- 实现提交：`9feea14 feat(api): add auth data layer`。
- 从空本地 D1 应用 migration 后创建 9 张认证表、相关索引和 trigger。
- Wrangler 单独管理 migration，没有 Drizzle migration 表。
- seed 连续执行两次后，Admin 应用、password 登录方式、`admin_owner` 和开发管理员各保留一份。
- rotation 成功、旧 token 不可用、session 不可用和并发竞争均已通过真实本地 D1 验证。
- 详细结果记录在归档子任务 `07-16-auth-d1-schema/prd.md`。

### Hono Admin Auth API

- 实现提交：`63b1451 feat(api): add admin authentication API`。
- 登录、session、refresh 和 logout 成功路径均返回 HTTP 200。
- 不存在账号、错误密码、suspended 用户、凭证锁定和缺少 active `admin_owner` 均返回 `AUTH.INVALID_CREDENTIALS`，不会泄漏账号状态。
- 错误算法、issuer、audience、app、`token_use`、token 互换和篡改均被拒绝。
- refresh replay 和两个并发 refresh 已验证；并发结果为一个 HTTP 200 和一个 `AUTH.REFRESH_REPLAYED`。
- `lifetime_violations=0`，`parents_with_multiple_children=0`。
- 详细结果记录在归档子任务 `07-16-admin-auth-api/validation.md`。

### Admin BFF

- 实现提交：`5374407 feat(admin): add auth BFF and session`。
- 登录、登录态恢复、静默 refresh、并发请求和 logout 已在 6154/6155 本地联调。
- 浏览器认证请求只访问 Admin 同源地址；浏览器响应只包含 `AdminSession`，不含 token 或 `jti`。
- access 和 refresh cookie 都包含 `HttpOnly`、`SameSite=Lax` 和 `Path=/`，`Max-Age` 使用各自剩余时间。
- 同一标签页的三个并发 session 请求只发起一次 refresh，每个原请求只重试一次。
- `proxy.ts` 只做 cookie 存在性跳转，Route Handler 和 Hono 端点仍执行认证与授权。
- 详细结果记录在归档子任务 `07-16-admin-auth-bff/validation.md`。

## 父任务复核

- 任务内 `research/` 保存了课程实现、仓库边界、运行环境和实现选择的研究记录。
- `apps/api/src/modules/auth/jwt.ts` 使用 UUIDv7 生成 JWT `jti`，`apps/api/src/modules/auth/auth.service.ts` 使用 UUIDv7 生成 session 和 refresh token 记录。
- `apps/api/src/middleware/request-context.middleware.ts` 继续使用 `crypto.randomUUID()` 生成 requestId。
- access 到期时间取 15 分钟与 session 截止时间的较小值；refresh 到期时间等于 session 截止时间。
- Admin cookie 的 `Max-Age` 由 API 返回的 token 到期时间计算，不超过 token 剩余时间。

## 本次检查

- `pnpm check-types`：通过。
- `pnpm lint`：通过，零 warning。
- `pnpm format:check`：通过。
- `pnpm --filter admin build`：通过，识别 4 个认证 Route Handler、`/login`、受保护根页面和 Proxy。

项目没有自动化集成测试脚本。HTTP、D1 和浏览器行为采用三个子任务保存的本地手动验证记录作为验收依据。
