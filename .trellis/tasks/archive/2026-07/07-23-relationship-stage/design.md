# 关系阶段系统技术设计（章 52）

对应课程章节：`docs/temp/52-agent-chat-relationship-stage-system.txt`
父任务：`07-23-agent-chat-understanding`
前置任务：`07-23-emotion-routing`（`EmotionRoute`、`buildEmotionRoute`）、`07-23-reply-policy`（`ReplyPolicy`、`buildReplyPolicy`）

## 落地范围

关系阶段是四个子任务里唯一同时改后端和前端的：

- `packages/contracts`：新增 `ConversationRelationshipStageSchema` 和类型。
- `apps/api`：LangChain 判断器 + 启发式兜底 + 产品规则兜底 + LangGraph 节点 + 改 `buildEmotionRoute` / `buildReplyPolicy` 入参 + prompt 注入 + metadata 升 v3 + service 传入会话统计。
- `apps/web`：单聊页头部展示关系阶段（轻量映射，仅按 `messageCount`）。

不加 D1 迁移：关系阶段是每轮动态结果，复用 `companionConversations.summary` 和 `messageCount` 作分析器入参，结果写进消息 metadata。

关系阶段放在情绪识别之后、情绪路由之前，既用意图和情绪做输入，又影响后续 route 和 policy。

## 一、contracts 新增 schema

文件 `packages/contracts/src/chat/companion-analysis.contract.ts` 末尾追加，字段照课程原文：

```ts
export const ConversationRelationshipStageSchema = z.object({
  stage: z.enum([
    "new_connection",
    "warming_up",
    "comfortable_chat",
    "trusted_companion",
    "close_bond",
    "repairing",
    "boundary_sensitive",
    "dependency_watch",
  ]),
  displayName: z.string().trim().min(1).max(80),
  closenessScore: z.number().int().min(0).max(100),
  trustLevel: z.enum(["low", "medium", "high"]),
  stability: z.enum([
    "new",
    "warming",
    "stable",
    "deepening",
    "fragile",
    "repairing",
  ]),
  boundaryMode: z.enum(["open", "warm", "careful", "firm"]),
  intimacyPermission: z.enum(["low", "medium", "high"]),
  pacing: z.enum(["slow_down", "hold", "advance_gently", "repair_first"]),
  riskSignals: z
    .array(
      z.enum([
        "low_history",
        "dependency_risk",
        "boundary_testing",
        "conflict",
        "pulling_away",
        "sexual_boundary",
        "emotional_volatility",
      ]),
    )
    .max(5),
  relationshipGuidance: z.string().trim().max(700),
});

export type ConversationRelationshipStage = z.infer<
  typeof ConversationRelationshipStageSchema
>;
```

`packages/contracts/src/index.ts` 在现有 companion-analysis re-export 块补上 schema 和 type。

## 二、chat.analysis.ts 改动

### 兜底对象

```ts
const fallbackRelationshipStage: ConversationRelationshipStage = {
  stage: "new_connection",
  displayName: "初识破冰",
  closenessScore: 20,
  trustLevel: "low",
  stability: "new",
  boundaryMode: "warm",
  intimacyPermission: "low",
  pacing: "hold",
  riskSignals: [],
  relationshipGuidance: "关系刚开始，保持自然友好，慢一点推进，不急于靠近。",
};
```

### 关系阶段判断 prompt

新增 `conversationRelationshipStagePrompt`，system 段照课程原文（不回复用户、只判断阶段；结合消息数量/摘要/最近对话/记忆/安全/意图/情绪；历史少即使语气亲密也不判深度亲密；出现误会/失望/冷淡/边界测试/依赖风险优先标 repairing / boundary_sensitive / dependency_watch）。system 段要显式列字段名、类型、枚举，要求只返回 JSON、不要 markdown 代码块（照 companion-chat spec 第 8 节，DeepSeek jsonMode 不喂 schema 会缺字段全走兜底）。

