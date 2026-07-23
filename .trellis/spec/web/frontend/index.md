# Web Frontend Spec

`apps/web` 是用户端 Next.js 应用。修改页面、样式或请求层前读取对应指南。

## 指南

| 文件                                        | 适用内容                                |
| ------------------------------------------- | --------------------------------------- |
| [目录与数据边界](./directory-structure.md)  | 路由组、业务目录、跨包依赖              |
| [页面与组件](./component-guidelines.md)     | 服务端组件、链接、文案和交互            |
| [环境变量](./environment-variables.md)      | 服务端、客户端配置边界与校验            |
| [HTTP 与 Query](./http-query-guidelines.md) | typed HTTP、响应错误、客户端缓存        |
| [样式](./styling-guidelines.md)             | Tailwind 4、token、响应式和动效         |
| [伴侣聊天](./companion-chat.md)             | 历史恢复、记忆管理、AI SDK 流和逐字显示 |
| [质量检查](./quality-guidelines.md)         | 禁止写法、类型、手动验证和命令          |

## 开发前检查

- [ ] 已确认页面属于 `(site)`、`(auth)` 或 `(app)`。
- [ ] 已判断是否真的需要 `"use client"`。
- [ ] 新业务数据已在 contracts 和 API 定义，不在页面临时拼协议。
- [ ] 修改运行配置前已确认变量属于服务端还是浏览器。
- [ ] 增加接口调用前已读取 HTTP 与 Query 规范，并复用 contracts schema。
- [ ] 已读取 `docs/apps/web-design.md` 和相关现有页面。

## 完成检查

- [ ] 移动端和桌面布局没有文字、按钮或卡片重叠。
- [ ] Latte、Mocha 和减少动态效果模式可用。
- [ ] 主要交互可以用键盘聚焦。
- [ ] 已依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`，页面改动还通过 Web build。
