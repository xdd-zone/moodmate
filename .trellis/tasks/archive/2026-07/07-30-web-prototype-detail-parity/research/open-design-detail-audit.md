# Open Design 细节差异审计

## 审计范围

原型目录：

`/Users/wuwanzhu/Library/Application Support/Open Design/namespaces/release-stable/data/projects/5eacec88-a8bf-47bc-9795-da9afcf96465`

已核对：

- `login.html`
- `chat-single.html`
- `chat-group.html`
- `contacts.html`
- `agent-detail.html`
- `settings.html`
- `assets/moodmate.css`
- `brand-spec.md`
- `docs/*.md`
- 当前 `apps/web` 路由、组件和样式
- 原型在 1280x720 下的六个页面首屏
- 当前 `/` 在 1280x720 下的首屏和 DOM 尺寸

原型目录没有 `DESIGN.md`、`README`、`package.json`、位图、视频或字体文件。artifact JSON 只记录 HTML 入口和导出元数据，不包含额外设计数据。

## 已保持的部分

- 路由已改为 `/`、`/chats`、`/chats/[kind]/[id]`、`/friends`、`/friends/[id]` 和 `/settings`。
- 应用壳沿用 72px 导航栏、340px 列表栏、300px 信息栏和 1100px / 820px / 640px 断点。
- 暗色与亮色 token、渐变头像、群聊头像角标、导航、会话列表、聊天气泡、朋友卡片、设置导航的主体样式已经建立。
- 登录欢迎页的标题、引导文案、主要按钮、边缘提示和页脚已经还原。1280x720 下，标题字号和行高与原型一致，内容整体比原型高约 10px。
- 输入框已经支持自动增高、Enter 发送、Shift+Enter 换行。
- 现有页面保留了真实登录、流式单聊、群聊、朋友管理、记忆和主动关怀接口。

## 全局与共用组件

### P1：朋友头像菜单只接在用户头像上

原型给聊天头头像和消息头像都绑定点击与右键菜单，点击空白、滚动或 Escape 后关闭：

- `chat-single.html:243`
- `chat-single.html:303`
- `chat-group.html:304`
- `chat-group.html:370`

当前 `MoodmateAvatarMenu` 已实现边界检测、点击、右键、滚动关闭和 Escape，但只用于导航栏底部用户头像：

- `apps/web/src/components/chat/chat-workspace.tsx:138`
- `apps/web/src/components/friends/friends-navigation.tsx:26`
- `apps/web/src/components/settings/settings-workspace.tsx:88`

聊天头和消息里的朋友头像仍使用静态 `MoodmateAvatar`。

### P2：响应式实现加入了原型外的页面级断点

原型共用 CSS 只有 1100px、820px 和 640px 三个布局断点。当前实现还为认证、朋友、详情和设置加入 760px、420px、低高度等断点。这些规则解决了真实内容溢出，不应直接删除；验收时需确认它们没有改变原型在基准视口下的布局。

## 登录页

### P2：首屏垂直位置有约 10px 偏差

1280x720 下：

- 原型标题顶部约 255.2px，主要按钮顶部约 497.3px。
- 当前标题顶部约 245.2px，主要按钮顶部约 487.2px。

标题字号 76px、行高 79.04px和按钮高度 48px已经一致。修正应只调整欢迎内容的纵向定位，不改排版比例。

### 保留差异：登录面板接入邮箱密码

原型登录面板只有 GitHub 和 Google。当前页面根据昨天任务的已确认范围保留邮箱密码登录，并把 GitHub、Google 标为未开放。该差异来自真实业务能力，不能为了静态一致性删除。

## 单聊与群聊

### P0：单聊历史消息时间在前端转换时丢失

合同已提供 `createdAtMs`：

- `packages/contracts/src/chat/companion-chat.contract.ts:63`

但 `toUiMessage()` 只保留 `id`、`parts` 和 `role`：

- `apps/web/src/components/chat/companion-chat.tsx:299`

因此当前单聊无法显示原型中的气泡时间，也无法按日期插入“今天”等日期分隔。群聊已经直接使用 `createdAtMs` 显示时间。

### P1：消息细节不完整

原型消息区包含日期分隔、连续消息收起重复头像、三点输入状态、时间戳、hover 操作和复制按钮：

- `chat-single.html:148`
- `chat-single.html:151`
- `chat-single.html:164`
- `chat-single.html:186`
- `chat-group.html:132`
- `chat-group.html:189`
- `assets/moodmate.css:342`
- `assets/moodmate.css:348`
- `assets/moodmate.css:365`
- `assets/moodmate.css:386`

当前单聊只提供赞同和反对，加载状态是旋转图标加“正在回复”；没有日期分隔、历史时间、连续消息状态和复制。群聊有时间与发送者名，但没有日期分隔、连续消息状态、输入中的三点气泡和消息操作。

### P1：聊天头输入状态没有接入真实发送状态

原型单聊和群聊的标题下方显示带三点动画的“正在输入”：

- `chat-single.html:14`
- `chat-single.html:135`
- `chat-group.html:14`
- `chat-group.html:135`

当前单聊始终显示“在线”，群聊始终显示成员数量：

