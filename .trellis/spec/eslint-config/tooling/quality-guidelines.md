# ESLint 配置质量检查

## 影响范围

修改前搜索：

```bash
rg '@repo/eslint-config' apps packages
```

当前消费者是 Web、Admin、API、contracts 和 UI。base 变化会间接影响三个 preset 及多数 workspace，不能只验证配置包自身。

## 类型与模块

- 文件使用 ESM 和 `.js` 扩展名。
- 配置通过 JSDoc 标注 `import("eslint").Linter.Config[]`。
- `packages/eslint-config/tsconfig.json` 使用 `allowJs` + `checkJs` 检查 JavaScript 配置。
- 插件必须在 `packages/eslint-config/package.json` 声明，不能依赖消费者的偶然安装。

## 验证

依次运行根命令：

```bash
pnpm check-types
pnpm lint
pnpm format:check
```

项目的 lint 脚本使用 `--max-warnings 0`；新增 warning 也会让检查失败。若修改 Next.js 或 React preset，还要确认 Web/Admin/UI 的 lint 都进入 Turbo 任务。
