# Web 样式

## Tailwind 与 token

Web 使用 Tailwind CSS 4，入口是 `apps/web/app/globals.css`，PostCSS 配置在 `apps/web/postcss.config.mjs`。不要新增 `tailwind.config`。

通用颜色、圆角、阴影和组件状态由 `@repo/ui/theme.css` 提供。Web 的全局样式按这个顺序导入：

```css
@import "tailwindcss";
@import "@repo/ui/theme.css";
```

页面组件使用 `text-foreground`、`bg-surface`、`border-border`、`bg-primary`、`outline-focus` 等语义 token，不直接写色值。只有 Web 使用的情绪色、环境背景和页面动画留在 `apps/web/app/globals.css`。

```css
@theme inline {
  --color-warm: var(--mood-warm);
}
```

字体继续使用 `app/layout.tsx` 通过 `next/font/local` 注册的 Maple Mono，并保留中文 fallback 和 `display: "swap"`。

## 主题

- 只支持 Latte 亮色与 Mocha 暗色，根节点通过 `data-theme` 切换，不使用 `prefers-color-scheme` 选择主题。
- `app/layout.tsx` 设置默认 Latte，并在 `<head>` 渲染 `@repo/ui/theme-script`，不能改成挂载后再读取 localStorage。
- 页面使用 `@repo/ui/theme-toggle` 提供切换入口；首页和 `/chats` 都必须能直接切换。
- Web 的 `warm`、`calm`、`rose` 和环境背景变量引用共享 `--theme-*`，不另写一套固定明暗色值。

## 布局与视觉

- 先写移动端单列，再用响应式类增加桌面布局。首页使用 `lg:grid-cols-*`，内容宽度使用 `max-w-*`。
- 卡片只包独立内容块，不把整个页面 section 都放进卡片。
- 固定格式控件使用稳定的高度、尺寸或 grid 轨道，避免文字和状态改变时跳动。
- 文字不能覆盖按钮或相邻内容；长内容先允许换行。

## 动效和可访问性

- 动画只改变 `opacity` 和 `transform`。
- 页面进入动画保持在 `500ms` 到 `800ms`；当前 `rise-soft` 为 `0.62s`。
- hover 位移不超过 `-translate-y-1`。
- `globals.css` 必须保留 `prefers-reduced-motion`，让动画和 transition 接近零时长。
- 修改颜色后同时检查 Latte 和 Mocha 的文字、边框、按钮和切换器对比度。

事实来源：`packages/ui/src/theme.css`、`apps/web/app/globals.css`、`apps/web/app/(site)/page.tsx`、`docs/apps/web-design.md`。
