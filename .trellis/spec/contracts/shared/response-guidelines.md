# 统一响应与错误码

## 响应结构

所有 API JSON 响应使用 `packages/contracts/src/common/response.ts` 中的判别联合：

- 成功：`{ ok: true, data, meta }`
- 失败：`{ ok: false, error, meta }`
- `meta` 始终包含 `requestId` 和 ISO 格式的 `timestamp`

构造响应时调用 `buildSuccess(data, meta)` 或 `buildFailure(error, meta)`。不要在 API route 中手写 `ok`、`data`、`error`、`meta`，否则字段顺序不是问题，但协议字段容易漏掉。

前端判断结果时先检查 `ok`，让 TypeScript 缩小到 `ApiSuccess` 或 `ApiFailure`；不要用 `as` 强行转换响应。

浏览器或 Next.js 服务端收到 JSON 后，使用下面的运行时 schema 校验：

```ts
BizCodeSchema;
ApiMetaSchema;
ApiErrorSchema;
createApiResponseSchema(dataSchema: z.ZodType<TData>);
```

`createApiResponseSchema()` 返回 `ApiResponse<TData>` 的判别联合 schema。接口调用方传入具体响应 schema，例如 `HealthResponseSchema`，再对 `response.json()` 的 `unknown` 结果调用 `safeParse()`。成功数据、失败错误、`requestId` 和 timestamp 都从解析结果读取，不手写局部 type guard。

## 业务错误码

错误码集中在 `packages/contracts/src/common/biz-code.ts` 的 `BizCode` 常量中，类型由常量值推导：

```ts
export type BizCodeValue = (typeof BizCode)[keyof typeof BizCode];
```

新增错误码时：

- 使用 `<DOMAIN>.<NAME>` 字符串，例如 `COMMON.INVALID_REQUEST`。
- 在 `BizCode` 中只定义一次，API 通过常量引用。
- 错误码表达可由调用方判断的类别；中文 `message` 说明当前失败。
- 不把 HTTP status 当作业务错误码，也不在多个 route 散落相同字符串。

## 对外字段

contracts 只描述调用方可见的 DTO。数据库列名、secret、内部 provider 返回、Hono context 和堆栈都不能进入响应类型。Web 与 Admin 权限和可见字段不同，需要分别定义 DTO，不能靠前端隐藏字段。
