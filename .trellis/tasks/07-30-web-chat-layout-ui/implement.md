# 实施清单

## 1. 登录后应用 Layout

- [x] 新增 `apps/web/app/(app)/layout.tsx` 和登录后应用客户端布局。
- [x] 把 session 恢复、用户资料请求、退出登录、用户头像菜单和导航当前项移到共享布局。
- [x] 提供只在登录后布局内使用的 profile hook；缺少 provider 时抛出明确错误。
- [x] 让朋友、朋友档案和设置页面直接渲染业务内容，移除重复 Guard、导航与完整应用壳。

检查点：在 `/chats`、`/friends`、`/friends/[id]`、`/settings` 之间切换时，导航 DOM 和 profile context 保持挂载。

## 2. 聊天 Layout

- [x] 新增 `apps/web/app/(app)/chats/layout.tsx`，让聊天列表包裹 `/chats` 与动态聊天页面。
- [x] 把会话摘要查询、列表搜索、新对话、新建群聊、移动端列表开关和列表渲染移到持久聊天布局。
- [x] 用聊天 context 向入口页和动态聊天页提供现有查询结果与列表操作。
- [x] 让 `/chats/page.tsx` 保留最近会话选择逻辑；让动态页只渲染当前单聊或群聊内容。
- [x] 移除 `ChatWorkspaceGuard` 的 `selectionKey` 和整壳条件分支，保证切换会话只更新内容区域。

检查点：先输入会话搜索词并滚动列表，再切换单聊和群聊；搜索词、列表位置和列表 DOM 不重置。

## 3. 详情、聚焦与滚动条

- [x] 把直接聊天和群聊的详情初始状态设为隐藏，保留桌面切换与移动端全屏打开、关闭行为。
- [x] 调整 MoodMate 文本输入控件样式，聚焦时不变色、不显示 outline 或阴影；保留按钮和链接的 `focus-visible`。
- [x] 为 `.moodmate-scroll` 隐藏轨道、按钮与角落，只显示滑块及滑块 hover 状态。
- [x] 检查登录、聊天输入、会话搜索、朋友搜索、编辑朋友和设置表单，确认规则没有遗漏。
- [x] 固定登录后应用壳，并确认聊天消息只产生内部滚动，不再产生页面级滚动条。

## 4. 验证

- [x] 启动 `pnpm dev:web`，检查 `/chats`、单聊、群聊、`/friends`、一条朋友详情和 `/settings`。
- [x] 在 Latte 与 Mocha 下检查文本输入聚焦、滚动条、详情默认状态和路由切换。
- [x] 检查桌面页面，并核对 1100px、820px 和 640px 媒体查询下的导航、会话列表、聊天内容和详情规则。
- [x] 依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`；前两项通过，全仓 Format 只命中任务外既有 Trellis 文档，本次文件定向检查通过。
- [x] 运行 `pnpm --filter web build`。

## 验证记录

- 浏览器实际视口为 1280×720。单聊和群聊详情默认隐藏，打开、关闭正常；单聊切到群聊后会话搜索值保留。
- `/chats`、`/friends`、朋友详情和 `/settings` 切换时主导航保持，页面没有再次显示“正在恢复登录状态”。
- Latte 和 Mocha 的文本输入控件聚焦前后边框、outline、阴影计算值不变；滚动条轨道、按钮和角落不显示。
- 浏览器控制台没有 error；只有 Next.js HMR 和 React DevTools 开发信息。
- 固定应用壳后，1280×720 视口中的 `html.scrollHeight` 从 2892px 降为 720px；消息区保留独立滚动。
- 项目没有自动化测试脚本。固定视口浏览器不能直接切换到 1100px、820px 和 640px，已核对对应媒体查询和移动端状态类。

## 风险文件与回退点

- `apps/web/app/(app)/layout.tsx` 和共享认证布局决定所有登录后页面能否进入；先完成并验证，再删除旧 Guard。
- `apps/web/app/(app)/chats/layout.tsx` 与 `chat-workspace.tsx` 决定聊天列表是否持久；若查询 context 有问题，先恢复页面直接调用现有 query，不修改 query key。
- `moodmate.css` 的移动端选择器依赖 DOM 层级；每次改网格后立即检查 640px 的列表与详情开关。
- 不修改 API、contracts 和数据存储，因此代码回退不需要数据处理。