human 段入参：agentName / agentGuardrails / messageCount / conversationSummary / safety / intent / emotion / activeMemories / recentMessages / userText。

复用现有 `formatSafetyForPrompt`、`formatIntentForPrompt`（emotion-routing 已加）、`formatExistingMemories`、`formatRecentMessages`；新增 `formatEmotionForPrompt(emotion)` 把 emotion 摘成文本（primaryEmotion/intensity/valence/needsComfort 等关键字段）。

### analyzeRelationshipStageWithLangChain

照现有结构化输出模式：`buildLangChainChatModel` + `withStructuredOutput(ConversationRelationshipStageSchema)`，prompt.pipe(model).invoke，结果过 `ConversationRelationshipStageSchema.parse` 再 `normalizeRelationshipStage`。外层按 `STRUCTURED_OUTPUT_METHODS`（functionCalling → jsonSchema → jsonMode）逐个 try，全失败 `console.warn` 后走启发式兜底 `heuristicRelationshipStage`，再过 `normalizeRelationshipStage`。

### heuristicRelationshipStage（启发式兜底）

结构化输出失败时用，照课程原文算 closenessScore 再分档：

```ts
const memoryScore = Math.min(
  20,
  activeMemories.reduce((total, m) => total + m.importance, 0),
);
const historyScore = Math.min(70, Math.floor(messageCount * 1.6));
const warmthScore =
  intent?.relationshipSignal === "seeking_closeness" ||
  emotion?.primaryEmotion === "affectionate"
    ? 10
    : intent?.relationshipSignal === "warming_up" ||
        emotion?.primaryEmotion === "playful"
      ? 6
      : 0;
const closenessScore = Math.min(100, memoryScore + historyScore + warmthScore);
```

分档（照课程阈值，从高到低）：

- `messageCount >= 80 && closenessScore >= 75` → `close_bond`
- `messageCount >= 36 && closenessScore >= 58` → `trusted_companion`
- `messageCount >= 16 && closenessScore >= 38` → `comfortable_chat`
- `messageCount >= 6` → `warming_up`
- 否则 → `new_connection`

各档给对应 displayName / trustLevel / stability / boundaryMode / intimacyPermission / pacing / relationshipGuidance 的合理默认值（照阶段含义）。启发式产出的对象仍要过 `normalizeRelationshipStage`。

`m.importance` 字段名以 `AnalysisMemory` 现有类型为准，实现时确认（emotion-routing 已用 `formatExistingMemories`，字段应一致）。

### normalizeRelationshipStage(stage,)

产品规则兜底，照课程原文，三条修正按顺序执行：

1. `messageCount < 6 && !['boundary_sensitive','dependency_watch','repairing'].includes(stage.stage)` → 拉回 `new_connection`：displayName="初识破冰"、closenessScore=min(closenessScore, 35)、trustLevel="low"、stability="new"、intimacyPermission="low"、pacing="hold"。
2. `safety.category === 'emotional_dependency' || intent?.relationshipSignal === 'dependency_risk'` → 切 `dependency_watch`：displayName="依赖观察"、boundaryMode="careful"、intimacyPermission="low"、pacing="slow_down"。
3. `intent?.primary === 'conversation_repair' || intent?.relationshipSignal === 'conflict' || intent?.relationshipSignal === 'feeling_hurt' || emotion?.primaryEmotion === 'hurt' || emotion?.primaryEmotion === 'disappointed'` → 切 `repairing`：displayName="修复期"、pacing="repair_first"。

规范化后建议再过一次 `ConversationRelationshipStageSchema.parse` 保证结构合法。

### LangGraph 图升级

`ConversationUnderstandingState` 新增三个 Annotation：`conversationSummary`（`string | null`）、`messageCount`（`number`）、`relationshipStage`（`ConversationRelationshipStage | null`）。

