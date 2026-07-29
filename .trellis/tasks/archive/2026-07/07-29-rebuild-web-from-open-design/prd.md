# 按 Open Design 原型重构 Web 端

## Goal

把 `apps/web` 按 Open Design 项目 `5eacec88-a8bf-47bc-9795-da9afcf96465` 的本地原型重构为可运行的 Next.js / React 页面，保持原型的视觉、布局、交互、文案与素材表现，并沿用当前仓库的工程栈。

原型来源：

`/Users/wuwanzhu/Library/Application Support/Open Design/namespaces/release-stable/data/projects/5eacec88-a8bf-47bc-9795-da9afcf96465`

## Requirements

- 以原型的 7 个 HTML 页面、`assets/moodmate.css`、`brand-spec.md` 和 `docs/*.md` 为实现依据。
- 重构 `apps/web`，不新建独立前端工程；保留 Next.js 16、React 19、TypeScript、App Router、现有 pnpm workspace 和 Turborepo 配置。
- 覆盖登录欢迎、统一聊天工作区、朋友列表、朋友详情和设置页面，并重新设计生产路由，不沿用当前 `/app`、`/group-chats`、`/agents` 的业务路径。
- 生产 `/` 直接渲染原型 Login 欢迎页，首次不显示登录方式；用户点击“进入 MoodMate”后再展开登录选项。
- 规范路由使用 `/`、`/chats`、`/chats/[kind]/[id]`、`/friends`、`/friends/[id]`、`/settings` 和 `/auth/callback/github`。
- 删除旧 `/login`、`/app`、`/group-chats`、`/agents` 和 `/login/github/callback` 路由目录，不新增重定向、rewrite、alias 页面或兼容组件。
- 原型 `index.html` 仅作为设计目录和验收依据，不发布为用户路由，也不在生产页面展示 HTML 文件名或设计文档入口。
- 单聊和群聊属于同一个聊天工作区，通过动态会话路由切换聊天对象，共用页面外壳、会话列表和主内容容器。
- 提取统一 IM 外壳、导航栏、会话列表、头像、消息气泡、菜单、设置控件等共用组件，避免各路由重复实现相同结构。
- 保持原型暗色默认、亮色可选的双主题视觉；主题状态沿用仓库现有 `ThemeScript` / `data-theme` 机制，不能引入第二套互相冲突的主题状态。
- 保留原型已展示的响应式行为、键盘输入行为、菜单、主题切换、信息栏显隐、会话选中与设置面板切换。
- 现有 API 能直接用于新页面的继续接入；依赖旧路由或缺少后端能力的功能使用静态数据和静态交互占位，不修改 API 或 contracts。
- 复用 `lucide-react` 图标；原型未提供位图素材时使用原型定义的渐变头像占位，不自行生成无依据的素材。
- 页面文案以原型为准；新增说明性文案保持具体、简短，不使用 emoji。
- 为路由页面、前端基础配置和共用组件建立多个 Trellis 子任务，子任务应能独立验收。
- 不修改 `apps/admin`、`apps/api`、`packages/contracts` 或无关共享包；新页面缺少对应 API 时只实现静态状态。

## Confirmed Facts

- 原型的产品定位是陪伴聊天应用，核心场景是一对一聊天、朋友群聊、通讯录、朋友档案和设置；视觉气质是安静、温和、有陪伴感。
- 原型的应用页采用固定视口 IM 布局：72px 导航栏、340px 列表栏、自适应主区、可选 300px 信息栏。
- 原型没有位图素材；头像由固定渐变色和首字构成，图标为内联 lucide 风格 SVG。
- 当前 Web 已实现邮箱密码登录、GitHub OAuth、单聊历史与流式回复、记忆管理、消息反馈、群聊和朋友 CRUD，对应 typed API 已存在。
- 单聊接口返回 `conversationId`，群聊列表返回独立 `groupChatId`；当前后端没有统一的“按任意聊天 ID 查询”接口，前端路由必须保留可判定的会话类型。
- 原型中的 Google OAuth、朋友档案统计、部分设置和资料字段暂无后端能力，按用户要求使用静态内容或静态交互占位。
- GitHub API 当前把结果送到旧 `/login/github/callback`。本次不修改 API，也不保留旧回调，因此 GitHub 登录和新 `/auth/callback/github` 先实现静态状态。
- 当前仓库主题只允许 `latte` / `mocha`，并通过 `moodmate-theme:v1`、`ThemeScript` 和 `ThemeToggle` 持久化；落地时把原型视觉映射到现有主题契约，不复制原型的 `light` / `dark` 脚本。
- 当前 `docs/apps/web-design.md` 仍把产品描述为情绪记录工具，与本次原型的陪伴聊天定位冲突；实现完成时应在任务范围内更新该文档。

## Acceptance Criteria

- [ ] `/` 进入原型 Login 欢迎页，默认不显示登录方式，点击主要按钮后显示登录选项。
- [ ] 源码中不存在旧路由页面、重定向、rewrite、alias 或兼容组件，访问旧路径得到 Next.js 404。
- [ ] 单聊与群聊在同一个动态聊天路由和页面组件中打开，切换对象不离开聊天工作区。
- [ ] 朋友列表、朋友详情和设置使用重新设计的语义路由，可从统一导航或页面内入口到达。
- [ ] 桌面端的列宽、间距、排版、颜色、圆角、边框、气泡、头像和控件状态与原型一致。
- [ ] 页面在 1100px、820px、640px 原型断点附近按设计文档调整布局，不出现文字或控件重叠。
- [ ] 暗色和亮色主题均可切换、持久化，首次加载不出现明显主题闪烁。
- [ ] 原型中可演示的菜单、会话切换、信息栏、输入框、设置面板等交互在 React 中可用。
- [ ] 暂无后端能力的区域展示完整静态占位，不出现死链、空白页面或未处理异常。
- [ ] 邮箱密码登录、单聊历史与流式回复、消息反馈、群聊、朋友 CRUD、记忆管理和主动关怀能力没有回归。
- [ ] GitHub、Google 和其他未接入功能显示完整静态状态，不发起无效请求。
- [ ] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 按顺序通过。
- [ ] `pnpm dev:web` 可在 `http://localhost:6153` 启动，并完成桌面端与移动端页面截图检查。

## Notes

- 这是复杂任务。开始实现前必须补齐 `design.md`、`implement.md` 和子任务规划，并由用户确认。
- 原型目录没有 `DESIGN.md`、`README` 或 `package.json`；可用设计依据是 7 个 HTML、对应 artifact JSON、一份 CSS、品牌说明和 5 份设计文档。
