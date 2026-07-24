# Reply Policy 引擎技术设计（章 50）

对应课程章节：`docs/temp/50-agent-chat-reply-policy-engine.txt`
父任务：`07-23-agent-chat-understanding`
前置任务：`07-23-emotion-routing`（提供 `EmotionRoute`、`fallbackEmotionRoute`、`ConversationEmotion`、`fallbackEmotion`、对话理解图和 `analyzeConversationUnderstanding`）

## 落地范围

只改 `apps/api` 和 `packages/contracts`，不改前端，不加 D1 迁移。分层沿用 emotion-routing 已定的结构：schema 进 `packages/contracts/src/chat/companion-analysis.contract.ts`，规则和节点进 `apps/api/src/modules/chat/chat.analysis.ts`，接线进 `chat.service.ts`。

Reply Policy 是纯代码规则，不调 LLM。它接在情绪路由之后，把 `EmotionRoute` 转成本轮可执行的回复策略（句数、节奏、开场、允许/禁止动作、追问上限、建议上限、亲密度、风格文案）。

## 一、contracts 新增 schema

文件 `packages/contracts/src/chat/companion-analysis.contract.ts` 末尾追加，字段照课程原文：

```ts
export const ReplyPolicySchema = z.object({
  policy: z.enum([
    "quiet_presence",
    "warm_companion",
    "deep_empathy",
    "playful_flirt",
    "calm_boundary",
    "relationship_repair",
    "gentle_clarify",
    "practical_support",
    "roleplay_flow",
    "memory_ack",
  ]),
  sentenceBudget: z.object({
    min: z.number().int().min(1).max(8),
    max: z.number().int().min(1).max(8),
  }),
  rhythm: z.enum(["still", "soft", "natural", "lively", "focused"]),
  openingMove: z.enum([
    "acknowledge",
    "comfort",
    "mirror",
    "apologize",
    "play",
    "answer",
    "clarify",
    "set_boundary",
  ]),
  allowedMoves: z
    .array(
      z.enum([
        "validate_feeling",
        "mirror_emotion",
        "offer_presence",
        "ask_one_question",
        "give_one_suggestion",
        "give_two_suggestions",
        "light_tease",
        "use_pet_name",
        "repair_misunderstanding",
        "continue_roleplay",
        "acknowledge_memory",
        "set_soft_boundary",
      ]),
    )
    .max(6),
  forbiddenMoves: z
    .array(
      z.enum([
        "lecture",
        "over_explain",
        "multiple_questions",
        "premature_advice",
        "intense_flirt",
        "diagnose_user",
        "take_sides_aggressively",
        "pressure_to_disclose",
        "promise_real_world_action",
        "expose_internal_labels",
      ]),
    )
    .max(8),
  questionLimit: z.number().int().min(0).max(2),
  adviceLimit: z.number().int().min(0).max(3),
  intimacyLevel: z.enum(["low", "medium", "high"]),
  styleGuidance: z.string().trim().max(700),
});

export type ReplyPolicy = z.infer<typeof ReplyPolicySchema>;
```

`packages/contracts/src/index.ts` 在现有 companion-analysis re-export 块补上 `ReplyPolicySchema`（schema）和 `ReplyPolicy`（type）。

`allowedMoves` 上限 6、`forbiddenMoves` 上限 8：二次修正会往 `forbiddenMoves` push，写规则时保证任一分支叠加修正后不超上限。

## 二、chat.analysis.ts 改动

### 兜底对象

三者全空时的保守策略，照课程原文：

```ts
const fallbackReplyPolicy: ReplyPolicy = {
  policy: "gentle_clarify",
  sentenceBudget: { min: 1, max: 3 },
  rhythm: "soft",
  openingMove: "acknowledge",
  allowedMoves: ["validate_feeling", "ask_one_question"],
  forbiddenMoves: [
    "lecture",
    "over_explain",
    "multiple_questions",
    "premature_advice",
    "diagnose_user",
    "expose_internal_labels",
  ],
  questionLimit: 1,
  adviceLimit: 0,
  intimacyLevel: "medium",
  styleGuidance:
    "先轻轻接住用户，再只问一个低压力问题；不要讲大道理，不要连续追问。",
};
```

