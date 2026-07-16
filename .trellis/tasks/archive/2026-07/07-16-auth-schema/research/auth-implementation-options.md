# 认证实现路线比较

## 路线 A：Better Auth + Drizzle + D1

Better Auth 官方 Hono 文档支持将 handler 挂到 Hono，并通过 session cookie 恢复用户。官方仓库当前 Cloudflare smoke fixture 明确使用：

- `better-auth@1.6.23`
- `drizzle-orm@0.45.2`
- `drizzle(env.DB)`
- 每个请求根据 `c.env` 创建 auth 实例
- Hono 挂载 `/api/auth/*`
- Cloudflare Workers 测试验证邮箱注册、密码登录和 session cookie

官方材料：

- <https://www.better-auth.com/llms.txt/docs/integrations/hono.md>
- <https://www.better-auth.com/llms.txt/docs/adapters/drizzle.md>
- <https://www.better-auth.com/llms.txt/docs/concepts/session-management.md>
- <https://github.com/better-auth/better-auth/tree/main/e2e/smoke/test/fixtures/cloudflare>

核心 schema 是 `user`、`session`、`account`、`verification`。邮箱密码与 OAuth 账号都保存在 `account`；Admin 插件可在 `user` 增加角色和封禁字段。

优点：

- 密码 hash、session、登录、GitHub OAuth、session 撤销和速率限制由成熟库处理。
- 官方仓库已有 Cloudflare Workers + D1 + Drizzle 运行测试。
- 不需要自研 refresh rotation、token family 和多标签页 replay 规则。
- 前端可以使用 cookie session，不必保存 access token。

代价：

- Auth 端点使用 Better Auth 自己的路径与响应，不遵循当前统一 `ApiResponse`。
- 默认是一个认证服务，不自然对应现有 `/auth/web/*` 与 `/auth/admin/*` 两套外部协议。
- 需要引入 Drizzle、Better Auth、schema 生成和 `nodejs_compat`，并确认 bundle 与 Workers 兼容性。
- 表结构和升级节奏受库版本影响，增加插件后要重新生成 schema。
- 若用户目标是学习并掌握 JWT rotation，这条路线不会实现课程协议。

适合：目标是尽快交付可靠登录，愿意把认证端点视为独立协议，并调整当前架构文档。

## 路线 B：自研短期 access token + 随机 refresh token

推荐自研时使用高熵随机 refresh token，D1 只保存摘要；不使用 refresh JWT。access token 可使用 `jose` 签发短期 JWS。

优点：

- 可以保留 `/auth/web/*`、`/auth/admin/*`、统一响应与项目错误码。
- 表字段、token claim、session 撤销和客户端刷新行为完全由项目控制。
- 与课程主线接近，适合把认证机制本身作为学习目标。

代价：

- 必须自行实现密码安全、token 校验、cookie、CSRF、session、rotation、replay、原子写入、错误码和大量安全测试。
- D1 对 refresh rotation 的原子性必须通过真实环境验证。
- Web、Admin、SSR、跨 origin 和多标签页会显著扩大第一期范围。

适合：明确要求项目拥有自定义 token 协议，并接受更长实现周期和更高测试成本。

## 路线 C：服务端 cookie session，自研最小认证

只使用随机 session token，不签发 access JWT。浏览器通过 HttpOnly cookie 调用 API，服务端每次从 D1 恢复 session。

优点：

- 表和客户端状态最少。
- logout 与撤销立即生效。
- 不需要 refresh rotation、token claim 或前端 token 保存。

代价：

- 每次受保护请求都查询 D1。
- 跨 origin cookie、CORS 和 CSRF 仍要处理。
- 与当前架构文档的 access/refresh 目标不同。

适合：只追求第一个可用登录，不要求 JWT，也不采用 Better Auth。

## 客户端连接方式

### 浏览器直连 Hono

需要精确 CORS、`credentials: true`、cookie SameSite/Domain、CSRF、客户端 refresh 合并和 SSR 取 token 规则。生产域名未知时不能完成最终 cookie 设计。

### Next.js BFF

Admin 的 Route Handler 保存 HttpOnly cookie并向 Hono 转发请求。它会增加一次网络跳转和转发代码，但能隔离浏览器与 Hono 的跨 origin cookie问题。若首期只做 Admin 且需要 SSR，这是较小的客户端范围。

若采用 Better Auth，优先让浏览器直接使用 Better Auth cookie session；是否还需要 BFF 取决于生产域名与部署方式，不应提前固定。

## Drizzle

Drizzle 官方文档确认 `drizzle-orm/d1` 直接接收 Workers 的 D1 binding：

```ts
const db = drizzle(c.env.DB);
```

官方材料：<https://orm.drizzle.team/docs/connect-cloudflare-d1>

引入 Drizzle 的理由必须来自真实表查询或 Better Auth adapter。若首期采用三张简单表并继续 Wrangler 手写 migration，原生 D1 仍可完成；若采用 Better Auth 或课程中的多表 join，Drizzle 能提供更清楚的 schema 与类型。

## 当前建议

用户已确认本任务用于学习课程中的认证机制，选择路线 B。本期只实现 Admin，不实现 Web、OAuth 与 session 管理页面。refresh token 使用 JWT + `jti`，D1 只保存 `jti_hash`；用户、session、refresh token 记录和 JWT `jti` 使用 UUIDv7。