- `apps/web/src/components/chat/companion-chat.tsx:195`
- `apps/web/src/components/group-chat/group-chat-workspace.tsx:143`

单聊已有 `status`，可以在生成期间显示输入状态。群聊接口没有同等的实时输入状态，只能在群聊发言请求进行时展示本地等待状态。

### P1：输入区缺少原型工具入口

原型单聊输入区有表情、附件和发送；群聊有表情、@ 提及和发送：

- `chat-single.html:192`
- `chat-group.html:201`

当前单聊只保留 textarea 和发送/停止按钮；群聊保留 @ 候选逻辑，但没有可点击的 @ 入口和表情入口。没有后端能力的表情与附件按钮可保留视觉和 disabled 状态，不发起无效操作。

### P1：单聊信息栏内容不足

原型单聊信息栏包含“查看详情”“静音”、简介、关系阶段、相识天数、对话数、记得的内容和共享媒体：

- `chat-single.html:205`

当前只显示头像、名称、简介和消息数量：

- `apps/web/src/components/chat/chat-workspace.tsx:399`

可从现有数据得到的详情链接、消息数量应补齐；没有合同的相识天数和共享媒体不能伪造成真实数据，需按用户确认的静态内容范围处理。

### P1：群聊信息栏内容不足

原型群聊信息栏包含静音、编辑群组、群简介、成员、群主标记、消息免打扰和朋友依次发言：

- `chat-group.html:217`

当前保留群简介、成员、邀请和移除能力，但缺少头部操作、群主标记和群设置。编辑、移除、邀请等真实能力必须保留；没有合同的开关只能作为静态状态或 disabled 控件。

### P2：会话列表少一个“新对话”入口

原型列表头同时提供“新建群组”和“新对话”。当前只有“新建群聊”。朋友列表已经存在，可把新对话入口指向 `/friends`，不增加新弹层。

## 通讯录

### P1：朋友卡片点击区域和尾部信息偏离原型

原型整张卡片可点击，尾部只显示关系阶段与消息数量。当前只有名称和箭头进入详情，尾部增加编辑、删除和更新时间：

- `contacts.html:61`
- `apps/web/src/components/friends/friends-list.tsx:252`

编辑与删除是真实业务能力，不能移除。可以保持整卡进入详情，同时阻止操作按钮冒泡；更新时间没有原型依据，消息数量又缺少合同，需要确认静态内容边界后处理。

### P2：描述显示行数不同

原型朋友描述最多两行：`assets/mood																																																																																																																																																																																																																																							mate.css:529`。当前最多三行：`apps/web/src/components/moodmate/moodmate.css:2373`。这会让卡片高度和原型首屏密度不同。

## 朋友档案

### P1：原型实际渲染与 class 名冲突

`agent-detail.html:69` 使用 `grid-3`，但原型 CSS 没有定义该 class。1280x720 实际渲染为三张纵向通栏统计卡。当前 React 明确定义为三列统计卡。

这是本任务唯一不能从代码自行判断的产品选择：按实际原型还原会改成纵向通栏；按 class 名推断设计意图则保留当前三列。

### P2：示例数据提示改变了原型节奏

当前在统计区前显示“档案示例数据”，记忆区显示额外说明：

- `apps/web/src/components/friends/friend-detail.tsx:181`
- `apps/web/src/components/friends/friend-detail.tsx:228`

这些说明帮助区分真实数据和静态占位，但原型没有，增加了纵向高度。需与静态内容范围一起决定是否保留。

### P2：更多操作少“消息免打扰”

原型底部同时显示“消息免打扰”和“暂别这位朋友”：`agent-detail.html:146`。当前只有暂别按钮。没有后端合同的免打扰可作为 disabled 控件还原视觉。

## 设置

### P1：主题预览卡不能直接选择主题

原型两张主题卡都可点击，并同步选中边框：

- `settings.html:196`
- `settings.html:245`

当前主题卡是静态 `div`，另放一个主题切换按钮：

- `apps/web/src/components/settings/settings-panels.tsx:204`

应把卡片改为可访问的主题选择控件，并继续调用现有 Latte / Mocha 主题机制。

### P2：个人资料面板把原型可编辑控件改成只读或 disabled

原型昵称可编辑、保存修改可点击；当前昵称只读、保存 disabled。后端没有资料更新能力，本任务不应假装保存成功，但应保持原型控件尺寸和状态表达。

### P2：气泡紧凑模式被禁用

原型开关可演示切换，当前 disabled。这个设置没有持久化合同，可以像通用设置一样只在当前页面生效，并明确不影响真实数据。

### P2：真实记忆与主动关怀面板比原型更复杂

当前两个面板接入真实 API，包含编辑、停用、删除、计划配置、手动生成和历史记录。它们超出静态原型，但属于既有业务能力。实现只调整外围排版、控件样式和空状态，不删减功能。

## 验证限制

- 项目没有安装 Playwright，未新增依赖。
- 原型和当前公开首页已通过 Codex 内置浏览器检查。
- 登录后页面需要真实会话。规划阶段没有伪造本地会话或绕过守卫；实现阶段使用用户现有登录数据或本地 API 完成截图检查。
- `pnpm dev:web` 的 6153 端口已有 Web 进程监听，本轮没有替换该进程。
