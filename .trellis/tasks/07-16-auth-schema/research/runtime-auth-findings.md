# 认证运行时研究

## D1 与 Drizzle

Cloudflare D1 的 `batch()` 会按顺序执行 prepared statements。官方文档明确说明 batched statements 是 SQL transaction；其中一条语句失败时，整批语句终止并回滚。

这只能证明同一个 `batch()` 的原子性，不能把多个 `await repository.*()` 调用视为事务。refresh rotation 还需要数据库约束保证并发请求不会各自创建后继 token：

- `jti_hash` 全局唯一。
- `parent_token_id` 在非空时唯一，一条旧 token 最多有一个直接后继。
- rotation 使用一个 D1 batch 写入旧 token 状态、后继 token 和 session 时间。
- batch 必须在旧 token 状态不满足条件时由数据库语句或 trigger 主动失败，不能只在 TypeScript 中检查更新行数。
- 实现阶段必须用本地 D1 同时提交两个相同 refresh token，检查一个成功、一个进入 replay 撤销，且没有第二个后继 token。

Drizzle 官方支持通过 `drizzle(env.DB)` 使用 D1 binding，也允许把生成的 SQL 交给外部 migration 工具执行。本仓库已经规定 migration 使用 Wrangler，因此本任务只引入 `drizzle-orm`：

- TypeScript schema 和 repository 查询使用 Drizzle。
- SQL migration 放在 `apps/api/migrations/`，由 `wrangler d1 migrations` 创建和执行。
- 不使用 `drizzle-kit push` 或 `drizzle-kit migrate`，不创建 `__drizzle_migrations`。
- schema 与 migration 的一致性通过 migration 后查询 `sqlite_master` 和真实 repository 查询验证。

官方资料：

- <https://developers.cloudflare.com/d1/worker-api/d1-database/>
- <https://orm.drizzle.team/docs/get-started/d1-new>
- <https://orm.drizzle.team/docs/drizzle-kit-generate>

## 密码 hash

Cloudflare Workers 原生提供 `crypto.subtle`，支持 PBKDF2 和 SHA-256，不需要 `nodejs_compat` 或动态加载 WASM。当前仓库也没有原生模块或 WASM 密码库。

首期使用 PBKDF2-HMAC-SHA-256：

- 每个密码使用 16 字节随机 salt。
- 派生 32 字节结果。
- 默认 600,000 次迭代。
- 数据库存储带版本、算法、迭代次数、salt 和摘要的完整编码字符串。
- 验证时解析记录中的参数，使用 `crypto.subtle.deriveBits()` 重新计算，再用 Workers 的 `crypto.subtle.timingSafeEqual()` 比较字节。
- `password_algo` 保存 `pbkdf2-sha256`，后续可以按记录算法升级，不覆盖旧记录的解释方式。

OWASP 优先推荐 Argon2id，在 Argon2id 不可用且要求 FIPS 时建议 PBKDF2-HMAC-SHA-256 至少 600,000 次。这里选择 PBKDF2 的原因是 Workers 原生支持和当前项目的依赖边界，不是认为 PBKDF2 优于 Argon2id。

Cloudflare Workers Free 的文档 CPU 上限是每个 HTTP 请求 10 ms，而密码认证通常超过普通请求。实现阶段必须在本地 workerd 记录 hash 和 verify 耗时；生产发布前还要在实际 Workers 套餐验证 CPU 用量。当前任务不配置生产环境，因此这项结果不会被当作生产可发布证明。

官方资料：

- <https://developers.cloudflare.com/workers/runtime-apis/web-crypto/>
- <https://developers.cloudflare.com/workers/platform/limits/#cpu-time>
- <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>

## Next.js BFF 与 cookie

Next.js 16 已把 `middleware.ts` 文件约定改名为 `proxy.ts`。官方文档建议减少对 Proxy 的依赖，并要求 Server Function 和 Route Handler 自己执行认证与授权，不能把 Proxy 当作唯一保护。

本任务不沿用课程中“Proxy 先请求 profile，发现过期再 refresh”的写法：

- `proxy.ts` 只读取 cookie 是否存在并处理登录页、受保护页之间的快速跳转。
- Hono 调用、refresh rotation 和 cookie 更新都在 Route Handler 中执行。
- 受保护 Route Handler 每次从 HttpOnly access cookie 读取 token，并通过 Authorization 调用 Hono。
- 浏览器 HTTP helper 收到明确的 access 过期业务码后，调用同源 refresh Route Handler，再重试原请求一次。

Next.js 的 `cookies()` 是异步 API。Server Component 可以读 cookie，但只能在 Server Function 或 Route Handler 中 set/delete，且流式响应开始后不能再写 cookie。因此 session 恢复接口、refresh 和 logout 都使用 Route Handler。

首期只设置两个 cookie，不设置 session JSON cookie：

| Cookie                         | 用途                           | 选项                                                                                                            |
| ------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `moodmate_admin_access_token`  | BFF 调用 Hono 的 Authorization | `HttpOnly`、`SameSite=Lax`、`Path=/`、production 使用 `Secure`，Max-Age 不超过 access token 和 session 剩余时间 |
| `moodmate_admin_refresh_token` | BFF 调用 refresh/logout        | `HttpOnly`、`SameSite=Lax`、`Path=/`、production 使用 `Secure`，Max-Age 不超过 session 剩余时间                 |

不设置 `Domain`。两个 cookie 都使用 `Path=/`，避免 refresh 路径收到 cookie而 logout 路径收不到。登录、refresh、logout 的 POST Route Handler 还要校验 `Origin` 等于 Admin 自身 origin。

官方资料：

- <https://nextjs.org/docs/app/api-reference/file-conventions/proxy>
- <https://nextjs.org/docs/app/api-reference/functions/cookies>
- <https://nextjs.org/docs/app/guides/authentication>

## 当前依赖版本

2026-07-16 查询 npm registry 得到：

- `jose`: `6.2.3`
- `uuidv7`: `1.2.1`
- `drizzle-orm`: `0.45.2`

实现时将共享版本写入 `pnpm-workspace.yaml` catalog，仅在 `apps/api` 引入运行期依赖。Admin 使用 Next.js 自带的 cookie 和 Route Handler API，不引入认证库。
