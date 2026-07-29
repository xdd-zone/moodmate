# 技术设计

- 用一个聊天守卫替代 `WebDashboardGuard` 和 `GroupChatsGuard` 的重复 session 检查，失效时进入 `/`。
- `/chats` 查询单聊和群聊摘要，按最后消息时间选择目标；没有消息时优先单聊。
- `/chats/[kind]/[id]` 挂载同一个工作区组件，`kind` 决定渲染 `CompanionChatApp` 或群聊详情组件。
- 重构 `CompanionChatApp` 和 `GroupChatWorkspace` 的 JSX 与样式，不改 API、query key、mutation payload 和消息排序规则。
- 统一会话列表由真实单聊和群聊数据组成；接口加载失败时分别显示局部错误，不阻塞另一种会话入口。
- 单聊路由 ID 与 API 返回值不一致时替换为规范 URL；群聊 ID 不存在时显示未找到状态。
- 资料栏使用现有数据和原型静态说明组合，静态字段不写回 API。
- 设置 mode 从单聊组件移出，改由 `/settings` 路由承担。
