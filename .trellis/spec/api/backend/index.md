# API Backend Spec

`apps/api` 是 Hono + Cloudflare Workers 服务。修改 API 前按任务范围读取下面的指南。

## 指南

| 文件                                        | 适用内容                              |
| ------------------------------------------- | ------------------------------------- |
| [目录与职责](./directory-structure.md)      | 入口、模块目录、依赖方向              |
| [路由与中间件](./routing-and-middleware.md) | Hono 路由、校验、应用组装             |
| [错误和请求上下文](./error-handling.md)     | `AppError`、统一失败响应、变量        |
| [环境变量](./environment-variables.md)      | Worker binding、校验、Wrangler        |
| [D1](./d1.md)                               | 本地 binding、readiness、迁移         |
| [头像存储](./assets.md)                     | R2、头像校验、元数据和接口            |
| [Admin 认证](./auth.md)                     | 密码、JWT、session、refresh           |
| [角色管理](./role-management.md)            | application 隔离、生命周期、Admin API |
| [质量检查](./quality-guidelines.md)         | 类型边界、禁止写法、验证命令          |

## 开发前检查

- [ ] 新接口已先在 `packages/contracts` 定义 schema、请求类型和响应类型。
- [ ] 已确认改动属于 route、service、repository、presenter 或 shared 中哪一层。
- [ ] 已读取 `docs/architecture.md` 中对应模块的当前状态，未把下一阶段设计当成已实现能力。
- [ ] 新增字符串变量时已同步 `ApiBindings`、解析函数、Wrangler 和示例文件；新增资源 binding 时已同步 `ApiBindings`、Wrangler 和生成类型。
- [ ] 未新增浏览器可读取的 secret、数据库 record 或 Hono 内部类型。
- [ ] 修改 Admin 认证时已读取 `auth.md`，并确认 token 类型、D1 状态和角色都会重新校验。
- [ ] 修改头像上传、读取、R2 key 或元数据时已读取 `assets.md`。

## 完成检查

- [ ] route 只处理 HTTP 边界，业务计算在 service。
- [ ] 成功和失败响应使用 `buildSuccess()`、`buildFailure()` 与 `createMeta()`。
- [ ] 新路由已在 `apps/api/src/routes/index.ts` 挂载。
- [ ] Admin 认证改动已用真实本地 D1 验证 rotation、replay 和 logout。
- [ ] 已依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。
