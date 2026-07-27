# @ 提及功能

## Goal

给 Agent 群聊加 @ 提及：前端输入框键入 `@` 弹出当前群成员候选浮层，支持鼠标 + 键盘选择，选中后把 `@昵称` 写进消息正文；服务端在调度前识别 `@昵称` 显式提及，被提及的 Agent 一定优先回复，且不被 LangGraph 智能调度覆盖。全程复用现有消息文本，不改群聊消息契约。

对应草稿：`docs/temp/61`（bobo 单文件写法，落点按 moodmate 模块化映射）。

## Background

群聊编排已是 LangGraph 图 `classifyIntent -> detectEmotion -> selectAgents -> generateReplies -> generateCrossReplies -> checkQuality`（前 5 个子任务已归档）。这是父任务 `07-25-agent-group-chat` 的第 6 个也是最后一个子任务。

### 现状落点（moodmate 实际 vs 草稿 bobo）

| 维度 | 草稿(bobo) | moodmate 实际 |
| --- | --- | --- |
| 前端输入 | `apps/web/app/(dashboard)/group-chats/page.tsx` | 内联在 `apps/web/src/components/group-chat/group-chat-workspace.tsx` 的 textarea（356-364 行，`onChange` 直接 `setDraft`）|
| 服务端识别 | `apps/api/src/routes/chat/group.route.ts` | `apps/api/src/modules/group-chat/group-chat.reply.ts`（`selectAgentsForReply`）+ `group-chat.orchestration.ts`（`selectAgentsNode`）|
| 成员字段 | `member.name` / `member.headline` | `AgentGroupChatMember`：`name` / `headline`(nullable) / `imageKey`(nullable) / `displayOrder`；无 `avatarColor` |

### 现状识别逻辑（要升级的点）

- `selectAgentsForReply`（reply.ts:38-45）现在用**无边界 includes**：`normalized.includes(agent.name.toLowerCase())`。即消息里出现名字即算提及，不需要 `@`，且会把子串误命中（如「小明」命中「小明明」）。
- `selectAgentsNode`（orchestration.ts:1149-1170）**没有**显式提及前置覆盖，直接走 `selectGroupAgentsWithLangChain`（内部失败才回退 `selectionFromLocalRules`）。正常流程下 LLM 调度结果会盖掉用户点名意图。
- `groupReplyAgentLimit = 3`（reply.ts:17）；`GroupChatAgentSelectionSchema.mode` 枚举为 `single | multi_serial | multi_parallel`。

## Requirements

### R1 服务端严格 @ 识别（共享函数）
- 新增共享函数 `findExplicitlyMentionedAgents(agents, userText)`：只识别 `@昵称`，昵称后须是空白、标点或文本结尾。正则 `@${escapedName}(?=\s|[,.!?，。！？、]|$)`，`i` 忽略大小写；昵称先做正则特殊字符转义。
- 放在 `group-chat.reply.ts` 导出，供 reply 与 orchestration 两条路径共用，避免正则逻辑漂移。
- 取代 `selectAgentsForReply` 里现有的无边界 `includes` 提及分支。

### R2 fallback 路径接严格识别
- `selectAgentsForReply`（reply.ts）的点名分支改用 `findExplicitlyMentionedAgents`，命中则 `slice(0, groupReplyAgentLimit)` 返回，点名优先不变。
- 无 @ 命中时，后续群体提问 / 打分排序逻辑保持不变。

### R3 正常路径调度前置覆盖
- `selectAgentsNode`（orchestration.ts）在调用 `selectGroupAgentsWithLangChain` **之前**先跑 `findExplicitlyMentionedAgents(state.agents, state.userText)`。
- 命中则构造 `GroupChatAgentSelectionSchema`：`selectedAgentIds` 取被提及 Agent 的 id（`slice(0, groupReplyAgentLimit)`），`mode` 为 1 人时 `single`、多人时 `multi_serial`，`reason` 记「用户在消息中显式提及了 Agent」；直接返回 `{ selection, selectedAgents }`，不进 LLM 调度。
- 保证 @ 的 Agent 一定优先、不被智能调度覆盖，且 LangGraph 失败时点名仍有效（R2 已覆盖 fallback）。

