# Web 与 Admin HTTP 层实施计划

## 1. 补依赖与响应 schema

- [x] 在 `pnpm-workspace.yaml` catalog 增加 `@tanstack/react-query: ^5.101.2`。
- [x] web/admin 增加 `@tanstack/react-query: catalog:` 与 `@repo/contracts: workspace:*`。
- [x] 在 `@repo/contracts` 增加 `BizCodeSchema`、响应 envelope schema 和 `createApiResponseSchema()`，从包入口导出。
- [x] 运行 `pnpm install` 更新 lockfile。
- [x] 运行 `pnpm --filter @repo/contracts check-types`，确认 schema 推导与现有类型兼容。

## 2. 实现 Web HTTP 与 system API

- [x] 建立 `apps/web/src/lib/http/error.ts` 和 `index.ts`。
- [x] 使用 Web 环境 helper 解析服务端/浏览器 base URL。
- [x] 实现 query、headers、JSON body、schema 校验、各类错误处理和取消传递。
- [x] 建立 `apps/web/src/api/system.api.ts`，实现 health 与 ping。
- [x] 建立 `apps/web/src/api/system.query.ts`，实现 key、query options、mutation options 和 health 失效规则。
- [x] 运行 `pnpm --filter web check-types`。

## 3. 实现 Admin HTTP 与 system API

- [x] 按相同公开接口建立 `apps/admin/src/lib/http/error.ts` 和 `index.ts`，只使用 Admin 环境 helper。
- [x] 建立 `apps/admin/src/api/system.api.ts` 和 `system.query.ts`。
- [x] 检查 Admin 没有 import Web 请求代码，Web 也没有 import Admin 请求代码。
- [x] 运行 `pnpm --filter admin check-types`。

## 4. 挂载 Query Provider

- [x] 分别建立 web/admin 的 `src/providers/query-provider.tsx`。
- [x] Provider 使用 `useState` 创建稳定的 QueryClient，配置 `staleTime: 30_000`、query `retry: 1`、mutation `retry: false`。
- [x] 在两个 `app/layout.tsx` 挂 Provider，不改 metadata、主题脚本、字体和现有页面结构。
- [x] 确认没有模块级 QueryClient，也没有把页面整体改成客户端组件。

## 5. 行为验证

- [x] 启动 API、Web、Admin，确认本地 CORS 包含 `http://localhost:6153` 和 `http://localhost:6154`。
- [x] 通过 system API 函数验证 `GET /health` 成功返回 `HealthResponse`。
- [x] 验证 `POST /rpc/system/ping` 成功返回 `PingResponse`，query 配置只失效 `systemKeys.health()`。
- [x] 验证各类错误：合法 API failure、非 JSON、schema 不匹配、网络失败、请求取消。
- [x] 检查 web/admin 客户端构建产物不包含私有 `API_BASE_URL` 的值。
- [x] 不保留临时演示页面、按钮或虚构数据。

项目暂无自动化测试配置。不要为本任务临时安装测试框架；能用现有命令覆盖的类型和构建检查直接运行，各类错误用本地受控响应或开发工具手动验证并记录结果。

## 6. 质量检查

严格按顺序运行，前一项通过后再执行下一项：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter web build
pnpm --filter admin build
```

最后运行 `git diff --check`，检查没有空白错误。

## 风险与回退点

- contracts schema 推导如果改变现有 `ApiResponse` 类型，先停在第 1 步修正，不用类型断言绕过。
- 任一客户端 build 检测到 server env 进入客户端依赖图，停在对应应用的第 2 或第 3 步，拆分运行环境解析后再继续。
- Query Provider 导致 hydration 或客户端实例重复时，先移除 layout 挂载；HTTP 与 API 函数可以独立保留和检查。
- cookie 鉴权需要 API CORS 支持，未完成配套设计前不设置全局 `credentials: "include"`。

## 完成条件

- [x] `prd.md` 的 AC1 至 AC8 全部有验证结果。
- [x] 本次代码的质量检查和两个应用 build 全部通过。
- [x] 没有新增演示页面、共享 HTTP package、Hono RPC client 或鉴权逻辑。
- [x] 实现结果与 `design.md` 的公开接口一致。

## 验证记录

- `pnpm check-types`：通过。
- `pnpm lint`：通过，零 warning。
- 本次修改文件的 `prettier --check`：通过。
- `pnpm format:check`：未通过，只报告以下 3 个任务开始前已经存在的文件；按项目规则没有修改：
  - `.trellis/tasks/archive/2026-07/07-15-configure-latte-mocha-theme/task.json`
  - `.trellis/workspace/喜东东/index.md`
  - `.trellis/workspace/喜东东/journal-1.md`
- `pnpm --filter web build`：通过，最终路由只有 `/`、`/_not-found`、`/app`。
- `pnpm --filter admin build`：通过，最终路由只有 `/`、`/_not-found`。
- 运行时 mock API：health、ping、API failure、非 JSON、schema 不匹配、HTTP 状态冲突、网络断开和取消均得到预期结果。
- 客户端生产构建：Web 与 Admin 的静态产物包含各自公开测试 URL，不包含私有测试 URL；临时验证页面已删除。
