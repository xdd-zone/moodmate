# 用户管理技术设计

## 范围与边界

本任务复用现有角色管理的分层和认证链路，不新增迁移、通用组件或搜索能力。

```text
用户管理页面
  -> Admin typed HTTP
  -> Next.js 同源 BFF
  -> Hono Admin API
  -> users service
  -> users repository
  -> D1
```

浏览器只访问 Admin 同源 `/api/users` 和现有 `/api/roles`。Access token 只由 BFF 读取并转发到 Hono。

## Contract

新增 `packages/contracts/src/auth/user-management.contract.ts`，并从 `packages/contracts/src/index.ts` 导出。

- `UserListQuerySchema`：`page` 从 1 开始，`pageSize` 范围为 1 到 50。
- `UserRoleSchema`：包含角色 `id`、`code`、`name` 和 `applicationCode`。
- `UserListItemSchema`：包含用户 `id`、`displayName`、主邮箱、状态、角色列表、创建时间和最后登录时间。
- `UserListResponseSchema`：包含 `items`、`page`、`pageSize`、`total` 和 `totalPages`。
- `UserCreateRequestSchema`：包含显示名、规范化邮箱、8 到 128 位密码和 `roleId`。
- `UserMutationResponseSchema`：返回创建后的完整用户 DTO。

新增 `USER_EMAIL_CONFLICT` 和 `USER_ROLE_NOT_FOUND` 业务码。重复邮箱返回 HTTP 409；角色不存在、已停用或所属应用已停用返回 HTTP 404。

## API

新增 `apps/api/src/modules/users`：

- `GET /rpc/admin/users?page=1&pageSize=10`：校验查询参数，读取分页列表。
- `POST /rpc/admin/users`：校验请求体，创建用户并返回 HTTP 201。
- route 只处理校验、认证上下文和统一响应。
- service 检查 `admin_owner`、角色状态、重复邮箱和密码哈希。
- repository 负责分页、角色聚合和创建写入。
- presenter 把数据库查询结果转换成 Contract DTO。

列表先查询用户总数和当前页，再按当前页用户 ID 批量读取启用的角色绑定，避免逐行查询。用户按 `createdAtMs DESC, id DESC` 排序，分页稳定。

创建时先确认邮箱和角色，再调用现有 `hashPassword()`。Repository 使用一个 Drizzle D1 batch 写入：

1. `users`
2. `user_emails`，主邮箱已验证，来源为 `password`
3. `password_credentials`，算法为 `pbkdf2-sha256`
4. `user_role_bindings`，状态为 `active`

写入前检查提供明确业务错误；唯一约束仍作为并发创建的最后保护，命中邮箱唯一约束时转换成相同的 409 业务错误。

## Admin BFF 与请求层

新增：

- `apps/admin/src/server/users/api.ts`
- `apps/admin/app/api/users/route.ts`
- `apps/admin/src/api/users.api.ts`
- `apps/admin/src/api/users.query.ts`

BFF 的 GET/POST 复用角色 BFF 的 cookie、同源校验、上游响应校验和失败响应方式。客户端 API 使用 `withAdminSessionRecovery()`；用户 query key 包含 `page` 和 `pageSize`，创建成功后使全部用户列表缓存失效。

角色下拉复用 `adminRolesQueryOptions()` 的真实数据，只显示 `status=active` 的角色。提交 `roleId`，显示名称同时带 application code，避免同名角色无法区分。

## 页面

`user-management-page.tsx` 保留现有 Admin 的紧凑表格和右侧抽屉样式，但删除演示统计、搜索、筛选、勾选、批量操作、导出和用户详情等无 API 支撑功能。

页面状态包括：

- 用户列表加载、失败、空数据和正常表格。
- 固定每页 10 条的上一页、下一页和页码信息。
- 新建用户抽屉的显示名、邮箱、密码和角色字段。
- 表单使用 Contract schema 校验，不复制邮箱或密码规则。
- 创建成功后关闭抽屉、刷新列表；失败时显示 API 返回的中文 message。

## 兼容与回退

数据库结构不变。回退时删除新增 users 模块、Contract、BFF 和请求封装，并恢复原页面文件即可；不会留下迁移或需要清理的数据结构。
