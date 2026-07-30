# 技术设计

## 布局边界

应用使用两层 Next.js Layout，页面只负责当前路由对应的内容。

```text
app/(app)/layout.tsx
└── AuthenticatedAppLayout
    ├── NavigationRail
    └── route children
        ├── chats/layout.tsx
        │   └── ChatWorkspaceLayout
        │       ├── conversation list
        │       └── chat page children
        ├── friends/page.tsx
        ├── friends/[id]/page.tsx
        └── settings/page.tsx
```

`AuthenticatedAppLayout` 是客户端边界，负责读取现有本地 session、请求一次 `WebUserProfile`、处理退出登录，并通过 React context 向登录后页面提供 profile。导航当前项由 `usePathname()` 计算。根 `app/layout.tsx`、`QueryProvider`、主题脚本和服务端页面边界保持不变。

`ChatWorkspaceLayout` 是 `/chats` 下的持久客户端布局。它负责单聊摘要、群聊列表、会话搜索、新建群聊弹层和移动端列表开关，并通过聊天 context 把查询结果和列表操作提供给页面。`/chats/page.tsx` 只处理最近会话跳转或空状态；`/chats/[kind]/[id]/page.tsx` 校验参数后渲染当前会话视图。

## 组件调整

- `src/components/moodmate/app-shell.tsx` 继续作为 72px 导航栏和路由内容的最外层固定视口网格使用。聊天和设置自己的列表列改成外层内容区里的局部网格，视觉宽度不变。
- 新增 `src/components/app/authenticated-app-layout.tsx`，集中 session 恢复、profile context、导航和退出登录。
- 重组 `src/components/chat/chat-workspace.tsx`：持久部分进入 `ChatWorkspaceLayout`，当前会话内容进入单独导出组件。移除覆盖整个聊天工作区的 `selectionKey`。
- `FriendsList`、`FriendDetail`、`SettingsWorkspace` 从 profile context 读取用户资料，不再渲染自己的导航栏和完整 `MoodmateAppShell`。
- 删除不再使用的 `ChatWorkspaceGuard`、`FriendsGuard`、`SettingsGuard`、`FriendsNavigation` 及本任务产生的无用导入和重复用户头像映射。

## 状态与数据

```text
本地 session + GET profile
    -> AuthenticatedAppLayout context
    -> navigation / chats / friends / settings

conversation query + group list query
    -> ChatWorkspaceLayout context
    -> persistent conversation list
    -> current chat page

route kind/id
    -> current chat page
    -> direct pane or group pane
    -> optional information pane
```

TanStack Query 继续负责同一 query key 的请求合并与缓存。不会把 API 响应复制到新的 React state。搜索结果从查询数据与搜索字符串直接计算；当前导航项从 pathname 直接计算。

详情显示状态属于当前会话视图，初始值为 `false`。移动端打开详情时同时显示详情内容和全屏视图；关闭时两个状态一起恢复为隐藏。切换会话只允许当前会话视图重建，不重建导航栏、用户资料、查询缓存或会话列表。

## 样式

- 保留 `--mm-rail-width`、`--mm-list-width`、`--mm-info-width` 和现有主题 token。
- 为登录后外层、聊天局部网格和设置局部网格增加明确的 `minmax(0, 1fr)`、`min-width: 0`、`min-height: 0`，避免路由内容改变时撑开布局。
- 登录后应用壳使用固定定位覆盖当前视口，避免内部消息列表的滚动高度被根文档计算为页面高度。
- 文本输入控件覆盖全局 `focus-visible` outline，并移除现有 `focus`、`focus-within` 主色边框或阴影。非文本操作继续使用现有主色 outline。
- `.moodmate-scroll` 同时设置 Firefox 的 `scrollbar-color`，以及 WebKit 的 `scrollbar-track`、`scrollbar-button`、`scrollbar-corner` 和 `scrollbar-thumb`。
- 1100px 以下详情继续作为右侧覆盖层，640px 以下导航默认隐藏，会话列表和详情由当前移动端按钮切换。

## 兼容与回退

- 路由地址、API、contracts、query key、本地 session 格式和主题存储 key 不变，不需要数据迁移。
- 页面 metadata 和动态路由的 `notFound()` 校验保留在服务端页面。
- 如果嵌套 Layout 引起页面结构问题，可按文件恢复原有页面级 Guard 和 `MoodmateAppShell`；数据层没有变化。