### R4 前端提及输入组件
- 抽独立组件 `apps/web/src/components/group-chat/mention-textarea.tsx`，替换 workspace 内联 textarea；对外暴露 `value` / `onChange` / `onSend` / `members` / `disabled` 等 props。
- `getMentionContext(value, cursor)`：解析光标前最后一个独立 `@` 片段（`@` 须在文本开头或空白符后，正则 `(^|\s)@([^\s@]*)$`），返回 `{ start, end, query }` 或 `null`。避免把 `name@example.com` 之类识别成提及。
- 候选来自当前群 active 成员；只输入 `@` 展示全体，继续输入按 `name` + `headline` 过滤（`toLowerCase().includes`）。
- `insertMention`：只替换当前 `@查询词` 区间为 `@昵称 `（含尾随空格），保留前后文本；支持一条消息多个提及。
- 键盘交互：菜单打开且有候选时，ArrowDown/Up 移动选中项、Enter/Tab 插入当前项（不发送）、Escape 关菜单；其余状态 Enter 仍走发送。鼠标候选项 `onMouseDown` 调 `preventDefault()` 防 textarea 失焦，`onClick` 插入。
- 候选项展示：`imageKey` 头像（沿用现有头像渲染方式）、`name`、`headline`、将插入的 `@昵称` 文本。
- 切换群聊、点击快捷提示、提交消息、按 Escape 时关闭菜单，避免旧浮层残留。
- 无匹配成员时显示「没有匹配的群成员」，不阻止发送。

## Acceptance Criteria

- [ ] 服务端只把 `@昵称`（带边界）当显式提及；不打 `@` 或子串命中不再算点名。
- [ ] `findExplicitlyMentionedAgents` 为 reply 与 orchestration 共用的单一实现，昵称含正则特殊字符不报错。
- [ ] 正常流程下 @ 的 Agent 一定进本轮回复，不被 LangGraph 智能调度覆盖；提及多人按消息匹配顺序取前 `groupReplyAgentLimit` 个。
- [ ] LangGraph 整图或选择节点失败时，点名 Agent 仍优先（fallback 路径也走严格识别）。
- [ ] 不提及任何成员时，保留原有智能调度 / 打分行为。
- [ ] 前端输入 `@` 弹出全体成员；输入片段实时按昵称 + 简介过滤。
- [ ] 鼠标点击、方向键 + Enter、方向键 + Tab 三种方式都能选中候选。
- [ ] 连续提及两名成员，两个 `@昵称` 都正确插入正文。
- [ ] 手动输入 `@昵称`（不经候选菜单）同样被服务端识别。
- [ ] @ 已移除 / 不存在的名字时，服务端识别为空，退回正常调度，消息照常发送。
- [ ] 切换群聊、加载更早消息、发送消息后提及浮层不残留。
- [ ] 前端不改群聊消息契约；`SendAgentGroupChatMessageRequest` 无新增字段。
- [ ] 通过类型检查 → lint → format。

## Out of Scope

- 给 `SendAgentGroupChatMessageRequest` 新增提及字段（文本已携带提及信息）。
- 群聊消息契约变更。
- @ 无效名字时的用户提示（消息照发、走正常调度即可）。
- 引入补全 / Popover / Command 类新 UI 依赖（`packages/ui` 无，手写浮层）。

## Notes

- 硬上限沿用父任务：每轮最多 `groupReplyAgentLimit = 3` 个 Agent，提及超过 3 个按匹配顺序 `slice(0, 3)`。
- 草稿 `docs/temp/61` 的代码片段作为逻辑与命名参考，路径以本 PRD 落点映射为准。
