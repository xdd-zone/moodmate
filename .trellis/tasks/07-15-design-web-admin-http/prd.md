# 设计 Web 与 Admin HTTP 层

## 目标

为 `apps/web` 和 `apps/admin` 建立一致的 typed HTTP 与 TanStack Query 使用约定。服务端组件、客户端组件和业务接口函数按同一套协议调用 `apps/api`，页面不再重复处理 URL、query、JSON body、响应 envelope 和远程数据状态。

## 背景

- 两个应用都是 Next.js 16 App Router 项目，当前没有请求层、业务接口目录或 TanStack Query 依赖。
- 两个应用已经分别提供 `src/env/client.ts` 和 `src/env/server.ts`。浏览器读取 `NEXT_PUBLIC_API_BASE_URL`，服务端读取 `API_BASE_URL`。
- `@repo/contracts` 已提供 `ApiResponse<T>`、`BizCode` 和 system 请求/响应 schema，但 web/admin 尚未依赖该包。
- 项目已经确定默认使用 `contracts + typed HTTP`。`AppType` 继续保留，但 web/admin 不以 Hono RPC client 作为主要调用方式。
- `pnpm-workspace.yaml` 的 catalog 统一管理共享依赖版本。
- 两份章节材料只用于提取需求，示例目录、类型断言、错误处理和演示页面不直接照搬。

## 需求

### R1 请求层归属

- Web 与 Admin 分别在自己的 `src/lib` 内维护 HTTP 实现，不新增共享 HTTP package。
- 业务接口函数分别放在各自的 `src/api`，页面和组件不直接写业务 `fetch()`。
- 两个应用不能互相 import 请求代码，也不能 import `apps/api/src`。

### R2 运行环境与请求构造

- 同一组业务接口函数必须能被服务端组件和客户端组件调用。
- 服务端请求使用各应用 `get*ServerEnv().API_BASE_URL`，浏览器请求使用 `get*ClientEnv().NEXT_PUBLIC_API_BASE_URL`。
- HTTP 层统一处理相对路径、query string、JSON request body、header 合并和 `AbortSignal`。
- 调用方可以通过 `RequestInit` 明确设置 Next.js 缓存、header 和其他 fetch 选项；HTTP 层不设置全局缓存策略。

### R3 响应与错误

- HTTP 层必须用 `@repo/contracts` 的 Zod schema 校验 JSON envelope 和成功数据，不能用类型断言把 `response.json()` 直接当成目标类型。
- 成功请求返回业务 `data`，API 失败、HTTP 协议异常、非 JSON、schema 不匹配和网络失败进入统一的 typed error 分支。
- API 失败错误保留 `code`、HTTP status、`requestId` 和 `details`，方便页面给出具体提示和排查请求。
- 请求取消继续抛出原始 `AbortError`，不能转换成普通网络错误。
- 网络失败不能伪造 `ApiResponse`、业务错误码、requestId 或 timestamp。

### R4 TanStack Query

- `@tanstack/react-query` 通过 workspace catalog 加入 web/admin。
- 两个应用分别创建自己的 `QueryClientProvider`，在客户端只创建一个稳定的 `QueryClient` 实例。
- Query 只管理客户端远程数据；服务端组件直接调用 `src/api` 函数，不为了使用 Query 把整页改成客户端组件。
- query key、`queryOptions`、`mutationOptions` 和缓存失效规则放在 `src/api`，页面只组合参数和展示状态。
- query function 必须把 TanStack Query 提供的 `signal` 传到 HTTP 层。

### R5 当前接入样例

- Web 与 Admin 都提供 system API 函数，覆盖 `GET /health` 和 `POST /rpc/system/ping`。
- system query 配置覆盖 health 查询、ping mutation，以及 ping 成功后使 health query 失效的规则。
- 当前项目没有对应产品操作，不新增永久演示页面。类型检查、构建和手动请求验证接入结果。

## 验收标准

- [x] AC1：web/admin 都有本地 HTTP 入口和 `src/api` system 请求函数，页面无需拼 base URL、query 或 JSON body。对应 R1、R2。
- [x] AC2：同一个 system 请求函数可在服务端组件直接调用，也可作为 TanStack Query 的 query/mutation function。对应 R2、R4。
- [x] AC3：合法成功响应返回经过 schema 校验的业务数据；API 失败保留错误码和 requestId。对应 R3。
- [x] AC4：网络断开、非 JSON、响应结构不符、HTTP 状态与 envelope 冲突、主动取消分别得到设计规定的结果。对应 R3。
- [x] AC5：两个应用的 Provider 使用独立 QueryClient，health query 接收 `signal`，ping 成功后只使 system health query 失效。对应 R4、R5。
- [x] AC6：web/admin 通过 catalog 引用同一 TanStack Query 版本，并直接依赖 `@repo/contracts`。对应 R3、R4。
- [x] AC7：`pnpm check-types`、`pnpm lint`、本次文件的 Prettier 检查和 web/admin build 通过；根 `pnpm format:check` 只剩 3 个本任务开始前已有的文件，见 `implement.md` 验证记录。对应全部需求。
- [x] AC8：两份参考 txt 在任务设计完成后删除。

## 不在范围内

- 不新增或修改 `apps/api` 路由。
- 不实现登录、cookie session、token refresh、请求埋点、超时重试或离线缓存。
- 不接入 TanStack Query Devtools、SSR dehydration、持久化缓存或 Suspense Query。
- 不新增演示页面，不改当前页面视觉和业务文案。
- 不新增 HTTP 共享 package，也不改用 Hono RPC client。
