# API 角色管理

## 1. Scope / Trigger

- 修改 `applications`、`roles`、`user_role_bindings`，或新增 `/rpc/admin/roles` 接口时使用。
- 角色管理属于 `apps/api/src/modules/roles`；认证 session、JWT 和有效角色读取仍在 `modules/auth`。

## 2. Signatures

```text
GET  /rpc/admin/roles
POST /rpc/admin/roles
POST /rpc/admin/roles/:roleId/disable
POST /rpc/admin/roles/:roleId/delete
```

```ts
listRoles(bindings, adminRoles): Promise<RoleListResponse>;
createRole(input): Promise<RoleMutationResponse>;
disableRole(input): Promise<RoleMutationResponse>;
deleteRole(input): Promise<RoleMutationResponse>;
```

`roles.status` 只能是 `active`、`disabled`、`deleted`。删除只更新 `status` 和 `deletedAtMs`，不物理删除记录。

## 3. Contracts

- 创建请求：`applicationCode` 1-64 字符，`code` 使用小写字母开头且只含小写字母、数字、`_`、`:`、`-`，`name` 1-128 字符。
- 列表项：`id`、`applicationCode`、`code`、`name`、`status`、`createdAtMs`、`updatedAtMs`、`disabledAtMs`、`deletedAtMs`、`isProtected`。
- `isProtected` 由 `protectedRoleCodes` 派生，不存数据库。
- 所有成功和失败 JSON 使用 `buildSuccess()`、`buildFailure()` 与 request `meta`。

## 4. Validation & Error Matrix

| 条件                                 | HTTP | 业务码                       |
| ------------------------------------ | ---- | ---------------------------- |
| 缺少或无效 access token              | 401  | `AUTH.ACCESS_*`              |
| session 没有 `admin_owner`           | 403  | `AUTH.FORBIDDEN`             |
| application 不存在或已停用           | 404  | `ROLE.APPLICATION_NOT_FOUND` |
| 角色不存在或已逻辑删除               | 404  | `ROLE.NOT_FOUND`             |
| 同 application 下 code 已存在        | 409  | `ROLE.CODE_CONFLICT`         |
| 禁用或删除 `admin_owner`、`web_user` | 403  | `ROLE.PROTECTED`             |

## 5. Good / Base / Bad Cases

- Good：先通过 `requireAdminAccess`，再由 service 检查 `admin_owner`、application、目标角色和保护规则，最后调用 repository。
- Base：列表从 `roles` 出发 join `applications`，排除 `deleted`，按 application code 和创建时间排序。
- Bad：route 直接写 SQL、把 D1 唯一约束错误返回给客户端，或只在 Admin 页面隐藏受保护角色按钮。

## 6. Tests Required

- 在已有 `0001`/`0002` 数据上执行 `0003_add_role_lifecycle.sql`，断言旧角色状态为 `active`。
- 连续执行 `apps/api/dev/seed.sql` 两次，断言应用、内建角色和管理员绑定各一条。
- 登录后断言列表、创建、禁用、软删除和重复 code 的 HTTP 状态与业务码。
- 直接请求 `admin_owner` 和 `web_user` 的禁用/删除接口，断言 `ROLE.PROTECTED`。
- 禁用角色后，`findActiveAdminRoles` 不再返回该角色；access/session/refresh 重新读取数据库状态。

## 7. Wrong vs Correct

```ts
// Wrong: only disable the button in Admin
if (role.isProtected) hideDeleteButton();

// Correct: the API checks the same policy before updating D1
if (isProtectedRole(role.code)) {
  throw new AppError(BizCode.ROLE_PROTECTED, "内建角色不能禁用或删除", 403);
}
```
