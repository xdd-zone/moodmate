# Admin 与 Web 认证合同

## 1. 适用范围

修改 Hono Admin/Web 认证端点、Admin BFF 解析、Web 浏览器 session 或 profile 请求时使用。Admin token response 只供 Hono 与 Admin server-only 代码使用；Web token response 会由 Web 客户端保存到当前浏览器。

## 2. 签名

```ts
AdminPasswordLoginRequestSchema;
AdminRefreshRequestSchema;
AdminLogoutRequestSchema;
AdminAuthTokenResponseSchema;
AdminSessionSchema;
AdminLogoutResponseSchema;

WebPasswordLoginRequestSchema;
WebPasswordLoginResponseSchema;
WebRefreshRequestSchema;
WebTokenRefreshResponseSchema;
WebAuthTokenResponseSchema;
WebSessionSchema;
WebUserProfileSchema;
```

调用方通过 `createApiResponseSchema()` 包装具体成功数据 schema，不手写局部响应类型。Web 密码登录和 refresh 的响应都复用 `WebAuthTokenResponseSchema`。

## 3. 合同

- Admin/Web 密码登录：`email` 在解析时 trim 并转小写；`password` 保留原文，限制为 8 至 128 个 Unicode code point。两个入口通过 `createPasswordLoginRequestSchema()` 创建独立命名的 schema。
- Admin/Web refresh：只包含长度 1 至 4096 的 `refreshToken`。
- Admin/Web token response：包含 `accessToken`、`accessTokenExpiresAtMs`、`refreshToken`、`refreshTokenExpiresAtMs` 和 `session`。
- `AdminSession`：只包含 `sessionId`、`userId`、`email`、`displayName`、`roles` 和 `expiresAtMs`。浏览器只能从 Admin BFF 收到这个 safe session。
- `WebSession`：在 safe session 字段上增加固定的 `app: "web"`，供客户端存储恢复时校验应用边界。
- `WebUserProfile`：只包含 `userId`、`email`、`displayName` 和当前 active Web roles，不返回 token、sessionId 或数据库 record。
- Admin roles 必须包含 `admin_owner`；Web roles 必须包含 `web_user`。角色状态不是 active 时不能继续出现在有效响应中。

## 4. 校验与错误矩阵

| 输入或响应                                     | 结果                                  |
| ---------------------------------------------- | ------------------------------------- |
| 合法邮箱和 8 至 128 个字符密码                 | 对应登录 schema 通过                  |
| 密码前后有空格                                 | 空格保留并参与密码校验                |
| refresh token 缺失或空字符串                   | `AUTH.REFRESH_MISSING`                |
| refresh token 超过 4096 字符                   | `COMMON.INVALID_REQUEST`              |
| Web session 缺少 `app` 或 `app` 不是 `web`     | `WebSessionSchema` 解析失败           |
| API 成功响应缺少 token 过期时间或 session 字段 | token response schema 解析失败        |
| Admin 浏览器响应包含 access、refresh 或 `jti`  | 违反 Admin server-only token DTO 边界 |
| Web profile 包含 token、sessionId 或 D1 字段   | 违反 Web profile 最小响应边界         |

## 5. 正常、基础、错误案例

- 正常：Admin BFF 用 `AdminAuthTokenResponseSchema` 解析 Hono 响应并写 HttpOnly cookie；Web 客户端用 `WebPasswordLoginResponseSchema` 解析响应后保存 token pair 与 `WebSession`。
- 基础：Web refresh 用 `WebTokenRefreshResponseSchema` 解析 rotation 后的完整新响应，不能只更新 access token。
- 错误：页面自己定义一份 Web login 返回类型，或者直接断言 `response.json()`，导致 API 字段变化时静默接受无效 session。

## 6. 必做检查

- Admin/Web 登录输入覆盖邮箱空格、大小写、密码前后空格和密码边界长度。
- Admin/Web refresh 覆盖缺失、空字符串、超长和非法 JSON。
- Web token response 缺少 `app`、token 过期时间或 safe session 字段时解析失败。
- Web profile 不包含 token、sessionId、`jti` 或数据库列。
- Admin BFF 浏览器响应、页面 props 和客户端 cache 不包含 access token 或 refresh token。
- 依次运行 `pnpm --filter @repo/contracts check-types`、`pnpm --filter @repo/contracts lint`、`pnpm --filter @repo/contracts format:check`，跨包改动再运行根目录质量检查。

## 7. 错误与正确写法

```ts
// 错误：Web 页面自己断言接口返回结构
const session = (await response.json()) as WebSession;

// 正确：typed HTTP 用共享 schema 校验统一响应
return http.post(
  "/auth/web/password/login",
  payload,
  WebPasswordLoginResponseSchema,
);
```
