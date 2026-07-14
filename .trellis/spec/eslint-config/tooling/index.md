# ESLint Config Tooling Spec

`@repo/eslint-config` 提供 ESLint 9 flat config，供普通 TypeScript、Next.js 和 React 组件包使用。

## 指南

| 文件                                      | 适用内容                       |
| ----------------------------------------- | ------------------------------ |
| [配置结构](./configuration-guidelines.md) | 三个导出、组合顺序和消费者写法 |
| [质量检查](./quality-guidelines.md)       | 修改边界、兼容性和验证命令     |

## 开发前检查

- [ ] 已确认规则属于所有包、Next.js 应用或 React 组件库中的哪一类。
- [ ] 已搜索各 workspace 的 `eslint.config.*`，确认受影响消费者。
- [ ] 已确认 ESLint 9 flat config 与插件提供的 flat 配置格式。

## 完成检查

- [ ] 共享配置仍通过命名导出提供，消费者配置只负责选择对应 preset。
- [ ] Prettier 兼容配置没有被规则覆盖。
- [ ] 新规则不会引用未声明插件。
- [ ] 已依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。
