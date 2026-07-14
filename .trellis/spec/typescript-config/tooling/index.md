# TypeScript Config Tooling Spec

`@repo/typescript-config` 提供严格模式的基础、Next.js 和 React library 配置。

## 指南

| 文件                                      | 适用内容                     |
| ----------------------------------------- | ---------------------------- |
| [配置结构](./configuration-guidelines.md) | 三个 JSON 配置及消费者覆盖项 |
| [质量检查](./quality-guidelines.md)       | 修改范围、禁止写法和验证命令 |

## 开发前检查

- [ ] 已确认选项应放 base、nextjs 还是 react-library。
- [ ] 已搜索所有 `extends`，确认受影响 workspace。
- [ ] 已区分共享默认值和单个包的运行环境要求。

## 完成检查

- [ ] `strict`、`noUncheckedIndexedAccess` 和 `isolatedModules` 仍保持启用。
- [ ] Next.js 使用 Bundler resolution，普通基础配置使用 NodeNext。
- [ ] 包级特殊项留在消费者 `tsconfig.json`。
- [ ] 已依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。
