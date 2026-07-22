# UI 组件写法

## Props 和渲染

- Props 必须有明确 TypeScript 类型；原生元素组件优先从 `ComponentProps<"button">`、`ComponentProps<"div">` 等类型扩展。
- 可选样式入口使用 `className`，内容和原生 ARIA 属性通过对应 DOM props 传入。
- 组件只渲染传入内容和通用交互，不读取应用级环境变量或请求数据。
- 语义元素按用途选择，不能为了样式把按钮改成链接或把标题改成普通 `div`。
- Button 包裹 Link 或 anchor 时使用 `asChild`，参考 `apps/web/app/(site)/page.tsx`。

## 客户端边界

只有使用事件、state 或浏览器 API 的组件才加 `"use client"`。当前 `Button`、`Card`、`Badge` 和 `Code` 都不读取浏览器状态，不写 client directive。

新增交互组件时，把客户端边界留在最小文件，不让纯展示组件继承不必要的 client 限制。

## 组件变体

使用 CVA 定义有限的静态变体，类名必须在源码中完整出现，不能拼接 `bg-${color}`。新增变体前先找到真实调用方。

```tsx
const variants = cva("...", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      secondary: "border-border bg-surface text-foreground",
    },
  },
});
```

## 默认密度与层级

- `Button` 默认高度为 `36px`，`sm` 为 `32px`，`lg` 为 `40px`，`icon` 为 `36px`。
- `Input` 默认高度为 `36px`。Admin 页面里的原生 `select` 使用相同高度。
- `Card` 默认只有 `1px` 边框和 surface 背景，不带 `shadow-card`。只有菜单、抽屉和弹层等浮动界面可以使用阴影。
- 页面不要用 `h-9 min-h-9` 重写共享组件的默认高度。只有登录主操作、移动端触控区域等明确需要更大尺寸的位置再写覆盖值。

```tsx
// 默认 36px，不重复写高度。
<Input className="bg-background text-xs" />

// 移动端主要操作可以单独扩大触控区域。
<Button className="size-11 sm:size-9" size="icon" />
```

## 布局组件的 asChild

`app-shell.tsx` 的 `SidebarNavItem` 等导航组件不 import `next/link`，通过 `asChild`（Slot）把样式套到调用方传入的 `<Link>` 上。共享包只出样式和 `active` 状态，路由和菜单数据由应用侧传入。

```tsx
<SidebarNavItem active={pathname === "/roles"} asChild>
  <Link href="/roles">角色管理</Link>
</SidebarNavItem>
```

## 受控组件

`Pagination` 等带交互状态的组件保持受控：状态（当前页）由调用方持有，组件通过 `page`/`pageCount` 接收，通过 `onPageChange` 回调上报，不内置 state。这类带事件回调的组件才加 `"use client"`。

## 样式归属

UI 组件只使用 `packages/ui/src/theme.css` 提供的语义 token。基础色值只在主题文件定义；Web 的情绪色、环境背景和 Admin 页面布局不能写入共享组件。
