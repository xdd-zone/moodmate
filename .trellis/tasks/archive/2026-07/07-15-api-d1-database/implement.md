# apps/api 本地 D1 接入实施清单

## 实施顺序

1. [x] 更新 `apps/api/wrangler.jsonc`，在默认开发环境增加 `DB` binding 和 `moodmate-local` 数据库名，不填写远程 `database_id`，不修改 test 与 production binding。
2. [x] 运行 `pnpm --filter api cf-typegen`，生成包含 `D1Database` runtime 类型的 `apps/api/worker-configuration.d.ts`；把生成文件加入 `.prettierignore`。
3. [x] 更新 `apps/api/src/shared/hono-env.ts`，把可选的 `DB?: D1Database` 加入 `ApiBindings`。
4. [x] 新建 `apps/api/src/infra/db/d1.ts`，执行 `SELECT 1 AS ok` 并校验结果，不创建 client、schema 或 ORM 包装。
5. [x] 新建 `packages/contracts/src/system/readiness.contract.ts`，定义 `{ status: "ready" }`，并从 `packages/contracts/src/index.ts` 导出。
6. [x] 在 `packages/contracts/src/common/biz-code.ts` 增加 `SYSTEM_DATABASE_UNAVAILABLE`，在 `apps/api/src/shared/app-error.ts` 允许 HTTP 503。
7. [x] 更新 `apps/api/src/modules/system/system.service.ts`，调用 D1 检查函数；失败时记录原始错误，再抛出不含内部细节的 `AppError`。
8. [x] 更新 `apps/api/src/modules/system/system.route.ts`，新增异步 `GET /rpc/system/readiness`，成功时使用 `buildSuccess()` 返回 readiness contract。
9. [x] 更新 `apps/api/README.md`，写明本地 D1 binding、启动、readiness 验证，以及未来 migration 和 seed 的准确命令与边界。
10. [x] 更新 `docs/apps/api.md` 和 `docs/architecture.md` 中的 API 目录、readiness 路径及 `src/db` 预设，改成实际采用的 `src/infra/db`。
11. [x] 删除仓库根目录的 `创建本地D1数据库.txt` 和 `D1 migration & seed.txt`。

## 明确不创建

- `apps/api/migrations/`
- `apps/api/dev/seed.sql`
- 业务表、schema、索引或测试账号
- `system.repository.ts`
- D1 client 单例、ORM 或远程 D1 配置

这些文件和目录在出现真实业务表或开发数据时再创建。

## 行为验证

1. 默认开发环境启动 API：

   ```bash
   pnpm dev:api
   ```

2. 确认 liveness 不访问数据库：

   ```bash
   curl --fail http://localhost:6155/health
   ```

3. 确认 API 能访问本地 D1：

   ```bash
   curl --fail http://localhost:6155/rpc/system/readiness
   ```

   响应必须为 HTTP 200、`ok: true` 和 `data.status: "ready"`。

4. 使用没有 D1 binding 的 test Wrangler 环境在另一个端口启动：

   ```bash
   pnpm --filter api exec wrangler dev --env test --port 6156
   ```

5. 请求失败路径：

   ```bash
   curl --silent --output /tmp/moodmate-readiness.json --write-out '%{http_code}\n' http://localhost:6156/rpc/system/readiness
   ```

   HTTP 状态必须为 503，响应必须为 `ok: false` 和 `SYSTEM.DATABASE_UNAVAILABLE`，且不得包含原始 D1 错误。

6. 检查 Wrangler 三个配置目标都能构建，不执行部署：

   ```bash
   pnpm --filter api exec wrangler deploy --dry-run --env=""
   pnpm --filter api exec wrangler deploy --dry-run --env test
   pnpm --filter api exec wrangler deploy --dry-run --env production
   ```

7. 确认生成类型与 Wrangler 配置一致：

   ```bash
   pnpm --filter api exec wrangler types --env-interface CloudflareBindings --check
   ```

## 质量检查

严格按顺序执行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
```

最后运行：

```bash
git diff --check
```

项目当前没有集成测试配置，因此 D1 binding 行为使用 Wrangler 本地服务和真实 HTTP 请求验证，不安装测试框架。

## 风险与回退点

- D1 binding 是 Wrangler 非继承配置；本次只在默认开发环境声明，test 环境故意用于验证缺失 binding，production 仍不配置远程 D1。
- `worker-configuration.d.ts` 是 Wrangler 生成文件，不手改；修改 binding 或 compatibility date 后重新运行 `pnpm --filter api cf-typegen`。
- `pnpm --filter api exec` 的工作目录是 `apps/api`，README 中 migration 和 seed 文件路径必须按这个目录书写。
- 不运行 `wrangler d1 create`、`wrangler d1 execute --remote`、`wrangler d1 migrations apply --remote` 或真实部署命令。
- 如果本地 Wrangler 不接受省略 `database_id` 的配置，停在该失败点并报告，不伪造 ID，也不改成远程 D1。

## 验证结果

- `pnpm check-types`：通过。
- `pnpm lint`：通过。
- 本次改动文件的 Prettier 检查：通过。
- `pnpm format:check`：获得用户授权格式化 4 个既有 Trellis archive/workspace 文件后通过。
- Wrangler 类型新鲜度检查：通过。
- 默认、test、production dry-run：通过；test 和 production 因有意缺少 D1 binding 显示 Wrangler 非继承 warning。
- `/health`：HTTP 200，保持原响应合同。
- 默认环境 readiness：HTTP 200，返回 `status: ready`。
- 缺少 D1 binding 的 test 环境 readiness：HTTP 503，返回 `SYSTEM.DATABASE_UNAVAILABLE`，客户端响应不含原始错误。
