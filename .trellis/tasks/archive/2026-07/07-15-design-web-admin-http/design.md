# Web 与 Admin HTTP 层设计

## 设计结论

Web 与 Admin 使用相同目录和公开接口，但各自保留实现。两边的环境变量、鉴权方式和后台权限会逐步分开，把 HTTP 实现放进共享 package 会提前绑定这些差异。

HTTP 层负责请求构造、envelope 校验和错误转换；`src/api` 负责接口路径、contract schema 和 query/mutation 配置；页面只传业务参数并展示结果。

```text
服务端组件 -> src/api/*.api.ts -> http -> apps/api
客户端组件 -> TanStack Query -> src/api/*.api.ts -> http -> apps/api
```

## 目录

Web 与 Admin 分别建立下面的结构。文件内容按应用环境 helper 调整，两个应用不能互相 import。

```text
apps/<web|admin>/src/
├── api/
│   ├── system.api.ts       # health、ping 请求函数
│   └── system.query.ts     # key、queryOptions、mutationOptions
├── lib/
│   └── http/
│       ├── error.ts        # HttpRequestError 与错误类别
│       └── index.ts        # URL、fetch、schema 校验、get/post
└── providers/
    └── query-provider.tsx  # 应用自己的 QueryClientProvider
```

`app/layout.tsx` 只挂 Provider。Provider 是客户端边界，但作为 `children` 传入的服务端组件不会因此全部变成客户端组件。

## Contracts 补充

HTTP 层不能信任 `response.json()` 的静态类型。`packages/contracts/src/common` 增加可复用的运行时 schema：

- `BizCodeSchema`：校验当前 `BizCode` 的值。
- `ApiMetaSchema`：校验 `requestId` 和 ISO timestamp。
- `ApiErrorSchema`：校验 `code`、`message` 和可选 `details`。
- `createApiResponseSchema(dataSchema)`：用接口的响应 schema 生成 `ok: true | false` 判别联合。

这些 schema 从 `packages/contracts/src/index.ts` 导出。现有 `ApiResponse<T>`、`buildSuccess()` 和 `buildFailure()` 保持兼容，API route 不需要改动。

## HTTP 公开接口

两个应用导出相同形状的 `http`：

```ts
type HttpQueryValue = string | number | boolean | null | undefined;
type HttpQuery = Record<
  string,
  HttpQueryValue | readonly HttpQueryValue[]
>;

type HttpOptions = {
  init?: RequestInit;
  query?: HttpQuery;
};

http.get(path, responseSchema, options?);
http.post(path, payload, responseSchema, options?);
```

返回类型从 `responseSchema` 推导，不由调用方手写响应泛型。调用示例：

```ts
export function getHealth(options?: Pick<HttpOptions, "init">) {
  return http.get("/health", HealthResponseSchema, options);
}

export function postPing(payload: PingRequest) {
  return http.post("/rpc/system/ping", payload, PingResponseSchema);
}
```

`getHealth()` 返回 `Promise<HealthResponse>`，不是 `Promise<ApiResponse<HealthResponse>>`。HTTP 层在返回前已经校验 envelope；失败响应抛出 typed error。这个约定让 TanStack Query 的 `isError` 与重试行为符合真实请求结果。

## 请求构造

### Base URL

`resolveBaseURL()` 在 Web 中调用 `getWebServerEnv()` / `getWebClientEnv()`，在 Admin 中调用对应的 Admin helper。

- `typeof window === "undefined"`：读取私有 `API_BASE_URL`。
- 浏览器：读取公开的 `NEXT_PUBLIC_API_BASE_URL`。
- 只接受以 `/` 开头的应用内 API path，不允许业务接口函数传完整外部 URL。

实现时必须用 web/admin build 检查客户端 bundle。私有 `API_BASE_URL` 不能出现在浏览器产物中。

### Query string

- `undefined` 和 `null` 不写入 URL。
- `string`、`number`、`boolean` 使用 `URLSearchParams.set()`。
- 数组对同一个 key 重复调用 `append()`，保留调用方顺序。
- 不在 HTTP 层定义业务字段的日期、对象或嵌套结构编码；业务接口先转换为 contract 约定的标量。

### RequestInit

