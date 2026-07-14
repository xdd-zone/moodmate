# UI 质量检查

## 检查内容

- 组件在 Web 和 Admin 中都有明确复用场景。
- 客户端组件确实使用事件、state 或浏览器 API。
- Props 能表达必填、可选和 children，没有 `any` 或无依据的断言。
- 组件不发请求、不读 session、不判断业务权限。
- 导入路径使用 `@repo/ui/<file>`，与 `package.json` 的 exports 匹配。

## 当前风险

`packages/ui` 仍保留 create-turbo starter 组件，且 Web/Admin 当前没有实际 import。不要把这些文件当成已经确认的设计系统。首次接入应用时检查 `Button` 的 `alert()` 和 `Card` 的 URL，并在该功能任务中替换。

项目没有组件测试或 Storybook。修改后至少运行：

```bash
pnpm --filter @repo/ui check-types
pnpm --filter @repo/ui lint
pnpm --filter @repo/ui format:check
```

接入应用后还要运行对应 Next.js build，并手动检查键盘、浅色和深色模式。
