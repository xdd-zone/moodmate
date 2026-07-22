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

## 8. GitHub OAuth 登录

### 8.1 适用范围

修改 Web GitHub 授权 URL、API callback、账号绑定、一次性 ticket、OAuth 环境变量或登录页回调时使用本节。GitHub 只确认外部身份，最终登录态仍由 moodmate 的 Web session、access token 和 refresh token 提供。

### 8.2 签名

```text
GET  /auth/web/github/authorize
GET  /auth/web/github/callback?code=<code>&state=<state>
POST /auth/web/github/ticket/login
```

```ts
buildWebGithubAuthUrl(c): Promise<WebGithubAuthUrlResponse>;
handleWebGithubCallback(c): Promise<Response>;
loginWebWithGithubTicket(input): Promise<WebGithubTicketLoginResponse>;
createWebSessionForOauthUser(input): Promise<WebAuthTokenResponse>;
```

D1 表为 `oauth_accounts` 和 `oauth_login_tickets`。账号唯一键是 `(provider, provider_user_id)`；ticket 原文不入库，只保存 SHA-256 base64url 摘要。

### 8.3 合同

- GitHub OAuth App 的 callback 必须指向 API 的 `/auth/web/github/callback`，不能指向 Web 页面。
- authorize 返回 GitHub URL 和带 HMAC-SHA256 签名的 state。state 使用 `AUTH_REFRESH_SECRET`，有效期 10 分钟。
- Web 把 state 写入 `sessionStorage`。API callback 校验签名和有效期，Web callback 再核对浏览器保存的 state。
- GitHub scope 固定为 `read:user user:email`。账号匹配顺序固定为现有 GitHub 绑定、规范化邮箱、创建新用户；成功用户必须为 active 并拥有 active `web_user` 角色。
- API callback 只把 2 分钟有效的一次性 ticket 和 state 放进 Web URL。GitHub access token、moodmate access token 和 refresh token 都不能进入 URL。
- `POST /auth/web/github/ticket/login` 通过带 `used_at_ms IS NULL` 和 `expires_at_ms > now` 条件的 D1 update 原子标记 ticket，随后调用现有 Web session/token 签发函数。
- `GITHUB_OAUTH_CLIENT_ID`、`GITHUB_OAUTH_CLIENT_SECRET`、`GITHUB_OAUTH_CALLBACK_URL` 和 `WEB_ORIGIN` 只在 GitHub 登录端点使用时必填。Client secret 只能放在 `.dev.vars` 或 Cloudflare secret。

### 8.4 校验与错误矩阵

| 条件                                       | HTTP 或 callback 结果                   | 业务码                     |
| ------------------------------------------ | --------------------------------------- | -------------------------- |
| GitHub 配置缺失或登录方式未启用            | authorize 返回 403                      | `AUTH.FORBIDDEN`           |
| state 签名错误、过期或 callback 参数不完整 | 重定向到 Web callback，并带中文 `error` | 不签发 token               |
| GitHub code 无效、资料无效或没有已验证邮箱 | 重定向到 Web callback，并带中文 `error` | 不签发 token               |
| ticket 不存在、过期、摘要不匹配或已经使用  | ticket/login 返回 401                   | `AUTH.INVALID_CREDENTIALS` |
| ticket 对应的用户、应用或必要角色失效      | ticket/login 返回 401                   | `AUTH.SESSION_REVOKED`     |

### 8.5 正常、基础、错误案例

- 正常：已绑定 GitHub 账号复用原用户，ticket 换得统一 Web 登录响应，profile 和 refresh 继续可用。
- 基础：GitHub 已验证邮箱对应现有用户时增加 OAuth 绑定和 `web_user` 角色；没有对应用户时创建用户、主邮箱、绑定和角色。
- 错误：把 GitHub client secret 放到 `NEXT_PUBLIC_*`，或把 moodmate token 直接拼进 Web callback URL。

### 8.6 必做检查

- 在隔离的 `--persist-to` 目录应用全部 migration 和 seed，确认 GitHub 登录方式已启用，`PRAGMA foreign_key_check` 返回空结果。
- 检查 authorize URL 的 `client_id`、API callback、scope、state 和 `allow_signup=true`。
- 插入一个已知摘要的有效 ticket，连续调用 ticket/login 两次；第一次必须创建完整 Web session，第二次必须返回 `AUTH.INVALID_CREDENTIALS`。
- 用首次响应的 access token 请求 `/rpc/user/profile`，再用 refresh token 请求 `/auth/web/token/refresh`，两个请求都必须成功。
- 检查 Web 登录页和 callback 页的移动端、桌面端、错误状态和键盘焦点。
- 依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter web build`。

### 8.7 错误与正确写法

```ts
// 错误：callback 把长期 token 放进浏览器 URL
callbackUrl.searchParams.set("accessToken", result.accessToken);

// 正确：URL 只携带短时 ticket，Web 再调用 API 换登录态
callbackUrl.searchParams.set("ticket", ticket);
await loginWebWithGithubTicket({ ticket });
```
