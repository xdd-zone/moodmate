# 验证记录

## 运行环境

- 日期：2026-07-16。
- runtime：本地 workerd，Wrangler 4.95.0。
- D1：使用 `mktemp` 创建独立 `--persist-to` 目录，从空状态应用 `0001_create_auth_schema.sql` 和 `dev/seed.sql`。

## HTTP 与 D1

- 登录成功、session 查询成功、refresh rotation 成功、logout 成功，HTTP 均为 200。
- 不存在账号、错误密码、suspended 用户、凭证锁定和无 active `admin_owner` 均返回 HTTP 401 与 `AUTH.INVALID_CREDENTIALS`；不存在账号与错误密码消息一致。
- access/refresh 互换、错误算法、issuer、audience、app、`token_use` 和篡改 token 均被拒绝；过期 access 返回 `AUTH.ACCESS_EXPIRED`。
- 旧 refresh 第一次 rotation 成功，第二次返回 `AUTH.REFRESH_REPLAYED`，随后新 access 返回 `AUTH.SESSION_REVOKED`。
- 两个并发 refresh 的结果为一个 HTTP 200、一个 HTTP 401 `AUTH.REFRESH_REPLAYED`。
- 角色撤销后，旧 access 和 refresh 都返回 `AUTH.SESSION_REVOKED`。
- logout 后，旧 access 返回 `AUTH.SESSION_REVOKED`，旧 refresh 返回 `AUTH.REFRESH_REPLAYED`。
- D1 查询结果：`lifetime_violations=0`，`parents_with_multiple_children=0`。

## 密码

通过 `apps/api/dev/password-benchmark.worker.ts` 在 workerd 内执行 hash 和 verify：

```text
hashDurationMs=43
verifyDurationMs=43
verified=true
```

这组耗时只代表本地运行结果，不代表生产 Workers CPU 使用。

## 检查命令

- `pnpm check-types`：通过。
- `pnpm lint`：通过，零 warning。
- `pnpm format:check`：通过。
- `pnpm --filter api exec wrangler types --env-interface CloudflareBindings --check`：通过。
- 默认、test、production 的 `wrangler deploy --dry-run`：通过。test 和 production 仍提示未继承顶层 D1 binding，这是现有环境设计，未连接远程 D1。
