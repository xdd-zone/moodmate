# 设计并实现数据表与认证

## Goal

在现有 Cloudflare D1 基础上实现 Admin 邮箱密码登录、登录态恢复、refresh rotation 和退出登录。认证协议按课程自行实现，浏览器通过 Admin 的 Next.js BFF 使用认证能力。

## Background

- `apps/api` 已完成本地 D1 binding 和 readiness 检查，目前没有业务表、ORM、认证、JWT、密码 hash 或 cookie 依赖。
- `docs/temp/` 包含 13 份课程片段，覆盖 UUIDv7、JWT、认证表、管理员密码登录、refresh、静默刷新和退出登录。
- 课程材料同时出现了两套 refresh token 方案和互相冲突的 cookie 传递方式。本任务采用 refresh JWT + `jti`，由 Admin BFF 处理浏览器 cookie。
- `docs/architecture.md` 已要求 Web 与 Admin 使用不同认证入口，Admin 登录必须检查管理员身份。
- 课程材料、现有仓库边界和实现路线的分析保存在任务的 `research/` 目录。

## Requirements

### Scope

- 本期只实现 Admin，不实现 Web 子站认证、注册或 OAuth。
- 认证自行实现，不引入 Better Auth、Auth.js 等完整认证框架。
- 首期只启用 `admin_owner`。登录账号必须有 active 的 `admin_owner` 绑定。
- API 保持 `route -> service -> repository -> presenter` 分层，接口 schema、DTO 和业务错误码先定义在 `packages/contracts`。

### Database

- 首期 D1 schema 只包含 `users`、`user_emails`、`password_credentials`、`applications`、`application_auth_methods`、`roles`、`user_role_bindings`、`auth_sessions` 和 `refresh_tokens`。
- 9 张表必须声明外键、唯一约束、状态约束和登录、角色、session、refresh 查询所需索引。
- 用户、session、refresh token 记录和 JWT `jti` 使用 UUIDv7，由 API 在请求期间生成。现有 requestId 保持 UUIDv4。
- Drizzle 只负责运行期 schema 和查询。migration 继续使用 Wrangler 管理，不建立第二套迁移历史。
- `apps/api/dev/seed.sql` 只初始化本地管理员、主邮箱、密码凭证、Admin 应用、password 登录方式和 `admin_owner` 绑定。seed 可以重复执行，不保存明文密码，执行命令必须带 `--local`。

### Authentication

- access token 和 refresh token 使用不同的 HS256 secret，并校验固定算法、token 类型、`iss`、`aud`、`exp`、`sub`、`sid`、`app` 和 `jti`。
- access token 携带 `roles`，有效期最多 15 分钟；refresh token 携带 `sid`、`app` 和 `jti`，最长有效期受 session 绝对截止时间限制。
- session 登录后 30 天绝对过期。refresh 不延长 session，不实现空闲超时或“记住我”。
- D1 只保存 refresh JWT `jti` 的 SHA-256 摘要，不保存 refresh token 原文。
- refresh token 只能成功使用一次。旧 token 再次出现或并发请求抢占失败时，撤销整个 session。
- 首期接受严格 replay 对多标签页的限制，不实现跨标签页协调、服务端宽限或响应丢失恢复。
- 旧 token 标记使用、新 token 写入、替代关系和 session 更新时间必须作为一次 D1 原子操作提交；不能用多个独立 repository 调用代替事务。
- refresh 时重新检查用户状态和 `admin_owner` 绑定。角色失效时撤销 session，不签发新 token。
- logout 撤销服务端 session 和该 session 下仍有效的 refresh token；Admin BFF 无论 API 返回什么都清除本地认证 cookie。

### Admin BFF

