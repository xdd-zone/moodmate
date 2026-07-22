# 用户管理实施计划

## 实施步骤

- [x] 新增用户管理 Contract、类型和业务码，并从 `@repo/contracts` 导出。
- [x] 新增 `apps/api/src/modules/users` 的 repository、presenter、service、route 和入口文件。
- [x] 在 `apps/api/src/routes/index.ts` 注册用户路由。
- [x] 新增 Admin users 服务端请求、同源 BFF、typed HTTP 和 TanStack Query 封装。
- [x] 改造 `user-management-page.tsx`，接入真实分页列表和新建用户抽屉，角色使用真实角色查询。
- [x] 手动检查重复邮箱、列表加载、创建、刷新、登录和响应式布局。

## 验证结果

- `pnpm check-types`：通过。
- `pnpm lint`：通过。
- 本任务文件 `prettier --check`：通过。
- `pnpm --filter admin build`：通过，包含 `/users` 和 `/api/users`。
- 本地 D1：创建账号后用户、密码凭据和启用角色绑定各 1 条；刷新后仍可读取。
- 本地浏览器：重复邮箱显示“该邮箱已存在”，新账号可登录 Web。
- 根目录 `pnpm format:check`：被 7 个任务外的既有 Trellis 文件阻塞，本任务文件不在失败列表。

## 验证顺序

1. `pnpm check-types`
2. `pnpm lint`
3. `pnpm format:check`
4. `pnpm --filter admin build`
5. 启动本地 API 与 Admin，确认列表读取、新建后刷新、重复邮箱提示和已有登录流程。

## 风险与回退点

- 四张表必须在同一个 D1 batch 内写入；如果任一写入失败，不能留下不完整账号。
- 邮箱查重和唯一约束错误必须归一为同一个业务码。
- 列表角色查询只处理当前页用户，不能为每个用户单独发 SQL。
- BFF 不得把 token 返回到浏览器，浏览器请求不得访问外部 API origin。
- 页面不得继续引用演示字段或本地筛选状态。
