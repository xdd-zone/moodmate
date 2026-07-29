# API 写法

`apps/api` 是 moodmate 的 Hono API 服务，运行在 Cloudflare Workers 上。外部资源接入放在 `infra`，接口契约放在 `@repo/contracts`。

## 目录

```text
apps/api/src/
├── index.ts              # Wrangler 入口，只导出 app
├── app.ts                # 创建 app，并导出 AppType
├── bootstrap/            # 注册中间件、错误处理和路由
├── infra/                # D1 等外部资源的访问代码
├── middleware/           # 请求 ID、CORS、安全响应头
├── modules/<module>/     # 每个业务模块自己的 route 和 service
├── routes/index.ts       # 一级路由挂载
└── shared/               # env、meta、AppError、Hono 类型
```

新增接口时，先在 `packages/contracts/src/<module>` 写请求 schema 和响应类型，再到 `apps/api/src/modules/<module>` 写 route。一级挂载只改 `apps/api/src/routes/index.ts`。

## 环境变量

字符串环境变量只在 `apps/api/src/shared/env.ts` 解析。D1 等资源 binding 在 `apps/api/src/shared/hono-env.ts` 定义类型，由 `infra` 访问。route、service 和 middleware 不直接拆分字符串配置。

- `APP_ENV` 只接受 `development`、`test`、`production`。
- `CORS_ORIGINS` 使用英文逗号分隔，解析后只保留合法的 HTTP/HTTPS origin。
- production 必须配置 `CORS_ORIGINS`。

本地值放在 `apps/api/.dev.vars`，可以从 `.dev.vars.example` 创建。`wrangler.jsonc` 定义 development、test、production 的 `APP_ENV`，并只在默认开发环境配置 `DB`；远端 CORS 来源由 Cloudflare 环境变量提供。

## D1

`apps/api/src/infra/db/d1.ts` 负责 D1 连通性检查和 Drizzle client 创建。认证表查询放在 `apps/api/src/modules/auth/auth.repository.ts`，不集中写进 `infra/db/d1.ts`。

- `GET /health` 只检查 Worker 能否响应，不访问 D1。
- `GET /rpc/system/readiness` 执行 `SELECT 1 AS ok`。
- D1 正常时返回 HTTP 200 和 `status: "ready"`。
- binding 缺失或查询失败时返回 HTTP 503 和 `SYSTEM.DATABASE_UNAVAILABLE`。

认证表 migration 位于 `apps/api/migrations`，本地认证数据位于 `apps/api/dev/seed.sql`。migration 继续由 Wrangler 管理；Drizzle 只负责运行期 schema 和查询。开发 seed 只执行到带 `--local` 的数据库。

## AI 接入层

调用上游模型的代码放在 `apps/api/src/infra/ai`。业务模块只负责 prompt、业务流程和结果处理，不自己创建模型客户端，也不解析 OpenAI 协议。

```text
apps/api/src/infra/ai/
├── index.ts                 # 唯一对外入口，业务只从这里 import
├── types.ts                 # 规范化消息、模型连接、生成选项、结果、事件、工具
├── errors.ts                # AiError 和稳定错误 code
├── provider-registry.ts     # 按 api 选实现的只读映射
├── stream.ts                # 事件流工具和转纯文本字节流的适配器
├── runtime/
│   ├── generate-text.ts     # generateText / streamText
│   ├── generate-object.ts   # generateObject
│   └── execute-tools.ts     # 工具执行循环
└── providers/
    └── openai-compatible/   # 唯一引用 openai SDK 的目录
        ├── index.ts
        ├── openai-compatible.provider.ts
        └── openai-compatible.mapper.ts
```

业务只从 `@/infra/ai` import，用这三个 runtime 入口：

- `streamText()`：流式文本，配 `toTextByteStream()` 转成 chat route 需要的纯文本字节流。单聊用这条。
- `generateText()`：非流式文本，传入 `tools` 时进入工具执行循环。群聊回复用这条。
- `generateObject()`：结构化输出，传 Zod schema，返回后再用同一 schema 校验。`chat.analysis.ts` 和 `group-chat.orchestration.ts` 的 LangGraph 节点用这条。

规则：

- 只有 `providers/openai-compatible` 目录能引用 `openai` SDK，SDK 类型不越过这个目录。
- 业务模块不 import `openai`，不构造 `ChatCompletionMessageParam`，不拼原始 request body。
- `provider-registry.ts` 按 `AiModel.api` 选实现，不按 `providerName` 写分支。
- `disableThinking` 只通过 `AiModel.providerOptions["openai-chat-completions"]` 传，映射为上游的 `thinking: { type: "disabled" }`。

`llm-config` 继续负责配置持久化、API Key 加密和活动配置选择，`resolveActiveLlmProviderConfig()` 返回 `AiModel` 连接形状交给 AI 模块。AI 模块不读 D1。

### 配置测试会产生少量 token

`POST /rpc/admin/llm-configs/test` 走 `generateText()` 发一次 `maxTokens: 1` 的最小非流式请求，验证认证、协议和模型是否可用。这次请求会在上游产生极少量 token。测试超时 15 秒，超时或失败返回管理端可读的中文短句，不暴露 API Key 和上游原始错误体。

### 错误排查

Provider 把 SDK error 和 HTTP status 转成 `AiError`，稳定 code：`invalid_config`、`authentication`、`permission_denied`、`rate_limited`、`timeout`、`aborted`、`network`、`invalid_response`、`invalid_output`、`tool_not_found`、`tool_invalid_arguments`、`tool_execution_failed`、`max_steps`、`upstream_error`。

`chat`、`group-chat` 和 `llm-config` service 在业务边界把 `AiError` 转成 `BizCode`、HTTP status 和中文文案。`aborted` 保持取消语义向上抛，不转成 503。

排查上游问题时看 `AiError.metadata` 里的 `providerName`、`model`、`status`、`requestId`、`durationMs`。日志只记录这些字段，不记录 API Key、Authorization、完整 prompt、完整工具参数、完整工具结果或原始上游错误体。工具执行日志只记录名称、耗时和结果状态。

### 新增协议

要接入除 OpenAI Chat Completions 以外的协议，按顺序：

1. 在 `types.ts` 的 `AiApi` 加协议标识。
2. 在 `providers/<new-protocol>` 实现 `AiProvider`，边界把 SDK 类型转成 `types.ts` 里的内部类型。
3. 在 `provider-registry.ts` 的 `PROVIDERS` 静态注册新实现。
4. 引入测试框架后补该协议的 Provider contract test。

业务模块不需要改动。registry 是只读映射，没有运行时注册方法。

### 测试覆盖

项目当前没有 API 测试框架。Provider mapper、流事件合并、structured output 方法切换和工具执行循环写成了可单测的纯逻辑，但没有自动化用例覆盖，只靠类型检查、lint 和手动开发环境请求验证。引入 Vitest 后优先补：SDK 响应到内部结果的映射、分段文本与并行 tool call chunk 的事件合并、finish reason 与 SDK error 映射、structured output 成功和方法切换、工具未注册和参数无效、纯文本流适配器的 `text-delta` 累计。

## Contracts

`@repo/contracts` 放前后端共用的类型和 schema。

当前基础文件：

```text
packages/contracts/src/
├── common/biz-code.ts
├── common/response.ts
├── system/health.contract.ts
├── system/ping.contract.ts
├── system/readiness.contract.ts
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