- 浏览器只调用 Admin 同源 Route Handler，不直接调用受保护的 Hono 接口。
- `API_BASE_URL` 只在 Next.js 服务端使用。BFF 调用 Hono 受保护接口时附加 `Authorization: Bearer <access-token>`。
- access token 和 refresh token 只保存在 `HttpOnly` cookie。浏览器 JavaScript、页面 props、日志和 BFF JSON 响应不能出现 token。
- Admin 不保存可由浏览器伪造的 session JSON cookie。当前用户和 session 信息通过同源 session 接口恢复。
- 登录、refresh 和 logout 使用 POST，并检查同源 `Origin`。refresh 和 logout 的 cookie 使用同一 Path，确保两个端点都能读取和删除。
- 同一标签页内的并发 401 只触发一次 refresh，成功后原请求最多重试一次。跨标签页并发不在首期处理范围内。
- Next.js 16 使用 `proxy.ts` 做快速跳转检查。`proxy.ts` 不请求 Hono、不执行 refresh，也不作为受保护数据的最终鉴权点。

### Task Split

- 将数据库、Hono Admin auth API、Admin BFF 与页面拆成三个可独立检查的 Trellis 子任务。
- 父任务保存共同需求、依赖顺序和最终联调验收，不直接承担业务代码修改。

## Acceptance Criteria

- [ ] 课程材料中的可复用做法、不适用部分、冲突和安全风险有任务内研究记录。
- [ ] Wrangler migration 在空本地 D1 创建确认的 9 张表、全部约束和索引；不创建 OAuth、Web 或占位业务表。
- [ ] migration 由 Wrangler 单独管理，D1 中不存在另一套 Drizzle migration 历史。
- [ ] 本地 seed 连续执行两次都成功，只产生一个 Admin 应用、一个 password 方式、一个 `admin_owner` 角色和一个开发管理员。
- [ ] 本地 seed 不含明文密码，不会通过不带 `--local` 的项目脚本写入远程 D1。
- [ ] 登录对不存在邮箱、错误密码、非 active 用户和无 Admin 角色返回不会泄漏账号状态的错误。
- [ ] 登录成功后 access token 不超过 15 分钟，refresh token 和 session 不超过同一个 30 天绝对截止时间。
- [ ] access、refresh 和受保护接口拒绝错误算法、错误 token 类型、错误 `iss`、错误 `aud`、错误 `app`、过期和篡改 token。
- [ ] refresh 成功后旧 token 失效；同一个旧 token 再次提交会撤销整个 session。
- [ ] 两个并发 refresh 最多一个完成 rotation，另一个触发 replay 处理；数据库不会出现两个有效后继 token或只有半条 rotation 记录。
- [ ] refresh 不延长 session。接近 session 截止时间时，新 access、refresh 和 cookie 的过期时间都被限制在该截止时间内。
- [ ] logout 后 session 和 refresh token 在 D1 中失效，Admin cookie 被清除，后续受保护请求失败。
- [ ] 浏览器请求只访问 Admin 同源地址，token 不出现在浏览器 JavaScript 可读状态、URL、日志或 BFF JSON 响应中。
- [ ] `proxy.ts` 只做快速跳转；每个受保护 Route Handler 和 Hono 端点仍执行自己的认证与授权检查。
- [ ] 同一标签页的并发 access 过期请求只发起一次 refresh，并且每个原请求最多重试一次。
- [ ] 持久化认证对象和 JWT `jti` 使用 UUIDv7，requestId 的 UUIDv4 行为不变。
- [ ] 三个子任务按数据库、API、Admin BFF 的顺序完成，并通过父任务最终联调。
- [ ] 规划经用户确认后才启动第一个子任务。

## Out Of Scope

- Web 子站登录、注册、session、refresh 和退出登录。
- GitHub、Google 等 OAuth 登录与账号绑定。
- `oauth_identities`、邮箱验证、密码重置和其他辅助 token 表。
- `admin_operator`、只读角色、权限管理界面和 session 管理页面。
- 多标签页 refresh 协调、replay 宽限、空闲超时和“记住我”。
- Durable Objects、RS256、ES256、JWE、JWKS 和多密钥轮换。
- 远程 D1、生产环境首个管理员初始化和生产域名部署。
- 在规划确认前修改业务代码或数据库 migration。
