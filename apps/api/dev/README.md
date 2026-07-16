# 本地认证数据

先应用 migration，再写入本地开发账号：

```bash
pnpm --filter api exec wrangler d1 migrations apply moodmate-local --local
pnpm --filter api exec wrangler d1 execute moodmate-local --local --file=./dev/seed.sql
```

本地 Admin 登录信息：

```text
邮箱：admin@moodmate.local
密码：MoodmateLocalAdmin!2026
```

这组数据只用于本地联调。不要删除命令中的 `--local`，也不要把账号或密码用于远程环境。

## 密码 benchmark

下面的 Worker 只用于本地执行 PBKDF2 hash 和 verify，不会挂到 API 路由：

```bash
pnpm --filter api exec wrangler dev dev/password-benchmark.worker.ts --port 6156
curl --fail http://localhost:6156
```

返回值包含 `hashDurationMs`、`verifyDurationMs` 和 `verified`。耗时只说明当前本地 workerd 可以运行，不能作为生产 Workers 的 CPU 使用结论。
