# 用户管理模块与页面

## Goal

对标课程参考项目 `/users` 页面，实现用户分页列表和新建用户（含选择角色），并把 `/users` 页面从演示数据切换到真实 API。前置任务：07-21-roles-wire-api。

## Background

- 数据表已就绪：`apps/api/migrations/0001_create_auth_schema.sql` 已有 `users`、`user_emails`、`password_credentials`、`roles`、`user_role_bindings`，默认不需要新迁移。
- API 全缺：`apps/api/src/modules` 下没有用户列表和新建用户模块；Contract、BFF、前端封装也都没有。
- 页面是纯演示：`apps/admin/src/components/users/user-management-page.tsx:172` 的 `DEMO_USERS` 生成 12 条假数据；页面还有统计卡、套餐徽章（free/pro/team）、活跃/沉睡/封禁状态筛选，这些字段在数据表里不存在。
- 课程参考项目 `/users` 功能：`GET /rpc/user/list` 分页列表、`POST /rpc/user/create` 新建用户、新建时用角色列表接口选择角色。

## 课程参考源码

参考项目根目录：`/Users/wuwanzhu/Code/bobo/ai-agent`

- 页面：`/Users/wuwanzhu/Code/bobo/ai-agent/apps/admin/app/(dashboard)/users`（页面请求函数在该目录下的 `api.ts`）
- API：`/Users/wuwanzhu/Code/bobo/ai-agent/apps/api/src/routes/user/profile.route.ts`（用户列表、新建用户与角色列表同在 user/role 路由）
- 角色列表 API：`/Users/wuwanzhu/Code/bobo/ai-agent/apps/api/src/routes/role/management.route.ts`

## Requirements

1. 新增 Contract：用户分页列表和新建用户的请求、响应 Schema，放在 `packages/contracts/src`，风格对齐 `role-management.contract.ts`。列表参数为 `page` 和 `pageSize`；新建参数为显示名、邮箱、密码和 `roleId`。
2. 新增 Hono 模块 `apps/api/src/modules/users`（route、service、repository、presenter、schema 分层，对齐 `roles` 模块结构），端点挂 `requireAdminAccess`：
   - 用户分页列表：返回用户基本信息、邮箱、角色、创建时间，支持页码和每页条数。
   - 新建用户：仅 `admin_owner` 可执行；原子写入 `users`、`user_emails`、`password_credentials`，并通过 `user_role_bindings` 绑定所选的启用角色；邮箱重复返回业务错误。
3. 在 `apps/api/src/routes/index.ts` 注册用户模块。
4. 新增 BFF Route Handler（`apps/admin/app/api/users/...`）和服务端请求函数，沿用 `apps/admin/src/server/roles/api.ts` 的会话恢复模式。
5. 新增 `apps/admin/src/api/users.api.ts`、`users.query.ts`，对齐 roles 的封装方式。
6. 改造 `/users` 页面：移除 `DEMO_USERS`、统计卡、套餐徽章、状态筛选、搜索框、导出、批量操作和详情操作等无后端支撑的 UI；保留真实列表、加载/失败/空状态和分页。
7. 新建用户表单的角色下拉来自真实角色 API。

## Acceptance Criteria

- [x] `user-management-page.tsx` 中不再存在 `DEMO_USERS` 及无后端字段的展示。
- [x] 列表分页来自 D1 真实数据，新建的用户刷新后仍存在，且其凭据能走通已有登录流程。
- [x] 新建用户可从真实角色列表选择角色，绑定关系写入 `user_role_bindings`。
- [x] 重复邮箱创建返回业务错误并在页面提示。
- [x] 非 `admin_owner` 不能列出或新建用户，停用或不存在的角色不能用于新建用户。
- [x] 本任务代码通过 type-check、lint 和 Prettier 检查。

## Out of Scope

- 用户编辑、禁用、删除（课程参考项目 `/users` 没有这些功能）。
- 套餐、订阅、活跃度统计（依赖地图第二阶段模块）。
- 情绪记录页面的用户数据联动。
