# TypeScript 配置质量检查

## 修改边界

修改共享配置前运行：

```bash
rg '@repo/typescript-config|"extends"' apps packages -g 'tsconfig.json'
```

不要：

- 关闭 `strict`、`strictNullChecks` 或 `noUncheckedIndexedAccess` 来绕过源码错误。
- 在 base 中加入只适用于 Node、Next.js 或 Workers 的专用 global。
- 把消费者的 include、exclude 和输出目录搬进共享配置。
- 让 Next.js 配置恢复发射 JavaScript；构建由 Next.js 负责。

## 验证

`@repo/typescript-config` 自身只有 JSON 格式检查，没有 `check-types` 或 lint 脚本。修改后必须通过所有消费者的根检查：

```bash
pnpm check-types
pnpm lint
pnpm format:check
```

如果配置影响构建解析，再运行 `pnpm build`。不要只运行 `pnpm --filter @repo/typescript-config check`，它只能检查 JSON 格式。
