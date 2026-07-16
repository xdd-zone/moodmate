# 实施计划

## 1. Task Order

### 子任务一：D1 Auth Schema

1. 在 `pnpm-workspace.yaml` 固定 `drizzle-orm`、`jose` 和 `uuidv7` 版本，只给 `apps/api` 增加运行期依赖。
2. 用 Wrangler 创建首个 migration，在一份 migration 中按外键顺序创建 9 张表、索引和 rotation 所需 trigger 或约束。
3. 新增 Drizzle schema 和 D1 client factory；readiness 继续使用现有轻量查询。
4. 新增 auth repository 的基础查询和 D1 batch 写入函数。
5. 新增 `apps/api/dev/seed.sql`，使用固定 UUIDv7 和预计算 PBKDF2 hash 初始化本地 Admin 数据。
6. 在全新本地 D1 应用 migration，查询 `sqlite_master`，连续执行 seed 两次并核对行数。
7. 单独验证 rotation batch：成功、旧 token 已使用、旧 token 已撤销、session 已撤销和两个并发请求。

### 子任务二：Hono Admin Auth API

1. 在 `packages/contracts` 定义 Admin auth 请求、响应、safe session 和业务错误码。
2. 扩展 API 环境变量校验，加入 access/refresh secret；更新 `.dev.vars.example`，不写真实 secret。
3. 实现 PBKDF2 编码、验证、dummy hash 和耗时记录脚本。
4. 实现 JWT 签发与校验，固定算法、issuer、audience、token type 和 claims schema。
5. 实现密码登录：检查 application/method、用户、凭证、锁定状态和 `admin_owner`，原子创建 session 与首个 refresh token。
6. 实现 access auth middleware 和 Admin session 查询。
7. 实现 refresh：校验 refresh JWT、查询持久化状态、重新读取角色、执行原子 rotation，并处理严格 replay。
8. 实现 logout：撤销 session 和仍有效的 refresh token，保持重复调用可处理。
9. 注册 `/auth/admin/*` 路由，确认日志和错误响应不含 token、密码、hash、邮箱或 secret。
10. 用本地 Wrangler 验证登录、session、refresh、并发 replay、logout 和全部错误分支。

### 子任务三：Admin BFF And Pages

1. 将 `API_BASE_URL` 保持为 server-only；浏览器 HTTP helper 改为同源 BFF，不再依赖 `NEXT_PUBLIC_API_BASE_URL` 调用 Hono。
2. 新增 server-only Hono client、Origin 校验和统一 cookie helper。
3. 实现 login、session、refresh 和 logout Route Handler；BFF 响应只返回 safe session。
4. 新增 `/login` 页面、登录表单、提交状态和通用错误反馈。
5. 将 Admin 根页面设为受保护页面，加载当前 safe session，并提供 logout 命令。
6. 新增 `proxy.ts`，只做 cookie 存在性跳转和静态 matcher。
7. 扩展浏览器 HTTP helper：只对 `AUTH.ACCESS_EXPIRED` 做 single-flight refresh，原请求最多重试一次。
8. 验证 token 不进入客户端 bundle 可见配置、页面 props、React Query cache、URL、console 或 BFF JSON。
9. 在 6154/6155 本地联调登录、刷新页面、access 过期恢复、并发请求、refresh 过期和 logout。

### 父任务集成检查

1. 从空本地 D1 开始执行 migration 和 seed。
2. 启动 API 6155 与 Admin 6154，完成一次登录、session 恢复、rotation 和 logout。
3. 检查 D1 中 session、旧 refresh token、新 refresh token 和撤销状态。
4. 用两个并发 refresh 请求验证严格 replay 会撤销 session。
5. 检查浏览器 Network、Application/Cookies 和页面运行时状态，确认 token 只存在 HttpOnly cookie。
6. 运行全仓质量门禁并记录本地手动验证结果。

## 2. Validation Commands

每个代码子任务完成后依次运行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
```

D1 子任务至少运行：

```bash
pnpm --filter api exec wrangler d1 migrations apply moodmate-local --local
pnpm --filter api exec wrangler d1 migrations list moodmate-local --local
pnpm --filter api exec wrangler d1 execute moodmate-local --local --file=./dev/seed.sql
pnpm --filter api exec wrangler d1 execute moodmate-local --local --file=./dev/seed.sql
pnpm --filter api cf-typegen
pnpm --filter api exec wrangler deploy --dry-run --env=""
pnpm --filter api exec wrangler deploy --dry-run --env test
pnpm --filter api exec wrangler deploy --dry-run --env production
```

父任务最后启动：

```bash
pnpm dev:api
pnpm dev:admin
```

HTTP payload 和 token 由实现后的 contracts 确定，不在规划文件中复制可能过期的 `curl` JSON。API 子任务必须在自己的验证记录中保存实际命令和返回的 HTTP 状态、业务码。

## 3. Review Gates

- migration 中实际表、索引、trigger 与 Drizzle schema 一致。
- raw token DTO 只在 Hono 与 server-only BFF 代码使用。
- refresh rotation 的成功路径和 replay 路径都经过真实本地 D1，不用 mock 代替。
- `proxy.ts` 中没有 `fetch()`、JWT refresh 或数据库检查。
- cookie set/delete 使用同一名称、Path 和 Secure 规则。
- access 到期、refresh 到期、session 撤销、角色撤销和 token 篡改不会进入无限重试。
- 浏览器同一请求最多 refresh 一次、重试一次。
- PBKDF2 验证耗时被记录；结果只证明本地可运行，不写成生产性能结论。

## 4. Rollback Points

- 子任务一修改 schema 后，先在可删除的本地 D1 state 验证；未通过前不开始 API 子任务。
- 子任务二保留 auth 路由注册边界；失败时可以移除路由注册而不影响 system 模块。
- 子任务三先完成 BFF Route Handler，再替换页面入口；失败时可以恢复现有 Admin 页面，API 与 D1 不回滚。

## 5. Before Start

- 父任务 PRD、design 和 implement 由用户审阅。
- 创建三个子任务，并在每个子任务 PRD 中写入依赖与可单独检查的验收条件。
- 用户确认后只启动第一个 D1 子任务，不启动父任务或后续依赖任务。
