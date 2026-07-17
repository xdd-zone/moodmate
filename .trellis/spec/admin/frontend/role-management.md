# Admin 角色管理

## 1. Scope / Trigger

- 新增或修改 `apps/admin/app/(dashboard)/roles`、`src/api/roles.*` 或 `app/api/roles` 时使用。
- 浏览器只访问 Admin 同源 BFF，API 地址和 token 只留在 Next.js server-only 代码。

## 2. Signatures

```ts
getAdminRoles(): Promise<RoleListResponse>;
createAdminRole(input): Promise<RoleMutationResponse>;
disableAdminRole(roleId): Promise<RoleMutationResponse>;
deleteAdminRole(roleId): Promise<RoleMutationResponse>;
```

## 3. Contracts

- BFF：`GET /api/roles`、`POST /api/roles`、`POST /api/roles/:roleId/disable`、`POST /api/roles/:roleId/delete`。
- server-only BFF 从 `moodmate_admin_access_token` 读取 cookie，并转发统一 API 响应。
- Client Component 只缓存 `RoleListResponse` 和 mutation 结果，不缓存 access/refresh token。

## 4. Validation & Error Matrix

| 条件                   | 页面行为                                              |
| ---------------------- | ----------------------------------------------------- |
| `AUTH.ACCESS_EXPIRED`  | 复用 `withAdminSessionRecovery()`，刷新后最多重试一次 |
| 角色创建或状态操作失败 | 展示 API 返回的中文 message                           |
| `isProtected=true`     | 隐藏禁用、删除按钮；服务端仍必须拒绝绕过页面的请求    |
| 没有登录 cookie        | 清理 cookie，返回 401 并进入登录恢复流程              |

## 5. Good / Base / Bad Cases

- Good：页面使用 `roles.query.ts` 的 key factory，mutation 成功后只使角色 query 失效。
- Base：角色表格在移动端允许横向滚动，按钮保持可点击高度。
- Bad：Client Component 直接读取 `API_BASE_URL`、cookie 或调用 `apps/api/src`。

## 6. Tests Required

- Admin build 生成 `/roles` 和三个 BFF mutation route。
- 登录后列表、创建、禁用、删除成功时 query 刷新；API 错误 message 出现在页面。
- 受保护角色不显示危险操作，但直接请求 BFF/API 仍收到 `ROLE.PROTECTED`。
- 检查浏览器响应和 React Query cache 不含 accessToken、refreshToken 或 jti。

## 7. Wrong vs Correct

```ts
// Wrong: browser calls the external API and reads a token
fetch(`${process.env.API_BASE_URL}/rpc/admin/roles`, {
  headers: { authorization: `Bearer ${token}` },
});

// Correct: browser calls same-origin typed HTTP; the BFF adds the cookie token
http.get("/api/roles", RoleListResponseSchema);
```
