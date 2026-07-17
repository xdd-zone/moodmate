# Admin UI 套件与管理页面改造

## Goal

给 MoodMate 后台补一套适配当前项目的常用 UI 组件，并用这套组件对现有 admin 管理页面做统一改造，让后台从「每页手写布局 + 手写 className」升级到「统一 UI 套件 + 统一管理布局壳」。

## Background（已确认事实，来自代码检查）

- Monorepo：pnpm + turbo。`packages/ui` 对外为 `@repo/ui`，`exports` 走 `"./*": "./src/*.tsx"`，按子路径引入（`@repo/ui/button`）。
- `packages/ui` 当前只有 4 个组件：`button` / `card` / `badge` / `code`，外加主题体系（`theme.ts` / `theme-script.tsx` / `theme-toggle.tsx` / `theme.css` / `styles/theme/*`）。
- 技术选型刻意极简：
  - `cn`（`packages/ui/src/lib/utils.ts`）只有 `filter(Boolean).join(" ")`，**没有** clsx / tailwind-merge。
  - 依赖只有 `@radix-ui/react-slot` + `class-variance-authority`，**没有**完整 Radix UI，**没有** lucide-react。
- 组件约定（`.trellis/spec/ui/frontend/component-guidelines.md`）：
  - Props 从 `ComponentProps<"...">` 扩展；样式入口用 `className`。
  - 纯展示组件不写 `"use client"`；只有用事件/state/浏览器 API 才加，且客户端边界留最小文件。
  - 变体用 CVA 静态定义，类名必须源码中完整出现，禁止 `bg-${x}` 拼接。
  - 只用 `theme.css` 的语义 token，禁止硬编码色值。
  - Button 包 Link 用 `asChild`。
- 主题：Catppuccin latte/mocha，`data-theme` 切换；`variables.css` 已定义完整语义色板（primary/success/warning/danger/info/surface/border/focus/muted 等）+ 圆角（sm/md/lg/xl）+ 阴影（control/card/soft）token；字体 Maple Mono。
  - focus 环写法硬约束：Tailwind 4 下必须 `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`，或沿用现有组件的 `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background` 写法；不能只写 `outline-none` + `outline-2`。
- Admin 现有页面（`apps/admin`）：
  - `/login`（`src/components/auth/login-form.tsx`）
  - `/`（`src/components/dashboard/admin-dashboard.tsx`）
  - `/roles`（`src/components/roles/roles-page.tsx`）
  - 每页各自手写 `<main> + <header>`，无统一布局壳；输入框是页面内手写 `inputClassName` 常量，表格是手写 `<table>`。
  - route group 已分 `(auth)` / `(dashboard)`；`(dashboard)` 下按业务域放页面。
- 后端 API（`apps/api/src/modules`）只有 `assets` / `auth` / `roles` / `system` 四个模块；`contracts` 只导出 auth / role-management / default-avatar / system 契约。课程 admin 的 subscriptions / subscription-plans / finance 在本项目**无后端接口**，不做。

## Decisions（brainstorm 已收敛）

- **D1 技术路线**：沿用当前极简路线。新组件继续用 `ComponentProps` + CVA + 极简 `cn` + 语义 token，不引入 Radix UI / lucide-react / clsx / tailwind-merge。
- **D2 组件清单**：本次补 4 类共 9 个组件（见 R1）。
- **D3 布局形态**：Admin 统一布局 = 左侧固定 Sidebar + 顶栏。
- **D4 图标**：Sidebar 菜单项纯文字，不加图标，不引入图标库。
- **D5 反馈组件**：只做静态 `Alert`（含语义变体），不引入 Toast / 全局通知机制。
- **D6 页面改造深度**：纯视觉 / 组件化改造。替换手写元素为新组件、套用统一布局，**不改动**现有交互逻辑、数据请求、mutation 行为（roles 删除仍保持当前"无二次确认直接执行"的行为）。
- **D7 组件归属**：结构类与通用组件进 `@repo/ui`；**同步更新** `.trellis/spec/ui/frontend/directory-structure.md`，把 input/sidebar 等从"等两个应用都用再加"的约束中放行。菜单数据（导航项清单）留在 admin 侧，`@repo/ui` 只出布局结构与样式。

## Requirements

### R1 扩充 `@repo/ui` 组件（9 个，分 4 类）

