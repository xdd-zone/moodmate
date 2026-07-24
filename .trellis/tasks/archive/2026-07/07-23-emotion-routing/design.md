# 情绪路由 LangGraph 技术设计（章 49）

对应课程章节：`docs/temp/49-agent-chat-emotion-routing-langgraph.txt`
父任务：`07-23-agent-chat-understanding`

## 落地范围

只改 `apps/api` 和 `packages/contracts`，不改前端。分层沿用现有 chat 模块：schema 进 contracts，分析逻辑进 `chat.analysis.ts`，装配进 `chat.service.ts`，D1 读写进 `chat.repository.ts`。

## 一、前置基础：companion_profiles 表

课程分析器要 `agentName`、`agentGuardrails` 两个入参。moodmate 是单 companion、固定 system prompt，没有 Agent 实体。本任务新建一张挂在 userId 上的档案表，只存这两个（加少量）字段，够供分析器入参即可，不做管理 UI，不做多 Agent CRUD。

### 迁移文件

新增 `apps/api/migrations/0010_create_companion_profiles.sql`，紧接现有最大编号 0009。

```sql
-- Migration 0010: companion profile (name / persona / guardrails) per user

CREATE TABLE companion_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  persona TEXT,
  guardrails TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE UNIQUE INDEX companion_profiles_user_unique
  ON companion_profiles (user_id);
```

- 三个业务字段全部可空。缺省时分析器和 system prompt 用固定占位，不报错。
- `user_id` 唯一，和 `companion_conversations` 一样一个用户一条。
- 迁移只加表，不改已执行过的 migration。

### Drizzle schema

在 `apps/api/src/modules/chat/chat.schema.ts` 追加 `companionProfiles` 表定义和 `CompanionProfileRecord` 类型，风格照现有三张表（`sqliteTable` + `unique` + `check` 时间戳约束）。

### 读取逻辑

`chat.repository.ts` 加 `getCompanionProfile({ database, userId })`：按 userId 查一条，查不到返回 null。本任务不做写入接口（没有创建/编辑档案的入口需求），只读。缺省档案由 service 兜底，不在 repository 造空行。

### service 供给入参

`chat.service.ts` 的 `prepareCompanionChat` 里，和 `recentMessages`、`activeMemories` 并行读取 profile，解析成：

```ts
const agentName = profile?.displayName?.trim() || "MoodMate";
const agentGuardrails = profile?.guardrails?.trim() || null;
```

- `agentName` 缺省用 "MoodMate"（与现有 `COMPANION_SYSTEM_PROMPT` 自称一致）。
- `agentGuardrails` 缺省 null，分析 prompt 里显示"暂无"。
- persona 本章不注入 prompt（避免和固定 `COMPANION_SYSTEM_PROMPT` 冲突，留给后续需要时再接），只随档案存着。

## 二、contracts 新增 schema

文件：`packages/contracts/src/chat/companion-analysis.contract.ts`，末尾追加，并在 `packages/contracts/src/index.ts` re-export（type + schema）。

### ConversationEmotionSchema

字段与课程一致：

```ts
export const ConversationEmotionSchema = z.object({
  primaryEmotion: z.enum([
    "neutral",
    "happy",
    "tired",
    "lonely",
    "sad",
    "anxious",
    "angry",
    "jealous",
    "embarrassed",
    "affectionate",
    "playful",
    "confused",
    "disappointed",
    "stressed",
    "hurt",
  ]),
  secondaryEmotions: z.array(z.string().trim().min(1).max(40)).max(3),
  intensity: z.number().min(0).max(1),
  valence: z.enum(["positive", "neutral", "negative", "mixed"]),
  arousal: z.enum(["low", "medium", "high"]),
  needsComfort: z.boolean(),
  needsDeescalation: z.boolean(),
  needsClarification: z.boolean(),
  emotionalCue: z.string().trim().max(300),
  replyTone: z.enum([
    "light",
    "warm",
    "soft",
    "playful",
    "calm",
    "serious",
    "reassuring",
    "apologetic",
  ]),
});
```

### EmotionRouteSchema

```ts
export const EmotionRouteSchema = z.object({
  route: z.enum([
    "light_companion",
    "warm_comfort",
    "deep_comfort",
    "playful_flirt",
    "calm_deescalation",
    "relationship_repair",
    "gentle_clarification",
    "practical_support",
    "quiet_presence",
  ]),
  responseLength: z.enum(["very_short", "short", "medium", "long"]),
  shouldAskQuestion: z.boolean(),
  shouldGiveAdvice: z.boolean(),
  shouldUsePetName: z.boolean(),
  shouldMirrorEmotion: z.boolean(),
  routeGuidance: z.string().trim().max(600),
});
```

