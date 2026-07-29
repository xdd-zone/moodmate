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

## 外壳契约

```tsx
<MoodmateAppShell
  navigation={<MoodmateNavigationRail active="chats" />}
  list={<MoodmateListPanel title="聊天">...</MoodmateListPanel>}
  information={<MoodmateInfoPanel profile={profile}>...</MoodmateInfoPanel>}
  variant="has-info"
>
  ...
</MoodmateAppShell>
```

- `default` 必须传 `list`，列为 `72px 340px minmax(0, 1fr)`。
- `has-info` 必须传 `list` 和 `information`，末列为 `300px`。
- `no-list` 不接收 `list` 和 `information`，列为 `72px minmax(0, 1fr)`。
- `1100px` 以下隐藏资料栏，`820px` 以下把列表缩到 `280px`，`640px` 以下隐藏导航栏和列表，只显示主区。

## 使用检查

- 新路由的最外层有 `.moodmate`；使用 `MoodmateAppShell` 时组件会自动添加。
- 单聊头像是圆形并显示状态点，群聊头像传 `isGroup`，显示圆角方形和群组徽标。
- 会话条目使用语义路由 `href`，当前项传 `active`，不要在组件里读路由或请求数据。
- 图标按钮使用 lucide 图标并提供 `aria-label` 或 `title`。
- 菜单和 dialog 可以用 Escape 关闭；菜单靠近视口边缘时不能溢出。
- 资料栏的“关于”只使用短的展示文案，不直接渲染 `conversation.summary` 等完整聊天记录；群聊标题下的成员数必须来自当前 `active` 成员。
- 头像菜单关闭时同时设置 `hidden` 和 `aria-hidden="true"`，避免隐藏菜单进入可访问树和键盘焦点顺序。
- 改动后依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter web build`。

## 设置工作区

- `/settings` 的 `page.tsx` 保持服务端组件，只挂载 `SettingsGuard`。Guard 用 `readClientSession()` 恢复 session，再调用 `getWebUserProfile()`；session 缺失或 profile 请求失败时清除登录态并进入 `/`。
- 设置页使用 `MoodmateAppShell` 的 `default` 布局：导航栏、340px 设置菜单和自适应内容区。640px 以下隐藏导航栏与设置菜单，内容区顶部显示可横向滚动的设置分组。
- 设置分组状态留在 `SettingsWorkspace`。面板首次访问时挂载，之后只通过 `hidden` 切换，避免用户切走后丢失尚未提交的表单和当前页面内开关状态。
- 切换分组时调用设置内容容器的 `scrollTo({ top: 0 })`，桌面菜单和移动菜单都用 `aria-current="page"` 标识当前项。
- 个人资料继续读取现有 profile；记忆管理和主动关怀继续调用 `chat.query.ts` 与 `chat.api.ts` 的既有 query、mutation 和 cache key，不能复制请求或另建缓存。
- 通用选项只用 React state，并在页面说明刷新后恢复默认值。外观只用 `ThemeToggle`、`data-theme="latte|mocha"` 和 `moodmate-theme:v1`，不能增加设置页专用主题状态或存储 key。
