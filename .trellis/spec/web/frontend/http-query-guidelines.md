# Web HTTP 与 Query

## 1. 适用范围

新增或修改 Web API 请求、客户端远程数据、query key、mutation 和缓存失效时使用本规范。服务端组件直接调用 `src/api`，客户端组件通过 TanStack Query 调用同一函数。

## 2. 公开签名

HTTP 入口在 `apps/web/src/lib/http/index.ts`：

```ts
http.get(path, responseSchema, options?);
http.post(path, payload, responseSchema, options?);
```

业务接口放在 `apps/web/src/api/<module>.api.ts`。Query 配置放在相邻的 `<module>.query.ts`，导出 key factory、`queryOptions()` 和 `mutationOptions()`。

## 3. 请求与响应约定

- 服务端 base URL：`getWebServerEnv().API_BASE_URL`。
- 浏览器 base URL：`getWebClientEnv().NEXT_PUBLIC_API_BASE_URL`。
- path 必须以单个 `/` 开头，业务接口不能传完整外部 URL。
- query 支持 string、number、boolean 和同名数组；`null`、`undefined` 不写入 URL。
- POST body 由 HTTP 层执行 `JSON.stringify()`，调用方不能通过 `RequestInit` 改 method 或 body。
- 响应用 `createApiResponseSchema(responseSchema)` 校验，成功时返回 `data`，失败时抛 `HttpRequestError`。
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

- 正常：客户端 `healthQueryOptions()` 调 `getHealth({ init: { signal } })`，缓存 key 是 `systemKeys.health()`。
- 基础：服务端组件直接 `await getHealth()`，不创建 QueryClient。
- 错误：query function 返回 `{ ok: false }`，TanStack Query 会把失败响应当成成功数据缓存。

## 6. 必做检查

- `pnpm check-types`：schema 推导、API 函数和 query options 通过。
- `pnpm lint`：没有类型断言、跨应用 import 或未使用变量。
- `pnpm format:check`：本次文件符合 Prettier。
- `pnpm --filter web build`：服务端和客户端依赖图都能构建。
- 客户端调用检查：静态产物包含 `NEXT_PUBLIC_API_BASE_URL`，不包含私有 `API_BASE_URL` 的值。
- 错误检查：至少覆盖 API failure、非 JSON、schema 不匹配、状态冲突、网络失败和取消。

## 7. 错误与正确写法

```ts
// 错误：页面自己信任 response.json() 的类型
const data = (await response.json()) as HealthResponse;

// 正确：业务函数传入 contracts schema，HTTP 层完成校验
export function getHealth(options?: SystemRequestOptions) {
  return http.get("/health", HealthResponseSchema, options);
}
```

QueryClient 只在 `src/providers/query-provider.tsx` 内通过 lazy `useState` 创建。不要创建模块级 QueryClient，也不要为了 Query 把整个页面改成客户端组件。

## 8. Web Token 静默刷新

### 8.1 适用范围

修改 `apps/web/src/auth/client-session.ts`、浏览器 Authorization、Web refresh 或受保护页面 profile 请求时使用。

### 8.2 签名

```ts
readClientSession(): StoredWebSession | null;
saveClientSession(input: WebAuthTokenResponse): void;
clearClientSession(): void;

POST /auth/web/password/login;
POST /auth/web/token/refresh;
GET /rpc/user/profile;
```

### 8.3 合同

- `web:client-session` 保存 access token、refresh token、各自过期时间和 `WebSession`。读取 JSON 后必须用 Zod schema 校验，不能类型断言。
- session 绝对过期或 refresh token 过期时删除本地值。access token 单独过期时保留 session，让 HTTP 模块请求 refresh。
- 浏览器请求没有显式 Authorization 时才附加本地 access token。服务端请求和显式 Authorization 请求不读取本地 session。
- 只有自动附加 token 的请求收到 `AUTH.ACCESS_EXPIRED` 才刷新。refresh 使用请求体里的 refresh token，不附加旧 access token。
- 并发请求共用模块级 refresh Promise。成功后完整保存 rotation 返回值，每个原请求只用新 access token 重试一次。
- refresh 或重试失败时清除本地 session。AbortError 原样抛出，不能因为取消请求清除登录态。

### 8.4 校验与错误矩阵

| 条件                              | 结果                                               |
| --------------------------------- | -------------------------------------------------- |
| 本地 JSON、字段或 `app` 无效      | 删除 `web:client-session`，返回 `null`             |
| access 返回 `AUTH.ACCESS_EXPIRED` | 共用一次 refresh，保存新 session，原请求重试一次   |
| access 缺失、无效或权限不足       | 原样抛 `HttpRequestError`，不 refresh              |
| refresh 无效、重放或 session 撤销 | 清除本地 session，抛 refresh 的 `HttpRequestError` |
| 显式 Authorization 请求到期       | 原样抛错，不改写当前浏览器 session                 |
| 请求被 AbortSignal 取消           | 原样抛 AbortError，不清除 session                  |

