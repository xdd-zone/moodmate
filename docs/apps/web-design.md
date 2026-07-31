# web 设计规则

这份文档写 `apps/web` 的页面设计规则。改首页、应用入口、全局样式和文案时先看这里。

## 设计上下文

- 目标用户：需要有人陪伴聊天的普通用户。
- 主要场景：从首页进入 MoodMate，继续单聊或群聊；管理朋友、资料和设置。
- 界面气质：安静、温和、清楚。保留一点技术感，但不要像后台。

moodmate 不是产品官网模板。首页直接展示欢迎状态，点击“进入 MoodMate”后再显示登录方式。

## 页面规则

- 公开首页放在 `apps/web/app/(site)/page.tsx`。
- 登录后的页面放在 `apps/web/app/(app)`：`/chats`、`/chats/[kind]/[id]`、`/friends`、`/friends/[id]` 和 `/settings`。
- GitHub 回调页放在 `apps/web/app/(auth)/login/github/callback/page.tsx`，URL 是 `/login/github/callback`。页面校验 OAuth state，并用一次性 ticket 创建登录态。
- 旧 `/login`、`/app`、`/group-chats`、`/agents` 和 `/auth/callback/github` 不保留页面、别名或重定向。
- 页面默认写服务端组件。只有需要浏览器事件、状态或本地存储时，才加 `"use client"`。

## 样式规则

- Tailwind 4 从 `apps/web/app/globals.css` 进入。
- Tailwind PostCSS 配置在 `apps/web/postcss.config.mjs`。
- 不新增 `tailwind.config`。
- 字体继续用 `apps/web/app/layout.tsx` 里的 Maple Mono。
- 通用颜色、圆角和阴影从 `@repo/ui/theme.css` 导入。
- 主题只支持 Latte 和 Mocha；`app/layout.tsx` 在首次绘制前读取 `moodmate-theme:v1`，页面使用 `@repo/ui/theme-toggle` 切换。
- Web 专用的情绪色、环境背景和页面动画留在 `apps/web/app/globals.css`。
- 页面使用 `background`、`surface`、`foreground`、`border`、`primary`、`focus` 等语义 token；MoodMate IM 专用 token 只放在 `.moodmate` 组件样式中。
- 色值只写在 token 定义里，不在页面和组件中直接写颜色。
- 卡片只用于独立内容块，不要把整页 section 都包成卡片。
- 通用按钮、卡片和标签分别使用 `@repo/ui/button`、`@repo/ui/card` 和 `@repo/ui/badge`。
- 按钮和链接必须有 `focus-visible` 样式。

## 文字规则

- 默认中文短句。
- 按钮写动作和对象，比如“进入 MoodMate”“开始聊天”“认识新朋友”。
- 空状态写当前没有什么。
- 报错写失败位置和下一步。
- 不写夸张宣传语。

## 动效

- 动画只用 `opacity` 和 `transform`。
- 页面进入动效控制在 `500ms` 到 `800ms`。
- hover 位移不要超过 `-translate-y-1`。
- 必须保留 `prefers-reduced-motion` 处理。

## 响应式

- 先写移动端单列，再加桌面双列。
- 触摸目标尽量接近 `44px`。
- 首页右侧预览面板在移动端放到主文案下面。
- 文本不能压住按钮和卡片内容。

## 检查

改 web 页面或样式后至少看这些点：

- `/` 在手机宽度能读完。
- `/chats`、`/friends` 和 `/settings` 需要本地登录状态才能打开；登录后可从主导航互相到达。
- Latte 和 Mocha 都能看清文字和按钮，刷新后通过 `moodmate-theme:v1` 保留当前主题。
- 键盘能聚焦主要按钮。
- 页面没有 Next starter 的文案、图片和样式。

## 验证命令

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter web build
```
