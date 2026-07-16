# 验证记录

## 已通过

- `pnpm check-types`：通过。
- `pnpm lint`：通过。
- `pnpm format:check`：通过。
- `pnpm exec prettier --check apps/admin .trellis/tasks/07-16-admin-auth-bff --ignore-path .prettierignore`：通过。
- `pnpm --filter admin build`：通过；Next.js 识别 4 个认证 Route Handler、`/login`、受保护根页面和 Proxy。
- 未登录访问 `/`：HTTP 307，跳转 `/login`。
- 缺少 `Origin` 的登录 POST：HTTP 403，错误码 `COMMON.INVALID_REQUEST`。
- 登录与 session：响应只包含 `AdminSession` 的 6 个字段，不含 token 或 `jti`。
- cookie：access 和 refresh 都包含 `HttpOnly`、`SameSite=Lax`、`Path=/`，Max-Age 使用各自剩余时间。
- refresh：refresh token 完成 rotation，浏览器响应仍只包含 `AdminSession`。
- access cookie 缺失、refresh cookie 存在：根页面返回 HTTP 200，session 返回 `AUTH.ACCESS_EXPIRED`，refresh 成功。
- 同一标签页并发 3 个 session 请求：首次 3 个 session、1 个 refresh、重试 3 个 session，最终全部成功。
- logout 后复用旧 access 返回 `AUTH.SESSION_REVOKED`；非法 refresh 返回 `AUTH.REFRESH_INVALID`；两种情况都清除两个 cookie。
- 浏览器 Network：认证请求只访问 `http://localhost:6154`。
- 浏览器页面刷新：session 恢复成功；logout 后回到 `/login`。
- 桌面和 390x844 移动端：Latte、Mocha 无横向溢出，主要按钮高度 44px，浏览器 console 无 error 或 warning。

## Format 基线处理

经用户明确授权，下面 3 个任务开始前已存在的 Trellis 文件只执行了 Prettier 格式化：

- `.trellis/tasks/archive/2026-07/07-16-admin-auth-api/task.json`
- `.trellis/workspace/喜东东/index.md`
- `.trellis/workspace/喜东东/journal-1.md`

格式化后 `pnpm format:check` 已通过，没有修改这些文件记录的含义。
