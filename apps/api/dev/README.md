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
