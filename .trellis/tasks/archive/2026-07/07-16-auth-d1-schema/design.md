# D1 认证数据设计

## Source

共同数据模型和运行时结论以父任务下列文件为准：

- `../07-16-auth-schema/design.md` 第 2、3、8 节。
- `../07-16-auth-schema/research/runtime-auth-findings.md` 的 D1 与 Drizzle 部分。
- `.trellis/spec/api/backend/d1.md`。

本任务只负责把这些设计变成 schema、migration、repository 数据操作和本地 seed，不实现 HTTP 认证流程。

## File Ownership

```text
pnpm-workspace.yaml
apps/api/package.json
apps/api/migrations/*.sql
apps/api/dev/seed.sql
apps/api/src/infra/db/*
apps/api/src/modules/auth/*.schema.ts
apps/api/src/modules/auth/*.repository.ts
```

实际目录先遵循 `trellis-before-dev` 注入的 API 规范；若规范要求不同位置，以更近的规范为准并更新本文件。

## Migration

Wrangler 创建一个初始认证 migration。表按外键依赖顺序创建，自引用 refresh 外键放在 `refresh_tokens` 建表语句中。所有索引使用明确名称，方便 `sqlite_master` 检查。

不配置 `drizzle.config.ts`，不加入 `drizzle-kit`，不执行 `push` 或 `migrate`。Drizzle schema 是 repository 的类型来源，Wrangler SQL 是数据库迁移来源。

## Rotation Write

repository 提供一个 rotation 写入入口，入参必须包含旧 token ID、新 token 完整记录、当前时间和 session ID。内部生成一个 D1 batch，不能把 batch 拆成多个 repository 调用。

migration 使用唯一索引和 trigger 或等效数据库约束检查：

- 旧 token 未使用、未撤销且未过期。
- session 未撤销且未过期。
- 新旧 token 属于同一 session。
- 新 token 的 parent 指向旧 token。
- 旧 token 的 replacement 指向新 token。

任何检查失败都使用 SQLite `RAISE(ABORT, ...)` 或约束错误中止整批操作。service 后续只根据明确的 repository 结果区分 rotation 成功和竞争失败，不解析原始 SQL 文本作为业务逻辑。

## Seed

seed 固定 `admin` 应用、`password` 方式、`admin_owner` 角色和本地管理员标识。所有 insert 使用明确的 conflict 策略，重复执行不新增行。

密码列只保存版本化 PBKDF2 编码串。对应明文只作为本地开发说明存在，不写入 SQL 注释或数据列。seed 执行命令始终包含 `--local`。

## Rollback

本任务只操作可删除的本地 D1 state。migration 未进入共享环境前，失败时删除本地 state 后从空库重跑。migration 一旦进入共享环境，不修改旧文件，只新增 migration。
