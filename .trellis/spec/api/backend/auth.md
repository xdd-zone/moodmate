# API Admin 认证

## 1. 适用范围

修改 Admin 密码登录、access 鉴权、session 查询、refresh rotation、logout、JWT、PBKDF2 或 auth secret 时使用本规范。浏览器 cookie 属于 `apps/admin` BFF，不在 Hono 中读取或设置。

## 2. 签名

```text
POST /auth/admin/password/login
POST /auth/admin/token/refresh
GET  /auth/admin/session
POST /auth/admin/logout
```

```ts
loginAdminWithPassword(input): Promise<AdminAuthTokenResponse>;
getAdminSessionFromAccess(bindings, authorization): Promise<AdminSession>;
refreshAdminSession(bindings, refreshToken): Promise<AdminAuthTokenResponse>;
logoutAdmin(input): Promise<AdminLogoutResponse>;
```

route 只校验 HTTP 输入和构造统一响应。service 组织认证动作，repository 读写 D1，presenter 只生成 `AdminSession`。

## 3. 合同

- access 和 refresh 固定使用 `HS256`，但分别读取 `AUTH_ACCESS_SECRET` 和 `AUTH_REFRESH_SECRET`。两个值都至少包含 32 个 UTF-8 字节。
- JWT 固定 `typ=JWT`、`iss=moodmate-api`、`aud=moodmate-admin`、`app=admin`，并要求 UUIDv7 格式的 `sub`、`sid`、`jti`。
- access 的 `token_use=access`，携带 `roles: ["admin_owner"]`，最长 15 分钟。
- refresh 的 `token_use=refresh`，不携带 roles，过期时间等于 session 的 30 天绝对截止时间。
- 密码格式是 `$pbkdf2-sha256$v=1$i=<iterations>,l=<bytes>$<salt>$<hash>`。新 hash 使用 600,000 次迭代、16 字节 salt 和 32 字节结果。
- 登录查不到可用账号时仍验证 `DUMMY_PASSWORD_HASH`。连续 5 次错误锁定 15 分钟；成功登录清零。
- refresh 只保存 `jti` 的 SHA-256 base64url 摘要。rotation 必须调用 `rotateRefreshToken()`，不能拆成多个 service 写入。
- 所有成功和失败 JSON 继续使用 `buildSuccess()`、`buildFailure()` 和 `createMeta()`。

## 4. 校验与错误矩阵

| 条件                                              | HTTP | 业务码                     |
| ------------------------------------------------- | ---- | -------------------------- |
| 登录账号不存在、密码错误、账号不可用或无角色      | 401  | `AUTH.INVALID_CREDENTIALS` |
| access header 缺失                                | 401  | `AUTH.ACCESS_MISSING`      |
| access 格式、签名、算法、claims 或 token 类型错误 | 401  | `AUTH.ACCESS_INVALID`      |
| access JWT 到期                                   | 401  | `AUTH.ACCESS_EXPIRED`      |
| refresh body 缺失或为空                           | 401  | `AUTH.REFRESH_MISSING`     |
| refresh 格式、签名、claims、记录或 token 类型错误 | 401  | `AUTH.REFRESH_INVALID`     |
| refresh 已使用、已撤销或 rotation 竞争失败        | 401  | `AUTH.REFRESH_REPLAYED`    |
| session、用户、应用或 `admin_owner` 已失效        | 401  | `AUTH.SESSION_REVOKED`     |

只有 `AUTH.ACCESS_EXPIRED` 可以触发 Admin BFF 静默 refresh。其他认证 401 都不能进入 refresh 重试循环。

## 5. 正常、基础、错误案例

- 正常：登录创建 session 和首个 refresh；refresh 生成一个后继 token，session 截止时间保持不变。
- 基础：每次 access 和 refresh 都读取 D1 session；refresh 还重新读取用户状态和 `admin_owner`。
- 错误：只验 JWT 签名后直接信任 roles，或者把 access 和 refresh 交给同一个 secret 和同一套 claims schema。

## 6. 必做检查

- 在隔离的 `--persist-to` 目录应用 migration 和 seed，再启动 `wrangler dev`。
- 验证不存在账号与错误密码的 HTTP 状态、业务码和消息完全一致。
- 验证错误算法、issuer、audience、app、`token_use`、过期和篡改 token。
- 同时提交两个相同 refresh，断言一个成功、一个 `AUTH.REFRESH_REPLAYED`，D1 中一个 parent 最多一个后继。
- 撤销角色后，旧 access 和 refresh 都返回 `AUTH.SESSION_REVOKED`。
- logout 后旧 access 不能查询 session，旧 refresh 不能续签。
- 运行密码 benchmark Worker，断言 `verified=true`；耗时只记录为本地 workerd 结果。
- 依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。

## 7. 错误与正确写法

```ts
// 错误：只验签，不查 D1 session 和当前角色
const claims = await verifyAccessToken(token, secret);
return claims.roles;

// 正确：验签后用 sid、sub 和 roles 重新加载有效 Admin session
const claims = await verifyAccessToken(token, secret);
return loadActiveAdminSession(bindings, claims.sid, claims.sub, claims.roles);
```
