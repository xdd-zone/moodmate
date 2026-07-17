# 执行计划：Admin UI 套件与页面改造

## 前置

- 分支：在 `main` 上按需新建 feature 分支（提交阶段由用户确认）。
- 目标包：`packages/ui`（新增组件 + spec）、`apps/admin`（布局 + 三页改造）。
- 验证命令（每阶段末尾按需跑，最终全量跑）：
  ```bash
  pnpm --filter @repo/ui check
  pnpm --filter admin check-types
  pnpm --filter admin lint
  pnpm --filter admin build
  pnpm format:check
  ```

## 阶段 A：@repo/ui 组件（纯展示优先，低风险先行）

按依赖顺序，先无 client 的基础件，再组合件：

- [ ] A1 `label.tsx` — `Label`
- [ ] A2 `input.tsx` — `Input`（沉淀现有 inputClassName）
- [ ] A3 `field.tsx` — `Field` + `FieldLabel`/`FieldControl`/`FieldDescription`/`FieldError`（复用 Label）
- [ ] A4 `table.tsx` — `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`
- [ ] A5 `alert.tsx` — `Alert`/`AlertTitle`/`AlertDescription`（CVA 四变体）
- [ ] A6 `spinner.tsx` — `Spinner`
- [ ] A7 `skeleton.tsx` — `Skeleton`
- [ ] A8 `separator.tsx` — `Separator`
- [ ] A9 `pagination.tsx` — `Pagination`（`"use client"`，受控）
- [ ] A10 `app-shell.tsx` — `AppShell`/`Sidebar`/`SidebarHeader`/`SidebarNav`/`SidebarNavItem`(asChild)/`SidebarFooter`/`AppShellHeader`/`AppShellContent`

验证：`pnpm --filter @repo/ui check`。组件类名中语义 token 全量出现，无硬编码色值，focus 环沿用现有写法。

- [ ] A11 更新 `packages/ui/src/theme.css` 的 `@source` 无需改（已 `./`）；确认新组件类名被 Tailwind 扫描到（admin build 时验证）。

## 阶段 B：spec 同步（与 A 同批提交）

- [ ] B1 改 `.trellis/spec/ui/frontend/directory-structure.md`：放宽「两个应用都用才进 ui」为「有真实调用方即可进结构/通用展示组件」，保留业务组件黑名单。
- [ ] B2 视情况在 `component-guidelines.md` 补 `asChild` 布局用法 / 受控 Pagination 约定（若实现中确立了新约定）。

## 阶段 C：Admin 布局壳

- [ ] C1 新增 `apps/admin/src/components/layout/admin-shell.tsx`（`"use client"`）：`NAV_ITEMS` 常量 + AppShell 组装 + 顶栏 ThemeToggle + 退出登录 mutation。
- [ ] C2 新增 `apps/admin/app/(dashboard)/layout.tsx`：用 AdminShell 包裹 children。
- [ ] C3 从 `admin-dashboard.tsx` 移除 header/logout（迁到 shell），保留账户 Card。

验证：`pnpm --filter admin check-types && pnpm --filter admin build`。

## 阶段 D：三页视觉改造

- [ ] D1 `login-form.tsx`：`Field`/`Label`/`Input` 替换手写；错误 `Alert variant="danger"`。（login 不在 dashboard group，保留自己的 `<main>`，不套 AdminShell。）
- [ ] D2 `admin-dashboard.tsx`：账户信息用 Card + `Field`/`Separator` 表达；错误 `Alert`。
- [ ] D3 `roles-page.tsx`：手写 `<table>` → `Table` 系列；本地 `Field`/`inputClassName` → `@repo/ui`；message/actionError → `Alert`。删除/禁用/创建/refetch 逻辑保持不变。

验证：全量命令。

## 阶段 E：最终质量门 + 回归

- [ ] E1 全量：`pnpm --filter @repo/ui check`、`pnpm --filter admin check-types`、`pnpm --filter admin lint`、`pnpm --filter admin build`、`pnpm format:check`。
- [ ] E2 浏览器手动回归（spec 要求，build 不能替代）：
  - 登录成功跳转 `/`、错误提示 Alert 展示。
  - 退出登录（顶栏）→ 回 `/login`。
  - 角色 create / disable / delete / 重新读取。
  - Latte/Mocha 切换 + 刷新保留；390x844 与 1440x900 无溢出/重叠。
  - 控制台无 hydration warning；focus-visible 焦点环可见。

## 风险与回滚点

- 组件为新增文件，回滚只需删文件 + 还原三页 import。
- 布局改造集中在 `(dashboard)/layout.tsx` + `admin-shell.tsx`，出问题可回退到「各页自带 header」。
- 移动端 Sidebar 若纯 CSS 方案体验差 → 允许加最小 `SidebarToggle` client 子件（design R-1）。

## 完成标准

- 10 个组件（含子件）在 `@repo/ui` 就位并通过 check。
- `(dashboard)` 统一 AdminShell 布局生效。
- login/dashboard/roles 完成视觉/组件化改造，交互逻辑零变更。
- ui spec 已同步放宽约束。
- 全量验证命令通过，手动回归清单走完。
