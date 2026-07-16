# D1 认证数据实施

1. 使用 `trellis-before-dev` 读取 API、D1 和跨层规范。
2. 固定 `drizzle-orm`、`jose`、`uuidv7` catalog 版本并更新 API 依赖；本任务只使用 `drizzle-orm`。
3. 用 Wrangler 创建初始 auth migration。
4. 写 9 张表、索引和 rotation 数据库保护。
5. 写 Drizzle schema 和 D1 client factory。
6. 写登录查询、角色查询、session、refresh token 和 rotation repository 操作。
7. 写可重复执行的本地 `seed.sql`。
8. 从空本地 D1 应用 migration，核对 `sqlite_master`。
9. 连续运行 seed 两次并核对各实体行数。
10. 执行 rotation 成功、状态失败和并发竞争验证，保存实际 SQL 查询结果。
11. 运行 `trellis-check`，再依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。
12. 将新确认的 D1 约束或 repository 规则通过 `trellis-update-spec` 写回规范。

关键回滚点：rotation 并发验证通过前，不启动 `07-16-admin-auth-api`。

## 当前验证结果

- `pnpm check-types`：通过。
- `pnpm lint`：通过。
- `pnpm format:check`：经用户授权格式化 3 个既有 Trellis 文件后通过。
- 空 local state 应用 `0001_create_auth_schema.sql`：通过，第二次检查无待执行 migration。
- seed 连续执行两次：通过，各固定实体保持 1 条。
- 同一 workerd 实例并发 rotation：一个请求成功，一个请求被拒绝，数据库只有一个后继 token。
- token 已用、token 已撤销、session 已撤销、过期和超出 session 截止时间：均未写入后继记录。
