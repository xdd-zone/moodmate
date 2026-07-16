# 当前仓库认证边界

## 已实现基础

- `apps/api` 使用 Hono 4.12、Cloudflare Workers 和 Wrangler。
- D1 通过 `c.env.DB` 注入，请求期才能取得 binding。
- `apps/api/src/infra/db/d1.ts` 当前只执行 readiness 查询。
- 默认开发环境有本地 D1；test 和 production 还没有 D1 binding。
- `apps/api` 没有 ORM、认证、JWT、密码 hash 或 cookie 依赖。
- `apps/web`、`apps/admin` 和 `apps/api` 本地端口分别为 6153、6154、6155。
- Web 与 Admin 已有各自的 fetch 包装，但当前只支持 GET/POST，不附加 credentials 或 Authorization，也不管理 auth 状态。

## 既有架构约束

`docs/architecture.md:384` 已确定：

- auth 负责 Web 登录、Admin 登录、GitHub OAuth、access token、refresh token hash 和 session 撤销。
- 外部接口分为 `/auth/web/*` 与 `/auth/admin/*`。
- Admin 登录必须检查管理员身份。

`docs/architecture.md:316` 已确定业务接口使用：

```text
route -> service -> repository -> presenter
```

数据库 record 不进入 `packages/contracts`。接口必须先在 contracts 定义 schema、DTO 和错误码，再实现 API 和前端请求函数。

上次归档任务 `.trellis/tasks/archive/2026-07/07-15-api-d1-database/` 明确把业务表、认证、session、refresh token、管理员初始化和 ORM 排除在 D1 接入任务外。本任务不能把课程结构视为已经批准的后续方案。

## D1 与 migration 约束

`.trellis/spec/api/backend/d1.md` 已确定：

- migration 使用 Wrangler 原生管理流程。
- 业务 SQL 放在所属模块 repository，不集中到 `infra/db/d1.ts`。
- 首张业务表确定后再创建 `apps/api/migrations/`。
- 开发数据放 `apps/api/dev/seed.sql`，只用于本地联调。
- 已执行的 migration 不回改，后续新增 migration。

引入 Drizzle 时需要明确它只负责 schema 与查询，还是也接管 migration 生成。不能同时保留两套无法判断先后顺序的 migration 历史。

## 当前缺少的决策

- 首个交付只做 Admin，还是同时做 Web 与 Admin。
- 采用成熟认证框架，还是按课程自研 access/refresh 协议。
- Web 与 Admin 是否共享一个用户主体。
- Web 是否开放密码注册，GitHub 是否进入首期。
- 生产域名是否同站，浏览器是否直连 Hono。
- 首个管理员如何创建。
- session、access token 与 refresh token 的有效期。
- 是否承诺多标签页并发刷新。
