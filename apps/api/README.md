# api

独立 API 服务。

## 环境变量

从示例文件创建本地配置：

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

- `APP_ENV`：`development`、`test`、`production` 之一。
- `CORS_ORIGINS`：允许访问 API 的 origin，多个值用英文逗号分隔。

本地真实值放在 `.dev.vars`，不会提交。`wrangler.jsonc` 只保存三个环境的 `APP_ENV`；test 和 production 的 `CORS_ORIGINS` 在 Cloudflare 中配置，`keep_vars` 会在部署时保留这些远端变量。production 缺少 `CORS_ORIGINS` 时，API 会直接报错。

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

## 检查

在项目根目录依次执行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
```
