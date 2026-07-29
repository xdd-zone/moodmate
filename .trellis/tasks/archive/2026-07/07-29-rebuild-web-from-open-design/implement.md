# 执行计划

## 顺序

- [x] 1. 完成 `07-29-web-prototype-foundation`：视觉 token、全局样式、静态模型、应用外壳和共用组件。
- [x] 2. 完成 `07-29-web-auth-entry`：`/`、静态 GitHub 回调页、欢迎切换、邮箱登录、GitHub 和 Google 静态状态，并删除旧认证路由。
- [x] 3. 完成 `07-29-web-chat-pages`：实现 `/chats` 与 `/chats/[kind]/[id]` 统一工作区，保留全部现有消息能力。
- [x] 4. 完成 `07-29-web-friends-pages`：实现 `/friends` 和 `/friends/[id]`，保留朋友管理能力。
- [x] 5. 完成 `07-29-web-settings-page`：独立设置路由和 5 个设置面板。
- [x] 6. 完成 `07-29-web-integration-verification`：导航、主题、断点、交互、截图、构建和文档检查。

## 每个代码子任务的检查

按顺序执行，前一项通过后再执行下一项：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter web build
```

## 最终浏览器检查

- [x] `pnpm dev:web` 在 `http://localhost:6153` 启动。
- [x] 检查 `/`、`/chats`、单聊与群聊动态路由、`/friends`、一条朋友详情路由、`/settings` 和 GitHub 回调状态页。
- [x] 检查旧 `/login`、`/app`、`/group-chats`、`/agents` 和旧 GitHub 回调地址均返回 404，源码没有兼容逻辑。
- [x] 在 1440×900、1280×720、820×900、390×844 检查布局。
- [x] Latte、Mocha、刷新持久化和减少动态效果均可用。
- [x] 检查欢迎页切换、登录错误、导航、头像菜单、信息栏、输入框、弹层、通讯录筛选、设置面板和开关。
- [x] 检查控制台没有 hydration warning、运行错误和缺失资源。

## 风险点

- `apps/web/src/components/chat/companion-chat.tsx` 同时包含聊天和设置，拆分时不能丢失历史分页、反馈和关怀未读状态。
- `apps/web/src/components/group-chat/group-chat-workspace.tsx` 包含多项 mutation，视觉重构不能改变 query key 和 mutation 参数。
- 全局样式会影响所有 Web 路由，先限定 MoodMate 页面根 class，再逐页接入。
- 根路由改为登录页后，已登录用户自动进入 `/chats`，继续沿用现有 session 检查。
