# Admin 认证 BFF

## 1. 适用范围

新增或修改 Admin 登录、session、refresh、logout、受保护页面或认证 cookie 时使用。浏览器只访问 Admin 同源地址；Hono token response 只能留在 Next.js 服务端。

## 2. 公开签名

```text
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/session
POST /api/auth/logout
```

浏览器认证入口位于 `apps/admin/src/auth/api.ts`：

```ts
loginAdmin(payload);
getAdminSession();
logoutAdmin();
withAdminSessionRecovery(request);
```

cookie 名称固定在 `apps/admin/src/auth/constants.ts`：

```text
moodmate_admin_access_token
moodmate_admin_refresh_token
```

## 3. 合同

- `API_BASE_URL` 只由 Next.js 服务端读取。浏览器请求使用 `/api/auth/*` 相对路径。
- 登录和 refresh 解析 `AdminAuthTokenResponseSchema`，写入两个 cookie 后只返回 `AdminSession`。
- cookie 使用 `HttpOnly`、`SameSite=Lax`、`Path=/`，不设置 `Domain`，只在 production 使用 `Secure`。
- cookie `Max-Age` 使用 API 返回过期时间减去当前时间后的整秒数，不能超过 token 剩余时间。
- POST Route Handler 要求 `Origin` 与请求 URL 的 origin 完全相同。
- `proxy.ts` 只有在 access 和 refresh cookie 都不存在时跳转 `/login`，不能请求 Hono、验 JWT 或执行 refresh。
- access cookie 缺失但 refresh cookie 存在时，session BFF 返回 `AUTH.ACCESS_EXPIRED`，让浏览器进入续期流程。
- `withAdminSessionRecovery()` 只处理 `AUTH.ACCESS_EXPIRED`。并发请求共享一个 refresh Promise，成功后每个原请求最多重试一次。
- 非续期 401 或 refresh 失败进入 `/login`。logout 不依赖上游 token 仍然有效，始终清除两个 cookie。

## 4. 校验与错误矩阵

| 条件                                | 结果                                                    |
| ----------------------------------- | ------------------------------------------------------- |
| POST 缺少或伪造 `Origin`            | HTTP 403、`COMMON.INVALID_REQUEST`                      |
| login JSON 或字段无效               | HTTP 400、`COMMON.INVALID_REQUEST`                      |
| access 和 refresh cookie 都缺失     | Proxy 跳转 `/login`，session 返回 `AUTH.ACCESS_MISSING` |
| access 缺失、refresh 存在           | session 返回 `AUTH.ACCESS_EXPIRED`                      |
| Hono 明确返回 `AUTH.ACCESS_EXPIRED` | 浏览器发起一次 single-flight refresh                    |
| refresh 失败                        | BFF 清 cookie，浏览器进入 `/login`                      |
| 重试后的原请求再次 401              | 不再 refresh，浏览器进入 `/login`                       |
| logout 上游凭证无效或请求失败       | 本地仍清 cookie，并向浏览器返回 `{ success: true }`     |
| 上游返回非 JSON 或不符合 contract   | HTTP 502、`SYSTEM.INTERNAL_ERROR`                       |

## 5. 正常、基础、错误案例

- 正常：三个并发受保护请求同时收到 `AUTH.ACCESS_EXPIRED`，Network 中只有一个 `/api/auth/refresh`，随后三个原请求各重试一次。
- 基础：刷新页面后 `/api/auth/session` 返回 `AdminSession`，Query cache 只保存 `displayName`、`email`、`expiresAtMs`、`roles`、`sessionId` 和 `userId`。
- 错误：Proxy 要求 access 和 refresh cookie 同时存在。access cookie 自然到期后会在 refresh 之前把用户送回登录页。

## 6. 必做检查

- 未登录访问 `/`：跳转 `/login`。
- 登录、session、refresh 响应：`data` 不含 `accessToken`、`refreshToken` 或 `jti`。
- 登录响应头：两个 cookie 都包含 `HttpOnly`、`SameSite=Lax` 和 `Path=/`。
- 只保留 refresh cookie：`/` 返回页面，session 返回 `AUTH.ACCESS_EXPIRED`，refresh 成功并重新写入两个 cookie。
- 并发续期：同时发起三个 `getAdminSession()`，断言 6 次 session 请求、1 次 refresh、0 次外部 origin 认证请求。
- logout：无论上游成功或凭证无效，浏览器最终没有两个认证 cookie。
- 运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter admin build`。

## 7. 错误与正确写法

```ts
// 错误：access cookie 自然到期后直接判定整个 session 不可恢复
if (!accessToken) {
  return authFailure(BizCode.AUTH_ACCESS_MISSING);
}

// 正确：refresh cookie 仍在时，明确进入已有续期流程
if (!accessToken && refreshToken) {
  return authFailure(BizCode.AUTH_ACCESS_EXPIRED);
}
```
