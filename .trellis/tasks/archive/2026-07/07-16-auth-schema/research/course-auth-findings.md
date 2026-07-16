# 课程认证材料研究结论

## 研究范围

本结论来自 `docs/temp/` 的 13 份课程片段，以及 Trellis channel `auth-schema-research` 中三个只读代理的两轮分析。课程材料约 16.4 万字符，包含 UUIDv7、服务端 token、客户端刷新、认证表和管理员登录。

## UUIDv7

`docs/temp/12-uuidv7.txt:15` 将用户、session、refresh token 记录、设备和审计记录列为需要唯一 ID 的对象，并推荐使用 UUIDv7。主要理由是：

- API 可以在 Cloudflare Workers 实例内生成 ID，不依赖数据库自增或中心服务。
- UUIDv7 的高位包含毫秒时间，D1 主键索引写入比完全随机的 UUIDv4 更接近顺序追加。
- UUIDv7 只保证大体按时间排序，不保证同一毫秒内严格递增，见 `docs/temp/12-uuidv7.txt:114`。

本任务采用以下边界：

- 用户、session、refresh token 数据库记录和 JWT `jti` 使用 UUIDv7。
- ID 只由 API 生成，Admin 不安装 `uuidv7`，也不生成服务端主键。
- requestId 继续使用现有 `crypto.randomUUID()`，不因认证主键策略而修改。
- `uuidv7` 当前 npm 版本为 `1.2.1`；实现时通过 `pnpm-workspace.yaml` catalog 管理版本，不沿用课程中的 `^1.0.2`。

## 课程方案

课程的主方案不是单纯使用 JWT，而是下面这组有状态认证机制：

- access token 是短期 JWS，通过 `Authorization: Bearer` 访问业务接口。
- refresh token 是长期凭证，通过 HttpOnly cookie 提交。
- D1 保存 session 和 refresh token 状态，用于 rotation、撤销和 replay 检测。
- admin 和 web 使用不同认证入口，内部可以复用 service。
- logout 撤销 session，不只是清理浏览器 token。

主要端点见 `docs/temp/19-auth-flow.txt:10`：

```text
POST /auth/admin/password/login
POST /auth/admin/token/refresh
POST /auth/admin/logout
POST /auth/web/password/login
GET  /auth/web/github/start
GET  /auth/web/github/callback
POST /auth/web/token/refresh
POST /auth/web/logout
```

课程还设计了 session 列表、撤销指定 session、撤销其他 session、OAuth 绑定和解绑。这些不是登录主流程的必要条件。

## 数据模型

`docs/temp/18-auth-database.txt:33` 至 `:224` 给出十张核心表：

- `users`
- `user_emails`
- `password_credentials`
- `oauth_identities`
- `applications`
- `application_auth_methods`
- `roles`
- `user_role_bindings`
- `auth_sessions`
- `refresh_tokens`

这组表同时处理多邮箱、多登录方式、web/admin 双入口、多角色、OAuth 和 refresh rotation。若首个交付只支持一种账号和一种登录方式，直接创建十张表会提前引入未使用的配置和关联。

课程表结构缺少若干实际需要的约束和索引：

- `applications(code)` 唯一约束。
- `application_auth_methods(application_id, provider)` 唯一约束。
- `roles(application_id, code)` 唯一约束。
- 密码凭证唯一约束。
- `refresh_tokens` 摘要唯一约束。
- session、角色和 refresh 查询使用的普通索引。

课程 repository 使用 Drizzle Core API 与 `db.batch`，见 `docs/temp/26-db-async-tools.txt:6`。顺序执行多个异步 repository 函数不等于一次原子 rotation。

## 材料冲突

课程片段不能直接组合成一个实现，至少存在以下冲突：

1. `docs/temp/20-token-signing.txt:340` 推荐高熵随机 refresh token，D1 只存摘要；`docs/temp/25-jwt-ts-details.txt:49` 使用 refresh JWT 与 `jti`。
2. `docs/temp/19-auth-flow.txt:105` 规定 refresh token 只从 cookie 读取；`docs/temp/28-admin-token-refresh.txt` 和 `30-admin-logout.txt` 的服务却从 JSON body 读取 refresh token。
3. `docs/temp/16-client-token.txt:114` 将 refresh cookie Path 限制为 refresh 端点；同文件 `:363` 又假设 logout 请求会自动携带该 cookie。
4. Web 方案把 access token 放 JS 内存；Admin 方案把 access、refresh 和 session 都放 HttpOnly cookie。两者不是同一套客户端协议。
5. 完整 access token 示例包含 `kid`、`iss`、`aud`、`jti`；简化示例省略这些 claim。
6. 登录示例使用 6 位密码，Zod schema 要求至少 8 位，见 `docs/temp/19-auth-flow.txt:54` 和 `:339`。

本任务已经决定采用后续实现章节中的 refresh JWT + `jti`，D1 保存 `jti_hash`。这项决定解决了第 1 条冲突，但仍需补齐 refresh JWT 的 claim 校验和密钥边界。

## 安全与并发边界

自研方案进入可发布状态前至少要证明：

- access token 和 refresh token 不能互换使用。
- 固定允许的算法，并校验 `iss`、`aud`、`exp`、`sub`、`sid`、`app` 和 token 类型。
- 密码使用专用密码 hash，登录失败有速率限制，响应不泄漏邮箱是否存在。
- refresh、logout 和 session revoke 并发时不会产生有效的后继 token。
- 同一个 refresh token 并发提交时最多一个请求成功。
- 旧 token 消费、新 token 插入、替代关系和 session 更新时间全部成功或全部回滚。
- 非法 Origin 不能调用 refresh；不能只依赖 `SameSite`。
- token、摘要、密钥和密码 hash 不出现在客户端响应和日志中。
- 多标签页并发刷新不会被正常请求误判为攻击并撤销整个 session。

`docs/temp/28-admin-token-refresh.txt:95` 的严格 replay 策略会在并发请求失败时撤销整个 session。若没有跨标签页协调或服务端宽限规则，两个正常标签页可能互相导致退出。

## 可保留的设计原则

- admin 与 web 的外部入口分开。
- route 只处理 HTTP，service 组织流程，repository 读写 D1。
- access token 不落库；session 和长期凭证状态必须持久化。
- logout 围绕 session 处理。
- refresh token 不进入 `localStorage`。
- OAuth 登录和 OAuth 绑定使用不同流程。
- 角色与用户状态在 refresh 时重新检查，不能永久相信旧 token 的 roles。

## 不应自动纳入首期

- Google OAuth。
- GitHub 绑定和解绑。
- session 管理页面。
- 多级后台角色。
- 邮箱验证和密码重置。
- Durable Objects。
- RS256、ES256、JWE 和 JWKS。
- 设备名称、IP 展示和长期审计。
