# admin 设计稿全量重构

## Goal

把 admin app 按 Open Design 设计稿补齐并对齐：新增「用户管理」「系统设置」两页，按 mockup 重构「角色权限」页，并在侧栏接入这三个入口。设计稿源文件在 Open Design 项目目录，共 4 个页面：admin-console（已实现为 /moods）、user-management、system-settings、role-management。

## Scope

- 目标工程：`apps/admin`（Next.js App Router + `@repo/ui` + Tailwind v4 + TanStack Query）。
- 复用现有设计 token（`bg-surface`/`text-muted`/`primary-subtle` 等已在 theme.css 接好），不引入原始 HTML 的裸 CSS。
- 页面级私有 UI（开关、range、角色卡片、权限矩阵）按 mood-records 的做法内联 Tailwind 实现。

## Requirements

- 新增 `/users` 用户管理页，对齐 user-management.html：4 张统计卡、筛选工具条（搜索 + 状态分段 + 角色/套餐下拉 + 批量封禁）、用户表格、行详情抽屉、空状态、分页。
- 新增 `/settings` 系统设置页，对齐 system-settings.html：左侧分区导航（基础信息/通知提醒/安全策略/情绪算法）、右侧面板、开关、range 联动、脏检查与保存/放弃、危险操作区。
- 重构 `/roles` 角色权限页为纯前端演示，对齐 role-management.html：角色卡片网格、权限矩阵（分组 + 复选格）、搜索联动、新建角色抽屉（含重名/空说明校验）、重置为默认、删除自定义角色、编辑缓冲 + 保存/放弃。
  - 现有 `/roles` 的真实后端集成（`@repo/contracts` + `roles.api.ts` + `roles.query.ts` + `app/api/roles/*`）在本任务不再被页面使用；用户已确认按设计稿改为纯前端演示。保留 API 文件不删除，仅让页面组件不再引用。
- 侧栏 `admin-shell` 接入 `/users`、`/settings` 两个入口；`角色管理` 标签与设计稿统一为 `角色权限`；面包屑 PAGE_META 补齐三页。
- 保持 latte/mocha 双主题、响应式与无障碍（aria、focus-visible、role=status）与现有页面一致。

## Acceptance Criteria

- [x] `/users`、`/settings`、`/roles` 三页在浏览器中渲染与各自设计稿一致（布局、配色、交互）。
- [x] 用户页：状态分段/角色/套餐/关键词筛选生效，全选与单选联动 footer 计数与「批量封禁」禁用态，点击行开抽屉，Esc 关闭。
- [x] 设置页：分区切换、开关、range 数值联动、脏检查驱动保存/放弃按钮与「未保存修改/已保存」徽章、放弃可还原、危险操作二次确认。
- [x] 角色页：卡片选中态、权限矩阵勾选进缓冲、保存/放弃、搜索同时过滤卡片与矩阵、新建校验重名与空说明、删除自定义角色、重置为默认、内置角色禁删。
- [x] 侧栏三个入口可导航且 active 态正确，latte/mocha 切换正常。
- [x] 通过质量门禁：`pnpm --filter admin check-types`、`pnpm --filter admin lint`、`pnpm format:check`（或等效脚本）零错误。

## Notes

- 数据概览（`/`）设计稿标记「待建」，本任务不改动现有 dashboard。
- 内容管理保持侧栏「待建」禁用态。
