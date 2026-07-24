# 关系阶段系统执行计划（章 52）

对应设计：同目录 `design.md`
父任务：`07-23-agent-chat-understanding`
前置：`07-23-emotion-routing`、`07-23-reply-policy` 已落地（本任务要改它们产出的 `buildEmotionRoute`、`buildReplyPolicy`）。

## 执行顺序

按依赖从下往上：contracts → analysis（判断器 + 兜底 + 改 route/policy 入参 + 图 + metadata）→ service → web。每步能单独 check-types。

### 步骤 1：contracts 加 schema

文件 `packages/contracts/src/chat/companion-analysis.contract.ts` 末尾追加 `ConversationRelationshipStageSchema` 和 `ConversationRelationshipStage` 类型（字段照 design 第一节，与课程一致）。

`packages/contracts/src/index.ts` 在 companion-analysis re-export 块补上 schema + type。

验证：`pnpm --filter @repo/contracts check-types`（或根 `pnpm check-types`）。

### 步骤 2：analysis 判断器 + 兜底

在 `apps/api/src/modules/chat/chat.analysis.ts`：

1. import 新增 `ConversationRelationshipStageSchema`、`ConversationRelationshipStage`。
2. 加 `fallbackRelationshipStage`（照 design 取值）。
3. 加 `formatEmotionForPrompt(emotion)`（摘 primaryEmotion/intensity/valence/needsComfort 等）。
4. 加 `conversationRelationshipStagePrompt`（system 段照课程原文 + 显式列字段/枚举 + "只返回 JSON"；human 段入参含 agentName/agentGuardrails/messageCount/conversationSummary/safety/intent/emotion/activeMemories/recentMessages/userText）。
5. 加 `heuristicRelationshipStage`（照 design：memoryScore/historyScore/warmthScore 算 closenessScore，按阈值分档，各档给合理默认字段）。确认 `AnalysisMemory` 的 importance 字段名。
6. 加 `normalizeRelationshipStage(stage, { safety, intent, emotion, messageCount })`（三条产品规则照 design，顺序执行，末尾 parse）。
7. 加 `analyzeRelationshipStageWithLangChain`（`withStructuredOutput` + `STRUCTURED_OUTPUT_METHODS` 逐个 try，全失败走 `heuristicRelationshipStage` 再 `normalizeRelationshipStage`）。

验证：`pnpm --filter api check-types`。

### 步骤 3：analysis 改 route/policy + 图 + 返回体 + metadata

仍在 `chat.analysis.ts`：

1. `buildEmotionRoute` 入参加 `relationshipStage`，在原 9 条分支之后追加 3 条关系阶段强制修正（照 design；null 跳过；改路线时同步换 routeGuidance）。
2. `buildReplyPolicy` 入参加 `relationshipStage`，在原 switch + 二次修正之后、parse 之前追加 3 条关系阶段修正（照 design；null 跳过；forbiddenMoves 仍去重）。
3. `ConversationUnderstandingState` 加 `conversationSummary`、`messageCount`、`relationshipStage` 三个 Annotation。
4. 加 `analyzeRelationshipStageNode`；图顺序改为 `normalizeInput → classifyIntent → detectEmotion → analyzeRelationshipStage → routeEmotion → buildReplyPolicy → END`。`routeEmotionNode`、`buildReplyPolicyNode` 调 `buildEmotionRoute`/`buildReplyPolicy` 时传入 `state.relationshipStage`。
5. `analyzeConversationUnderstanding` 入参加 `conversationSummary`、`messageCount`；返回体加 `relationshipStage`；catch 兜底按 intent → emotion → relationshipStage → route → replyPolicy 顺序补齐，route/policy 兜底调用带 relationshipStage。
6. 加 `getRelationshipStageSystemInstruction(relationshipStage)`（照 design）。
7. `buildConversationAnalysisMetadata`：版本升 `conversation-understanding-v3`，入参 + 输出加 `relationshipStage`。

验证：`pnpm --filter api check-types`。

### 步骤 4：service 接线

在 `apps/api/src/modules/chat/chat.service.ts`：

1. import 加 `getRelationshipStageSystemInstruction`。
2. `prepareCompanionChat` 给 `analyzeConversationUnderstanding` 传 `conversationSummary`（会话 summary）、`messageCount`（会话 messageCount），来源为现有会话记录读取处。
3. 返回体解构 `relationshipStage`；boundaryResponse 存在时为 null。
4. `buildSystemPrompt` 追加 `getRelationshipStageSystemInstruction`，放情绪路由指令之后、reply-policy 指令之前（阶段影响 route，指令排 route 前）。
5. user 消息落库 metadata 用 `buildConversationAnalysisMetadata({ safety, intent, emotion, relationshipStage, route, replyPolicy })`。

验证：`pnpm --filter api check-types`。

### 步骤 5：web 单聊页头部展示

在 `apps/web/app/(app)/app`：

1. 加轻量映射函数（仅按 messageCount，阈值照 design：80 / 36 / 16 / 6 / 兜底）。
2. 先确认单聊页能拿到 `messageCount`（会话详情/初始化接口是否返回）；能拿到直接映射展示，拿不到再看已有接口字段可否透传，不新增业务 API。
3. 头部只显示阶段名文案，不显示分数/信任等级。

验证：`pnpm --filter web check-types`（或根 `pnpm check-types`）。

## 最终验证（quality gate 顺序）

```
pnpm check-types
pnpm lint
pnpm format:check
```

功能判定（照 design 第五节）：

- 新会话（messageCount < 6）发暧昧内容 → `relationshipStage.stage` == `new_connection`、`intimacyPermission` low，route 不进 `playful_flirt`。
- 发"你刚才一点都不懂我" → `relationshipStage.stage` == `repairing`、`pacing` == `repair_first`，route == `relationship_repair`，replyPolicy.openingMove == `apologize`。
- user 消息 `metadata_json` 的 `analysisVersion` == `conversation-understanding-v3`，含 relationshipStage。
- 单聊页头部显示对应阶段名。

## 完成标准

- [ ] 步骤 1-5 全部落地并通过各自 check-types。
- [ ] 关系阶段影响 `buildEmotionRoute` 和 `buildReplyPolicy`（三条强制修正 + 三条策略修正）。
- [ ] metadata 升到 v3，system prompt 注入关系阶段指令。
- [ ] 单聊页头部展示阶段名。
- [ ] quality gate 三项全过。
