# API 写法

`apps/api` 是 moodmate 的 Hono API 服务，运行在 Cloudflare Workers 上。目录按 momo 的方式放，接口契约按老师项目的方式放到 `@repo/contracts`。

## 目录

```text
apps/api/src/
├── index.ts              # Wrangler 入口，只导出 app
├── app.ts                # 创建 app，并导出 AppType
├── bootstrap/            # 注册中间件、错误处理和路由
├── middleware/           # 请求 ID、CORS、安全响应头
├── modules/<module>/     # 每个业务模块自己的 route 和 service
├── routes/index.ts       # 一级路由挂载
└── shared/               # env、meta、AppError、Hono 类型
```

新增接口时，先在 `packages/contracts/src/<module>` 写请求 schema 和响应类型，再到 `apps/api/src/modules/<module>` 写 route。一级挂载只改 `apps/api/src/routes/index.ts`。

## 环境变量

Worker binding 的原始值只在 `apps/api/src/shared/env.ts` 解析。route、service 和 middleware 调用 `getApiEnv(c.env)`，不直接拆分字符串。

- `APP_ENV` 只接受 `development`、`test`、`production`。
- `CORS_ORIGINS` 使用英文逗号分隔，解析后只保留合法的 HTTP/HTTPS origin。
- production 必须配置 `CORS_ORIGINS`。

本地值放在 `apps/api/.dev.vars`，可以从 `.dev.vars.example` 创建。`wrangler.jsonc` 定义 development、test、production 的 `APP_ENV`；远端 CORS 来源由 Cloudflare 环境变量提供。

## Contracts

`@repo/contracts` 放前后端共用的类型和 schema。

当前基础文件：

```text
packages/contracts/src/
├── common/biz-code.ts
├── common/response.ts
├── system/health.contract.ts
├── system/ping.contract.ts
├── system/root.contract.ts
└── index.ts
```

规则：

- 请求体用 Zod schema，例如 `PingRequestSchema`。
- 请求类型从 schema 推出来，例如 `type PingRequest = z.infer<typeof PingRequestSchema>`。
- 响应类型也放在 contracts，例如 `HealthResponse`、`PingResponse`。
- API 返回用 `buildSuccess()` 和 `buildFailure()` 拼，不在 route 里手写 `ok/data/meta/error`。
- 错误码只从 `BizCode` 取，例如 `BizCode.COMMON_INVALID_REQUEST`。

## API 返回

成功响应：

```json
{
  "ok": true,
  "data": {
    "service": "api"
  },
  "meta": {
    "requestId": "<request-id>",
    "timestamp": "<iso-time>"
  }
}
```

失败响应：

```json
{
  "ok": false,
  "error": {
    "code": "COMMON.INVALID_REQUEST",
    "message": "请求参数无效",
    "details": []
  },
  "meta": {
    "requestId": "<request-id>",
    "timestamp": "<iso-time>"
  }
}
```

`meta.requestId` 来自 `x-request-id` 请求头。没有这个请求头时，API 会自己生成一个。

## Route 写法

请求体验证用 `@hono/zod-validator`：

```ts
route.post(
  "/rpc/system/ping",
  zValidator("json", PingRequestSchema, (result) => {
    if (result.success) return;

    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      "请求参数无效",
      400,
      result.error.issues,
    );
  }),
  (c) => {
    const payload = c.req.valid("json");

    return c.json(
      buildSuccess(
        getPingResult(c.env, payload.name),
        createMeta(c.var.requestId),
      ),
    );
  },
);
```

route handler 只返回 Hono response，例如 `c.json()`。能放在 service 的业务计算，不放在 route 里写长函数。

## 前端调用

moodmate 默认用 `contracts + typed HTTP`。前端页面不要直接写请求体类型和响应类型，要把请求函数放到 API 文件里。

示例：

```ts
import type { PingRequest, PingResponse } from "@repo/contracts";
import { http } from "@/lib/http";

export function postPing(payload: PingRequest) {
  return http.post<PingRequest, PingResponse>("/rpc/system/ping", payload);
}
```

`AppType` 会继续从 `apps/api/src/app.ts` 导出，给需要 Hono RPC 类型时使用。默认业务调用先走 typed HTTP。

## 检查命令

改 API 或 contracts 后，至少跑：

```bash
pnpm --filter @repo/contracts check-types
pnpm --filter api check-types
```

改接口路径、请求参数、响应结构或错误码后，同步检查这份文档和 `apps/api/README.md`。
