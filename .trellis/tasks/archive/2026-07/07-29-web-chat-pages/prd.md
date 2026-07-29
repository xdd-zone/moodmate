# 实现统一聊天工作区

## Goal

按 `chat-single.html` 和 `chat-group.html` 实现同一个聊天工作区，由动态路由切换单聊和群聊对象。

## Requirements

- `/chats` 作为聊天入口，进入最近或首个可用会话。
- `/chats/[kind]/[id]` 使用同一个页面组件和应用外壳，`kind` 为 `direct` 或 `group`。
- 单聊按 `chat-single.html` 呈现，群聊按 `chat-group.html` 呈现；切换会话只替换列表选中态、主区和资料栏内容。
- 保留单聊流式回复、历史分页、反馈、停止生成、错误恢复和关系阶段。
- 保留群聊列表、详情、历史分页、提及、发言、新建群聊和成员管理。
- 信息栏显隐、头像菜单、输入框增高和移动端详情切换可用。
- 原型示例会话只补充无合同的展示，不覆盖真实 API 返回值。

## Acceptance Criteria

- [x] 同一个动态路由根据会话类型呈现对应原型的气泡、资料栏和输入区。
- [x] 单聊和群聊导航互通，当前会话和当前主导航有明确选中态。
- [ ] 已有单聊与群聊请求、mutation 和错误状态没有功能回归。
- [ ] 1100px 隐藏资料栏，820px 收窄列表，640px 使用移动端单列交互。
- [x] Enter 发送、Shift+Enter 换行，输入框不超过 140px。
- [x] 类型、Lint、Web 范围 Format 和 Web build 通过。

## Notes

- 依赖 `07-29-web-prototype-foundation`。
- 浏览器验证按用户要求跳过；响应式布局和功能回归由用户手动检查。
- 根级 Format 仍受已有 `.pi/`、Trellis 归档和工作日志文件影响，本次 Web 文件已通过 Format 检查。
