# 角色管理执行计划

## 实现顺序

1. 更新 `BizCode`、角色 contracts 和导出，保证 API 与 Admin 共用协议。
2. 增加 `0003_add_role_lifecycle.sql`，同步 Drizzle auth schema 和开发 seed。
3. 新建 roles module：policy、repository、service、presenter、route、index，并挂到 API routes。
4. 修改 auth repository、service、presenter、JWT schema，让 active 角色进入 login/session/refresh 校验。
5. 增加 Admin roles server API、BFF route、客户端请求/query 和角色页面，接入现有 dashboard 入口。
6. 运行类型检查；修复本次改动导致的类型错误后再运行 lint；最后运行 format check。
7. 运行 Admin build，并用本地 API/seed 手动验证列表、创建、保护角色和禁用后的 session 行为。

## 重点文件

- `apps/api/migrations/0003_add_role_lifecycle.sql`
- `apps/api/src/modules/auth/auth.schema.ts`
- `apps/api/src/modules/auth/auth.repository.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.presenter.ts`
- `apps/api/src/modules/auth/jwt.ts`
- `apps/api/src/modules/roles/*`
- `packages/contracts/src/auth/role-management.contract.ts`
- `packages/contracts/src/common/biz-code.ts`
- `apps/admin/app/(dashboard)/roles/*`

## 验证命令

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter admin build
```

## 风险与检查点

- SQLite 迁移必须兼容已有 `roles` 数据，不能只修改初始 migration。
- 所有 active 角色查询都要检查 `roles.status`，漏掉任一处会让禁用角色继续生效。
- Admin BFF 不能把 access/refresh token 放进 JSON 或客户端状态。
- 删除是软删除，不能使用物理 `DELETE`，也不能让唯一约束被绕过。