### 8.5 正常、基础、错误案例

- 正常：profile access 到期，HTTP 模块 refresh 成功后用新 token 重试，guard 继续显示页面。
- 基础：多个 profile/query 同时到期时只发送一个 refresh，所有调用等待同一 Promise。
- 错误：在每个页面 catch 401 后各自 refresh，rotation 会让后续请求拿旧 refresh token，触发 replay 并撤销 session。

### 8.6 必做检查

- 登录后刷新浏览器，受保护页面能从经过 schema 校验的 session 恢复。
- access 到期时 Network 中只有一个 `/auth/web/token/refresh`，原业务请求最多重试一次。
- refresh 成功后本地 access token 和 refresh token 都变化。
- refresh 失败后 `/app` 清除 session 并替换到 `/login`。
- 显式 Authorization、服务端请求、非过期业务错误和 AbortError 不触发 refresh。
- 依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter web build`。

### 8.7 错误与正确写法

```ts
// 错误：每个请求单独刷新，并继续复用旧 Authorization
await refreshClientSession();
return fetch(url, originalRequestInit);

// 正确：等待共享 refresh，再根据最新 session 重建请求
await ensureClientRefresh();
const retryRequest = createRequestInit(method, options?.init, payload);
return executeRequest(url, retryRequest.init, responseSchema);
```

## 9. 乐观更新（onMutate / onError / onSuccess）

即时聊天类交互（用户发消息后要立刻看到自己的气泡）用 React Query 乐观更新，不等服务端返回再渲染。首见于群聊发送 `sendGroupChatMessageMutationOptions`（`apps/web/src/api/group-chat.query.ts`）。

### 9.1 三段式契约

```ts
export function sendGroupChatMessageMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (input: { groupChatId: string; message: string }) =>
      sendGroupChatMessage(input.groupChatId, { message: input.message }),
    async onMutate(variables) {
      const detailKey = groupChatKeys.detail(variables.groupChatId);
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous =
        queryClient.getQueryData<AgentGroupChatDetail>(detailKey);
      const optimistic = buildOptimisticUserMessage(variables, previous);
      queryClient.setQueryData<AgentGroupChatDetail>(detailKey, (current) =>
        current
          ? {
              ...current,
              recentMessages: [...current.recentMessages, optimistic],
            }
          : current,
      );
      return { optimisticId: optimistic.id, previous };
    },
    onSuccess(response, variables, context) {
      const detailKey = groupChatKeys.detail(variables.groupChatId);
      const serverIds = new Set([
        context.optimisticId,
        response.userMessage.id,
        ...response.agentMessages.map((m) => m.id),
      ]);
      queryClient.setQueryData<AgentGroupChatDetail>(detailKey, (current) =>
        current
          ? {
              ...current,
              groupChat: response.groupChat,
              recentMessages: [
                ...current.recentMessages.filter((m) => !serverIds.has(m.id)),
                response.userMessage,
                ...response.agentMessages,
              ],
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: groupChatKeys.list() });
    },
    onError(_error, variables, context) {
      if (context?.previous) {
        queryClient.setQueryData(
          groupChatKeys.detail(variables.groupChatId),
          context.previous,
        );
      }
    },
  });
}
```

### 9.2 硬约定

- `onMutate` 先 `cancelQueries` 目标 key，再快照 `previous`，最后写入乐观数据。跳过 `cancelQueries` 会让在途请求的旧响应覆盖乐观值。
- 乐观消息 id 用可识别前缀（`optimistic-${Date.now()}`），`onSuccess` 靠它 + 服务端返回的真实 id 组成去重集合，避免乐观项与真实项并存。
- `onSuccess` 用服务端返回的权威字段覆盖（如 `groupChat` 的 `messageCount` / `lastMessageAtMs`），不复用乐观时的估算值。
- `onError` 用 `context.previous` 整体回滚。草稿等输入态恢复放组件层（在组件的 `onError` 回调里 `setDraft(variables.message)`），不塞进 mutationOptions。
- 列表类连带数据（左栏群聊列表的消息数 / 时间）在 `onSuccess` 里 `invalidateQueries` 拉最新，不做乐观估算。

### 9.3 何时用 / 何时不用

- 用：即时聊天发送、点赞点踩这类高频、低风险、用户需要即时反馈的写操作。
- 不用：创建 / 删除 / 成员增减这类低频操作，直接 `onSuccess` + `invalidateQueries` 即可（见 3.3），乐观更新的回滚成本不划算。
