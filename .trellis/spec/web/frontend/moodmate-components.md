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
- 改动后依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter web build`。
