# 设计 apps/api D1 数据库接入

## Goal

为 `apps/api` 接入 Cloudflare D1，使本地运行的 API 能通过 Worker binding 执行一条数据库查询，并为后续业务表 migration 和开发 seed 留下明确、可执行的约定。

## Background

- `apps/api` 当前使用 Hono 和 Wrangler，开发命令为 `wrangler dev --port 6155`。
- `apps/api/wrangler.jsonc` 当前只有注释形式的 D1 示例，代码中还没有 D1 binding 类型或数据库访问逻辑。
- 课程材料用于理解本地 D1、migration 和 seed 的职责，不直接决定本项目的目录、数据库名、binding 名或表结构。
- 当前没有业务表设计，因此不能照搬课程中的认证表、系统配置数据或开发账号。

## Requirements

- 使用 Wrangler D1 binding 接入数据库，binding 名在配置和 TypeScript 类型中保持一致。
- 本地开发能够使用 `pnpm dev:api` 启动 API，并通过一个 HTTP 请求实际执行 D1 查询。
- 数据库访问验证不得依赖尚未确定的业务表。
- migration 只保存数据库结构及结构所需的系统数据；开发 seed 只保存本地联调数据，不进入生产初始化流程。
- 不引入当前目标不需要的 ORM、repository 抽象或占位业务表。
- 本次只接入 Wrangler 管理的本地 D1，不创建或配置 Cloudflare 远程 D1。
- 设计文件保留课程材料中适用于本项目的结论后，删除仓库根目录的两份课程 `.txt`。
- D1 基础接入代码放在 `apps/api/src/infra/db/d1.ts`；不新增顶层 `src/db`。
- `apps/api/migrations` 和 `apps/api/dev/seed.sql` 分别保留给 Wrangler migration 与开发 seed，有真实 SQL 时再创建。
- 保留 `GET /health` 作为不访问外部资源的 liveness；新增 `GET /rpc/system/readiness` 执行 D1 连通性查询。
- `/rpc/system/readiness` 查询成功时返回 HTTP 200 和 `status: "ready"`；binding 缺失或查询失败时返回 HTTP 503、`ok: false` 和 `SYSTEM.DATABASE_UNAVAILABLE`。
- readiness 失败响应不得包含数据库名、本地文件路径、SQL 或 D1 原始错误。
- 使用现有 `cf-typegen` 脚本生成并提交 Cloudflare runtime 类型，不手写 `D1Database` 的近似类型。

## Acceptance Criteria

- [x] Wrangler 配置中存在可供本地开发使用的 D1 binding，TypeScript 能正确识别 `D1Database`。
- [x] D1 正常时，`GET /rpc/system/readiness` 返回 HTTP 200、`ok: true` 和 `data.status: "ready"`。
- [x] D1 binding 缺失或查询失败时，`GET /rpc/system/readiness` 返回 HTTP 503、`ok: false` 和 `SYSTEM.DATABASE_UNAVAILABLE`。
- [x] `GET /health` 保持现有响应合同，不访问 D1。
- [x] `worker-configuration.d.ts` 与 Wrangler 配置一致，`D1Database` 由 Wrangler runtime 类型提供。
- [x] 项目文档写明本地启动、数据库验证、后续 migration 和开发 seed 的准确命令及边界。
- [x] 未新增任何业务表、认证表、演示账号或生产 seed。
- [x] `创建本地D1数据库.txt` 和 `D1 migration & seed.txt` 已删除，所需项目约定已写入 Trellis 设计文件或项目文档。
- [x] `pnpm check-types` 通过。
- [x] `pnpm lint` 通过。
- [x] `pnpm format:check` 通过。

## Out Of Scope

- 业务表、字段、索引和关联关系设计。
- 认证、session、refresh token 与管理员账号初始化。
- Cloudflare 远程 D1 的创建、test/production binding、远程 migration 和部署。
- ORM 选型与接入。
