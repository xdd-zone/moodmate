# 完成角色管理章节

## Goal

把角色从只能通过初始化数据维护的静态记录，推进成可以在 Admin 中管理、受服务端规则保护，并且会影响登录态鉴权的系统能力。

## Background

- `applications`、`roles` 和 `user_role_bindings` 已存在于 `apps/api` 的认证数据层。
- `roles` 当前只有名称和时间字段，没有 `active`、`disabled`、`deleted` 生命周期。
- Admin 登录和 JWT 当前把角色固定为 `admin_owner`；后台只有登录后首页，没有角色管理页面。
- 章节要求角色按 application 隔离，保护 `admin_owner` 和 `web_user`，并让禁用角色不再参与有效角色查询。

## Requirements

1. 为角色增加生命周期字段：`status`（`active`、`disabled`、`deleted`）、`disabledAtMs`、`deletedAtMs`；保留逻辑删除记录和 `(applicationId, code)` 唯一约束。
2. 开发 seed 至少提供 `admin`/`admin_owner` 和 `web`/`web_user` 两组应用与内建角色，重复执行保持幂等。
3. 在 `packages/contracts` 定义角色列表、创建、状态操作的请求和响应 schema，并定义角色不存在、受保护、应用不存在和 code 冲突的业务错误码。
4. 新增独立角色管理 API：列表、创建、禁用、逻辑删除。所有动作先验证当前 Admin session 含 `admin_owner`，再查询目标对象和保护规则；列表排除 `deleted`，返回 `applicationCode` 和派生的 `isProtected`。
5. 把角色读写收进 `apps/api/src/modules/roles` repository/service/presenter，route 只负责 HTTP 校验和统一响应。
6. 让登录、access session、refresh 和 Admin session 重新读取 active 角色；角色状态为 `disabled` 或 `deleted` 时，不得继续作为有效 Admin 角色。JWT 不再把角色集合固定成单一字面量。
7. 在 Admin 增加角色管理页面和同源 BFF 请求：展示当前角色、创建角色、禁用角色、逻辑删除角色；受保护角色不显示危险操作，API 拒绝绕过页面的请求。
8. 保持现有认证 BFF、统一响应、D1 binding 和 Admin 页面目录边界，不把 token、数据库 record 或 secret 暴露给浏览器。

## Acceptance Criteria

- [ ] 新迁移可在已有数据库上执行，旧角色默认为 `active`，并可存储禁用和逻辑删除时间。
- [ ] seed 连续执行两次后，`admin`、`web`、`admin_owner`、`web_user` 及默认管理员绑定各只有一条。
- [ ] `GET /rpc/admin/roles` 只返回非 deleted 角色，并返回 application code、状态和正确的 `isProtected`。
- [ ] 创建角色按 application 隔离；应用不存在、重复 code、无效参数分别返回明确的 4xx 业务错误。
- [ ] `admin_owner` 和 `web_user` 的禁用、删除请求即使绕过 Admin 页面直接调用 API 也会被拒绝。
- [ ] 被禁用或逻辑删除的角色不会出现在 `findActiveAdminRoles`，相关 Admin session/access/refresh 校验会失败或只返回仍 active 的角色。
- [ ] Admin 角色页面能完成列表、创建、禁用和删除，并在失败时展示 API 返回的可执行错误。
- [ ] 依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`；Admin 改动另外通过 `pnpm --filter admin build`。

## Out Of Scope

- 用户列表、用户详情和角色绑定管理 UI/API；当前仓库没有用户管理域，本任务只更新绑定关系的鉴权读取规则。
- 细粒度 permission 表、角色继承、批量操作、审计日志和恢复 deleted 角色。
- 修改 `applications` 的管理能力。
