# 情绪路由 LangGraph 执行计划（章 49）

对应设计：同目录 `design.md`
父任务：`07-23-agent-chat-understanding`

## 执行顺序

按依赖从下往上：contracts schema → D1/schema/repository → analysis → service。每步能单独 check-types。

### 步骤 1：contracts 加 schema

文件 `packages/contracts/src/chat/companion-analysis.contract.ts` 末尾追加 `ConversationEmotionSchema`、`EmotionRouteSchema` 和两个 `z.infer` 类型（字段照 design 第二节，与课程一致）。

`packages/contracts/src/index.ts` 在现有 companion-analysis re-export 块里补上四个新导出（两个 schema + 两个 type）。

验证：`pnpm --filter @repo/contracts check-types`（或根 `pnpm check-types`）。

### 步骤 2：D1 迁移 + Drizzle schema + repository

1. 新增 `apps/api/migrations/0010_create_companion_profiles.sql`（SQL 照 design 第一节）。
2. `apps/api/src/modules/chat/chat.schema.ts` 追加 `companionProfiles` 表和 `CompanionProfileRecord` 类型，风格照现有三张表。
3. `apps/api/src/modules/chat/chat.repository.ts` 加 `getCompanionProfile({ database, userId })`，只读，查不到返回 null。

验证：
```
pnpm --filter api exec wrangler d1 migrations apply moodmate-local --local
pnpm --filter api exec wrangler d1 migrations list moodmate-local --local
pnpm --filter api check-types
```

### 步骤 3：analysis 情绪识别 + 路由

在 `apps/api/src/modules/chat/chat.analysis.ts`：

1. import 新增 `ConversationEmotionSchema/ConversationEmotion`、`EmotionRouteSchema/EmotionRoute`。
2. 加 `fallbackEmotion`、`fallbackEmotionRoute`（照 design 第三节取值）。
3. 加 `formatIntentForPrompt(intent)`。
4. 加 `conversationEmotionPrompt`（system 段显式列字段/枚举 + "只返回 JSON"，human 段入参含 agentName/agentGuardrails/safety/intent/activeMemories/recentMessages/userText，要求不回复不诊断）。
5. 加 `invokeConversationEmotionAnalysis` + `detectConversationEmotionWithLangChain`（复用 `STRUCTURED_OUTPUT_METHODS` 逐个 try，全失败回退 `normalizeConversationEmotion(fallbackEmotion, safety)`）。
6. 加 `normalizeConversationEmotion(emotion, safety)`（治理规则照 design）。
7. 加 `buildEmotionRoute({ safety, intent, emotion })`（分支顺序照 design，纯代码）。
8. `ConversationUnderstandingState` 加 `agentName`、`agentGuardrails`、`emotion`、`route` 四个 Annotation。
9. 加 `detectEmotionNode`、`routeEmotionNode`；图扩成 `normalizeInput → classifyIntent → detectEmotion → routeEmotion → END`。
10. 加 `analyzeConversationUnderstanding` 返回 `{ intent, emotion, route }`，catch 走三层兜底。
11. 加 `getEmotionRouteSystemInstruction({ emotion, route })`。
12. `buildConversationAnalysisMetadata` 升级：版本改 `conversation-understanding-v1`，入参加 emotion、route。
13. grep `analyzeConversationIntent` 调用方，确认只有 service 一处后，service 切换完成再删旧导出（只清本次相关死代码）。

验证：`pnpm --filter api check-types`。

### 步骤 4：service 接线

在 `apps/api/src/modules/chat/chat.service.ts`：

1. import 换成 `analyzeConversationUnderstanding`、`getEmotionRouteSystemInstruction`；`getIntentSystemInstruction`、`getSafetySystemInstruction`、`buildBoundaryResponse` 保留。
2. `prepareCompanionChat` 开头 `Promise.all` 里加 `getCompanionProfile`，解析 `agentName`/`agentGuardrails`（缺省照 design）。
3. safety 通过后用 `analyzeConversationUnderstanding` 拿 `{ intent, emotion, route }`；boundaryResponse 存在时三者 null。
4. `buildSystemPrompt` 追加 `getEmotionRouteSystemInstruction`，放 intent 之后、长期记忆之前。
5. user 消息落库改 `buildConversationAnalysisMetadata({ safety, intent, emotion, route })`。

验证：`pnpm --filter api check-types`。

## 最终验证（quality gate 顺序）

```
pnpm --filter api check-types
pnpm lint
pnpm format:check
```

功能判定：本地发一条消息，查 user 消息 `metadata_json`：
- `analysisVersion` == `conversation-understanding-v1`
- emotion.emotionalCue 是贴合内容的具体文案（非兜底固定句）
- route 分支符合输入（如"今天好累不想说话"应走 quiet_presence）

## 完成标准

- [ ] 步骤 1-4 全部落地并通过各自 check-types。
- [ ] 迁移本地 apply/list 成功。
- [ ] quality gate 三项全过。
- [ ] user 消息 metadata 为 v1 情绪版，结构化输出真实生效（非全程兜底）。