导出 `ConversationEmotion`、`EmotionRoute` 类型。

## 三、chat.analysis.ts 改动

### 兜底对象

```ts
const fallbackEmotion: ConversationEmotion = {
  primaryEmotion: "neutral",
  secondaryEmotions: [],
  intensity: 0.3,
  valence: "neutral",
  arousal: "medium",
  needsComfort: false,
  needsDeescalation: false,
  needsClarification: true,
  emotionalCue: "情绪识别暂时不可用，采用中性陪伴策略。",
  replyTone: "warm",
};

const fallbackEmotionRoute: EmotionRoute = {
  route: "gentle_clarification",
  responseLength: "short",
  shouldAskQuestion: true,
  shouldGiveAdvice: false,
  shouldUsePetName: false,
  shouldMirrorEmotion: false,
  routeGuidance: "先温和承接，再用一个轻问题确认用户想继续聊什么。",
};
```

### 情绪识别 prompt

新增 `conversationEmotionPrompt`，system 段沿用现有两个 prompt 的契约风格（显式列字段名、类型、枚举，要求"只返回 JSON、不要 markdown 代码块"）。这是必做项：DeepSeek 推理模型最终落 `jsonMode` 时不会喂 schema 结构，缺字段契约会自创字段导致 Zod 失败全程走兜底（见 companion-chat spec 第 8 节）。

human 段入参：agentName / agentGuardrails / safety / intent / activeMemories / recentMessages / userText。明确要求模型不回复用户、不做诊断。

现有 `formatSafetyForPrompt` 复用；新增 `formatIntentForPrompt(intent)` 把 intent 摘成文本（primary/userNeed/relationshipSignal 等关键字段），供情绪 prompt 使用。

### detectConversationEmotionWithLangChain

照现有 `classifyConversationIntentWithLangChain` 结构：

- `invokeConversationEmotionAnalysis`：`buildLangChainChatModel` + `withStructuredOutput(ConversationEmotionSchema)`，prompt.pipe(model).invoke，结果过 `ConversationEmotionSchema.parse` 再 `normalizeConversationEmotion`。
- 外层按现有 `STRUCTURED_OUTPUT_METHODS`（functionCalling → jsonSchema → jsonMode）逐个 try，全失败 `console.warn` 后回退 `normalizeConversationEmotion(fallbackEmotion, safety)`。

### normalizeConversationEmotion(emotion, safety)

代码治理层，规则照课程：

- 去重 + 去空 `secondaryEmotions`，slice(0,3)；`emotionalCue` 空则用 fallback 文案。
- safety.category === "self_harm" 或 safetyLevel === "crisis"：`intensity = max(intensity, 0.85)`、`valence = "negative"`、`arousal` low 提到 medium、`needsComfort = true`、`needsDeescalation = true`、`replyTone = "serious"`。
- safety.category === "emotional_dependency"：`needsComfort = true`，playful/light 语气收到 warm。
- `intensity >= 0.7 && valence === "negative"`：`needsComfort = true`。
- (angry || hurt) && arousal === "high"：`needsDeescalation = true`。

### buildEmotionRoute({ safety, intent, emotion })

纯代码规则，不调 LLM。分支顺序照课程严格执行：

1. `!intent && !emotion` → `fallbackEmotionRoute`。
2. 初始默认：route=`light_companion`、responseLength=`short`、shouldAskQuestion 取 `intent?.replyExpectation.shouldAskQuestion ?? false`、其余 false、routeGuidance 默认轻松延续文案。
3. `safety.boundaryAction === "soft_boundary"` → `calm_deescalation`，短、不追问、不建议、不镜像。
4. else if `emotion.needsDeescalation || primaryEmotion === "angry"` → conversation_repair/agent_feedback 走 `relationship_repair` 否则 `calm_deescalation`；短、relationship_repair 时追问、不建议、镜像。
5. else if `intent.primary === "conversation_repair" || "agent_feedback"` → `relationship_repair`，短、追问、不建议、negative 时镜像。
6. else if `intent.primary === "romantic_flirt" || emotion.primaryEmotion === "affectionate"` → `playful_flirt`，用昵称、镜像。
7. else if `intent.primary === "relationship_advice" || requestedAgentAction === "analyze_situation"` → needsComfort 走 `warm_comfort` 否则 `practical_support`；intensity>=0.65 时 medium；给建议；negative 镜像。
8. else if `emotion.needsComfort || valence === "negative"` → tired 或 companionship_presence 走 `quiet_presence`（very_short、不追问、不建议）否则 `warm_comfort`（short）；镜像。
9. 其余保持默认 `light_companion`。

