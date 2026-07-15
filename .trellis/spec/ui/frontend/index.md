# UI Frontend Spec

`@repo/ui` 是 Web 和 Admin 共用的无业务 React 组件包。当前组件来自 create-turbo starter，新增或接入前先确认真实复用需求。

## 指南

| 文件                                   | 适用内容                       |
| -------------------------------------- | ------------------------------ |
| [目录与导出](./directory-structure.md) | 文件命名、子路径导出、共享条件 |
| [组件写法](./component-guidelines.md)  | Props、客户端边界、样式归属    |
| [主题](./theme-guidelines.md)          | Latte/Mocha、存储、首屏和切换  |
| [类型和依赖](./type-safety.md)         | TypeScript 与禁止依赖          |
| [质量检查](./quality-guidelines.md)    | 复用判断、starter 风险和命令   |

## 开发前检查

- [ ] 已找到 Web 和 Admin 两个真实使用位置。
- [ ] 已确认组件不含 API、session、权限或业务字段。
- [ ] 已检查现有组件是否仍有 create-turbo starter 行为。
- [ ] 修改主题时已读取 `theme-guidelines.md`。

## 完成检查

- [ ] `"use client"` 只出现在需要交互的组件。
- [ ] Props 无 `any`，导出路径与文件名一致。
- [ ] 没有新增对 app、contracts、Next.js 或 Hono 的依赖。
- [ ] 已依次通过类型、Lint 和 Format 检查，并在实际使用的应用中手动验证。