- 先读取调用方 headers，再补默认 `accept: application/json`。
- POST 在调用方没有指定时补 `content-type: application/json`，并由 HTTP 层序列化 payload。
- `method` 和 HTTP 层生成的 `body` 不能被 `init` 覆盖。
- `signal`、`cache` 和其他标准 fetch 选项原样传递。
- 不设置全局 `cache: "no-store"`。每个接口按数据时效显式配置，客户端缓存由 TanStack Query 管理。

## 响应与错误

`HttpRequestError` 至少包含：

```ts
type HttpErrorKind = "api" | "http" | "invalid-response" | "network";

class HttpRequestError extends Error {
  kind: HttpErrorKind;
  status?: number;
  code?: BizCodeValue;
  requestId?: string;
  details?: unknown;
  cause?: unknown;
}
```

处理顺序：

1. 调用 fetch。
2. 读取 JSON；读取失败时抛 `invalid-response`。
3. 使用 `createApiResponseSchema(responseSchema)` 校验 envelope；失败时抛 `invalid-response`。
4. `ok: false` 时抛 `api`，保留 status、code、requestId 和 details。
5. `ok: true` 但 HTTP status 不是 2xx 时抛 `http`，避免缓存协议冲突的响应。
6. 返回已校验的 `data`。

| 情况                           | 结果                             |
| ------------------------------ | -------------------------------- |
| 2xx + 合法成功 envelope        | 返回已校验的`data`               |
| 4xx/5xx + 合法失败 envelope    | 抛`api` 错误                     |
| 2xx + 合法失败 envelope        | 抛`api` 错误                     |
| 非 2xx + 成功 envelope         | 抛`http` 错误                    |
| 空响应、HTML 或 JSON 解析失败  | 抛`invalid-response` 错误        |
| envelope 或 data schema 不匹配 | 抛`invalid-response` 错误        |
| fetch 网络失败                 | 抛`network` 错误，不伪造业务字段 |
| `AbortSignal` 取消             | 原样抛出`AbortError`             |

错误默认使用中文短句。协议错误不把原始响应正文直接显示给用户，开发日志可以保留 cause。

## TanStack Query

### 依赖

`pnpm-workspace.yaml` 增加：

```yaml
"@tanstack/react-query": ^5.101.2
```

web/admin 的 dependencies 都增加 `@tanstack/react-query: catalog:` 和 `@repo/contracts: workspace:*`。

### Provider

两个应用分别创建 QueryClient，默认配置保持克制：

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});
```

Provider 使用 `useState(() => new QueryClient(...))` 保证客户端实例稳定。不创建模块级 QueryClient，不在 Web 与 Admin 之间共享缓存，不接 Devtools。

### Query 配置

每个业务域维护自己的 key factory。system 的形状为：

```ts
const systemKeys = {
  all: ["system"] as const,
  health: () => [...systemKeys.all, "health"] as const,
};
```

- `healthQueryOptions()` 使用 `queryOptions()`，`queryFn` 把 `{ signal }` 传给 `getHealth({ init: { signal } })`。
- `pingMutationOptions(queryClient)` 使用 `mutationOptions()`，成功后调用 `invalidateQueries({ queryKey: systemKeys.health() })`。
- query key 必须包含会改变响应的全部业务参数；对象参数先规范化，不能放不稳定引用。
- 不为只转发 `useQuery()` 的场景创建自定义 hook。只有需要组合多个请求或统一页面行为时再加 hook。

服务端组件直接调用 `getHealth()`。本期不做 `prefetchQuery`、`dehydrate` 或流式 hydration，避免在没有真实页面需求时增加 SSR Query 状态同步。

## Web 与 Admin 边界

- 两个应用可以使用相同的 system contracts，但后续用户端和后台返回字段不同时必须定义不同 contract。
- 本期不默认设置 `credentials: "include"`。当前 API CORS 没有启用 credentials；接入 cookie session 时需要同时修改 API CORS、两个 HTTP 层和鉴权设计。
- Authorization header 可以由具体请求通过 `init.headers` 传入。本期不增加 token 存储或刷新拦截器。
- Admin 不复用 Web 的 query key、缓存或业务请求函数。

## 兼容与回退

当前没有旧请求层和 TanStack Query 数据，无迁移数据。实现失败时可以按相反顺序移除 Provider、query 配置、HTTP/API 文件和依赖；现有页面与 API 不受影响。

不修改 `apps/api` 路由和返回结构。contracts 新增 schema 是向后兼容导出，已有调用继续使用原类型和构造函数。
