# Contracts 角色管理

## 1. Scope / Trigger

- 新增或修改角色管理 API、Admin 角色列表或角色状态时使用。
- DTO 位于 `packages/contracts/src/auth/role-management.contract.ts`，入口统一从 `src/index.ts` 导出。

## 2. Signatures

```ts
RoleCreateRequestSchema;
RoleListResponseSchema;
RoleMutationResponseSchema;
RoleSchema;
RoleStatusSchema;
```

## 3. Contracts

- `RoleStatusSchema`：`active | disabled | deleted`。
- `RoleSchema`：对外字段包含 application code、角色 code/name、生命周期时间和 `isProtected`。
- `RoleCreateRequestSchema`：校验 application code、机器角色 code 和展示名称。
- `RoleMutationResponseSchema`：返回更新后的 `role`，不返回 D1 record、Hono context 或 token。

## 4. Validation & Error Matrix

| 输入或业务条件        | 结果                         |
| --------------------- | ---------------------------- |
| code 不是小写角色标识 | `COMMON.INVALID_REQUEST`     |
| application 不存在    | `ROLE.APPLICATION_NOT_FOUND` |
| code 冲突             | `ROLE.CODE_CONFLICT`         |
| 目标是内建角色        | `ROLE.PROTECTED`             |
| 角色已删除            | `ROLE.NOT_FOUND`             |

## 5. Good / Base / Bad Cases

- Good：API 和 Admin 都使用 `RoleListResponseSchema` 解析同一份成功数据。
- Base：`isProtected` 是服务端规则派生字段，前端不复制保护角色列表。
- Bad：在页面里重新声明 Role interface，或把数据库列名、binding、secret 放进 contract。

## 6. Tests Required

- schema 通过合法 application/code/name，拒绝空值、超长值和非法 code。
- 成功响应缺字段、status 不在枚举内或时间不是正整数时解析失败。
- API/Admin 使用同一错误码集合，未知错误码不能绕过 `BizCodeSchema`。

## 7. Wrong vs Correct

```ts
// Wrong: duplicate DTO in an Admin component
type RoleRow = { code: string; disabled: boolean };

// Correct: use the shared runtime schema and inferred type
const result = createApiResponseSchema(RoleListResponseSchema).parse(body);
```
