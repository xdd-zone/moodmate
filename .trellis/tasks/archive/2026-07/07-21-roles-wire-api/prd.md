# 角色管理接入真实 API

## Goal

把 `/roles` 页面从组件内演示数据切换到已有的角色 API，跑通 Moodmate 的标准请求链路：Admin 页面 -> TanStack Query -> Next.js BFF -> Hono API -> D1。这是 07-21-admin-course-map 第一阶段的第一张卡。

## Background

链路各层都已存在，只差页面接线：

- Contract：`packages/contracts/src/auth/role-management.contract.ts`
- Hono API：`apps/api/src/modules/roles/role.route.ts`，提供 `GET /rpc/admin/roles`、新建、停用、删除四个端点，内置角色保护在 `role-policy.ts`
- BFF：`apps/admin/app/api/roles/route.ts`、`[roleId]/disable/route.ts`、`[roleId]/delete/route.ts`，服务端请求函数在 `apps/admin/src/server/roles/api.ts`
- 前端请求封装：`apps/admin/src/api/roles.api.ts`、`roles.query.ts`（已有 `adminRolesQueryOptions`）
- 页面：`apps/admin/src/components/roles/roles-page.tsx:90` 的 `INITIAL_ROLES` 加 `useState` 本地状态，未调用以上任何封装

课程参考项目 `/roles` 功能：角色列表（按 admin/web 应用区分）、新建、停用、删除，内置角色不可停用或删除。

## 课程参考源码

参考项目根目录：`/Users/wuwanzhu/Code/bobo/ai-agent`

- 页面：`/Users/wuwanzhu/Code/bobo/ai-agent/apps/admin/app/(dashboard)/roles`（页面请求函数在该目录下的 `api.ts`）
- API：`/Users/wuwanzhu/Code/bobo/ai-agent/apps/api/src/routes/role/management.route.ts`

## Requirements

1. `/roles` 列表数据来自 `adminRolesQueryOptions`，移除 `INITIAL_ROLES` 和本地 `useState` 角色数据。
2. 新建、停用、删除通过 `useMutation` 调 BFF，成功后失效 `adminRoleKeys` 缓存刷新列表；BFF 缺少的动作（如新建）补齐 Route Handler 和 `roles.api.ts` 封装。
3. 内置角色在 UI 上禁用停用和删除入口，与 `role-policy.ts` 的服务端保护一致。
4. 移除页面内的模块动作权限矩阵 UI 及其本地状态（已确认：权限模型留到地图第三阶段单独设计，本次不做假保存）。
5. 请求失败时页面给出可见的错误提示，不静默吞掉。
6. 页面交互沿用现有组件库和主题变量，不引入新 UI 依赖。

## Acceptance Criteria

- [ ] `roles-page.tsx` 中不再存在 `INITIAL_ROLES` 和权限矩阵相关代码。
- [ ] 列表、新建、停用、删除全部走真实 API，操作后列表自动刷新。
- [ ] 对内置角色发起停用或删除：UI 无入口，直接调 API 返回业务错误。
- [ ] type-check、lint、format 检查全部通过。

## Out of Scope

- 权限矩阵的 Contract、数据表和持久化。
- 角色编辑（课程参考项目也没有编辑功能）。
- 用户与角色的绑定管理（属于用户管理卡）。