### sentenceBudgetForRoute(route)

把 `route.responseLength` 转成句数范围，照课程：

- `very_short` → `{ min: 1, max: 2 }`
- `short` → `{ min: 1, max: 3 }`
- `medium` → `{ min: 2, max: 5 }`
- 其余（`long`）→ `{ min: 3, max: 7 }`

### buildReplyPolicy({ safety, intent, emotion, route })

纯代码规则，不调 LLM。入参和 `buildEmotionRoute` 对齐，额外收 `route`。返回前用 `ReplyPolicySchema.parse` 校验。

**执行顺序（照课程严格执行）**：

1. `!intent && !emotion && !route` → 直接返回 `fallbackReplyPolicy`。
2. `route = route ?? fallbackEmotionRoute`、`emotion = emotion ?? fallbackEmotion`、`sentenceBudget = sentenceBudgetForRoute(route)`。
3. 初始默认：`policy=warm_companion`、`rhythm=natural`、`openingMove=acknowledge`、`allowedMoves=['validate_feeling']`、`forbiddenMoves=['lecture','over_explain','expose_internal_labels']`、`questionLimit = route.shouldAskQuestion ? 1 : 0`、`adviceLimit = route.shouldGiveAdvice ? 1 : 0`、`intimacyLevel=medium`、`styleGuidance=route.routeGuidance`。
4. 按 `route.route` 进入 switch 分支（见下）。
5. `intent?.primary === 'memory_update' || 'preference_setting'` → 覆盖为 `memory_ack` 分支（见下），压句数。
6. 二次修正（见下）。
7. `ReplyPolicySchema.parse` 后返回。

**route.route → policy 分支映射**：

| route.route | 分支 | 说明 |
| --- | --- | --- |
| `quiet_presence` | quiet_presence | 见下 |
| `warm_comfort` | warm_companion | 见下 |
| `deep_comfort` | deep_empathy | 见下 |
| `playful_flirt` | playful_flirt | 见下 |
| `calm_deescalation` | calm_boundary | 见下 |
| `relationship_repair` | relationship_repair | 见下 |
| `practical_support` | practical_support | 见下 |
| `light_companion` / `gentle_clarification` | 无 case | 保持初始默认（warm_companion） |

课程 EmotionRoute.route 有 9 个枚举值，Reply Policy switch 只覆盖 7 个。`light_companion`、`gentle_clarification` 不进 case，落初始默认。

各分支取值（照课程原文，`${route.routeGuidance}` 拼在 styleGuidance 前）：

