# web

`apps/web` 是 moodmate 的用户端站点，包含公开首页和登录后的聊天页面。

技术栈是 `Next.js 16 + React 19 + Tailwind CSS 4 + TypeScript`。开发服务默认使用 `6153` 端口。

## 当前页面

- 首页在 `app/(site)/page.tsx`，URL 是 `/`。
- 聊天入口在 `app/(app)/chats/page.tsx`，URL 是 `/chats`。
- 单聊和群聊共用 `app/(app)/chats/[kind]/[id]/page.tsx`。
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

从示例文件创建本地配置：

```bash
cp apps/web/.env.example apps/web/.env.local
```

`APP_ENV`、`API_BASE_URL` 只给服务端使用。`NEXT_PUBLIC_APP_ENV`、`NEXT_PUBLIC_API_BASE_URL` 会进入浏览器代码，不能填写密钥。四项变量都会在页面构建时校验，缺失或格式错误会直接报错。

`APP_ENV` 的可选值是 `development`、`test`、`production`。test 和 production 的真实值由部署平台配置，不提交到仓库。

## 常改位置

- `app/(site)/page.tsx`
  首页。
- `app/(app)/chats/page.tsx`
  聊天入口和最近会话选择。
- `src/components/chat/chat-workspace.tsx`
  单聊、群聊共用的会话列表和应用外壳。
- `app/globals.css`
  Tailwind 入口、颜色、字体、动效和基础样式。
- `app/layout.tsx`
  Maple Mono 字体、全局 metadata 和 HTML 语言。

## 检查

改 web 后在项目根目录执行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter web build
```
