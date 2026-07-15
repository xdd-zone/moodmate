# API 错误、环境和请求上下文

API 的失败响应由 `apps/api/src/bootstrap/create-app.ts` 统一生成。业务代码抛出带业务码和 HTTP 状态的 `AppError`，route 和 service 不手写失败响应对象。

## 错误处理

- 请求校验失败时，参考 `apps/api/src/modules/system/system.route.ts`：`zValidator()` 的失败回调抛出 `AppError`。
- 业务错误使用 `apps/api/src/shared/app-error.ts` 的 `AppError`，`code` 必须是 `BizCodeValue`。
- `HTTPException` 在 `createApiApp()` 的 `app.onError()` 中转为统一失败响应。
- 未识别异常只在服务端执行 `console.error(error)`，客户端收到 `SYSTEM.INTERNAL_ERROR` 和中文短句，不返回堆栈或内部对象。
- 未匹配路由由 `app.notFound()` 返回 `COMMON.NOT_FOUND`。

失败响应必须调用 `buildFailure()` 并携带 `createMeta(c.var.requestId)`。不要在 route 中重复拼 `ok`、`error`、`meta`。

## 请求上下文

`apps/api/src/middleware/request-context.middleware.ts` 负责：

- 优先读取 `x-request-id`，没有时调用 `crypto.randomUUID()`。
- 把 `requestId` 和 `startedAt` 写入 `c.var`。
- 把 `x-request-id` 写回响应头。

新增上下文字段时同步修改 `apps/api/src/shared/hono-env.ts` 的 `ApiHonoEnv.Variables`。这些字段只属于单次请求，不写入业务数据。