- **quiet_presence**：`rhythm=still`、`openingMove=comfort`、allowed `['validate_feeling','offer_presence']`、forbidden `['lecture','over_explain','multiple_questions','premature_advice','pressure_to_disclose','expose_internal_labels']`、`questionLimit=0`、`adviceLimit=0`、`intimacyLevel=medium`、styleGuidance 追加"像安静坐在用户旁边一样回复，允许留白，不要努力把话题撑满。"。
- **warm_comfort → warm_companion**：`rhythm=soft`、`openingMove=comfort`、allowed `['validate_feeling','mirror_emotion','offer_presence']`、forbidden `['lecture','over_explain','multiple_questions','premature_advice','diagnose_user','expose_internal_labels']`、`adviceLimit=0`、styleGuidance 追加"先陪伴，再轻轻延续，不要急着解决问题。"。
- **deep_comfort → deep_empathy**：`rhythm=soft`、`openingMove=mirror`、allowed `['validate_feeling','mirror_emotion','offer_presence','ask_one_question']`、forbidden `['lecture','over_explain','multiple_questions','premature_advice','diagnose_user','pressure_to_disclose','expose_internal_labels']`、`questionLimit = route.shouldAskQuestion ? 1 : 0`、`adviceLimit=0`、`intimacyLevel=medium`、styleGuidance 追加"情绪承接要比建议更重要，语言可以更认真但不要沉重。"。
- **playful_flirt**：`rhythm=lively`、`openingMove=play`、allowed `['mirror_emotion','light_tease', ...(route.shouldUsePetName ? ['use_pet_name'] : [])]`、forbidden `['lecture','over_explain','intense_flirt','multiple_questions','expose_internal_labels']`、`questionLimit = (intent?.replyExpectation.shouldAskQuestion ?? route.shouldAskQuestion) ? 1 : 0`、`adviceLimit=0`、`intimacyLevel=high`、styleGuidance 追加"表达可以甜一点、轻一点，但不要露骨，不要油腻。"。
- **calm_deescalation → calm_boundary**：`rhythm=focused`、`openingMove = safety.boundaryAction === 'soft_boundary' ? 'set_boundary' : 'acknowledge'`、allowed `['validate_feeling','set_soft_boundary']`、forbidden `['lecture','over_explain','multiple_questions','take_sides_aggressively','premature_advice','expose_internal_labels']`、`questionLimit=0`、`adviceLimit=0`、`intimacyLevel=low`、styleGuidance 追加"语气要稳，不刺激用户，不站队扩大冲突。"。
- **relationship_repair**：`rhythm=soft`、`openingMove=apologize`、allowed `['validate_feeling','repair_misunderstanding','ask_one_question']`、forbidden `['lecture','over_explain','multiple_questions','take_sides_aggressively','expose_internal_labels']`、`questionLimit=1`、`adviceLimit=0`、`intimacyLevel=medium`、styleGuidance 追加"先修复用户体验，不要急着证明自己对。"。
- **practical_support**：`rhythm=focused`、`openingMove = emotion.needsComfort ? 'comfort' : 'answer'`、allowed `['validate_feeling', route.shouldGiveAdvice ? 'give_two_suggestions' : 'give_one_suggestion']`、forbidden `['lecture','over_explain','multiple_questions','diagnose_user','expose_internal_labels']`、`questionLimit = route.shouldAskQuestion ? 1 : 0`、`adviceLimit = emotion.needsComfort ? 1 : 2`、`intimacyLevel=medium`、styleGuidance 追加"建议要具体、少而可做，保持亲密朋友口吻。"。

**memory_ack 覆盖分支**（在 switch 之后，`intent.primary` 命中 `memory_update` / `preference_setting`）：

`policy=memory_ack`、`rhythm=soft`、`openingMove=acknowledge`、allowed `['acknowledge_memory']`、forbidden `['lecture','over_explain','multiple_questions','premature_advice','expose_internal_labels']`、`questionLimit=0`、`adviceLimit=0`、`intimacyLevel=medium`、`sentenceBudget.min=1`、`sentenceBudget.max = Math.min(sentenceBudget.max, 2)`、styleGuidance 换成"简短确认已经理解这条信息或偏好，不要展开成长篇解释。"。

**二次修正**（照课程原文，注意用 push 追加 forbidden，parse 前不去重也在 max 内）：

- `safety.boundaryAction !== 'continue'` → forbidden push `'intense_flirt'`、`'promise_real_world_action'`；`intimacyLevel='low'`。
- `emotion.intensity >= 0.75 && emotion.valence === 'negative'` → forbidden push `'intense_flirt'`、`'premature_advice'`；`rhythm = rhythm === 'lively' ? 'soft' : rhythm`。
- `!route.shouldAskQuestion` → forbidden push `'multiple_questions'`；`questionLimit=0`。
- `!route.shouldGiveAdvice` → forbidden push `'premature_advice'`；`adviceLimit=0`。

阈值用课程原文的 `0.75`（emotion-routing 的 `normalizeConversationEmotion` 内部另有 0.7 判定 needsComfort，两者不冲突：一个治理情绪，一个修正策略）。

