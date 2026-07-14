# API 目录与职责

`apps/api` 是运行在 Cloudflare Workers 上的 Hono 服务。入口、应用组装、中间件、业务路由和共享类型分开放置。

## 当前目录

```text
apps/api/src/
├── index.ts              # Wrangler 入口，只导出 app
├── app.ts                # 创建 app，并导出 AppType
├── bootstrap/            # 注册中间件、错误处理和路由
├── middleware/           # 跨路由的请求处理
├── modules/<module>/     # 按业务域放 route 和 service
├── routes/index.ts       # 挂载一级业务路由
└── shared/               # env、meta、AppError 和 Hono 类型
```

现有实现可从这些文件核对：

- `apps/api/src/index.ts` 只默认导出 `app`。
- `apps/api/src/app.ts` 调用 `createApiApp()`，并导出 `AppType`。
- `apps/api/src/bootstrap/create-app.ts` 统一注册中间件、错误处理和路由。
- `apps/api/src/modules/system/` 包含 `system.route.ts` 和 `system.service.ts`。

## 新业务模块

按 `docs/architecture.md` 的约定，新模块放在 `apps/api/src/modules/<module>/`。route 只处理 HTTP 边界，service 组织业务动作；接入 D1 后再增加 repository，需要转换内部记录时再增加 presenter 或 mapper。

```text
modules/mood/
├── index.ts
├── mood.route.ts
├── mood.service.ts
├── mood.repository.ts    # 接入持久化后再建
└── mood.presenter.ts     # 需要转换 DTO 时再建
```

同一模块内使用 presenter 或 mapper 其中一个，不同时保留两个同义层。当前项目还没有 D1、R2、KV、AI 或队列绑定，不要提前创建空 repository、数据库目录或占位客户端。

## 依赖方向

- API 可以依赖 `@repo/contracts`，不能 import `apps/web` 或 `apps/admin`。
- route 调 service；接入持久化后由 service 调 repository。
- `shared/` 只放多个模块会用的 API 基础类型和工具，不放某个业务域的规则。
- 新接口先改 `packages/contracts`，再改 API 模块和 `apps/api/src/routes/index.ts`。
