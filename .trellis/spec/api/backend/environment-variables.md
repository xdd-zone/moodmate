# API 环境变量

## 1. 适用范围

新增或修改 Cloudflare Worker 环境变量、资源 binding、CORS 来源和 Wrangler 环境时使用本约定。字符串 binding 在 `apps/api/src/shared/env.ts` 解析；D1 等资源 binding 通过 `ApiBindings` 提供类型，由 `infra` 访问。

## 2. 函数签名

```ts
getApiEnv(bindings: ApiBindings): ApiEnv;
```

route、service 和 middleware 传入 `c.env`，不直接读取或拆分 binding。Hono 通过 `ApiHonoEnv.Bindings` 提供类型。

资源 binding 不放进 `ApiEnv`。当前 D1 和 R2 合同是：

```ts
interface ApiBindings {
  AVATAR_BUCKET?: R2Bucket;
  DB?: D1Database;
}
```

两个字段都是可选的，因为只有默认开发环境配置本地 D1 和 R2，test 与 production 没有对应 binding。修改 `wrangler.jsonc` 的 binding 或 `compatibility_date` 后运行 `pnpm --filter api cf-typegen`，提交更新后的 `apps/api/worker-configuration.d.ts`，不要手写 Cloudflare runtime 类型。

## 3. 变量合同

| 变量           | 必填规则        | 约束                                |
| -------------- | --------------- | ----------------------------------- |
| `APP_ENV`      | 所有环境必填    | `development`、`test`、`production` |
| `CORS_ORIGINS` | production 必填 | 英文逗号分隔的 HTTP/HTTPS origin    |

`wrangler.jsonc` 定义三个环境的 `APP_ENV`，并使用 `keep_vars` 保留 Cloudflare 中配置的远端变量。本地真实值放在 `.dev.vars`，仓库只提交 `.dev.vars.example`。

## 4. 校验与错误矩阵

| 条件                           | 服务行为                             | 日志               |
| ------------------------------ | ------------------------------------ | ------------------ |
| `APP_ENV` 缺失或非法           | 请求返回 500                         | 写明允许的三个值   |
| production 缺少 `CORS_ORIGINS` | 请求返回 500                         | 写明必须配置该变量 |
| CORS 项不是 HTTP/HTTPS origin  | 请求返回 500                         | 写明无效值         |
| 请求 origin 不在允许列表       | 不返回 `Access-Control-Allow-Origin` | 不报错             |

## 5. 正常、基础、错误案例

- 正常：production 的 `APP_ENV` 来自 Wrangler，`CORS_ORIGINS` 来自 Cloudflare 变量。
- 基础：development 使用 `.dev.vars` 中的 6153、6154 origin。
- 错误：非法 `APP_ENV` 静默改成 development，或 production 空列表接受任意 origin。

## 6. 必做检查

- `pnpm check-types`、`pnpm lint`、`pnpm format:check`。
- Wrangler 对默认、test、production 分别执行 `deploy --dry-run`。
- `pnpm --filter api exec wrangler types --env-interface CloudflareBindings --check`。
- `/health` 返回当前 `APP_ENV`；允许来源有 CORS header，未允许来源没有。
- production 清空 `CORS_ORIGINS` 后请求返回 500，日志指向该变量。

## 7. 错误与正确写法

```ts
// 错误：业务模块直接读取并提供默认值
const appEnv = c.env.APP_ENV ?? "development";

// 正确：固定入口严格校验
const env = getApiEnv(c.env);
return c.json({ env: env.APP_ENV });
```