forbidden push 可能产生重复项（如多个分支都含 `premature_advice`）。课程原文直接 push 不去重，`ReplyPolicySchema` 不含 unique 约束，重复不报错。为避免 `.max(8)` 越界，在 parse 前对 `forbiddenMoves` 去重（`[...new Set(forbiddenMoves)]`）。这是相对课程的一处稳健处理，不改变语义。

### LangGraph 图升级

`ConversationUnderstandingState` 新增 `replyPolicy` Annotation（`ReplyPolicy | null`）。

emotion-routing 的图 `normalizeInput → classifyIntent → detectEmotion → routeEmotion → END` 扩展为：

```
normalizeInput → classifyIntent → detectEmotion → routeEmotion → buildReplyPolicy → END
```

`buildReplyPolicyNode` 不调 LLM，返回 `{ replyPolicy: buildReplyPolicy({ safety, intent, emotion, route }) }`，入参全部从 state 取。

### analyzeConversationUnderstanding 返回体

返回体从 `{ intent, emotion, route }` 扩为 `{ intent, emotion, route, replyPolicy }`。图执行失败的 catch 分支在构建 `intent/emotion/route` 兜底后，追加 `replyPolicy: buildReplyPolicy({ safety, intent, emotion, route })`，保证上游失败时 Reply Policy 仍在。

### getReplyPolicySystemInstruction(replyPolicy)

`replyPolicy` 为 null 返回空串。否则拼多行策略文本（策略、句数范围、节奏、开场、亲密度、追问上限、建议上限、允许动作、禁止动作、风格指导），末句声明"这不是固定话术模板；请自然表达，但必须遵守以上策略约束，不要暴露策略名称或内部标签。"。文案风格对齐现有 `getIntentSystemInstruction`、`getEmotionRouteSystemInstruction`。

### metadata

`buildConversationAnalysisMetadata`：`analysisVersion` 从 `conversation-understanding-v1` 升到 `conversation-understanding-v2`，入参加 `replyPolicy`，输出新增 `replyPolicy` 字段。

## 三、chat.service.ts 接线

- import 加 `getReplyPolicySystemInstruction`。
- `analyzeConversationUnderstanding` 返回体解构出 `replyPolicy`；`boundaryResponse` 存在时 `replyPolicy` 为 null（安全优先，不进理解链路）。
- `buildSystemPrompt` 在 `getEmotionRouteSystemInstruction` 之后追加 `getReplyPolicySystemInstruction(replyPolicy)`。
- user 消息落库 metadata 用 `buildConversationAnalysisMetadata({ safety, intent, emotion, route, replyPolicy })`。
- `replyPolicy` 要透传给 assistant 落库供章 51 质检使用：在 `turn` 结构（`PreparedCompanionChat['turn']`）里加 `replyPolicy` 字段，`prepareCompanionChat` 装配时带上。本任务只负责把它挂到 turn 上并落库，assistant metadata 的质检写入是章 51 的事。

## 四、验证

quality gate 顺序：

```
pnpm --filter api check-types
pnpm lint
pnpm format:check
```

无 D1 迁移。功能判定：本地发一条"今天好累，不想说话"，查 user 消息 `metadata_json`：

- `analysisVersion` == `conversation-understanding-v2`。
- `replyPolicy.policy` == `quiet_presence`，`questionLimit` == 0，`adviceLimit` == 0，`forbiddenMoves` 含 `multiple_questions`、`premature_advice`。
- system prompt 注入含"本轮回复策略"段。

## 五、不做

- 不改安全边界、意图判断、情绪识别的既有行为。
- 不调 LLM 生成 policy（纯代码规则）。
- 不做后台调试面板、策略配置化、用户反馈闭环、效果评估（课程"后续演进"里的方向）。
- assistant metadata 的 reply-quality-guard 写入留给章 51。
- 前端不改。
