# Contracts 用户管理

## 1. Scope / Trigger

- 新增或修改 Admin 用户列表、新建用户或用户角色 DTO 时使用。
- DTO 位于 `packages/contracts/src/auth/user-management.contract.ts`，统一从 `src/index.ts` 导出。

## 2. Signatures

```ts
UserListQuerySchema;
UserListResponseSchema;
UserCreateRequestSchema;
UserMutationResponseSchema;
```

## 3. Contracts

- 列表参数：`page >= 1`，`1 <= pageSize <= 50`。
- 列表项：`id`、`displayName`、主邮箱、用户状态、启用角色、创建时间和最后登录时间。
- 角色项：`id`、`applicationCode`、`code`、`name`。
- 创建请求：显示名 1-80 字符、规范化邮箱、密码 8-128 个字符和 `roleId`。
- 创建响应返回完整 `user`，不返回 password hash、token 或 D1 record。

## 4. Validation & Error Matrix

| 条件                   | 业务码                   |
| ---------------------- | ------------------------ |
| 分页、邮箱或密码无效   | `COMMON.INVALID_REQUEST` |
| 邮箱已存在             | `USER.EMAIL_CONFLICT`    |
| 角色不存在或不可分配   | `USER.ROLE_NOT_FOUND`    |
| 管理员没有用户管理权限 | `AUTH.FORBIDDEN`         |

## 5. Good / Base / Bad Cases

- Good：API、BFF 和页面使用同一组 runtime schema。
- Base：邮箱在 Contract 入口执行 trim 和小写规范化。
- Bad：页面重复声明用户 DTO，或把密码凭据、token 放进响应 schema。

## 6. Tests Required

- schema 接受合法分页和创建请求，拒绝空显示名、非法邮箱、短密码和非法 UUID。
- 列表响应缺字段、状态不在枚举内或角色结构无效时解析失败。
- 重复邮箱和无效角色返回对应 `BizCode`，不能改写成通用成功响应。

## 7. Wrong vs Correct

```ts
// Wrong: duplicate the password rule in the page
const passwordValid = password.length >= 8;

// Correct: use the shared runtime schema
const result = UserCreateRequestSchema.safeParse(payload);
```
