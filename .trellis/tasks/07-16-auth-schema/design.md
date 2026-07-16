# Admin 认证技术设计

## 1. Boundary

本任务由一个父任务和三个子任务组成：

```text
父任务：共同需求、依赖、最终联调
  -> D1 schema、migration、seed、rotation 原子写入
  -> Hono Admin auth contracts、JWT、登录、refresh、session、logout
  -> Admin BFF、登录页、登录态恢复、静默 refresh、logout
```

依赖顺序固定：API 子任务依赖数据库子任务；Admin 子任务依赖 API contracts 和端点。父任务没有直接业务代码。

外部协议只包含 Admin：

```text
Browser -> Admin Next.js Route Handler -> Hono API -> D1
```

浏览器不知道 `API_BASE_URL`，也不读取 token。Hono 不设置浏览器 cookie，只通过 JSON 把 token 返回给 Admin BFF。BFF 将安全的 session DTO 返回给浏览器，不转发含 token 的 API 原始响应。

## 2. Dependencies

`pnpm-workspace.yaml` catalog 增加并固定：

```text
drizzle-orm  0.45.2
jose         6.2.3
uuidv7       1.2.1
```

三项依赖只加入 `apps/api`。不加入 `drizzle-kit`，Wrangler 是唯一 migration 工具。密码 hash、`jti` 摘要和安全比较使用 Workers 原生 Web Crypto。

## 3. Data Model

所有时间列使用 Unix 毫秒 `INTEGER`。布尔值使用带 `CHECK (value IN (0, 1))` 的 `INTEGER`。所有持久化认证对象主键由 API 生成 UUIDv7；seed 使用固定、合法的 UUIDv7。

### `users`

- 字段：`id`、`status`、`display_name`、`created_at_ms`、`updated_at_ms`、`last_login_at_ms`。
- `status` 只允许 `active`、`suspended`、`deleted`。
- 不保存密码或 OAuth 字段。

### `user_emails`

- 字段：`id`、`user_id`、`email`、`normalized_email`、`is_primary`、`is_verified`、`verified_at_ms`、`source`、时间列。
- `normalized_email` 全局唯一。
- `(user_id, normalized_email)` 唯一。
- `user_id` 上建立 partial unique index，条件为 `is_primary = 1`。
- `user_id` 外键删除时 cascade。

### `password_credentials`

- 字段：`id`、`user_id`、`email_id`、`password_hash`、`password_algo`、`password_updated_at_ms`、`failed_attempts`、`locked_until_ms`、`must_reset_password`、时间列。
- `user_id` 和 `email_id` 分别唯一，首期一个用户只有一份密码凭证。
- `password_algo` 首期只写入 `pbkdf2-sha256`。
- 两个外键删除时 cascade。

### `applications`

- 字段：`id`、`code`、`name`、`status`、`created_at_ms`、`updated_at_ms`。
- `code` 唯一，首期只有 `admin`。
- `status` 只允许 `active`、`disabled`。

### `application_auth_methods`

- 字段：`id`、`application_id`、`provider`、`enabled`、时间列。
- `(application_id, provider)` 唯一。
- 首期只插入 `admin + password`。
- `application_id` 删除时 cascade。

### `roles`

- 字段：`id`、`application_id`、`code`、`name`、时间列。
- `(application_id, code)` 唯一。
- 首期只插入 `admin_owner`。
- `application_id` 删除时 cascade。

### `user_role_bindings`

- 字段：`id`、`user_id`、`role_id`、`status`、`granted_at_ms`、`revoked_at_ms`、`created_at_ms`、`updated_at_ms`。
- `(user_id, role_id)` 唯一。
- `status` 只允许 `active`、`revoked`。
- 为 `(user_id, status)` 和 `(role_id, status)` 建索引。
- 用户或角色删除时 cascade。

### `auth_sessions`

- 字段：`id`、`user_id`、`application_id`、`session_type`、`user_agent`、`ip`、`last_seen_at_ms`、`created_at_ms`、`expires_at_ms`、`revoked_at_ms`、`revoke_reason`。
- `session_type` 首期写入 `admin`。
- 为 `(user_id, application_id, revoked_at_ms, expires_at_ms)` 建索引。
- 用户或应用删除时 cascade。

### `refresh_tokens`

- 字段：`id`、`session_id`、`jti_hash`、`parent_token_id`、`issued_at_ms`、`expires_at_ms`、`used_at_ms`、`revoked_at_ms`、`replaced_by_token_id`。
- `jti_hash` 全局唯一。
- `parent_token_id` 在非空时唯一，保证一条 token 只有一个直接后继。
- 为 `(session_id, revoked_at_ms, expires_at_ms)` 建索引。
- session 删除时 cascade；token 链自引用删除时 set null。

### Rotation 原子性

登录时创建 session 和首个 refresh token 使用一个 D1 batch。

refresh 先读取并验证 JWT、token 记录、session、用户和角色，然后预生成新 token ID、`jti` 和摘要。真正写入只使用一个 D1 batch。migration 需要提供数据库约束或 trigger，使下面任一条件不成立时 batch 直接失败并回滚：

- 旧 token 仍未使用、未撤销、未过期。
- session 未撤销、未过期。
- 新 token 是旧 token 的唯一直接后继。
- 旧 token 的 `replaced_by_token_id` 指向新 token。

并发 loser 的 batch 失败后，service 单独撤销该 session，原因写 `refresh_token_replay`。实现阶段必须验证本地 D1 的真实行为，不能只用内存数据库推断。

## 4. Password Handling

