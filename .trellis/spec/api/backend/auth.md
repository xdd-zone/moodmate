# API Admin 与 Web 认证

## 1. 适用范围

修改 Admin/Web 密码登录、access 鉴权、session/profile、refresh rotation、Admin logout、JWT、PBKDF2 或 auth secret 时使用。Admin 浏览器 cookie 属于 `apps/admin` BFF；Web token 由 `apps/web` 客户端 session 保存，Hono 不读写浏览器 cookie 或 `localStorage`。

## 2. 签名

```text
POST /auth/admin/password/login
POST /auth/admin/token/refresh
GET  /auth/admin/session
POST /auth/admin/logout

POST /auth/web/password/login
POST /auth/web/token/refresh
GET  /rpc/user/profile
```

```ts
loginAdminWithPassword(input): Promise<AdminAuthTokenResponse>;
getAdminSessionFromAccess(bindings, authorization): Promise<AdminSession>;
refreshAdminSession(bindings, refreshToken): Promise<AdminAuthTokenResponse>;
logoutAdmin(input): Promise<AdminLogoutResponse>;

loginWebWithPassword(input): Promise<WebAuthTokenResponse>;
getWebSessionFromAccess(bindings, authorization): Promise<WebSession>;
refreshWebSession(bindings, refreshToken): Promise<WebAuthTokenResponse>;
getWebUserProfile(session): WebUserProfile;
```

route 只校验 HTTP 输入和构造统一响应。service 按 application 配置组织认证动作，repository 读写 D1，presenter 生成 safe Admin/Web session。

## 3. 合同

- access 和 refresh 固定使用 `HS256`，分别读取至少 32 个 UTF-8 字节的 `AUTH_ACCESS_SECRET` 与 `AUTH_REFRESH_SECRET`。
- JWT 固定 `typ=JWT`、`iss=moodmate-api`，并要求 UUIDv7 格式的 `sub`、`sid`、`jti`。
- Admin JWT 固定 `app=admin`、`aud=moodmate-admin`；Web JWT 固定 `app=web`、`aud=moodmate-web`。签发函数不传 application 时默认 Admin，Web 调用必须明确传 `web`。
- access 的 `token_use=access`，携带当前数据库中 active 的对应 application roles，最长 15 分钟。Admin 必须包含 `admin_owner`，Web 必须包含 `web_user`。
- refresh 的 `token_use=refresh`，不携带 roles，过期时间等于 session 的 30 天绝对截止时间。
- `auth_sessions.session_type` 只允许 `admin` 或 `web`，并且必须与 application code 和 JWT `app` 相同。
- 密码登录查不到可用账号时仍验证 `DUMMY_PASSWORD_HASH`。连续 5 次错误锁定 15 分钟；成功登录清零。
- refresh 只保存 `jti` 的 SHA-256 base64url 摘要。Admin/Web rotation 都必须调用 `rotateRefreshToken()`，不能拆成多个 service 写入。
- access 每次重新读取 D1 session、user、application 和 active roles。refresh 还检查 token 记录、session 绝对有效期和当前必要角色。
- 所有成功和失败 JSON 使用 `buildSuccess()`、`buildFailure()` 和 `createMeta()`。

## 4. 校验与错误矩阵

| 条件                                                | HTTP | 业务码                     |
| --------------------------------------------------- | ---- | -------------------------- |
| 登录账号不存在、密码错误、账号不可用或缺必要角色    | 401  | `AUTH.INVALID_CREDENTIALS` |
| access header 缺失                                  | 401  | `AUTH.ACCESS_MISSING`      |
| access 格式、签名、algorithm、app 或 token 类型错误 | 401  | `AUTH.ACCESS_INVALID`      |
| access JWT 到期                                     | 401  | `AUTH.ACCESS_EXPIRED`      |
| refresh body 缺失或为空                             | 401  | `AUTH.REFRESH_MISSING`     |
| refresh 格式、签名、claims、app 或记录错误          | 401  | `AUTH.REFRESH_INVALID`     |
| refresh 已使用、已撤销或 rotation 竞争失败          | 401  | `AUTH.REFRESH_REPLAYED`    |
| session、用户、应用或必要角色已失效                 | 401  | `AUTH.SESSION_REVOKED`     |

只有 `AUTH.ACCESS_EXPIRED` 可以触发 Admin BFF 或 Web 客户端静默 refresh。其他认证 401 都不能进入 refresh 重试循环。

## 5. 正常、基础、错误案例

- 正常：Web 登录创建 `session_type=web` 的 session 和首个 refresh；refresh 生成一个后继 token，session 截止时间保持不变，profile 返回当前 safe 用户字段。
- 基础：Admin/Web access 和 refresh 都重新读取 D1 当前状态；角色被禁用或绑定被撤销后不能继续授权。
- 错误：Web access token 只因为签名正确就访问 Admin session，或者校验 JWT 时只检查 audience、不检查 `app` 与 D1 application。

## 6. 必做检查

- 在隔离的 `--persist-to` 目录应用全部 migration 和 seed，`PRAGMA foreign_key_check` 返回空结果。
- 用含现有 Admin session 和 parent/replacement refresh 链的 SQLite 数据执行 Web session migration，确认数据、外键、唯一索引和三个 trigger 保留。
- 分别验证 Admin/Web 登录、access、refresh、必要角色失效和 session 撤销。
- Web token 请求 Admin session、Admin token 请求 Web profile，都返回 `AUTH.ACCESS_INVALID`。
- 同时提交两个相同 refresh，断言一个成功、一个 `AUTH.REFRESH_REPLAYED`，随后 session 已撤销。
- 验证错误 algorithm、issuer、audience、app、`token_use`、过期和篡改 token。
- 依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。

## 7. 错误与正确写法

```ts
// 错误：Web access 沿用默认 Admin 校验
const claims = await verifyAccessToken(token, secret);

// 正确：Web 入口明确 expected application，再读取 D1 当前 session
const claims = await verifyAccessToken(token, secret, "web");
return loadActiveSession(
  WEB_AUTH_CONFIG,
  bindings,
  claims.sid,
  claims.sub,
  claims.roles,
);
```
