# 技术设计：Admin UI 套件与页面改造

## 1. 边界与依赖方向

```
apps/admin ──uses──▶ @repo/ui ──uses──▶ theme.css (语义 token)
   │                    │
   │                    └── 只出结构/样式，无业务、无请求、无 contracts 依赖
   └── 出菜单数据、组装布局、保留 query/mutation 逻辑
```

- `@repo/ui` 新增组件：纯展示 + 通用交互，禁止 import `@repo/contracts` / `apps/*`，禁止发请求。
- admin 侧：菜单项清单、退出 mutation、session query 全部留在 admin，通过 props/children 注入布局壳。

## 2. 组件设计

统一写法（沿用现有 button/card/badge）：`ComponentProps<"...">` 扩展 + `cn` 合并 className + `data-slot` 标记 + 命名导出。变体用 CVA。

### 2.1 表单类

- **`label.tsx`** — `Label`：`ComponentProps<"label">`，基础 `text-sm font-medium`。纯展示，无 client。
- **`input.tsx`** — `Input`：`ComponentProps<"input">`，把现有两处 `inputClassName` 常量沉淀为组件默认样式（`min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm ... focus-visible:ring-2 ...`）。纯展示，无 client。
- **`field.tsx`** — `Field`：组合容器。组成部分：`Field`（`grid gap-2` 容器）、`FieldLabel`（复用 Label）、`FieldControl`（放 Input/select 等）、`FieldDescription`、`FieldError`。通过子组件组合，不做受控逻辑。纯展示，无 client。
  - 设计取舍：不做「一个 Field 吃 label+input+error 全部 props」的黑盒式 API，改用子组件组合，保持与 Card 一致的风格，也让 login 的 email/password、roles 的 create 表单都能灵活拼。

### 2.2 表格类

- **`table.tsx`** — `Table` + `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell`。
  - `Table` 外层负责 `overflow-x-auto` + 边框；内部是原生 `<table>/<thead>/...`。
  - 把 roles 页手写的 `border-y border-border` + `min-w-[680px]` + `<th className="px-3 py-3 ...">` 沉淀为组件默认。纯展示，无 client。
- **`pagination.tsx`** — `Pagination`：受控展示组件。props：`page` / `pageCount`（或 `hasPrev`/`hasNext`）+ `onPageChange`。渲染上一页/下一页/页码。带事件回调 → 需 `"use client"`。
  - 取舍：只做「受控」分页（状态由调用方持有），不内置 state，符合展示组件边界。当前 roles 用的是全量列表无分页，Pagination 先作为套件能力就位，dashboard/roles 改造中若无分页数据则不强行接入（见 implement 说明）。

### 2.3 反馈类

- **`alert.tsx`** — `Alert` + 可选 `AlertTitle` / `AlertDescription`。CVA 变体 `info | success | warning | danger`，映射到 `bg-*-subtle` / `text-*` / `border-*` 语义 token（色板已在 variables.css 定义）。`role="alert"`（danger/warning）或 `role="status"`。纯展示，无 client。
  - 取舍：变体类名在 CVA 中全量列出（禁止 `bg-${variant}-subtle` 拼接）。
- **`spinner.tsx`** — `Spinner`：`ComponentProps<"span">`，CSS 旋转（`animate-spin`）的 SVG 或 border 圆环。尊重 `prefers-reduced-motion`（globals 已全局降级动画）。纯展示，无 client。
- **`skeleton.tsx`** — `Skeleton`：`ComponentProps<"div">`，`animate-pulse rounded-md bg-surface-muted`。纯展示，无 client。

### 2.4 布局类

