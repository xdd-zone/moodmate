# Design：Admin UI 改造

## 范围边界

- **改**：`packages/ui/src/*`（组件尺寸、Card 去阴影、app-shell 侧边栏原语）、`apps/admin/src/components/layout/admin-shell.tsx`（重构为侧边栏）、`apps/admin/app/globals.css`（去 frame、重写 admin-\* 样式）、`apps/admin/src/components/**` 各页面（去 Card 卡片感 + 清理冗余尺寸 override）、登录页 `auth/login-form.tsx`。
- **不改**：主题 token 值（`catppuccin.css` / `variables.css` 色板保持）、API 层（`src/api`、`src/server`）、路由、数据查询。

## 关键决策

### D1 组件尺寸档位（对齐 Halo 32/40，本项目取更紧凑一档）

| 组件           | 现值                      | 目标                    |
| -------------- | ------------------------- | ----------------------- |
| Button default | `min-h-11 h-11 px-5` (44) | `min-h-9 h-9 px-4` (36) |
| Button sm      | `h-9 px-3 text-xs` (36)   | `h-8 px-3 text-xs` (32) |
| Button lg      | `h-12 px-6` (48)          | `h-10 px-5` (40)        |
| Button icon    | `size-11` (44)            | `size-9` (36)           |
| Input          | `min-h-11 px-3` (44)      | `min-h-9 h-9 px-3` (36) |

- 圆角保持 `rounded-md`（variables.css 中 `--radius-md: 0.5rem`；Halo 是 10px，现值 8px 已接近，不改 token）。
- sm 按钮维持 `rounded-sm`。

### D2 Card 去卡片

- `Card` 默认移除 `shadow-card`，保留 `border border-border bg-surface rounded-md`。
- 页面里表格外层的 Card 改为普通 `border rounded-md` 容器（本就无阴影观感即可），投影一律去掉。
- 不逐个删除 Card 组件调用（改动面过大、回归风险高）；而是让 Card 默认无阴影 = 全局去卡片感，页面按需把「视觉独立卡片」降级为 hairline 分区（去 border 或用 `border-t` 分隔）。具体逐页在 implement 中列。

### D3 侧边栏（可折叠）

- 在 `packages/ui/src/app-shell.tsx` 已有 `Sidebar/SidebarNav/SidebarNavItem` 等原语，但当前 admin-shell 没用它、走的是自定义 `admin-*` class。**决策：admin-shell 直接用语义化结构 + globals.css 里的 `admin-*` 类重写为侧边栏**，不强行迁移到 app-shell 原语（app-shell 原语是给 web 端用的，保持不动，避免跨应用回归）。
- 折叠状态：`admin-shell.tsx` 内 `useState` + `localStorage`（key 如 `admin-sidebar-collapsed`），SSR 安全（初始读取放 effect，避免 hydration mismatch）。
- 展开 `--sidebar-w: 15rem`（240px），折叠 `4rem`（64px，只剩图标）。用 CSS 变量驱动 grid 列宽。
- 折叠时导航项只显示图标，label 用 `title` + `sr-only`。折叠按钮放侧边栏底部或顶部。
- 布局：`.admin-shell { display: grid; grid-template-columns: var(--sidebar-w) 1fr }`，侧边栏 `position: sticky; top:0; height:100svh`。
- 移动端（<760px）：侧边栏收起为顶部或抽屉；沿用现有断点策略，简化为顶部 brand + 内容，或侧边栏 overlay。取最简：移动端侧边栏变为可切换 overlay。

### D4 顶栏

- 去掉 brand（`admin-brand` 整块）与 `admin` Badge。brand 迁到侧边栏。
- 通知按钮已经是 ghost（无边框）✓；主题按钮 ThemeMenu 内部 `variant="secondary"`→加 prop 或在 admin 侧覆盖为无边框。**决策**：给 ThemeMenu 加一个可选 `variant` 透传，默认保持 secondary（不破坏 web 端），admin 传 ghost。
- 搜索栏 `admin-search` 圆角从 `0.5rem` 提到 `999px`（full）或 `0.75rem`——需求要「圆角」，Halo input 是 md(10px)。取 `999px` pill 更明显区分「改为圆角」。定为 `border-radius: 999px`。

### D5 主题不变

- 不动 `catppuccin.css` / `variables.css` 的颜色。只在必要时新增结构性 token（如无必要则不加）。

## 兼容性 / 回归风险

- ThemeMenu 加 `variant` prop：web 端不传则默认 secondary，行为不变。
- app-shell 原语不动：web 端布局不受影响。
- Card 去 shadow / 尺寸降档：web 端也用了 Button/Input/Card/Badge/Field/Alert。**已确认采用「全局改，web 跟着变」**——直接改 packages/ui 默认值，两端统一变小。改完需目视/构建确认 web 端 3 处入口（`app/(site)/page.tsx`、`(lab)/lab/page.tsx`、`web-dashboard-guard.tsx`、`auth/login-form.tsx`）无破版。

## 回滚

- 纯前端样式/布局改动，无数据迁移。回滚 = revert 提交。