图顺序从 emotion-routing + reply-policy 的
`normalizeInput → classifyIntent → detectEmotion → routeEmotion → buildReplyPolicy`
改为在 detectEmotion 和 routeEmotion 之间插入 analyzeRelationshipStage：

```
normalizeInput → classifyIntent → detectEmotion → analyzeRelationshipStage → routeEmotion → buildReplyPolicy → END
```

`analyzeRelationshipStageNode`：userText 取 `normalizedInput || normalizeStoredMessage(userText)`，调 `analyzeRelationshipStageWithLangChain`，返回 `{ relationshipStage }`。

### 改 buildEmotionRoute（emotion-routing 产物）

`buildEmotionRoute` 入参增加 `relationshipStage`（`ConversationRelationshipStage | null`）。在 emotion-routing 原有 9 条分支算出 route 之后，追加关系阶段强制修正（照课程原文，顺序在分支结果之后、返回之前）：

1. `relationshipStage.stage === 'repairing' || relationshipStage.pacing === 'repair_first'` → route=`relationship_repair`、responseLength=`short`、shouldAskQuestion=true、shouldGiveAdvice=false、shouldMirrorEmotion=true。
2. `relationshipStage.stage === 'boundary_sensitive' || 'dependency_watch' || boundaryMode === 'firm'` → route=`calm_deescalation`、responseLength=`short`、shouldAskQuestion=false、shouldGiveAdvice=false、shouldUsePetName=false。
3. `route === 'playful_flirt' && (stage === 'new_connection' || intimacyPermission === 'low')` → route=`light_companion`、responseLength=`short`、shouldUsePetName=false。

`relationshipStage` 为 null 时跳过这三条（兼容关系阶段未接入的调用路径）。routeGuidance 在被强制改路线时同步换成对应策略句。

### 改 buildReplyPolicy（reply-policy 产物）

`buildReplyPolicy` 入参增加 `relationshipStage`。在 reply-policy 原有 switch 分支和二次修正算完之后、`parse` 之前，追加关系阶段修正（照课程原文）：

1. `intimacyPermission === 'low'` → intimacyLevel="low"、forbiddenMoves push `'intense_flirt'`。
2. `pacing === 'slow_down'` → rhythm="soft"、forbiddenMoves push `'premature_advice'`、`'pressure_to_disclose'`、`'intense_flirt'`、questionLimit=min(questionLimit,1)、adviceLimit=min(adviceLimit,1)、sentenceBudget.max=min(sentenceBudget.max,3)。
3. `pacing === 'repair_first'` → policy=`relationship_repair`、rhythm="soft"、openingMove="apologize"、forbiddenMoves push `'intense_flirt'`、`'take_sides_aggressively'`、`'over_explain'`、adviceLimit=0、sentenceBudget.max=min(sentenceBudget.max,3)。

`relationshipStage` 为 null 时跳过。forbiddenMoves 仍在 parse 前去重（reply-policy 已加 `[...new Set()]`），保证不超 `.max(8)`。

### getRelationshipStageSystemInstruction(relationshipStage)

null 返回空串。否则拼多行文本（阶段 displayName+stage、亲近度 /100、信任等级、稳定性、边界模式、允许亲密度、推进节奏、风险信号、关系指导），末句"请把关系阶段作为隐性节奏控制：不要在回复中暴露阶段名称、分数或内部标签。"。文案风格对齐 `getEmotionRouteSystemInstruction`、`getReplyPolicySystemInstruction`。

### analyzeConversationUnderstanding 返回体

返回体从 reply-policy 的 `{ intent, emotion, route, replyPolicy }` 扩为 `{ intent, emotion, relationshipStage, route, replyPolicy }`。入参增加 `conversationSummary`、`messageCount`。

图执行失败的 catch 分支要按顺序补齐兜底：intent → emotion → relationshipStage(`normalizeRelationshipStage(fallbackRelationshipStage, ...)`) → route(`buildEmotionRoute({ safety, intent, emotion, relationshipStage })`) → replyPolicy(`buildReplyPolicy({ safety, intent, emotion, route, relationshipStage })`)。route 和 policy 的兜底调用要带上 relationshipStage。

