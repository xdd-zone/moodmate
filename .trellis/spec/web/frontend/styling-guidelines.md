# Web 样式

## Tailwind 与 token

Web 使用 Tailwind CSS 4，入口是 `apps/web/app/globals.css` 的 `@import "tailwindcss"`，PostCSS 配置在 `apps/web/postcss.config.mjs`。不要新增 `tailwind.config`。

颜色、圆角、阴影和动效 token 放在 `@theme`，亮暗色值放在 `:root` 和 `prefers-color-scheme: dark`。页面组件优先使用 `text-foreground`、`bg-surface`、`border-border`、`bg-primary` 等语义 token，不直接写 `#000` 或 `#fff`。

字体继续使用 `app/layout.tsx` 通过 `next/font/local` 注册的 Maple Mono，并保留中文 fallback 和 `display: "swap"`。

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
- 修改颜色后同时检查浅色和深色系统模式的文字、边框和按钮对比度。

事实来源：`apps/web/app/globals.css`、`apps/web/app/(site)/page.tsx`、`docs/apps/web-design.md`。
