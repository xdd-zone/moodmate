# API 用户管理

## 1. Scope / Trigger

- 修改 `apps/api/src/modules/users`、用户分页或密码账号创建时使用。
- 用户管理复用 `modules/auth/auth.schema.ts` 和 `hashPassword()`，不另建用户表或密码算法。

## 2. Signatures

```text
GET  /rpc/admin/users?page=1&pageSize=10
POST /rpc/admin/users
```

```ts
listUsers(input): Promise<UserListResponse>;
createUser(input): Promise<UserMutationResponse>;
```

## 3. Contracts

- 两个端点都先执行 `requireAdminAccess`，service 再要求 `admin_owner`。
- 列表排除软删除用户，按 `createdAtMs DESC, id DESC` 分页。
- 角色只返回启用绑定、启用角色和启用应用；当前页角色一次批量查询。
- 创建时写入 `users`、`user_emails`、`password_credentials` 和 `user_role_bindings`。
- 四条写入放在一个 D1 batch；邮箱是已验证的主邮箱，密码算法固定为 `pbkdf2-sha256`。

## 4. Validation & Error Matrix

| 条件                       | HTTP | 业务码                   |
| -------------------------- | ---- | ------------------------ |
| access token 缺失或无效    | 401  | `AUTH.ACCESS_*`          |
| session 没有 `admin_owner` | 403  | `AUTH.FORBIDDEN`         |
| 请求字段无效               | 400  | `COMMON.INVALID_REQUEST` |
| 角色不存在或已停用         | 404  | `USER.ROLE_NOT_FOUND`    |
| 邮箱已存在                 | 409  | `USER.EMAIL_CONFLICT`    |

## 5. Good / Base / Bad Cases

- Good：service 在 hash 前检查邮箱与角色，唯一约束负责并发创建时的最后保护。
- Base：用户没有启用角色时仍出现在列表，`roles` 返回空数组。
- Bad：route 直接写 SQL，或按用户逐条查询角色绑定。

## 6. Tests Required

- 本地 D1 创建后断言四张表各有对应记录，刷新列表仍能读取账号。
- 用新凭据登录对应应用，断言密码 hash 与角色绑定能被现有认证链路读取。
- 重复邮箱返回 409，用户、邮箱、凭据和绑定数量不增加。
- 使用停用或不存在的 `roleId` 返回 404，D1 不留下部分记录。

## 7. Wrong vs Correct

```ts
// Wrong: independent writes can leave a partial account
await db.insert(users).values(user);
await db.insert(userEmails).values(email);

// Correct: D1 applies all account writes in one batch
await db.batch([userInsert, emailInsert, credentialInsert, roleInsert]);
```