### metadata

`buildConversationAnalysisMetadata`：`analysisVersion` 从 `conversation-understanding-v2`（reply-policy 定的）升到 `conversation-understanding-v3`，入参和输出新增 `relationshipStage` 字段。字段顺序：safety / intent / emotion / relationshipStage / route / replyPolicy。

> 版本号说明：reply-policy 已把 v2 占用为「含 replyPolicy、不含 relationshipStage」的字段集。本任务再加 relationshipStage 字段，字段集变化，故升 v3，避免回看数据时同名版本号字段集不一致。

## 三、chat.service.ts 接线

- `prepareCompanionChat` 给 `analyzeConversationUnderstanding` 传 `conversationSummary`（会话 summary）、`messageCount`（会话 messageCount）。两者来源：现有会话记录读取处已能拿到 `companionConversations` 记录，取其 `summary` 和 `messageCount`。
- `analyzeConversationUnderstanding` 返回体解构出 `relationshipStage`；boundaryResponse 存在时为 null。
- `buildSystemPrompt` 追加 `getRelationshipStageSystemInstruction(relationshipStage)`，顺序放在情绪路由指令之后、reply-policy 指令之前（对应链路 emotion → route → policy，阶段在 route 前判断，指令按理解顺序排）。实现时确认与课程 `getEmotionRouteSystemInstruction / getReplyPolicySystemInstruction` 的相对顺序：阶段影响 route，指令放 route 之前更贴合。
- user 消息落库 metadata 用 `buildConversationAnalysisMetadata({ safety, intent, emotion, relationshipStage, route, replyPolicy })`。

## 四、前端阶段展示（apps/web）

moodmate web 是单 companion 单聊页 `apps/web/app/(app)/app`，无 inbox 列表。课程的 `getInboxRelationshipStage` 是列表轻量映射，这里落到单聊页头部。

- 新增轻量映射函数（仅按 messageCount，照课程阈值）：`>= 80` 亲密连结、`>= 36` 稳定信任、`>= 16` 舒适陪伴、`>= 6` 升温熟悉、否则 初识破冰。
- 阶段名从会话接口已有的 `messageCount` 推导，不新增业务 API。实现时先确认单聊页当前能拿到 `messageCount`（会话详情/初始化接口是否返回该字段）；能拿到就直接映射展示，拿不到再看接口是否已有该字段可透传。
- 头部只展示阶段名文案，不展示分数、信任等级等内部指标（避免陪伴感变数值感）。真正影响回复的关系阶段以后端 LangGraph 判断为准，前端只是轻量提示。

## 五、验证

quality gate 顺序：

```
pnpm check-types
pnpm lint
pnpm format:check
```

无 D1 迁移。功能判定：

- 新会话（messageCount < 6）即使发暧昧内容，user 消息 metadata 的 `relationshipStage.stage` 应为 `new_connection`、`intimacyPermission` 为 low，且 route 不进 `playful_flirt`。
- 发"你刚才一点都不懂我"类内容，`relationshipStage.stage` 应为 `repairing`、`pacing` 为 `repair_first`，route 走 `relationship_repair`，replyPolicy 的 openingMove 为 `apologize`。
- user 消息 `metadata_json` 的 `analysisVersion` == `conversation-understanding-v3`，含 relationshipStage 字段。
- 单聊页头部显示与 messageCount 对应的阶段名。

## 六、不做

- 不新增 D1 迁移、不新增关系状态表（阶段进 metadata）。
- 不做阶段历史、阶段变更记录、主动消息、成长事件（课程"后续升级"里的方向）。
- 前端不展示分数/信任等级等内部指标，不做阶段可视化面板。
- 不改安全边界、意图判断、情绪识别的既有判断行为（关系阶段只新增，不改上游语义）。
