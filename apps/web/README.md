# web

`apps/web` 是 moodmate 的用户端站点。当前先放公开首页和应用入口。

技术栈是 `Next.js 16 + React 19 + Tailwind CSS 4 + TypeScript`。开发服务默认使用 `6153` 端口。

## 当前页面

- 首页在 `app/(site)/page.tsx`，URL 是 `/`。
- 应用入口在 `app/(app)/app/page.tsx`，URL 是 `/app`。
- 全局布局、字体和 metadata 放在 `app/layout.tsx`。
- 全局样式入口放在 `app/globals.css`。
- Tailwind 4 的 PostCSS 配置放在 `postcss.config.mjs`。

## 运行

在项目根目录执行：

```bash
pnpm dev:web
```

访问：

```text
http://localhost:6153
```

## 环境变量

浏览器侧请求 API 时使用：

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:6155
```

当前首页不依赖 API 才能渲染。`NEXT_PUBLIC_API_BASE_URL` 没有配置时，服务状态链接会指向 `http://localhost:6155/health`。

## 常改位置

- `app/(site)/page.tsx`
  首页。
- `app/(app)/app/page.tsx`
  应用入口。
- `app/globals.css`
  Tailwind 入口、颜色、字体、动效和基础样式。
- `app/layout.tsx`
  Maple Mono 字体、全局 metadata 和 HTML 语言。

## 检查

改 web 后在项目根目录执行：

```bash
pnpm check-types
pnpm lint
pnpm format
pnpm --filter web build
```
