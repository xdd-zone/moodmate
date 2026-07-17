# 角色管理技术设计

## 边界

- `packages/contracts` 只定义跨 API/Admin 的 Zod schema、类型和业务错误码。
- `apps/api/src/modules/auth` 继续拥有认证 schema 和 session/token 流程；角色 CRUD 放到新的 `apps/api/src/modules/roles`。
- `apps/admin/src/server/roles` 负责带 cookie 调 API 的服务端 BFF，浏览器只访问 `app/api/roles`；页面和交互组件放在 `(dashboard)/roles` 与 `src/components/roles`。
- D1 迁移只负责数据库兼容，seed 负责本地内建应用、角色和管理员数据。

## 数据与状态

`roles.status` 的有效值为 `active`、`disabled`、`deleted`。创建角色为 `active`；禁用写入 `disabledAtMs`；删除写入 `deletedAtMs`。删除是逻辑删除，列表和可分配查询都排除 `deleted`，数据库保留历史绑定。

迁移新增列并给已有记录默认 `active`，不重写已有表。Drizzle schema 同步增加枚举、check 和时间字段。`user_role_bindings` 保持现有 `active`/`revoked` 状态，角色是否有效由 join 时同时过滤。

## API

资源前缀采用现有 Admin RPC 约定：

- `GET /rpc/admin/roles`
- `POST /rpc/admin/roles`
- `POST /rpc/admin/roles/:roleId/disable`
- `POST /rpc/admin/roles/:roleId/delete`

所有路由使用 `requireAdminAccess`，service 再检查 session 包含 `admin_owner`。repository 负责 application 查询、列表 join、目标角色查询和状态写入。创建前显式检查 application 和同 application 下 code，避免把 D1 唯一约束错误直接返回给调用方。

响应只返回角色展示字段和 `isProtected` 派生值，不返回 D1 record。`protectedRoleCodes` 放在 roles policy 文件中，服务端对禁用和删除都执行保护判断。

## 鉴权数据流

`findAdminLoginContext`、`findActiveAdminRoles` 和 Admin session 查询都要求 `roles.status = 'active'`。登录和 refresh 从数据库读取完整 active 角色集合并签发 access token；session presenter 返回同一集合。访问已有 token 时，JWT 中声明的角色必须仍存在于数据库 active 集合，且集合仍含 `admin_owner`，这样禁用 owner 会立即让现有 session 失效，禁用其他角色会从 session 返回值中消失。

## Admin BFF 与页面

`apps/admin/src/server/roles/api.ts` 复用认证 API 的请求解析和统一响应 schema，读取当前 HTTP-only access cookie。`app/api/roles` 的 route handler 负责同源、cookie、refresh 恢复和上游响应转发。客户端 `src/api/roles.api.ts` 只使用现有 `http` 和 contracts，页面用 React Query 查询和 mutation。

角色页先完成可用的列表和表单操作，不引入全局状态或共享 UI 组件。受保护角色由后端返回 `isProtected`，页面隐藏禁用/删除按钮；API 仍是最终边界。

## 兼容与回滚

- 现有 Admin 登录 DTO 仍兼容，只是 `roles` 从固定字面量扩展为非空角色 code 数组。
- 迁移可通过回滚应用版本恢复旧代码；不物理删除任何既有角色或绑定。
- 若页面或 BFF 出问题，API 和认证数据层仍可独立验证，便于先回滚 Admin 页面。
