# @ 提及功能 — 技术设计

## 边界与总体思路

文本兼容方案：提及信息只以 `@昵称` 文本形态存在于消息正文，不新增契约字段。前端负责输入补全把 `@昵称` 写进 draft；服务端从消息文本里识别 `@昵称`，在调度前置覆盖被提及的 Agent。消息契约、乐观更新、历史分页、落库全部零改动。

依赖方向：前端 `mention-textarea.tsx` 自包含（只吃 members + draft）；服务端 `findExplicitlyMentionedAgents` 抽到 `group-chat.reply.ts` 作共享函数，`selectAgentsForReply`（fallback）与 `selectAgentsNode`（LLM 前置）都调它，避免正则逻辑漂移。

## 服务端

### findExplicitlyMentionedAgents（新，group-chat.reply.ts）

```ts
export function findExplicitlyMentionedAgents(
  agents: GroupChatMemberWithAgentRow[],
  userText: string,
): GroupChatMemberWithAgentRow[] {
  return agents.filter((agent) => {
    const escaped = agent.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`@${escaped}(?=\\s|[,.!?，。！？、]|$)`, "i");
    return pattern.test(userText);
  });
}
```

- 昵称先做正则转义（昵称可能含 `()+` 等特殊字符）。
- 边界断言 `(?=\s|[标点]|$)`：`@小明` 命中，`@小明明` 里的 `@小明` 不命中后续没有边界的情况按 lookahead 处理 —— `@小明明` 中 `@小明` 后面是「明」不是边界，不命中；`@小明明` 会作为整体命中 `小明明` 那个 Agent。
- 只在传入的 active 成员里匹配，已移除/不存在的名字返回空。

### selectAgentsForReply 改造（group-chat.reply.ts:38-45）

把现状无边界 `includes` 替换为调 `findExplicitlyMentionedAgents`：

```ts
const mentioned = findExplicitlyMentionedAgents(agents, userText);
if (mentioned.length > 0) {
  return mentioned.slice(0, groupReplyAgentLimit);
}
```

后续群体提问打分逻辑不变。

### selectAgentsNode 前置覆盖（group-chat.orchestration.ts:1149-1170）

在调 `selectGroupAgentsWithLangChain` 之前插入显式提及拦截：

```ts
const mentioned = findExplicitlyMentionedAgents(state.agents, state.userText);
if (mentioned.length > 0) {
  const selected = mentioned.slice(0, groupReplyAgentLimit);
  const selection = GroupChatAgentSelectionSchema.parse({
    selectedAgentIds: selected.map((agent) => agent.agentId),
    mode: selected.length > 1 ? "multi_serial" : "single",
    reason: "用户在消息中显式提及了 Agent。",
  });
  return { selection, selectedAgents: selected };
}
```

- 命中即返回，跳过 LLM 调度，保证不被智能调度覆盖。
- `mode`：单个 `single`，多个 `multi_serial`（串行补充，与草稿一致）。
- `selectedAgentIds` 用 `agentId`（与 schema 里 LLM 返回的 id 口径一致，参考 selectionFromLocalRules 的映射）。
- 前置覆盖会跳过 speakingContext 打分 —— 这是「点名优先于智能调度」的预期语义。

### 两条 fallback 路径

`selectionFromLocalRules`（节点内兜底）与 `runFallbackOrchestration`（整图失败）都经 `selectAgentsForReply`，已自动获得严格 `@` 识别，无需单独改。

## 前端

### mention-textarea.tsx（新，components/group-chat/）

对外 props：

```ts
type MentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  members: AgentGroupChatMember[];
  disabled?: boolean;
};
```

内部状态与逻辑：

- `getMentionContext(value, cursor)`：正则 `/(^|\s)@([^\s@]*)$/` 解析光标前最后一个独立 `@` 片段，返回 `{start, end, query}` 或 null。`@` 须在开头或空白后，`name@example.com` 不触发。
- state：`mentionContext`、`mentionIndex`。
- `mentionCandidates`：`useMemo`，无 query 显示全体 members，有 query 按 `name` + `headline` 大小写不敏感过滤。
- `insertMention(member)`：只替换 `[start, end)` 区间为 `@昵称 `（尾随空格），保留前后文本，支持一条消息多个提及。插入后调 `onChange` 并需同步更新光标位置。
- 键盘（仅在浮层打开且有候选时消费）：ArrowDown/Up 移动 `mentionIndex`，Enter/Tab 插入当前项（不发送），Escape 关闭浮层；其他情况 Enter 走原发送逻辑。
- 鼠标候选项 `onMouseDown` 调 `preventDefault()` 防 textarea 失焦，`onClick` 插入。
- 候选浮层：绝对定位 `<div>` 在输入框上方，每项复用现有头像样式（`grid size-8 place-items-center rounded-full bg-primary/12 text-primary` + `<Bot>`），展示昵称 + headline + 将插入的 `@昵称`。无匹配显示「没有匹配的群成员」。

### workspace 接入

`group-chat-workspace.tsx` 输入区（356-364 行）的内联 `<textarea>` + 发送逻辑，改为 `<MentionTextarea value={draft} onChange={setDraft} onSend={handleSend} members={activeMembers} disabled={sendMutation.isPending} />`。`handleSend`/`handleKeyDown` 里 Enter 发送逻辑迁进组件（Enter 在浮层未打开时才发送）。`members` 传 active 成员（`detail.members.filter(status==="active")`）。

## 兼容边界

- 无契约变更：`SendAgentGroupChatMessageRequest` 不加字段，`@昵称` 随 message 文本走。
- 手打 `@昵称` 不依赖候选菜单也能被服务端识别。
- 提及已移除成员 / 不存在名字：`findExplicitlyMentionedAgents` 匹配不到返回空，退回正常智能调度（等于没 @）。
- 切换群聊、提交消息、Escape 都关闭浮层，防旧浮层残留。

## 风险点

- 光标位置同步：`insertMention` 后需把 textarea 光标移到插入的空格之后，否则连续提及体验断裂。用 ref + `setSelectionRange`（`useEffect` 或 `requestAnimationFrame` 里执行，因 React 受控更新后 DOM 才更新）。
- 边界正则的中文标点：断言含全角 `，。！？、`，需覆盖常见中文场景。
- `agentId` vs `id`：selection schema 用的 id 口径要和 selectionFromLocalRules 保持一致（用 `agentId`），否则 selectedAgents 映射不上。
