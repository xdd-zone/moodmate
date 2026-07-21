# Token 静默刷新技术设计

## 1. 范围与边界

本次改动覆盖 `packages/contracts`、`apps/api` 和 `apps/web`。认证状态由 API 的 D1 session 与 refresh token 记录决定，浏览器 `localStorage` 只保存客户端继续请求所需的 token 和 safe session，不作为服务端授权依据。

数据流如下：

```text
Web 登录表单
  -> Web HTTP 模块
  -> POST /auth/web/password/login
  -> API 校验账号、application、角色与密码
  -> D1 创建 web session 和初始 refresh token
  -> Web 保存 token pair 与 safe session

Web profile 请求
  -> HTTP 模块附加 access token
  -> GET /rpc/user/profile
  -> API 校验 JWT，再读取 D1 session、用户、application 和角色
  -> access 到期返回 AUTH.ACCESS_EXPIRED
  -> HTTP 模块用 refresh token 调用 POST /auth/web/token/refresh
  -> API 原子 rotation，返回新 token pair 与 safe session
  -> Web 覆盖本地 session，使用新 access token 重试 profile 一次
```

## 2. Contracts

在 `packages/contracts/src/auth/` 增加 Web 专用合同：

- `WebSessionSchema`：`app: "web"`、`sessionId`、`userId`、`email`、`displayName`、`roles`、`expiresAtMs`。
- `WebAuthTokenResponseSchema`：access token、refresh token、各自过期时间和 `session`。
- `WebPasswordLoginRequestSchema`：邮箱标准化规则和密码长度与 Admin 保持一致，但使用独立名称，避免 Web 与 Admin 协议以后互相限制。
- `WebRefreshRequestSchema`：长度 1 到 4096 的 `refreshToken`。
- `WebUserProfileSchema`：`userId`、`email`、`displayName` 和当前 active Web roles。

合同从 `packages/contracts/src/index.ts` 导出。浏览器 session 的存储结构属于 Web 实现，不放进共享合同；它在 Web 内部组合 token 字段与 `WebSessionSchema` 做运行时校验。

## 3. 数据库迁移与种子数据

新增顺序 migration，不修改已有 migration：

- 将 `auth_sessions.session_type` 的约束从仅允许 `admin` 改为允许 `admin`、`web`。
- SQLite 不能直接修改 check constraint。迁移重建 `auth_sessions` 和引用它的 `refresh_tokens`，复制现有数据后重新创建索引与三个 rotation trigger。
- 迁移完成后，现有 Admin session、refresh token、parent/replacement 关系和唯一约束保持不变。

同步更新 `auth.schema.ts` 的 enum 与 check。`dev/seed.sql` 为 Web application 启用 password，并把现有本地账号绑定到 `web_user`，这样同一开发账号可以分别验证 Admin 与 Web 的 application 隔离。

## 4. JWT 应用隔离

`jwt.ts` 增加内部 `AuthApplication = "admin" | "web"`：

- Admin audience 保持 `moodmate-admin`，确保现有 Admin token 继续可验证。
- Web audience 使用 `moodmate-web`。
- 签发函数接收 application，Admin 调用保持默认 `admin`，Web 调用明确传 `web`。
- 校验函数接收 expected application，默认仍为 `admin`。`jwtVerify()` 校验对应 audience，Zod claims schema 再校验 `app`。
- access 与 refresh 继续使用不同 secret，`token_use` 和 UUIDv7 claims 规则不变。

API 不能只靠 `app` 和 audience 授权。JWT 通过后仍用 `sid`、`sub` 和 roles 读取 D1 当前状态。

## 5. API 分层

### Repository

将只写死 Admin 的登录、角色和 session 查询改为接收 application code 与必要角色的内部通用查询。原子写入函数 `createSessionWithRefreshToken()`、`rotateRefreshToken()` 和 `revokeSession()` 保持单一实现。

### Service

保留现有公开 Admin service 函数，并新增：

