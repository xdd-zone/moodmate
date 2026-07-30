# MoodMate 原型基础组件

`apps/web/src/components/moodmate/` 保存 Web 新 IM 页面共用的展示组件和局部样式。聊天、朋友和设置路由先复用这些文件，不在页面里重写相同结构。

## 文件与边界

- `app-shell.tsx`：渲染 `default`、`has-info`、`no-list` 三种固定视口网格。
- `navigation-rail.tsx`：渲染 `/chats`、`/friends`、`/settings` 导航，并调用共享 `ThemeToggle`。
- `avatar.tsx`、`conversation-item.tsx`、`list-panel.tsx`、`info-panel.tsx`：渲染无业务请求的展示结构。
- `avatar-menu.tsx`、`dialog.tsx`：处理菜单定位、关闭和弹层状态，是该目录中需要 `"use client"` 的组件。
- `models.ts`：保存展示类型和原型占位数据。API 响应先在路由业务组件中转成这些展示类型。
- `moodmate.css`：保存只供 `.moodmate` 根节点使用的原型 token 和组件样式，由 `apps/web/app/globals.css` 导入。

这些文件不能调用 `src/api`、读取 session 或维护 query cache。业务请求和 mutation 留在聊天、朋友、设置业务组件中。

登录后应用外壳位于 `apps/web/src/components/app/authenticated-app-layout.tsx`。它可以调用用户 API、读取 session，并组合上面的纯展示组件；不要把认证和 profile 请求移回 `moodmate/`。

## 展示模型复用

- `MoodmateProfile.palette` 统一由 `models.ts` 的 `getMoodmateAvatarPalette(value)` 生成；聊天和朋友业务组件只负责把 API 响应映射为 `MoodmateProfile`，不要各自复制哈希和颜色表。
- `GET /rpc/agents` 当前只返回 `active` 朋友。朋友页的“已归档”页签只能筛选当前已加载数据；没有归档数据接口时显示空状态，不在前端伪造归档记录。

## 主题契约

根布局继续使用 `ThemeScript`、`data-theme="latte|mocha"` 和 `moodmate-theme:v1`。不要增加 `light`、`dark` 或新的 localStorage key。

`moodmate.css` 用下面两个选择器映射原型颜色：

```css
.moodmate {
  /* Latte 对应原型亮色 */
}

[data-theme="mocha"] .moodmate {
  /* Mocha 对应原型暗色 */
}
```

原型颜色只写在 `--mm-*` token 和头像占位数据中。页面和组件使用 token，不修改 `packages/ui` 的 Catppuccin 色值，避免 Admin 颜色跟着变化。

## 登录后布局契约

```tsx
// app/(app)/layout.tsx
<AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>

// app/(app)/chats/layout.tsx
<ChatWorkspaceLayout>{children}</ChatWorkspaceLayout>
```

- `app/(app)/layout.tsx` 只挂载 `AuthenticatedAppLayout`。该组件恢复一次 session 和 profile，并用 `MoodmateAppShell` 的 `no-list` 变体持久渲染导航栏。朋友、朋友详情和设置页面不能再次挂载 Guard、导航栏或 `MoodmateAppShell`。
- `.moodmate-app` 固定覆盖当前视口并隐藏自身溢出。消息、会话列表、朋友内容和设置内容只能在各自的 `.moodmate-scroll` 容器内滚动，不能把根 `html` 撑出页面级滚动条。
- 登录后业务组件通过 `useAuthenticatedApp()` 读取 `profile`、`userProfile` 和 `logout`。hook 只能在 `(app)` Layout 内使用，缺少 Provider 时直接报错。
- `app/(app)/chats/layout.tsx` 挂载 `ChatWorkspaceLayout`。会话查询、搜索、新建群聊弹层、移动端列表状态和列表 DOM 都留在该布局；聊天页面只渲染当前会话。
- 动态聊天页面用路由中的 `kind` 和 `id` 作为当前会话组件的 `key`。切换会话时只重建聊天内容，不能给 `ChatWorkspaceLayout` 或会话列表加选择项 `key`。
- 单聊和群聊的资料状态初始值都是 `false`。`1100px` 以下由头部按钮打开右侧抽屉，`640px` 以下显示全屏资料；关闭时同时清除桌面和移动端资料状态。
- 聊天列表列宽为 `340px`，`820px` 以下缩到 `280px`，`640px` 以下默认隐藏并由聊天头部按钮打开。

## 使用检查

- 登录后路由由 `AuthenticatedAppLayout` 提供 `.moodmate` 根节点，页面组件不要重复添加。
- 单聊头像是圆形并显示状态点，群聊头像传 `isGroup`，显示圆角方形和群组徽标。
- 会话条目使用语义路由 `href`，当前项传 `active`，不要在组件里读路由或请求数据。
- 图标按钮使用 lucide 图标并提供 `aria-label` 或 `title`。
- 菜单和 dialog 可以用 Escape 关闭；菜单靠近视口边缘时不能溢出。
- 资料栏的“关于”只使用短的展示文案，不直接渲染 `conversation.summary` 等完整聊天记录。
- 群聊头部、头像副标题和成员栏数量必须使用同一口径：当前 `active` 朋友成员数加当前用户；邀请上限仍只计算 `active` 朋友成员。
- 头像菜单关闭时同时设置 `hidden` 和 `aria-hidden="true"`，避免隐藏菜单进入可访问树和键盘焦点顺序。
- 改动后依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter web build`。

## 设置工作区

- `/settings` 的 `page.tsx` 保持服务端组件，只挂载 `SettingsWorkspace`。认证和 profile 由 `(app)` Layout 处理，`SettingsWorkspace` 通过 `useAuthenticatedApp()` 读取 profile 和退出登录动作。
- 设置页使用 `moodmate-settings-layout` 局部网格：340px 设置菜单和自适应内容区放在共享导航栏右侧。640px 以下共享导航栏和设置菜单隐藏，内容区顶部显示可横向滚动的设置分组。
- 设置分组状态留在 `SettingsWorkspace`。面板首次访问时挂载，之后只通过 `hidden` 切换，避免用户切走后丢失尚未提交的表单和当前页面内开关状态。
- 切换分组时调用设置内容容器的 `scrollTo({ top: 0 })`，桌面菜单和移动菜单都用 `aria-current="page"` 标识当前项。
- 个人资料继续读取现有 profile；记忆管理和主动关怀继续调用 `chat.query.ts` 与 `chat.api.ts` 的既有 query、mutation 和 cache key，不能复制请求或另建缓存。
- 通用选项只用 React state，并在页面说明刷新后恢复默认值。外观只用 `ThemeToggle`、`data-theme="latte|mocha"` 和 `moodmate-theme:v1`，不能增加设置页专用主题状态或存储 key。
