# apps/api 本地 D1 接入设计

## 范围

本次只让本地运行的 `apps/api` 通过 Cloudflare Worker binding 执行 D1 查询。没有业务表，因此不设计 schema，不创建 migration、seed、ORM 或业务 repository。

## 目录与职责

```text
apps/api/
├── migrations/              # 首个业务表确定后由 Wrangler 创建
├── dev/
│   └── seed.sql             # 出现本地联调数据后创建
└── src/
    ├── infra/
    │   └── db/
    │       └── d1.ts        # D1 基础查询和连通性检查
    ├── modules/system/      # HTTP 检查接口及响应组织
    └── shared/              # Hono binding 类型与环境配置
```

本次只创建实际使用的 `src/infra/db/d1.ts`。`migrations/` 和 `dev/seed.sql` 是后续约定，不创建空目录或无效 SQL。

`infra` 保存外部资源的具体访问代码。D1 是第一个资源；以后接入 R2 或 LLM 时，再按实际需要新增 `infra/storage` 或 `infra/llm`。业务模块的表查询仍放在各模块 repository，不能把业务 SQL 集中到 `infra/db/d1.ts`。

## Wrangler Binding

默认开发环境在 `apps/api/wrangler.jsonc` 中增加 D1 binding：

- binding：`DB`
- database name：`moodmate-local`
- 不配置远程 `database_id`

`ApiBindings` 增加 D1 类型。由于 test 和 production 环境不在本次配置远程 D1，代码在执行检查前必须识别 binding 是否存在，不能把缺少 binding 当成查询成功。

运行现有 `pnpm --filter api cf-typegen` 生成 `apps/api/worker-configuration.d.ts`。该文件提供与当前 workerd 版本匹配的 `D1Database` runtime 类型；`ApiBindings.DB` 保持可选，用来准确描述没有 D1 binding 的 test 和 production Wrangler 环境。生成文件加入 `.prettierignore`，不由 Prettier 改写。

Wrangler 在 `.wrangler/state` 保存本地数据库状态，该目录不提交 Git。

## 调用边界

数据流：

```text
HTTP 检查请求
  -> system route
  -> system service
  -> infra/db/d1.ts
  -> c.env.DB.prepare("SELECT 1 AS ok")
  -> 统一 API 响应
```

- route 只处理路径、调用 service 和生成 Hono response。
- system service 组织检查结果，不直接写 SQL。
- `infra/db/d1.ts` 只执行无业务表依赖的 D1 查询，并校验结果。
- 连通性查询不是业务数据访问，不创建 `system.repository.ts`。

## 检查接口

- `GET /health` 保持现有 liveness 语义，只证明 Worker 能处理请求，不访问 D1。
- 新增 `GET /rpc/system/readiness`，通过 `infra/db/d1.ts` 执行 D1 查询。
- readiness 只返回通用检查状态和必要的错误信息，不返回数据库名、本地文件路径或原始 SQL 错误。
- 当前没有认证能力，readiness 暂时不加权限中间件；响应不得包含敏感配置。

成功响应使用现有统一结构，HTTP 状态为 200：

```json
{
  "data": {
    "status": "ready"
  },
  "meta": {
    "requestId": "<request-id>",
    "timestamp": "<iso-time>"
  },
  "ok": true
}
```

binding 缺失、查询异常或查询结果不是预期值时，service 记录原始错误并抛出 `AppError`。HTTP 状态为 503，客户端只收到：

```json
{
  "error": {
    "code": "SYSTEM.DATABASE_UNAVAILABLE",
    "message": "数据库不可用"
  },
  "meta": {
    "requestId": "<request-id>",
    "timestamp": "<iso-time>"
  },
  "ok": false
}
```

`packages/contracts` 增加 readiness response schema 和 `SYSTEM_DATABASE_UNAVAILABLE`；`AppErrorStatus` 增加 503。成功数据只保留一个 `status` 字段，已有 `meta.timestamp` 已能表示检查时间，不增加重复字段。

## Migration 与 Seed

- 使用 Wrangler 原生 `d1 migrations create/list/apply` 管理 migration。
- migration 使用 `apps/api/migrations/` 默认目录，不额外配置 `migrations_dir`。
- migration 只包含表、索引、约束及结构必需的系统数据。
- 本地联调数据放在 `apps/api/dev/seed.sql`，只通过带 `--local` 的命令执行。
- 当前没有业务表和联调数据，因此不创建 migration 或 seed 文件。
- 已经在其他环境执行过的 migration 不回改，后续新增下一份 migration。

## 文档同步

- 更新 `apps/api/README.md`，写明本地 D1 的启动与验证方式，以及后续 migration 和 seed 的准确命令。
- 更新 `docs/apps/api.md`，加入 `infra` 目录和 readiness 接口的当前实现。
- 更新 `docs/architecture.md` 中预设的 `src/db/client.ts`、`schema.ts` 目录，改成已确认的 `src/infra/db` 边界。
- 删除 `创建本地D1数据库.txt` 和 `D1 migration & seed.txt`。

## 兼容与回退

- Web 和 Admin 不需要同步接入 readiness；只在 `packages/contracts` 增加 system contract，不修改现有 health、ping 或 root contract。
- 不触碰 Cloudflare 远程资源。
- 回退时删除本次 D1 binding、连通性代码和检查接口改动；`.wrangler/state` 属于本地状态，不纳入 Git 回退。
