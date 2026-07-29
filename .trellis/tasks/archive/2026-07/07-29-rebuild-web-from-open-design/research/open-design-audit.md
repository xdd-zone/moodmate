# Open Design 原型调查

## 来源

原型目录：

`/Users/wuwanzhu/Library/Application Support/Open Design/namespaces/release-stable/data/projects/5eacec88-a8bf-47bc-9795-da9afcf96465`

主要依据：

- `login.html`：欢迎页和延迟出现的 OAuth 登录面板。
- `chat-single.html`：单聊、会话列表、资料栏、头像菜单和输入框。
- `chat-group.html`：群聊、成员栏、提及输入、新建群组弹层。
- `contacts.html`：通讯录筛选、朋友卡片和新建朋友弹层。
- `agent-detail.html`：朋友档案、统计和长文本资料。
- `settings.html`：个人资料、通用、记忆、主动关怀和外观面板。
- `index.html`：原型目录，不是用户页面。
- `assets/moodmate.css`：683 行共用 token、布局、组件和响应式样式。
- `brand-spec.md`、`docs/*.md`：品牌、主题、颜色、布局和交互规范。

原型没有位图、视频或字体素材。头像使用固定渐变和首字，图标使用 lucide 风格 SVG。

## 视觉与布局

- 产品定位：陪伴聊天应用。
- 气质：安静、温和、有陪伴感，交互形态参考 Telegram Desktop。
- 暗色为原型默认；亮色通过同一组语义变量切换。
- IM 外壳：72px 导航栏、340px 列表栏、自适应主区、可选 300px 信息栏。
- 断点：1100px 隐藏信息栏，820px 收窄列表，640px 切为移动端单列。
- 单聊用圆形头像；群聊用圆角方形头像和群组角标。
- 消息区使用极弱紫色与青色氛围光，不影响文字可读性。

在本地静态服务 `http://127.0.0.1:6170` 以 1280×720 渲染检查过 6 个用户页面。聊天、通讯录、档案和设置均为固定视口应用布局；登录页首屏只显示欢迎内容和“进入 MoodMate”按钮。

## 原型交互

- 主题切换和跨页持久化。
- 登录欢迎内容与登录面板之间切换，Escape 返回欢迎内容。
- 聊天信息栏显隐。
- 头像左键和右键菜单，点击空白或滚动关闭。
- 用户头像菜单、退出确认和主题入口。
- 会话选中、通讯录页签、设置面板和开关切换。
- 输入框自动增高，Enter 发送，Shift+Enter 换行。
- 新建群组和认识新朋友弹层。

## 目标工程现状

- Next.js 16、React 19、TypeScript 5.9、Tailwind 4、pnpm workspace 和 Turborepo 已可运行。
- `/login` 已支持邮箱密码和 GitHub OAuth。
- `/app` 已支持登录恢复、单聊历史、流式回复、加载更早消息、关系阶段、消息反馈和设置面板。
- `/group-chats` 已支持群聊列表、详情、分页、发言、提及、成员管理和新建群聊。
- `/agents` 已支持朋友列表和 CRUD。
- 主题由 `@repo/ui` 的 `ThemeScript`、`ThemeToggle`、`latte` / `mocha` 和 `moodmate-theme:v1` 管理。

## 冲突与处理

- 原型 `index.html` 是设计目录。用户确认生产 `/` 直接使用 Login 欢迎页。
- 用户确认单聊和群聊属于同一个聊天工作区，规范路由采用 `/chats/[kind]/[id]`，不再使用两个顶层聊天路由。
- 用户确认重新设计全部业务路由：`/chats`、`/friends`、`/friends/[id]`、`/settings` 和 `/auth/callback/github`。
- 用户明确要求直接删除旧业务路由和旧回调，不实现任何重定向或兼容产物；无法直接接入新路由的功能先做静态状态，API 后续另行调整。
- 原型主题脚本使用 `light` / `dark`。实现继续使用仓库的 `latte` / `mocha`，不复制主题运行时。
- 原型只有 GitHub 和 Google OAuth；当前工程还有邮箱密码。实现让欢迎页先出现，登录面板保留可直接使用的邮箱登录，GitHub 和 Google 显示暂未开放状态。
- 原型使用示例朋友和统计。存在真实 API 的列表、聊天、记忆和关怀使用真实数据；没有合同的档案统计和设置项使用静态展示。
- 当前 `docs/apps/web-design.md` 仍描述情绪记录工具。实现完成时改为本次陪伴聊天页面事实。
