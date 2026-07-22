# Admin UI 改造：侧边栏布局与组件尺寸优化

## Goal

把 admin 后台从「顶栏 + 顶部横向 tab + 外层大卡片」的观感，改造成标准 Web 后台：左侧可折叠侧边栏 + 通栏内容区，组件尺寸整体降一号，去掉卡片式包裹，边框/圆角/间距语言对齐 `/Users/wuwanzhu/Code/halo/DESIGN.md`（Halo）。

## Background（confirmed facts）

- 布局壳：`apps/admin/src/components/layout/admin-shell.tsx`，当前是顶栏 brand + 顶部横向 tab nav（`admin-nav-tab`），无侧边栏。
- 全部 admin 专用样式集中在 `apps/admin/app/globals.css`（`admin-canvas` / `admin-frame` / `admin-bar` / `admin-nav` / `admin-search` / `admin-icon-button` 等）。`admin-frame` 有 `border + border-radius + box-shadow`，是「整体像卡片」的根源。
- 通用组件在 `packages/ui/src`。当前默认尺寸偏大：Button/Input 均为 `min-h-11`（44px），Card 用 `shadow-card` + `p-5`。
- 页面组件在 `apps/admin/src/components/**`，8 个页面用了 `@repo/ui/card`，共约 47 处 Card 使用。开发者已在页面级大量手写 `size="sm"`、`h-9 min-h-9`、`text-xs` 强行缩小，说明默认尺寸确实偏大。
- 主题：Catppuccin latte（浅）/ mocha（深）双主题，token 定义在 `packages/ui/src/styles/theme/{catppuccin,variables}.css`。本次不改色板。
- 顶栏通知按钮、退出按钮当前 `variant="ghost"`；主题按钮（ThemeMenu）当前 `variant="secondary"`（有边框）；搜索栏 `admin-search` 圆角 0.5rem。
- brand 处有 `admin` Badge 标记（`admin-brand-badge`）。

## Requirements

### R1 组件尺寸降一号（packages/ui）

- Button 默认高度 44px→36px（`h-9`），sm 32px（`h-8`），icon 默认 36px；lg 保留但相应收敛。
- Input/select 默认高度对齐 36px。
- 相关组件（Badge、Table 行高/padding、Field、Pagination、Alert 内边距）同步收一档，保持视觉协调。
- 尺寸降档后，清理页面里为「变小」而写的手动 override（`size="sm"` 中确有必要的保留，纯粹为缩小的 `h-9 min-h-9`/`text-xs` 视情况移除）。

### R2 去卡片化（外层 + 页面内 Card）

- 移除 `admin-frame` 的外框卡片观感（border + border-radius + box-shadow + max-width 居中留白），改为通栏 Web 布局。
- 页面内 Card 改为 Halo 的 hairline 分区 / 表格式：以 1px 边框和三层 surface 表达层级，不用投影。Card 组件默认去掉 `shadow-card`。
- 登录页（login-form）也去卡片，与主应用一致的无卡片风格。

### R3 侧边栏布局（可折叠）

- 左侧固定侧边栏，展开约 240px、折叠只剩图标列；带折叠切换按钮，折叠状态可持久（localStorage）。
- brand（moodmate logo）移到侧边栏顶部；导航项竖向排列，保留现有 6 个入口与 active 态、count、"待建"标记。
- 顶栏只保留：搜索、通知、主题、用户 chip、退出；移除 brand 与 `admin` 标记。

### R4 顶栏控件样式（需求③）

- 通知按钮、主题按钮改为无边框（ghost，无 border）。
- 搜索栏改为圆角（更大圆角，非当前 0.5rem 直角感）。
- 移除左侧 `admin` Badge 标记。

### R5 设计语言对齐 Halo

- 圆角：按钮/输入 10px 档、卡片/面板 16px 档、tab/chip/switch full。
- 边框：统一 1px hairline；深度靠 surface 分层 + 边框，不靠投影（focus 例外，允许 ring）。
- 间距节奏参考 Halo spacing（4px 基数）。
- 色板不变（继续用 Catppuccin 双主题 token），仅结构/尺寸/圆角/边框对齐。

## Acceptance Criteria

- [ ] AC1 admin 布局为左侧可折叠侧边栏 + 通栏内容区；无外层卡片边框/圆角/阴影；折叠状态刷新后保持。
- [ ] AC2 通用组件默认尺寸降一号：Button 默认 `h-9`、sm `h-8`；Input/select 默认 36px；Badge/Table/Field/Pagination/Alert 同步收档。
- [ ] AC3 8 个页面内 Card 与登录页 Card 均去卡片化（无投影，改 hairline 分区/表格式）；页面为缩小而加的冗余 override 已清理。
- [ ] AC4 顶栏通知/主题按钮无边框；搜索栏圆角；左侧无 `admin` 标记；顶栏无 brand。
- [ ] AC5 深浅双主题（latte/mocha）下所有改动页面显示正常，色板未改。
- [ ] AC6 质量门禁全绿：type-check、lint、format。

## Out of Scope

- 不改主题色板（不引入 Halo 深空色系，不新增主题）。
- 不改后端 API、数据查询逻辑、路由结构。
- 不新增页面或业务功能；不改「数据概览」待建状态。

## Open Questions

- 无阻塞项。