routeGuidance 每个分支给对应的中文策略句（照课程文案）。

### LangGraph 图升级

`ConversationUnderstandingState` 新增 `emotion`、`route` 两个 Annotation（`ConversationEmotion | null` / `EmotionRoute | null`）。

现有图 `normalizeInput → classifyIntent → END` 扩展为：

```
normalizeInput → classifyIntent → detectEmotion → routeEmotion → END
```

- `detectEmotionNode`：normalizedInput 为空时返回 `normalizeConversationEmotion(fallbackEmotion, safety)`；否则调 `detectConversationEmotionWithLangChain`。
- `routeEmotionNode`：不调 LLM，返回 `buildEmotionRoute({ safety, intent, emotion })`。

### 对外入口

现有导出 `analyzeConversationIntent` 只返回 intent。新增 `analyzeConversationUnderstanding` 返回 `{ intent, emotion, route }`，跑完整图；catch 时构建兜底：intent=`normalizeConversationIntent(fallbackIntent, safety)`、emotion=`normalizeConversationEmotion(fallbackEmotion, safety)`、route=`buildEmotionRoute({ safety, intent, emotion })`。

`analyzeConversationIntent` 是否保留：service 改用 `analyzeConversationUnderstanding`，旧函数无其他调用方时删掉（只清本次相关死代码）。实现时 grep 确认调用方。

新增图入参 `agentName`、`agentGuardrails` 两个 Annotation，`intent` 节点当前不需要但情绪节点需要，统一从 state 取。

### getEmotionRouteSystemInstruction({ emotion, route })

emotion/route 任一为 null 返回空串。否则拼多行策略文本（主情绪、次要情绪、强度 toFixed(2)、valence、arousal、needsComfort、needsDeescalation、replyTone、route、responseLength、shouldAskQuestion、shouldGiveAdvice、shouldMirrorEmotion、routeGuidance），末句要求"把情绪路由作为回复策略：控制长度、语气和是否给建议，不要在回复中暴露这些标签"。

### metadata

`buildConversationAnalysisMetadata` 升级：`analysisVersion` 从 `conversation-analysis-v1` 改为 `conversation-understanding-v1`，新增 emotion、route 字段。入参加 `emotion`、`route`。

## 四、chat.service.ts 接线

- `prepareCompanionChat` 里 safety 通过（`boundaryResponse` 为空）后，把原来的 `analyzeConversationIntent` 换成 `analyzeConversationUnderstanding`，传 agentName / agentGuardrails / safety / activeMemories / recentMessages / userText / signal，拿到 `{ intent, emotion, route }`。boundaryResponse 存在时三者都为 null（安全优先，不进理解链路）。
- `buildSystemPrompt` 追加 `getEmotionRouteSystemInstruction({ emotion, route })`，顺序放在 intent 之后、长期记忆之前。
- user 消息落库 metadata 用升级后的 `buildConversationAnalysisMetadata({ safety, intent, emotion, route })`。
- profile 读取加入 `prepareCompanionChat` 开头的并行读取（`Promise.all` 里加 `getCompanionProfile`）。

## 五、验证

按项目 quality gate 顺序：

```
pnpm --filter api check-types
pnpm lint
pnpm format:check
```

迁移本地验证：

```
pnpm --filter api exec wrangler d1 migrations apply moodmate-local --local
pnpm --filter api exec wrangler d1 migrations list moodmate-local --local
```

功能判定（照 spec 第 8 节）：查 user 消息 `metadata_json`，`analysisVersion` 为 `conversation-understanding-v1`，emotion 的 `emotionalCue` 是贴合内容的具体文案而非兜底固定句，说明结构化输出真正生效。

## 六、不做

- multi-turn 情绪趋势、路由效果评估、A/B。
- companion_profiles 的管理 UI 和写入接口。
- persona 注入 prompt。
- 前端改动（关系阶段展示在章 52）。