密码输入限制为 8 至 128 个 Unicode 字符。邮箱先 trim，再按项目规则转小写生成 `normalized_email`。

PBKDF2 编码格式由 password 模块统一生成和解析，至少包含版本、算法、迭代次数、salt 和摘要。salt 使用 `crypto.getRandomValues()`。新 hash 使用 PBKDF2-HMAC-SHA-256、600,000 次迭代、16 字节 salt 和 32 字节结果。

登录查询不到邮箱时仍对固定 dummy hash 执行一次 verify。错误密码、无用户、用户非 active、凭证锁定和无 `admin_owner` 对浏览器使用同一条“邮箱或密码错误”消息；服务端日志只记录业务错误码和 requestId，不记录邮箱、密码或 hash。

密码连续失败计数和临时锁定使用 `password_credentials` 字段。具体阈值固定在 auth 模块常量中，首期采用 5 次失败锁定 15 分钟；登录成功清零。IP 级全局限流需要 Cloudflare Rate Limiting 或其他跨实例存储，不在本地首期实现，生产发布前必须另行配置。

## 5. JWT And Session

access 和 refresh 使用不同 secret。secret 从 Worker secret 读取，至少 32 UTF-8 字节，不写入 `wrangler.jsonc`、日志或响应。

两类 JWT 都固定：

```text
alg: HS256
typ: JWT
iss: moodmate-api
aud: moodmate-admin
sub: user UUIDv7
sid: session UUIDv7
app: admin
jti: UUIDv7
token_use: access | refresh
iat / exp: Unix 秒
```

access 额外携带 `roles: ["admin_owner"]`。refresh 不携带 roles，续签时从 D1 重新查询。

登录创建 `session_expires_at = now + 30d`。每次签发使用：

```text
access_exp = min(now + 15m, session_expires_at)
refresh_exp = session_expires_at
```

BFF cookie Max-Age 也使用对应 token 与 session 的剩余秒数。refresh 只更新 `last_seen_at_ms`，不修改 `auth_sessions.expires_at_ms`。

受保护 Hono 路由先验 access JWT，再检查 D1 中 session 未撤销、未过期且 user、application 与 claims 一致。logout 后旧 access token 最迟在下一次 D1 session 检查时失效。

## 6. API Contracts

Hono 提供：

| Method | Path                         | Credential                                        | Response                          |
| ------ | ---------------------------- | ------------------------------------------------- | --------------------------------- |
| POST   | `/auth/admin/password/login` | email + password                                  | token pair + safe session         |
| POST   | `/auth/admin/token/refresh`  | refresh token body                                | rotated token pair + safe session |
| GET    | `/auth/admin/session`        | Bearer access token                               | safe session                      |
| POST   | `/auth/admin/logout`         | refresh token body，BFF 同时附加可用 access token | `{ success: true }`               |

`safe session` 只包含 `sessionId`、`userId`、`email`、`displayName`、`roles` 和 `expiresAtMs`。Hono token response 仅供 BFF 使用；BFF 的浏览器响应不能包含 `accessToken`、`refreshToken` 或 `jti`。

业务错误码至少区分：

- `AUTH.INVALID_CREDENTIALS`
- `AUTH.ACCESS_MISSING`
- `AUTH.ACCESS_INVALID`
- `AUTH.ACCESS_EXPIRED`
- `AUTH.REFRESH_MISSING`
- `AUTH.REFRESH_INVALID`
- `AUTH.REFRESH_REPLAYED`
- `AUTH.SESSION_REVOKED`

只有 `AUTH.ACCESS_EXPIRED` 触发客户端静默 refresh。其他 401 直接清除本地状态并进入登录页。

## 7. Admin BFF

Admin Route Handler：

```text
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/session
POST /api/auth/logout
```

登录和 refresh 从 Hono token response 取出 token，使用共享 cookie helper 同时写入两个 HttpOnly cookie，然后只返回 safe session。logout 即使 Hono 返回 token 无效，也清除两个 cookie并向浏览器返回成功。

所有 POST auth handler 检查 `Origin` 与请求自身 origin 完全相同。cookie 不设置 `Domain`，使用 `SameSite=Lax`、`Path=/`，只在 production 设置 `Secure`。

`proxy.ts` matcher 只覆盖 Admin 页面，排除 `/api`、`/_next`、静态文件和 `/login`。它只根据认证 cookie 是否存在处理明显未登录请求，不解析角色，不调用 Hono，不执行 refresh。

浏览器 HTTP helper 使用同源相对路径。收到 `AUTH.ACCESS_EXPIRED` 后调用模块级 single-flight refresh Promise；refresh 成功后原请求重试一次，失败则清理客户端 session 并跳转 `/login`。这个 Promise 只合并同一标签页内请求，不解决多个标签页同时 refresh。

## 8. Rollback

- migration 一旦执行不回改。若首个 migration 尚未离开本地开发，可删除本地 D1 state 后重新应用；进入共享环境后只能新增反向 migration。
- auth API 可以通过取消路由注册停止新登录，但不能删除已经写入的认证表。
- Admin BFF 回滚时清除两个认证 cookie，避免旧 cookie 被其他实现误读。
- JWT secret 变更会让现有 token 全部失效。首期不实现多 key 验证，变更 secret 时按全量登出处理。

## 9. Release Limits

当前任务只验证本地 D1 和本地 Admin/API。production 尚未配置 D1，PBKDF2 的实际 Workers CPU 使用、Cloudflare 全局登录限流和生产域名 cookie 行为不属于本期完成证明。上线前必须单独验证这三项。
