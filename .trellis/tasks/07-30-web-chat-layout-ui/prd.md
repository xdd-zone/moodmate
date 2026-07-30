# 优化 Web 聊天布局与界面细节

## Goal

保持 Open Design 原型的视觉、交互和素材，同时按 Next.js App Router 的持久化布局方式重组登录后页面。切换业务路由时保留左侧导航，切换单聊和群聊时保留会话列表，避免整页恢复登录状态和聊天外壳重建造成的闪烁。

## Background

- 原型目录为 `/Users/wuwanzhu/Library/Application Support/Open Design/namespaces/release-stable/data/projects/5eacec88-a8bf-47bc-9795-da9afcf96465`。目录没有 `DESIGN.md`、`README`、`package.json` 或独立素材文件；设计依据是 `docs/*.md`、`brand-spec.md`、六个 HTML 文件和 `assets/moodmate.css`。
- 原型采用 72px 导航栏、340px 列表栏、300px 可选详情栏，以及 1100px、820px、640px 三个主要断点。当前 React 实现已经保留这些视觉规格。
- `apps/web/app/(app)` 当前没有 `layout.tsx`。聊天、通讯录和设置页面分别挂载 `ChatWorkspaceGuard`、`FriendsGuard`、`SettingsGuard`，每次跨业务路由都会重新读取本地 session 和请求用户资料。
- `apps/web/src/components/chat/chat-workspace-guard.tsx:45` 在聊天路由内重新请求用户资料，`apps/web/src/components/chat/chat-workspace-guard.tsx:49` 使用会话选择生成 `key`，导致切换单聊或群聊时整个 `ChatWorkspace` 重建。
- `apps/web/src/components/chat/chat-workspace.tsx:72` 当前默认展开详情栏，与本次要求相反。
- `apps/web/src/components/moodmate/moodmate.css:87` 为所有可聚焦元素设置主色 outline，文件中还存在多个文本输入框的主色边框和阴影规则。
- 原型 `assets/moodmate.css:121` 已把 Firefox 滚动条轨道设为透明，但没有明确隐藏 WebKit 的轨道、按钮和角落。

## Requirements

1. 所有 MoodMate 文本输入框和多行输入框聚焦时不改变边框颜色、不出现主色 outline 或额外阴影。输入、光标、自动增高、Enter 发送和 Shift+Enter 换行等既有行为保持不变。按钮、链接、菜单项和其他键盘操作入口继续显示 `focus-visible` 提示。
2. `.moodmate-scroll` 及本任务涉及的内部滚动区域只显示滚动滑块。轨道、上下按钮和角落透明或不显示，Firefox 与 WebKit 浏览器均有对应规则，滚动能力保持不变。
3. 单聊和群聊首次打开时均隐藏右侧详情。用户点击聊天头的详情按钮后才显示；移动端仍使用现有全屏详情视图，关闭后保持隐藏。
4. 在 `apps/web/app/(app)/layout.tsx` 建立登录后应用 Layout。它只恢复一次 session 和用户资料，并持久渲染导航栏、主题入口和个人菜单。`/chats`、`/friends`、`/friends/[id]`、`/settings` 不再各自重复挂登录守卫和导航栏。
5. 在 `apps/web/app/(app)/chats/layout.tsx` 建立聊天 Layout。会话查询、搜索、新对话、新建群聊、移动端会话列表状态和会话列表 DOM 放在该 Layout 内；切换 `/chats/direct/:id` 与 `/chats/group/:id` 时只替换聊天内容和对应详情内容。
6. `/chats` 继续按现有规则进入最近会话；单聊规范 URL 修正、群聊不存在状态、局部加载失败、新建群聊、消息发送、历史加载、提及和成员管理保持可用。
7. 继续使用现有 API、TanStack Query key、contracts、Latte/Mocha 主题、Maple Mono 字体和 Open Design 视觉规格。不新增依赖，不修改 API 或 contracts。
8. 登录后应用固定在当前视口内。聊天消息只在消息区域滚动，不能把根文档撑高或产生页面级滚动条。

## Out Of Scope

- 不新增后端接口、认证方案、消息协议或缓存 key。
- 不重新设计颜色、排版、聊天气泡、朋友卡片或设置面板。
- 不为页面切换增加骨架屏、过场动画或手写客户端路由。
- 不安装测试框架或浏览器自动化依赖。

## Acceptance Criteria

- [x] 文本输入框和多行输入框在鼠标或键盘聚焦时外观不发生主色高亮；按钮、链接等非文本输入操作仍有可见的键盘焦点提示。
- [x] Latte 和 Mocha 下，滚动区域只看到滑块，轨道、按钮和角落不显示；鼠标滚轮、触控板、触摸滚动和键盘滚动仍可用。
- [x] 直接打开任一单聊或群聊时不显示右侧详情；点击详情按钮可打开，再次点击或使用移动端返回按钮可关闭。
- [x] 在 `/chats`、`/friends`、`/friends/[id]`、`/settings` 之间切换时，导航栏与登录资料状态由 `(app)` Layout 保留，不重复显示“正在恢复登录状态”。
- [x] 在两个单聊/群聊地址之间切换时，会话列表、搜索值、列表滚动位置和新建群聊入口由 `chats` Layout 保留，只有聊天内容与详情内容更新。
- [x] `/chats` 最近会话跳转、单聊、群聊、通讯录、朋友档案和设置的现有业务功能没有回归。
- [x] 640px、820px、1100px 断点规则没有内容重叠；移动端会话列表和详情视图仍保留打开与关闭状态类。
- [x] 聊天页面根文档高度等于视口高度，只显示消息区和列表区各自需要的内部滚动条。
- [x] `pnpm check-types`、`pnpm lint` 和 `pnpm --filter web build` 通过；本次文件通过 Format，全仓检查只命中任务外既有 Trellis 文档。
