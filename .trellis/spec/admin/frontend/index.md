# Admin Frontend Spec

`apps/admin` 是管理后台。当前已有使用共享主题的基础入口，新增业务前先建立 `docs/architecture.md` 规定的目录和权限边界。

## 指南

| 文件                                        | 适用内容                                 |
| ------------------------------------------- | ---------------------------------------- |
| [目录与边界](./directory-structure.md)      | route group、请求层、跨包依赖            |
| [页面与组件](./component-guidelines.md)     | 服务端组件、后台组件职责、Web/Admin 分离 |
| [环境变量](./environment-variables.md)      | 服务端、客户端配置边界与校验             |
| [HTTP 与 Query](./http-query-guidelines.md) | typed HTTP、响应错误、客户端缓存         |
| [认证 BFF](./auth-bff-guidelines.md)        | 同源请求、cookie、续期和页面保护         |
| [角色管理](./role-management.md)            | 角色页面、BFF 和状态操作                 |
| [用户管理](./user-management.md)            | 用户分页、创建表单和角色选择             |
| [头像管理](./default-avatar-management.md)  | 默认头像、个人头像、资料页和图片回退     |
| [样式](./styling-guidelines.md)             | Tailwind 4、共享主题、密度和可访问性     |
| [质量检查](./quality-guidelines.md)         | 类型、数据、禁止写法和验证命令           |

## 开发前检查

- [ ] 已确认功能属于 `(auth)` 或 `(dashboard)` 及具体业务目录。
- [ ] 已确认后台 contract 与权限要求，没有复用用户端 DTO 隐藏字段。
- [ ] 已判断组件只供 Admin 使用，还是确实可进入 `packages/ui`。
- [ ] 修改运行配置前已确认变量属于服务端还是浏览器。
- [ ] 增加接口调用前已读取 HTTP 与 Query 规范，并确认使用后台 contract。
- [ ] 涉及登录态时已读取认证 BFF 规范，并确认浏览器不接触 token。
- [ ] 已区分当前源码事实和 `docs/architecture.md` 中尚未实现的下一阶段设计。
- [ ] 已读取 `docs/apps/admin-design.md` 和相关现有页面。

## 完成检查

- [ ] 页面没有直接调用数据库、LLM 或服务端 secret。
- [ ] 页面没有 import `apps/api/src` 或 Web 业务代码。
- [ ] 认证响应、页面 props、Query cache、URL 和日志没有 token。
- [ ] 交互组件的 `"use client"` 范围保持最小。
- [ ] 已依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`，页面改动还通过 Admin build。
