# 头像对象存储实施

1. 使用 `trellis-before-dev` 读取 API、contracts、D1、环境变量和跨层规范。
2. 在 `packages/contracts` 定义头像 key query、上传响应 DTO 和存储错误码。
3. 新增 `assets` 模块的文件校验、key 生成、R2 读写、Drizzle schema 和 repository。
4. 新增 `0002_create_default_avatar_versions.sql`，保持 Wrangler 为唯一 migration 工具。
5. 实现受 Admin access 保护的上传路由和公开读取路由，并挂载到 API。
6. 在默认开发环境增加 `AVATAR_BUCKET`，运行 `pnpm --filter api cf-typegen` 更新 Worker 类型。
7. 从空 local state 应用 migration，核对表、索引和外键。
8. 启动本地 Wrangler，用真实 Admin 登录验证未授权上传、合法上传、读取、错误类型、空文件、超限和未知 key。
9. 检查 R2 object metadata 与 D1 元数据一致。
10. 运行 `trellis-check`，再依次执行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。
11. 使用 `trellis-update-spec` 记录确认后的 R2 binding、头像模块和跨资源写入规则。

关键回滚点：本地 migration、R2 上传和读取闭环通过前，不配置远端 bucket，也不部署 production。

## 当前验证结果

- `pnpm check-types`：通过。
- `pnpm lint`：通过。
- `pnpm format:check`：通过；此前 46 个 `.claude/**` 和 Trellis 文件的格式问题已由用户手动处理。
- `pnpm --filter api cf-typegen` 与 Wrangler types check：通过。
- 默认、test、production Wrangler dry-run：通过；test 和 production 按设计提示缺少非继承的 D1/R2 binding。
- 独立空 local state 应用 `0001`、`0002`：通过，`default_avatar_versions`、创建时间索引和 `users.id` 的 `ON DELETE SET NULL` 外键存在。
- Admin 上传：缺少或无效 access 返回 401；PNG、JPEG 和真实 WebP 返回 201。
- 文件校验：缺少文件、错误 MIME、空文件返回 400，超过 2 MiB 返回 413。
- 读取：合法 key 返回 200，未知 key 返回 404，无效 key 返回 400；读取 body 与原 PNG 的 SHA-256 相同，HTTP metadata、content length 和 etag 正确。
