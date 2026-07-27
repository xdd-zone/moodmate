# @ 提及功能 — 执行计划

## 有序清单

1. **共享识别函数**（`group-chat.reply.ts`）
   - 新增导出 `findExplicitlyMentionedAgents(agents, userText)`：对每个 agent 用 `@${escapedName}(?=\s|[,.!?，。！？、]|$)`（`i` 标志）测试；昵称先做正则转义 `name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`。
   - 改 `selectAgentsForReply`：把现在的 `normalized.includes(agent.name)`（38-41 行）替换为 `const mentioned = findExplicitlyMentionedAgents(agents, userText)`，命中即 `slice(0, groupReplyAgentLimit)` 返回（保留现有点名优先分支位置）。

2. **调度前置覆盖**（`group-chat.orchestration.ts`）
   - `selectAgentsNode`（1149 行）在算出 `intent` 之后、调 `selectGroupAgentsWithLangChain` 之前插入前置覆盖：
     ```
     const mentioned = findExplicitlyMentionedAgents(state.agents, state.userText);
     if (mentioned.length > 0) {
       const picked = mentioned.slice(0, groupReplyAgentLimit);
       return {
         selection: {
           selectedAgentIds: picked.map((a) => a.agentId),
           mode: picked.length > 1 ? "multi_serial" : "single",
           reason: "用户在消息中显式提及了 Agent。",
         },
         selectedAgents: picked,
       };
     }
     ```
   - import `findExplicitlyMentionedAgents`（已从 reply.ts 导出，`selectAgentsForReply` 同处 import）。
   - 不动 `selectionFromLocalRules` / `runFallbackOrchestration`：它们内部已走 `selectAgentsForReply`，改共享函数后自动生效。

3. **前端提及组件**（新文件 `apps/web/src/components/group-chat/mention-textarea.tsx`）
   - `getMentionContext(value, cursor)`：`beforeCursor.match(/(^|\s)@([^\s@]*)$/)`，返回 `{ start, end, query }` 或 `null`。
   - props：`value` / `onChange(value)` / `onSend()` / `members: AgentGroupChatMember[]` / `disabled`。
   - 内部 state：`mentionContext` / `mentionIndex`；`ref` 拿 textarea 读 `selectionStart`。
   - `mentionCandidates`：`useMemo`，无 query 返回全体 active 成员，有 query 按 `name` + `headline` 小写 `includes` 过滤。
   - `insertMention(member)`：`value.slice(0,start) + "@" + member.name + " " + value.slice(end)`，清 `mentionContext`。
   - `handleKeyDown`：菜单开且有候选时 ArrowDown/Up 移 `mentionIndex`、Enter/Tab 插入并 `preventDefault`、Escape 关；否则 Enter（非 shift）触发 `onSend`。
   - 浮层：绝对定位 `<div>` 在输入区上方，候选项 `<Bot>` + `bg-primary/12` 头像色块（同 MessageBubble）、`name`、`headline`、右侧灰字 `@name`；`onMouseDown` `preventDefault` 防失焦，`onClick` 插入。无候选显示「没有匹配的群成员」。
   - 切群 / 发送 / Escape 关闭菜单。

4. **接入 workspace**（`group-chat-workspace.tsx`）
   - 输入区 textarea（356-364 行）换成 `<MentionTextarea value={draft} onChange={setDraft} onSend={handleSend} members={detail.members.filter(m => m.status === "active")} disabled={sendMutation.isPending} />`。
   - 删掉原 `handleKeyDown`（逻辑迁进组件），`handleSend` 保留在 workspace（组件通过 `onSend` 回调）。
   - 发送按钮 `canSend` / `onClick` 逻辑不变。

5. **spec 更新**（`.trellis/spec/api/backend/group-chat.md`）
   - 补 `findExplicitlyMentionedAgents` 严格 `@昵称` 边界识别 + 调度前置覆盖优先级说明。

## 验证命令

```bash
pnpm --filter @repo/api exec tsc --noEmit
pnpm --filter @repo/web exec tsc --noEmit
pnpm --filter @repo/api lint
pnpm --filter @repo/web lint
pnpm exec prettier --check "apps/api/src/modules/group-chat/**/*.ts" "apps/web/src/components/group-chat/**/*.tsx"
```

（先查根 `package.json` / turbo 是否有 `type-check` / `lint` / `format` 脚本，有则优先用项目脚本。）

## 风险点 / 回滚

- **正则转义遗漏**：昵称含 `.` `+` `(` 等未转义会破坏正则或误匹配。转义函数必测含特殊字符的昵称。
- **收紧识别的行为变更**：从 `includes` 改严格 `@` 后，「不打 @ 直接说名字」不再算点名。这是有意变更（prd R1 已确认），但要确认现有测试/使用方无依赖旧宽松行为。
- **Enter 语义冲突**：菜单打开时 Enter 必须插入而非发送，菜单关闭时 Enter 发送。`handleKeyDown` 分支要覆盖菜单开且无候选的边界（此时 Enter 应正常发送还是吞掉 — 采用无候选则不拦截，走发送）。
- **失焦丢草稿**：候选项必须 `onMouseDown` preventDefault，否则点击时 textarea 失焦、`selectionStart` 失效。
- **多提及顺序**：`findExplicitlyMentionedAgents` 按 `agents` 数组顺序（displayOrder）返回，非按消息中出现顺序。prd 已接受此表现。

## start 前检查

- design.md / implement.md / 两个 jsonl 真实条目就位。
- 与父任务全局约束一致（硬上限 groupReplyAgentLimit=3、越权、降级原则）。
- 确认前端 `AgentGroupChatMember` 无 `avatarColor` 字段，头像走 `<Bot>` 色块方案。
