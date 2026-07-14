# Contracts Shared Spec

`@repo/contracts` 是 API、Web 和 Admin 共用的接口约定包。它是纯 TypeScript + Zod 包，不属于 frontend 或 backend 实现层。

## 指南

| 文件                                         | 适用内容                             |
| -------------------------------------------- | ------------------------------------ |
| [Contract 写法](./contract-guidelines.md)    | 模块目录、Zod schema、类型推导和导出 |
| [统一响应与错误码](./response-guidelines.md) | `ApiResponse`、`BizCode`、构造函数   |
| [边界与检查](./quality-guidelines.md)        | 包职责、禁止依赖、验证命令           |

## 开发前检查

- [ ] 已确认字段属于跨入口 API 协议，而不是数据库 record、service 内部类型或页面状态。
- [ ] 已搜索现有 module、schema、DTO 和 `BizCode`，避免重复定义。
- [ ] 已确认 API 与前端消费者是否都需要同步修改。

## 完成检查

- [ ] 运行时输入使用 Zod schema，TypeScript 类型从 schema 推导。
- [ ] 新导出已加入 `packages/contracts/src/index.ts`。
- [ ] contracts 没有 import app、Hono、数据库、环境变量或 DOM。
- [ ] 已依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。