- **表格类**：`Table`（含 `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` 等子组件）、`Pagination`。
- **表单类**：`Input`、`Field`（label + control + 错误/描述文案的组合容器）、`Label`。
- **反馈类**：`Alert`（语义变体：info / success / warning / danger）、`Spinner`、`Skeleton`。
- **布局类**：`Separator`、`AppShell` + `Sidebar`（结构与样式，菜单项由调用方以 props/children 传入）。

约束：

- 每个组件一个小写文件，命名导出，通过 `exports` 的 `./*` 映射自动可用（`@repo/ui/input` 等）。
- 交互/带 state 的组件（如 Sidebar 折叠、Pagination）才加 `"use client"`，纯展示组件不加。
- 变体用 CVA；只用语义 token；focus 环遵循现有硬约束写法。

### R2 建立 Admin 统一管理布局

- 在 `apps/admin` 用 `@repo/ui` 的 `AppShell` + `Sidebar` 组装后台布局壳（左侧固定 Sidebar + 顶栏）。
- 菜单项清单（首页 / 角色管理等现有页面）在 admin 侧定义并传入。
- 顶栏保留 `ThemeToggle` 与退出登录动作（沿用现有 mutation）。
- 布局套用在 `(dashboard)` route group，`(auth)/login` 是否套壳见 R3。

### R3 用新组件 + 新布局改造现有页面

- `/login`：用 `Field` / `Input` / `Label` / `Alert` 替换手写输入框和错误提示；login 不套 dashboard 布局壳（保持独立居中布局），仅组件化。
- `/`（dashboard）：套 AppShell 布局；账户信息区可用现有 Card + 新组件优化，交互不变。
- `/roles`：套 AppShell 布局；手写 `<table>` 换成 `Table` 组件，手写输入框换成 `Field`/`Input`，inline `<p>` 提示换成 `Alert`；mutation/删除逻辑不变。

### R4 同步 spec

- 更新 `.trellis/spec/ui/frontend/directory-structure.md`：放行本次新增组件进入 `@repo/ui` 的判定（说明 admin 已是真实调用方，结构类组件优先共享）。
- 如新增组件引入新的写法约定，补进 `component-guidelines.md`。

## Acceptance Criteria

- [x] AC1：`@repo/ui` 新增 10 个组件文件（label/input/field/table/alert/spinner/skeleton/separator/pagination/app-shell，较初稿多一个 app-shell），均可通过 `@repo/ui/<name>` 子路径引入，命名导出，`grep "export default"` 结果为空。
- [x] AC2：新组件全部只用语义 token，无硬编码色值；仅 pagination 带 `"use client"`（app-shell 等纯展示无 client）；focus 环沿用 `focus-visible:ring-*` 现有写法。
- [x] AC3：Admin `(dashboard)/layout.tsx` 套 AdminShell（AppShell + Sidebar），Sidebar 展示 NAV_ITEMS 纯文字导航，顶栏含 ThemeToggle + 退出登录。
- [x] AC4：`/login`、`/`、`/roles` 三页完成组件化改造，手写 `inputClassName` 常量与手写 `<table>` 已被 Field/Input/Table 取代；三页 mutation/query 逻辑经 check 逐行核对与改造前一致。
- [x] AC5：`.trellis/spec/ui/frontend/directory-structure.md` 已更新（含「有真实调用方即可进」表述），放行新增组件归属判定。
- [x] AC6：`pnpm --filter @repo/ui check`、`pnpm --filter admin check-types`、`pnpm --filter admin lint`、`pnpm --filter admin build` 全部 exit=0；`pnpm format:check` 仅 3 个 Trellis 元数据文件告警（非本次代码，历史单独处理），代码文件格式通过。
- [ ] AC7：Latte / Mocha 两主题下三页视觉、390x844 与 1440x900 溢出、hydration warning ——**浏览器手动回归未执行**，需人工自查（build 不能替代）。

## Out of Scope

- subscriptions / subscription-plans / finance / users / default-avatar / profile 等页面（无后端接口或本次不涉及）。
- 引入 shadcn 全家桶 / 完整 Radix / lucide-react / clsx / tailwind-merge。
- 全局 Toast / 通知中心。
- 改动任何页面的数据请求、mutation、鉴权、路由保护逻辑。
- web 应用的改造（本次只动 admin 与 ui）。
