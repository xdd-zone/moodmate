# Admin 样式

## Tailwind 与共享主题

Admin 使用 Tailwind CSS 4，入口是 `apps/admin/app/globals.css`，PostCSS 配置在 `apps/admin/postcss.config.mjs`。不要新增 `tailwind.config`。

全局样式按这个顺序导入：

```css
@import "tailwindcss";
@import "@repo/ui/theme.css";
```

页面使用 `text-foreground`、`bg-surface`、`border-border`、`bg-primary`、`outline-focus` 等语义 token，不直接写色值。共享 Button、Card 和 Badge 分别从 `@repo/ui/button`、`@repo/ui/card`、`@repo/ui/badge` 导入。

Admin 只支持 Latte 亮色与 Mocha 暗色。`app/layout.tsx` 在 `<head>` 渲染 `@repo/ui/theme-script`，页面通过 `@repo/ui/theme-toggle` 切换；不要增加 `prefers-color-scheme` 主题分支。

## 布局与密度

- 管理端保持中性、紧凑，背景使用纯 surface，不复制 Web 的环境渐变。
- 登录后的页面统一由 `src/components/layout/admin-shell.tsx` 提供通栏布局。桌面侧栏展开宽度为 `15rem`，折叠宽度为 `4rem`，内容区占满剩余宽度；不要再包最大宽度外框或顶部横向模块导航。
- 侧栏折叠状态写入 localStorage 的 `admin-sidebar-collapsed`。服务端首屏按展开状态渲染，客户端挂载后读取该值，不能在服务端读取 `window`。
- `760px` 以下把侧栏改成覆盖内容的抽屉。抽屉关闭时同时设置不可见状态，不能只移出视口后让内部链接继续参与键盘导航；顶栏图标操作保持至少 `44px` 触控区域。
- 顶栏只放移动端菜单、搜索、通知、主题、管理员资料和退出操作。品牌与模块导航放在侧栏，通知和主题使用无边框 `ghost` Button。
- 登录页使用通栏 Header、内容和 Footer。桌面显示说明区与表单分区，窄屏改为单列；表单区用 1px 分隔线表达层级，不包 Card。
- 卡片只包独立内容或操作区域，不嵌套卡片。
- 移动端主要操作保持至少 `44px` 高；紧凑尺寸只用于数据密集的桌面区域。
- 页面先写移动端单列，再增加桌面 grid；长标题、Badge 和按钮必须允许换行。

侧栏关闭状态要同时处理位置和键盘可达性：

```css
@media (max-width: 760px) {
  .admin-sidebar {
    transform: translateX(-100%);
    visibility: hidden;
  }

  [data-mobile-sidebar-open="true"] .admin-sidebar {
    transform: translateX(0);
    visibility: visible;
  }
}
```

## 可访问性

- 交互元素使用共享 `focus` token，不能移除 `focus-visible` 而不提供替代样式。
- `globals.css` 保留 `prefers-reduced-motion`，让动画和 transition 接近零时长。
- 修改主题值后同时检查 Latte 和 Mocha 的文字、边框、按钮、Badge 和切换器。

事实来源：`apps/admin/app/globals.css`、`apps/admin/app/page.tsx`、`docs/apps/admin-design.md`。
