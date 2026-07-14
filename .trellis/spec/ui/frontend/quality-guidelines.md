# UI 质量检查

## 检查内容

- 组件在 Web 和 Admin 中都有明确复用场景。
- 客户端组件确实使用事件、state 或浏览器 API。
- Props 能表达必填、可选和 children，没有 `any` 或无依据的断言。
- 组件不发请求、不读 session、不判断业务权限。
- 导入路径使用 `@repo/ui/<file>`，与 `package.json` 的 exports 匹配。

## 共享样式检查

`theme.css` 使用 `@source "./"` 扫描共享组件。修改组件 class、CSS export 或应用 import 后，Web 和 Admin 都要 build；只做 UI 包类型检查无法发现共享 utility 没有生成的问题。

错误写法：

```tsx
<div className={`bg-${color}`} />
```

正确写法：

```tsx
const colors = { primary: "bg-primary", danger: "bg-danger" };
```

项目没有组件测试或 Storybook。修改后至少运行：

```bash
pnpm --filter @repo/ui check-types
pnpm --filter @repo/ui lint
pnpm --filter @repo/ui format:check
```

然后运行 `pnpm --filter web build` 和 `pnpm --filter admin build`，并在两个应用中手动检查键盘、浅色、深色和减少动态效果模式。
