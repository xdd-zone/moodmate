# D1 接入现状与参考结论

## 仓库现状

- `apps/api` 使用 Hono、Cloudflare Workers 和 Wrangler。
- `apps/api/wrangler.jsonc` 的 D1 配置仍是注释示例。
- `apps/api/src/shared/hono-env.ts` 还没有 `D1Database` binding。
- `/health` 当前只返回服务和环境状态，没有访问外部资源。
- `docs/architecture.md` 把 `apps/api/src/db`、`apps/api/migrations` 和 `apps/api/dev/seed.sql` 标为 D1 接入阶段的候选目录，不代表已经实现。

## 课程材料可保留的原则

- Worker 通过 binding 访问 D1，本地数据库文件由 Wrangler 管理。
- migration 保存可重复执行的结构变更历史。
- seed 只提供开发联调数据，不参与生产初始化。
- 代码中的 binding 名、Wrangler 中的数据库名和 Cloudflare 的数据库 ID 是三个不同概念。

## 不直接采用的课程内容

- 不复制认证表、角色、session、refresh token 或演示管理员数据。
- 不用 `wrangler d1 execute --file` 代替 Wrangler 原生 migration 管理。
- 不沿用课程中的数据库名和数据库 ID。
- 不在没有数据需求时创建 seed SQL。

## 当前工具与官方资料

- 仓库中的 Wrangler 支持 `d1 migrations create`、`list` 和 `apply`。
- `d1 migrations create` 默认在 Worker 项目目录创建 `migrations/`。
- migration 执行历史默认保存在 D1 的 `d1_migrations` 表。
- migration 命令可以使用 binding 名或数据库名；Cloudflare 建议需要降低误操作风险时使用稳定的数据库名。
- `wrangler d1 create` 创建远程 D1，不是只创建本地文件。
- `wrangler dev` 默认使用独立的本地 D1 数据，不会访问远程生产数据。

## 与 xdd/core 的目录比较

`/Users/wuwanzhu/Code/xdd/core/apps/momo/src/infra` 统一保存外部资源的具体接入代码：

- `infra/db` 保存 PostgreSQL client、Drizzle schema 和 Drizzle migrations。
- `infra/cache`、`infra/search`、`infra/storage`、`infra/llm` 和 `infra/logs` 保存各资源的 driver 类型和具体实现。
- `bootstrap/create-runtime.ts` 根据环境配置选择具体实现，业务模块通过 service 或 repository 使用这些实现。
- `shared` 仍保存环境变量解析、Hono 类型和通用错误等应用内部基础代码，不保存外部资源实现。

这个边界适合 `moodmate`，因为 `apps/api` 后续还会接入 R2 和 LLM；D1 可以成为第一个真实的 `infra` 子目录。需要保留的只是目录职责，不复制 Momo 的 PostgreSQL client 生命周期、Drizzle schema 或 migration 布局。

## 推荐目录

```text
apps/api/
├── migrations/              # Wrangler 原生 migration，首个业务表确定后创建
├── dev/
│   └── seed.sql             # 有本地联调数据后创建
└── src/
    └── infra/
        └── db/
            └── d1.ts        # D1 binding 的基础查询与连通性检查
```

- 采用 `src/infra/db`，不再新增顶层 `src/db`。
- 当前不创建空的 `migrations/`、`dev/`、schema、repository 或数据库 client。
- D1 由 Cloudflare Workers 通过 `c.env.DB` 注入，不需要像 Momo 的 PostgreSQL 一样维护可关闭的全局 client。
- migration 保留在 Worker 项目根目录，沿用 Wrangler 默认路径；不为了与 Momo 目录相同而增加 `migrations_dir` 配置。
- seed 属于开发数据准备，不是运行时代码，因此不放进 `src/infra`。

## 文档冲突

`docs/architecture.md` 当前预设 `apps/api/src/db/client.ts` 和 `schema.ts`。源码还没有这些文件，而且本次不引入 ORM 或业务 schema。目录决策确认后，应把文档改成实际采用的 `src/infra/db`，并注明 migration 和 seed 在有真实 SQL 时才创建。

参考：

- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/d1/best-practices/local-development/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