- **`separator.tsx`** — `Separator`：`ComponentProps<"div">` + `orientation?: "horizontal" | "vertical"`，`role="separator"`，`border`/`bg-border` 实现。纯展示，无 client。
- **`app-shell.tsx`** — `AppShell` + `Sidebar` + 子件：
  - `AppShell`：最外层 grid，桌面 `grid-cols-[var(--sidebar-w)_minmax(0,1fr)]`，移动端单列。
  - `Sidebar`：左侧固定容器（`sticky top-0 h-svh`），内部 `SidebarHeader` / `SidebarNav` / `SidebarFooter` 插槽，菜单项由调用方通过 children 传入。
  - `SidebarNavItem`：单个菜单项样式（active/hover），纯文字。为支持 Next `<Link>`，用 `asChild`（Slot）模式，样式组件不 import next/link。
  - `AppShellHeader` / `AppShellContent`：顶栏 + 主内容区容器。
  - 客户端边界：桌面固定 Sidebar 若无折叠交互则可保持纯展示。移动端抽屉展开需要 state → 把「移动端开关」这一小块单独做成 client 子组件，或本次移动端 Sidebar 采用「顶栏下方可折叠」的 details/CSS 方案避免 JS state。**决策：优先纯 CSS/无 state 布局；若移动端体验必须 toggle，则最小化 client 边界到一个 `SidebarToggle` 组件。** 实施时先做桌面 + 移动端静态，再评估。

## 3. Admin 布局组装

- 新增 `apps/admin/src/components/layout/admin-shell.tsx`（`"use client"`，因含退出 mutation 与 ThemeToggle）：
  - 定义菜单项常量 `NAV_ITEMS`（首页 `/`、角色管理 `/roles`）。
  - 用 `@repo/ui/app-shell` 的结构 + `next/link` 渲染导航。
  - 顶栏放 ThemeToggle + 退出登录按钮（复用 dashboard 现有 logout mutation 逻辑，抽到这里或保留在各页——见取舍）。
- 套用位置：`app/(dashboard)/layout.tsx`（新增）包裹 `(dashboard)` 下所有页面。
  - 取舍：退出 mutation 当前在 `admin-dashboard.tsx` 内。改造后移到 AdminShell 顶栏统一处理，dashboard 页面只保留账户信息展示。session query 仍按需在各页/shell 读取。

## 4. 页面改造映射

| 页面                  | 改造动作                                                                                                                                                       | 交互变化                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `login-form.tsx`      | 手写`inputClassName` + `<label>` + `<input>` → `Field`/`Label`/`Input`；错误 `<p>` → `Alert variant="danger"`                                                  | 无                                           |
| `admin-dashboard.tsx` | 去掉自带`<main>+<header>`（移到 AdminShell）；账户信息保留 Card；错误提示 → `Alert`                                                                            | 无（logout 移到 shell 顶栏）                 |
| `roles-page.tsx`      | 去掉自带 header；手写`<table>` → `Table` 系列；`inputClassName` + `Field` 局部组件 → `@repo/ui` 的 `Field`/`Input`；message/actionError inline `<p>` → `Alert` | 无（create/disable/delete/refetch 逻辑不变） |

## 5. spec 更新

- `directory-structure.md`：把「dialog、input、sidebar 等要等两个应用都用再加」改为「结构与通用展示组件在有真实调用方（admin）时即可进入 `@repo/ui`；仍禁止业务组件/请求/权限逻辑进入」。保留业务组件黑名单。
- `component-guidelines.md`：如引入 `asChild` 在布局组件中的用法、受控 Pagination 约定，补一节。

## 6. 兼容与回归

- 组件是新增文件，不改现有 button/card/badge 的 API，现有引用不受影响。
- 三页改造后需回归：登录成功跳转、退出登录、角色 create/disable/delete/refetch、主题切换、两主题两分辨率视觉。
- 无自动化组件测试（项目现状），依赖 build + 手动浏览器检查。

## 7. 风险

- **R-1 移动端 Sidebar**：固定 Sidebar 在窄屏会挤占空间。缓解：移动端折叠为顶栏/隐藏，优先无 JS 方案。
- **R-2 client 边界扩散**：布局壳含 mutation 易把整片标记 client。缓解：`@repo/ui` 布局组件保持纯展示，client 只落在 admin 的 `admin-shell.tsx`。
- **R-3 focus 环写法**：新组件易误用 `outline-none` 破坏焦点环。缓解：统一沿用现有 button/input 的 ring 写法，check 阶段核对。
