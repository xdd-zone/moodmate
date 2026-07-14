# Admin Frontend Spec

`apps/admin` 是管理后台。当前仍是基础壳，新增业务前先建立 `docs/architecture.md` 规定的目录和权限边界。

## 指南

| 文件                                    | 适用内容                                         |
| --------------------------------------- | ------------------------------------------------ |
| [目录与边界](./directory-structure.md)  | route group、请求层、跨包依赖、当前 starter 状态 |
| [页面与组件](./component-guidelines.md) | 服务端组件、后台组件职责、Web/Admin 分离         |
| [质量检查](./quality-guidelines.md)     | 类型、数据、禁止写法和验证命令                   |

## 开发前检查

- [ ] 已确认功能属于 `(auth)` 或 `(dashboard)` 及具体业务目录。
- [ ] 已确认后台 contract 与权限要求，没有复用用户端 DTO 隐藏字段。
- [ ] 已判断组件只供 Admin 使用，还是确实可进入 `packages/ui`。
- [ ] 已区分当前源码事实和 `docs/architecture.md` 中尚未实现的下一阶段设计。

## 完成检查

- [ ] 页面没有直接调用数据库、LLM 或服务端 secret。
- [ ] 页面没有 import `apps/api/src` 或 Web 业务代码。
- [ ] 交互组件的 `"use client"` 范围保持最小。
- [ ] 已依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`，页面改动还通过 Admin build。
