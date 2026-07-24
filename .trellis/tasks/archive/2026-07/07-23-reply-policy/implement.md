# Reply Policy 引擎执行计划（章 50）

对应设计：同目录 `design.md`
父任务：`07-23-agent-chat-understanding`
前置：`07-23-emotion-routing` 已落地（`EmotionRoute`、`fallbackEmotionRoute`、`ConversationEmotion`、`fallbackEmotion`、对话理解图、`analyzeConversationUnderstanding` 均已存在）

## 执行顺序

按依赖从下往上：contracts schema → analysis 规则 → analysis 图/入口/prompt/metadata → service 接线。每步能单独 check-types。

### 步骤 1：contracts 加 ReplyPolicySchema

文件 `packages/contracts/src/chat/companion-analysis.contract.ts` 末尾追加 `ReplyPolicySchema` 和 `ReplyPolicy` 类型（字段照 design 第一节，与课程一致）。

`packages/contracts/src/index.ts` 在现有 companion-analysis re-export 块补上 `ReplyPolicySchema`（schema）和 `ReplyPolicy`（type）。

验证：`pnpm --filter @repo/contracts check-types`（或根 `pnpm check-types`）。

### 步骤 2：analysis 加 Reply Policy 规则

在 `apps/api/src/modules/chat/chat.analysis.ts`：

1. import 补 `ReplyPolicySchema`、`ReplyPolicy`。
2. 加 `fallbackReplyPolicy`（照 design 取值）。
3. 加 `sentenceBudgetForRoute(route)`（four-way responseLength 映射）。
4. 加 `buildReplyPolicy({ safety, intent, emotion, route })`：
   - 三者全空返回 `fallbackReplyPolicy`。
   - `route ?? fallbackEmotionRoute`、`emotion ?? fallbackEmotion`，算 `sentenceBudget`。
   - 初始默认值（照 design 第三步）。
   - `switch (route.route)` 覆盖 7 个分支（design 表格），`light_companion`/`gentle_clarification` 无 case 保持默认。
   - switch 后处理 `memory_update`/`preference_setting` 覆盖为 memory_ack 并压句数。
   - 二次修正 4 条（safety、强负面、不追问、不建议）。
   - parse 前 `forbiddenMoves = [...new Set(forbiddenMoves)]` 去重防越界。
   - `ReplyPolicySchema.parse` 后返回。

验证：`pnpm --filter api check-types`。

### 步骤 3：analysis 图 / 入口 / prompt / metadata

同文件继续：

1. `ConversationUnderstandingState` 加 `replyPolicy` Annotation（`ReplyPolicy | null`）。
2. 加 `buildReplyPolicyNode`（不调 LLM，从 state 取 safety/intent/emotion/route，返回 `{ replyPolicy: buildReplyPolicy(...) }`）。
3. 图加节点和边：`routeEmotion → buildReplyPolicy → END`（把原 `routeEmotion → END` 改掉）。
4. `analyzeConversationUnderstanding` 返回体加 `replyPolicy`；catch 兜底分支在 intent/emotion/route 之后补 `replyPolicy: buildReplyPolicy({ safety, intent, emotion, route })`。
5. 加 `getReplyPolicySystemInstruction(replyPolicy)`（null 返回空串，否则拼策略文本，末句声明不是固定话术、不暴露标签）。
6. `buildConversationAnalysisMetadata`：版本升 `conversation-understanding-v2`，入参加 `replyPolicy`，输出加 `replyPolicy`。

验证：`pnpm --filter api check-types`。

### 步骤 4：service 接线

在 `apps/api/src/modules/chat/chat.service.ts`：

1. import 加 `getReplyPolicySystemInstruction`。
2. `analyzeConversationUnderstanding` 返回体解构 `replyPolicy`；boundaryResponse 存在时 `replyPolicy` 为 null。
3. `buildSystemPrompt` 在 `getEmotionRouteSystemInstruction` 之后追加 `getReplyPolicySystemInstruction(replyPolicy)`。
4. user 消息落库 metadata 改 `buildConversationAnalysisMetadata({ safety, intent, emotion, route, replyPolicy })`。
5. `PreparedCompanionChat['turn']` 加 `replyPolicy` 字段，`prepareCompanionChat` 装配 turn 时带上（供章 51 用，本任务只挂载落库）。

验证：`pnpm --filter api check-types`。

## 最终验证（quality gate 顺序）

```
pnpm --filter api check-types
pnpm lint
pnpm format:check
```

无 D1 迁移，不跑 wrangler。功能判定：本地发"今天好累，不想说话"，查 user 消息 `metadata_json`：

- `analysisVersion` == `conversation-understanding-v2`。
- `replyPolicy.policy` == `quiet_presence`，`questionLimit`/`adviceLimit` 都是 0。
- system prompt 含"本轮回复策略"段。

## 完成标准

- [ ] 步骤 1-4 全部落地并通过各自 check-types。
- [ ] `buildReplyPolicy` 覆盖 7 个 route 分支 + memory_ack 覆盖 + 4 条二次修正。
- [ ] 对话理解图含 `buildReplyPolicy` 节点，`analyzeConversationUnderstanding` 返回含 `replyPolicy`。
- [ ] system prompt 注入 Reply Policy，metadata 升到 `conversation-understanding-v2`。
- [ ] quality gate 三项全过。
