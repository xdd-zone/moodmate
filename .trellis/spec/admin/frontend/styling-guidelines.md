# Admin 样式

## Tailwind 与共享主题

Admin 使用 Tailwind CSS 4，入口是 `apps/admin/app/globals.css`，PostCSS 配置在 `apps/admin/postcss.config.mjs`。不要新增 `tailwind.config`。

全局样式按这个顺序导入：

```css
@import "tailwindcss";
@import "@repo/ui/theme.css";
```

页面使用 `text-foreground`、`bg-surface`、`border-border`、`bg-primary`、`outline-focus` 等语义 token，不直接写色值。共享 Button、Card 和 Badge 分别从 `@repo/ui/button`、`@repo/ui/card`、`@repo/ui/badge` 导入。

Admin 只支持 Latte 亮色与 Mocha 暗色。`app/layout.tsx` 在 `<head>` 渲染 `@repo/ui/theme-script`，页面通过 `@repo/ui/theme-toggle` 切换；不要增加 `prefers-color-scheme` 主题分支。

## 布局与密度

- 管理端保持中性、紧凑，背景使用纯 surface，不复制 Web 的环境渐变。
- 卡片只包独立内容或操作区域，不嵌套卡片。
- 移动端主要操作保持至少 `44px` 高；紧凑尺寸只用于数据密集的桌面区域。
- 页面先写移动端单列，再增加桌面 grid；长标题、Badge 和按钮必须允许换行。

## 可访问性

- 交互元素使用共享 `focus` token，不能移除 `focus-visible` 而不提供替代样式。
- `globals.css` 保留 `prefers-reduced-motion`，让动画和 transition 接近零时长。
- 修改主题值后同时检查 Latte 和 Mocha 的文字、边框、按钮、Badge 和切换器。

事实来源：`apps/admin/app/globals.css`、`apps/admin/app/page.tsx`、`docs/apps/admin-design.md`。
