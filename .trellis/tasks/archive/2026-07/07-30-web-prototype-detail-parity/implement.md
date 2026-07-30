# 执行计划

## 顺序

- [x] 1. 以原型实际渲染为验收依据，完成 PRD 最终整理。
- [x] 2. 调整登录页欢迎内容纵向定位，并核对登录面板切换、Escape 和双主题。
- [x] 3. 补齐聊天共用展示：日期分隔、时间戳、连续消息、三点输入状态、复制按钮和输入区工具入口。
- [x] 4. 把朋友头像点击/右键菜单接入单聊头部、群聊成员和消息头像，保持用户头像菜单行为不变。
- [x] 5. 补齐单聊和群聊信息栏的原型分组、操作位置与静态 disabled 状态，保留群成员管理能力。
- [x] 6. 调整会话列表的“新对话”入口、通讯录卡片点击区域、描述行数和操作按钮布局。
- [x] 7. 把朋友档案统计区改为原型实际渲染的纵向通栏卡，调整示例提示和更多操作，保留真实朋友编辑与删除。
- [x] 8. 把主题预览卡改为可选择控件，补齐气泡紧凑模式的页面内演示状态；只调整记忆和主动关怀的外层视觉。
- [x] 9. 核对 1100px、820px、640px 断点和 1440x900、1280x720、820x900、390x844 视口。
- [x] 10. 完成浏览器交互、控制台、资源和回归检查。

## 质量检查

按顺序执行，前一项通过后再执行下一项：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter web build
```

项目没有安装 Playwright，不新增依赖。浏览器检查使用 Codex 内置浏览器完成。

实际结果：`pnpm check-types`、`pnpm lint`、本次改动文件的 Prettier 检查和 `pnpm --filter web build` 通过。全仓 `pnpm format:check` 被 76 个与本任务无关的既有 `.pi/`、历史任务和 spec 文件阻塞。

## 浏览器检查

- `/`：欢迎页、登录面板、返回、Escape、主题切换。
- `/chats` 与 `/chats/[kind]/[id]`：会话切换、历史分页、发送、停止、反馈、复制、输入状态、资料栏、头像菜单、新建群聊。
- `/friends`：搜索、筛选、整卡进入详情、编辑、暂别和新建朋友。
- `/friends/[id]`：返回、编辑、开始聊天、资料区、静态统计边界和暂别。
- `/settings`：五个面板、主题卡、开关、记忆操作和主动关怀操作。
- Latte、Mocha、刷新持久化和 `prefers-reduced-motion`。
- 控制台没有新增运行错误、hydration warning 或资源 404。

## 风险文件

- `apps/web/src/components/chat/companion-chat.tsx`
- `apps/web/src/components/chat/chat-conversation.tsx`
- `apps/web/src/components/group-chat/group-chat-workspace.tsx`
- `apps/web/src/components/moodmate/avatar-menu.tsx`
- `apps/web/src/components/moodmate/info-panel.tsx`
- `apps/web/src/components/settings/settings-panels.tsx`
- `apps/web/src/components/moodmate/moodmate.css`
