# 配置 Latte 与 Mocha 主题

## Goal

为 moodmate 的 Web 与 Admin 配置统一的 Catppuccin 主题系统，只保留 Latte 亮色和 Mocha 暗色。页面与共享组件继续使用现有语义 token，不直接依赖另一个仓库的主题包。

## Background

- `apps/web` 与 `apps/admin` 都使用 Next.js 16、Tailwind CSS 4，并从 `@repo/ui/theme.css` 导入共享主题。
- 现有共享主题使用自定义 `oklch` 色板，并通过 `prefers-color-scheme` 自动切换明暗模式。
- `/Users/wuwanzhu/Code/xdd/core/packages/catppuccin-theme` 作为实现参考，主题色值以其中的 Catppuccin Latte 与 Mocha 官方色板为准。
- Web 还在 `apps/web/app/globals.css` 定义情绪色、环境背景和页面动画；这些 Web 专用 token 需要随主题保持可读。

## Requirements

- 仅支持 `latte` 与 `mocha` 两个主题；默认主题为 `latte`。
- 使用根节点的 `data-theme` 属性驱动主题，`latte` 使用 `color-scheme: light`，`mocha` 使用 `color-scheme: dark`。
- 主题基础变量与 Tailwind 4 语义 token 继续由 `packages/ui` 统一提供，Web 与 Admin 不复制共享色值。
- 现有 `background`、`surface`、`foreground`、`muted`、`border`、`focus`、`primary`、状态色、圆角和阴影类名保持可用。
- Latte 与 Mocha 的基础色、表面色、文字色和强调色取自参考包中的官方 Catppuccin 色板；状态色固定使用 Red、Green、Yellow、Teal，主色使用 Blue，高亮与焦点使用 Lavender。
- Web 专用情绪色和环境背景改为引用主题变量，不能保留只适合当前自定义色板的固定色值。
- 主题选择需要在 React 首次渲染前生效，避免从 Latte 闪到 Mocha。
- 主题选择需要持久化，并对无效的持久化值回退到 `latte`。
- Web 与 Admin 都提供可见的 Latte / Mocha 切换入口；入口使用同一个共享组件，并支持键盘操作与当前状态标识。
- 不引入 `/Users/wuwanzhu/Code/xdd/core` 的工作区依赖，不增加第三方主题依赖。

## Acceptance Criteria

- [x] Web 与 Admin 在 `data-theme="latte"` 下使用 Latte 亮色，在 `data-theme="mocha"` 下使用 Mocha 暗色。
- [x] 两个应用的背景、正文、辅助文字、边框、Button、Card、Badge、焦点环和状态色都随主题切换。
- [x] Web 首页的情绪色、环境背景和装饰效果在两个主题下均可读，不出现遗留的固定明暗媒体查询。
- [x] 刷新页面后保留有效主题；存储缺失或值无效时使用 `latte`。
- [x] 首次绘制前设置主题，页面加载时不出现明显的错误主题闪烁。
- [x] Web 与 Admin 都能通过页面中的共享入口切换 Latte / Mocha，当前主题状态对辅助技术可读。
- [x] 主题实现只包含 `latte` 与 `mocha`，不包含 Frappe 或 Macchiato 配置。
- [x] 移动端和桌面端没有因为主题入口导致文字、按钮或卡片重叠，键盘可以操作主题入口。
- [x] 依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`、`pnpm --filter web build` 和 `pnpm --filter admin build`。

## Out Of Scope

- 不把参考目录发布或接入为 moodmate 依赖。
- 不支持 Frappe、Macchiato 或跟随系统的第三种主题模式。
- 不重做现有页面布局或新增业务功能。
