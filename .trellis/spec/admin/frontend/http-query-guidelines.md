# Admin HTTP 与 Query

## 1. 适用范围

新增或修改 Admin API 请求、客户端远程数据、query key、mutation 和缓存失效时使用本规范。Admin 保留自己的请求和缓存，不能 import Web 的 API、HTTP 或 query 文件。

## 2. 公开签名

HTTP 入口在 `apps/admin/src/lib/http/index.ts`：

```ts
http.get(path, responseSchema, options?);
http.post(path, payload, responseSchema, options?);
```

后台业务接口放在 `apps/admin/src/api/<module>.api.ts`。Query 配置放在相邻的 `<module>.query.ts`，导出 key factory、`queryOptions()` 和 `mutationOptions()`。

## 3. 请求与响应约定

- 服务端 base URL：`getAdminServerEnv().API_BASE_URL`。
- 浏览器 base URL：`getAdminClientEnv().NEXT_PUBLIC_API_BASE_URL`。
- path 必须以单个 `/` 开头，业务接口不能传完整外部 URL。
- query 支持 string、number、boolean 和同名数组；`null`、`undefined` 不写入 URL。
- POST body 由 HTTP 层执行 `JSON.stringify()`，调用方不能通过 `RequestInit` 改 method 或 body。
- 响应用 `createApiResponseSchema(responseSchema)` 校验，成功时返回 `data`，失败时抛 `HttpRequestError`。
- 后台接口使用 Admin contract；不能复用用户端 DTO 后在页面隐藏字段。
- Query function 把 TanStack Query 提供的 `signal` 放进 `RequestInit`。

## 4. 校验与错误情况

| 条件                     | 结果                                                    |
| ------------------------ | ------------------------------------------------------- |
| path 不是应用内路径      | 抛 `TypeError`                                          |
| 2xx + 合法成功响应       | 返回经过 schema 校验的 `data`                           |
| 合法失败响应             | 抛 `kind: "api"`，保留 code、status、requestId、details |
| 非 2xx + 成功响应        | 抛 `kind: "http"`                                       |
| 非 JSON 或 schema 不匹配 | 抛 `kind: "invalid-response"`                           |
| fetch 失败               | 抛 `kind: "network"`                                    |
| `AbortSignal` 取消       | 原样抛 `AbortError`                                     |

网络失败不能伪造业务错误码、requestId 或 timestamp。环境变量校验、非法 path 和 JSON 序列化错误不转换成网络错误。

## 5. 正常、基础、错误案例

- 正常：后台客户端组件调用 domain query options，mutation 成功后只使相关 key 失效。
- 基础：后台服务端页面直接调用 `src/api` 函数，不创建 QueryClient。
- 错误：Admin import Web 的 API 函数，共享用户端缓存和未来的用户 session。

## 6. 必做检查

- `pnpm check-types`：schema 推导、API 函数和 query options 通过。
- `pnpm lint`：没有类型断言、Web import 或未使用变量。
- `pnpm format:check`：本次文件符合 Prettier。
- `pnpm --filter admin build`：服务端和客户端依赖图都能构建。
- 客户端调用检查：静态产物包含 `NEXT_PUBLIC_API_BASE_URL`，不包含私有 `API_BASE_URL` 的值。
- 错误检查：至少覆盖 API failure、非 JSON、schema 不匹配、状态冲突、网络失败和取消。

## 7. 错误与正确写法

```ts
// 错误：后台组件直接拼 URL 和响应泛型
fetch(`${baseURL}/rpc/admin/users`);

// 正确：后台请求函数固定接口路径和 contract schema
export function getAdminUsers(options?: AdminRequestOptions) {
  return http.get("/rpc/admin/users", AdminUsersResponseSchema, options);
}
```

QueryClient 只在 `src/providers/query-provider.tsx` 内通过 lazy `useState` 创建。不要创建模块级 QueryClient，也不要把 Admin 缓存放进共享 package。
