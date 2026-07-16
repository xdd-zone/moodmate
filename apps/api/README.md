# api

独立 API 服务。

## 环境变量

从示例文件创建本地配置：

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

- `APP_ENV`：`development`、`test`、`production` 之一。
- `AUTH_ACCESS_SECRET`：签发 access token 的 secret，至少 32 个 UTF-8 字节。
- `AUTH_REFRESH_SECRET`：签发 refresh token 的 secret，至少 32 个 UTF-8 字节，不能与 access secret 共用。
- `CORS_ORIGINS`：允许访问 API 的 origin，多个值用英文逗号分隔。

本地真实值放在 `.dev.vars`，不会提交。`wrangler.jsonc` 保存三个环境的 `APP_ENV`，并在默认开发环境配置本地 D1；test 和 production 的 `CORS_ORIGINS` 在 Cloudflare 中配置，`keep_vars` 会在部署时保留这些远端变量。production 缺少 `CORS_ORIGINS` 时，API 会直接报错。

test 和 production 的两个 auth secret 通过 Cloudflare Worker secret 配置，不写入 `wrangler.jsonc`。

`pnpm --filter api deploy` 明确部署到 Wrangler 的 production 环境。部署 test 环境时直接使用 Wrangler 的 `--env test` 参数。

## 运行

在项目根目录执行：

```bash
pnpm dev:api
```

健康检查：

```bash
curl http://localhost:6155/health
```

正常返回：

```json
{
  "data": {
    "env": "development",
    "service": "api",
    "status": "ok"
  },
  "meta": {
    "requestId": "<request-id>",
    "timestamp": "<iso-time>"
  },
  "ok": true
}
```

## 本地 D1

默认开发环境通过 `DB` binding 访问 `moodmate-local`。Wrangler 把本地数据库状态保存在 `apps/api/.wrangler/state`，该目录不会提交。

启动 API 后检查 D1：

```bash
curl --fail http://localhost:6155/rpc/system/readiness
```

D1 可用时返回 HTTP 200，`data.status` 为 `ready`。binding 缺失或查询失败时返回 HTTP 503 和 `SYSTEM.DATABASE_UNAVAILABLE`。

认证表 migration 位于 `apps/api/migrations/`。在项目根目录把待执行 migration 应用到本地 D1：

```bash
pnpm --filter api exec wrangler d1 migrations apply moodmate-local --local
```

本地认证 seed 位于 `apps/api/dev/seed.sql`，登录信息见 `apps/api/dev/README.md`。只把 seed 写入本地 D1：

```bash
pnpm --filter api exec wrangler d1 execute moodmate-local --local --file=./dev/seed.sql
```

修改 `wrangler.jsonc` 的 binding 或 `compatibility_date` 后重新生成 Worker 类型：

```bash
pnpm --filter api cf-typegen
```

本地开发命令不使用 `--remote`。本项目当前也不运行 `wrangler d1 create`，不会创建 Cloudflare 远程 D1。

## 检查

在项目根目录依次执行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
```
