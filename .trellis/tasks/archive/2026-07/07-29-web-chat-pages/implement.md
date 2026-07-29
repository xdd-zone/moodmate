# 执行计划

- [x] 新增 `/chats` 入口选择逻辑和 `/chats/[kind]/[id]` 动态页面。
- [x] 把单聊和群聊接入同一个 IM 工作区并保留现有消息逻辑。
- [x] 实现统一会话列表、会话切换、信息栏和头像菜单。
- [x] 删除旧 `/app`、`/group-chats` 路由和不再使用的重复页面组件。
- [x] 完成桌面与移动端输入、分页、错误和空状态实现。
- [x] 运行类型、Lint、Web 范围 Format 和 Web build。

## 验证记录

- 用户要求跳过浏览器验证，由用户手动检查桌面端和移动端页面。
- `pnpm check-types`、`pnpm lint`、`pnpm --filter web format:check`、`pnpm --filter web build` 通过。
- 根级 `pnpm format:check` 仍报 71 个已有 `.pi/`、Trellis 归档和工作日志文件；本次未修改这些文件。
