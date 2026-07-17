# Admin 认证合同

## 1. 适用范围

修改 Hono Admin 认证端点或 Admin BFF 解析逻辑时使用。token response 只供 Hono 与 Admin server-only 代码使用；浏览器只能收到 `AdminSession`。

## 2. 签名

```ts
AdminPasswordLoginRequestSchema;
AdminRefreshRequestSchema;
AdminLogoutRequestSchema;
AdminAuthTokenResponseSchema;
AdminSessionSchema;
AdminLogoutResponseSchema;
```

调用方通过 `createApiResponseSchema()` 包装具体成功数据 schema，不手写局部响应类型。

## 3. 合同

- `AdminPasswordLoginRequest`：`email` 在解析时 trim 并转小写；`password` 保留原文，限制为 8 至 128 个 Unicode code point。
- `AdminRefreshRequest`、`AdminLogoutRequest`：只包含长度 1 至 4096 的 `refreshToken`。
- `AdminAuthTokenResponse`：包含 `accessToken`、`accessTokenExpiresAtMs`、`refreshToken`、`refreshTokenExpiresAtMs` 和 `session`。
- `AdminSession`：只包含 `sessionId`、`userId`、`email`、`displayName`、`roles` 和 `expiresAtMs`。
- `roles` 是当前数据库中 active 的 Admin 角色 code 数组，必须包含 `admin_owner`；角色被禁用或逻辑删除后不能继续出现在有效 session 中。
- `AdminLogoutResponse` 固定为 `{ success: true }`。

## 4. 校验与错误矩阵

| 输入                                    | 结果                            |
| --------------------------------------- | ------------------------------- |
| 合法邮箱和 8 至 128 个字符密码          | 登录 schema 通过                |
| 密码前后有空格                          | 空格保留并参与密码校验          |
| refresh token 缺失或空字符串            | `AUTH.REFRESH_MISSING`          |
| refresh token 超过 4096 字符            | `COMMON.INVALID_REQUEST`        |
| API 成功响应缺少 safe session 字段      | response schema 解析失败        |
| 浏览器响应包含 access、refresh 或 `jti` | 违反 server-only token DTO 边界 |

## 5. 正常、基础、错误案例

- 正常：Admin BFF 用 `AdminAuthTokenResponseSchema` 解析 Hono 登录结果，写入 HttpOnly cookie，再只返回 `session`。
- 基础：页面恢复登录态时用 `AdminSessionSchema` 解析 BFF 响应。
- 错误：Client Component 保存整个 `AdminAuthTokenResponse`，导致 token 进入浏览器运行时状态。

## 6. 必做检查

- login、refresh、session 和 logout 的成功数据分别用对应 schema 解析。
- 登录输入覆盖邮箱空格、大小写和密码边界长度。
- refresh/logout 覆盖缺失、空字符串、超长和非法 JSON。
- 检查浏览器响应、页面 props 和客户端 cache 不包含 `accessToken`、`refreshToken` 或 `jti`。
- 依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。

## 7. 错误与正确写法

```ts
// 错误：把含 token 的 Hono 原始响应返回给浏览器
return Response.json(honoResponse.data);

// 正确：server-only 代码解析 Hono 响应，只把 safe session 作为浏览器响应
const schema = createApiResponseSchema(AdminAuthTokenResponseSchema);
const result = schema.parse(await response.json());
if (!result.ok) throw new Error(result.error.code);
return Response.json(result.data.session);
```
