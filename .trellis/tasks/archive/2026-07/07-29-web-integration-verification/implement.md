# 执行计划

- [x] 检查路由和导航完整性。
- [x] 检查规范路由、动态聊天切换和旧路径 404。
- [x] 依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`、`pnpm --filter web build`。
- [x] 启动 `pnpm dev:web`。
- [x] 按 PRD 的尺寸、主题和交互矩阵做浏览器截图检查。
- [x] 修复本次任务引入的问题并重复检查。
- [x] 更新 `docs/apps/web-design.md` 和父任务验收状态。

## 验收记录

- `pnpm check-types`、`pnpm lint`、`pnpm --filter web format:check` 和 `pnpm --filter web build` 均通过。
- 根级 `pnpm format:check` 仍被仓库原有 `.pi/`、Trellis 历史任务和日志文件格式问题阻塞；本次没有修改这些无关文件。
- 已在本地开发服务检查 `/`、`/chats`、单聊、群聊、`/friends`、朋友详情和 `/settings`。
- 已检查 390×844 移动布局，以及桌面断点的导航栏、列表栏、资料栏、消息区和输入区。
- 已验证 Latte/Mocha 主题切换、头像菜单打开与 Escape 关闭、设置个人资料布局、群聊成员数和单聊资料栏短文案。
- 旧 `/login`、`/app`、`/group-chats`、`/agents` 和 `/login/github/callback` 均返回 404。
