# UI 主题

## 1. 适用范围

修改共享颜色、主题存储、首次渲染脚本、主题切换器或应用根节点的 `data-theme` 时读取本文件。主题由 `packages/ui` 管理，Web 和 Admin 不能各自复制运行时或 Catppuccin 色值。

## 2. 签名

`packages/ui/src/theme.ts` 保持以下公开给共享组件使用的契约：

```ts
const THEMES = ["latte", "mocha"] as const;
type ThemeName = (typeof THEMES)[number];
const DEFAULT_THEME: ThemeName = "latte";
const THEME_STORAGE_KEY = "moodmate-theme:v1";

function isThemeName(value: string | null | undefined): value is ThemeName;
function resolveTheme(value: string | null | undefined): ThemeName;
function applyTheme(theme: ThemeName, root?: HTMLElement): void;
function subscribeToTheme(onStoreChange: () => void): () => void;
```

应用从 `@repo/ui/theme-script` 导入 `ThemeScript`，从 `@repo/ui/theme-toggle` 导入 `ThemeToggle`。不要在应用里重新实现 localStorage 读写。

## 3. 契约

- 根节点只允许 `data-theme="latte"` 或 `data-theme="mocha"`。
- `latte` 使用 `color-scheme: light`，`mocha` 使用 `color-scheme: dark`；不跟随 `prefers-color-scheme`。
- 默认值是 Latte。localStorage 只保存一个主题字符串，不保存用户信息。
- `ThemeScript` 放在两个根布局的 `<head>`，在 body 绘制前应用持久化主题；`<html>` 设置 `suppressHydrationWarning`。
- 同源页面内切换通过 `moodmate:theme-change` 更新，其他同源标签页通过 `storage` 更新。主题 key 被删除或 localStorage 被清空时回退 Latte。
- 直接色值只写在 `styles/theme/catppuccin.css`，并且来自 Catppuccin Latte/Mocha 官方色板。`variables.css` 只引用 `--theme-*` 或用 `color-mix()` 推导语义状态。
- `dark` variant 只匹配 `[data-theme="mocha"]`。

## 4. 校验和错误处理

| 条件                             | 结果                               |
| -------------------------------- | ---------------------------------- |
| storage 为 `latte` 或 `mocha`    | 首次绘制前应用对应主题             |
| storage 缺失、被删除或值无效     | 使用 Latte                         |
| 浏览器拒绝读取 localStorage      | 使用 Latte，页面继续渲染           |
| 浏览器拒绝写入 localStorage      | 当前页面继续切换，不保证刷新后保留 |
| 收到其他 localStorage key 的事件 | 忽略，不更新主题                   |

## 5. 用例

- Good：用户切到 Mocha，刷新后根节点仍是 `data-theme="mocha"`，Mocha 按钮为 `aria-pressed="true"`。
- Base：首次访问没有 storage，页面和切换器都显示 Latte。
- Bad：storage 写入 `frappe`、空字符串或其他值；页面必须回退 Latte，不能生成第三种主题。

## 6. 检查

依次运行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter web build
pnpm --filter admin build
```

浏览器至少检查 Web `/`、Web `/app`、Admin `/`：

- Latte/Mocha 切换、刷新保留和无效 storage 回退。
- 390 x 844 与 1440 x 900 没有溢出、裁切或重叠。
- 两个选项的 `aria-pressed`、2px `focus-visible` 焦点环和 `prefers-reduced-motion`。
- 控制台没有 hydration warning。

项目没有自动化组件测试；不能用 build 代替上述浏览器检查。

## 7. 错误与正确写法

不要用系统媒体查询覆盖显式主题：

```css
/* 错误 */
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
  }
}

/* 正确 */
[data-theme="mocha"] {
  color-scheme: dark;
}
```

Tailwind 4 的 `outline-none` 会把 `--tw-outline-style` 设为 `none`。只加 `focus-visible:outline-2` 不能恢复实线样式：

```tsx
// 错误
className = "outline-none focus-visible:outline-2 focus-visible:outline-focus";

// 正确
className =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
```

Tailwind 的 `base`、`components`、`utilities` 都在 cascade layer 内。应用 CSS 中没有放进 layer 的全局规则会排在这些规则前面，可能覆盖 Button utility。`Button asChild` 渲染为链接时尤其要检查文字颜色：

```css
/* 错误：覆盖 text-primary-foreground */
a {
  color: inherit;
}

/* 正确：Preflight 已处理链接颜色，应用只补需要的装饰 */
a {
  text-decoration: none;
}
```