- `loginWebWithPassword()`
- `refreshWebSession()`
- `getWebProfileFromAccess()`

Admin 与 Web 通过内部 application 配置调用同一套密码校验、session 创建、JWT 签发、refresh 校验和 rotation 流程，防止两套安全检查漂移。配置明确规定 application code、session type、必要角色和 presenter。

Web profile access 每次检查：

- JWT `app` 和 audience 是 Web。
- session 的 user、type、有效期和撤销状态有效。
- application 是 active Web。
- user 是 active。
- 当前 active roles 包含 `web_user`。
- JWT roles 仍是当前角色集合的子集，角色变化不能靠旧 claims 继续授权。

### Route 与 Middleware

`auth.route.ts` 增加 Web login 与 refresh。`auth.middleware.ts` 增加 `requireWebAccess`，把 safe Web session 写入 Hono variables。profile route 使用该 middleware 并返回 Web profile DTO，所有响应继续使用统一 response 与 request meta。

## 6. 浏览器 Session

`client-session.ts` 使用模块内内存缓存和 `web:client-session`：

- 首次读取时从 `localStorage` 取 JSON，并用本地 Zod schema 校验。
- JSON 无效、字段缺失或 schema 不通过时删除该 key 并返回 `null`。
- 保存时同时更新内存与 `localStorage`。
- 清除时同时清空内存与 `localStorage`。
- 保存和清除后派发 `web-client-session-changed` 自定义事件。

浏览器 session 不在服务端渲染期间读取。token 不进入 React props、URL 或服务端日志。

## 7. HTTP 刷新与重试

现有 `fetch + Zod` 结构保留，拆成一次请求和带恢复策略的外层调用：

1. 创建浏览器请求时，如果调用方没有 `Authorization`，读取 session 并附加 Bearer access token，同时记录该请求使用的是自动登录态。
2. 一次请求继续负责网络、JSON、统一响应和 HTTP 状态校验。
3. 外层只捕获自动登录态请求的 `AUTH.ACCESS_EXPIRED`。
4. `ensureClientRefresh()` 用模块级 Promise 合并并发 refresh。
5. refresh 使用不附加 access token、不可再次 refresh 的一次请求函数。
6. refresh 成功后保存完整新 session，再重新创建原请求，确保 Authorization 使用新 token。
7. 原请求只重试一次。refresh 或重试失败时清除 session，并保留 `HttpRequestError` 供 guard 和表单判断。

显式 Authorization、服务端请求、AbortError、其他业务错误均不进入刷新流程。

## 8. 页面与组件

- `/login` 保持服务端 page，只渲染小范围客户端登录表单。
- 登录表单使用共享 schema 校验邮箱和密码，提交期间禁用控件，失败时显示 API 消息，成功后 `router.replace("/app")`。
- `/app` 保持服务端 page，内部挂载客户端 `WebDashboardGuard`。
- guard 首先读取本地 session；不存在时直接替换到 `/login`。存在时请求 profile，等待期间显示稳定尺寸的加载状态。
- profile 成功后渲染用户身份与继续记录入口；失败时清理 session 并替换到 `/login`。

视觉沿用当前 Web 站的 Maple Mono、主题 token、克制色彩和紧凑卡片，不增加新的品牌体系、插画或营销区块。移动端按钮和输入框保持可触摸尺寸，错误信息使用 `role="alert"`。

## 9. 兼容、风险与回退

- JWT 的 Admin 默认 app 与 audience 不变，降低对现有 Admin 登录态的影响。
- 最高风险是 SQLite 表重建和 refresh rotation。迁移必须先在隔离 D1 上验证旧 Admin 数据复制、外键、索引与 trigger。
- 前端最高风险是并发 refresh 和递归重试。refresh 走不可恢复的一次请求函数，原请求设置单次重试边界。
- 回退代码时不能只回退应用代码而保留一半迁移。上线前需在隔离数据库完整应用 migration；若迁移失败，停止部署并恢复该隔离数据库，不继续启动新代码。
