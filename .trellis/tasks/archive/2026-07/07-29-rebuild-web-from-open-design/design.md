# 技术设计

## 范围

主要修改 `apps/web`。只在更新 Web 设计事实时修改 `docs/apps/web-design.md`，不改 API、数据库、Admin 或共享主题运行时。

## 路由

| 路由                    | 原型                                   | 数据方式                                       |
| ----------------------- | -------------------------------------- | ---------------------------------------------- |
| `/`                     | `login.html`                           | 公开欢迎页，点击后展示登录面板                 |
| `/chats`                | 无独立原型                             | 查询单聊和群聊后进入最近会话                   |
| `/chats/[kind]/[id]`    | `chat-single.html` / `chat-group.html` | 同一个工作区按 `direct` / `group` 选择数据组件 |
| `/friends`              | `contacts.html`                        | 现有朋友列表和 CRUD                            |
| `/friends/[id]`         | `agent-detail.html`                    | 从朋友列表查询匹配项，缺失统计静态占位         |
| `/settings`             | `settings.html`                        | 现有用户资料、记忆和主动关怀；其余静态交互     |
| `/auth/callback/github` | 无可用新回调                           | 静态说明页，等待后续 API 调整                  |

`index.html` 不生成生产路由。

旧 `/login`、`/app`、`/group-chats`、`/agents` 和 `/login/github/callback` 路由目录直接删除。Next.js 不配置 redirect、rewrite 或 alias，旧地址返回 404。

## 组件边界

- 路由 `page.tsx` 保持服务端组件，只负责 metadata 和挂载业务组件。
- 登录、应用壳、菜单、弹层、可切换面板和输入区使用小型客户端组件。
- Web 专用组件留在 `apps/web/src/components`，不移动到 `packages/ui`。
- 共用层只提取原型在三个以上页面重复的结构：应用外壳、导航栏、头像、用户菜单、会话列表条目和通用静态弹层。
- 单聊、群聊、朋友和设置的业务状态继续留在各自现有组件目录，不建立新的全局状态库。

## 样式与主题

- 保留 Tailwind 4 和 `@repo/ui/theme.css` 导入顺序。
- 把原型共用样式整理为 Web 本地样式层，沿用原型 class 和六个核心语义变量。
- 根主题仍只有 `data-theme="latte"` 与 `data-theme="mocha"`。Web 局部 token 根据这两个值映射到原型亮色和暗色值。
- 不修改 `packages/ui` 的 Catppuccin 原始色值，避免 Admin 视觉变化。
- 原型字体栈用于 MoodMate 页面局部：展示标题用 Iowan Old Style / Charter / Georgia / Songti SC，正文使用系统无衬线；当前 Maple Mono 只用于时间、数字和短标签。
- 动效只改变 `opacity` 与 `transform`，继续保留 `prefers-reduced-motion`。

## 数据与状态

- 邮箱登录继续调用 `loginWeb`。GitHub 和 Google 按钮保留原型视觉，但显示“暂未开放”，不调用旧 OAuth 流程。
- 登录恢复和退出继续使用 `readClientSession`、`clearClientSession`。
- `/chats` 同时读取单聊和群聊摘要。群聊使用 `lastMessageAtMs`，单聊使用已返回消息中最后一条的 `createdAtMs`；时间较新的会话优先，两边都没有消息时优先单聊。
- `/chats/[kind]/[id]` 只有一个页面组件。`kind="direct"` 时使用 `useChat`、现有 conversation query、历史分页和反馈 mutation；`kind="group"` 时使用现有 group chat query/mutation。
- 动态路由参数通过明确的 `direct` / `group` 联合类型校验。单聊路由 ID 与 API 返回的 `conversationId` 不一致时替换为规范 URL，群聊不存在时显示未找到状态。
- 通讯录继续使用 user agent query/mutation；筛选只作用于客户端已加载列表。
- 朋友详情按 `agentId` 从现有朋友列表中查找。接口失败、未找到和无数据都有明确状态。
- 设置页复用现有 Profile、Memory、Care、General 和 Appearance 面板逻辑；把聊天组件内部的 settings mode 改为独立 `/settings` 路由。
- 示例关系天数、对话数量、故事和相处约定没有合同，只作为标明性质的静态内容，不写回 API。

## 直接替换与回退

- 新路由是唯一地址。旧路由文件和不再使用的旧页面组件直接删除。
- 不修改 `apps/api` 或 contracts。GitHub 新回调接入留给后续 API 任务。
- API 请求函数、contracts schema、缓存 key 和本地存储 key 不变。
- 每个子任务完成后单独运行 Web 类型、Lint、Format 和 build；出现回归时只回退该子任务涉及的组件和路由。
- 基础样式任务先完成，后续路由任务依赖该任务；最终集成任务依赖全部页面任务。
