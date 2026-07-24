# Reply Quality Guard 技术设计（章 51）

对应课程章节：`docs/temp/51-agent-chat-reply-quality-guard.txt`
父任务：`07-23-agent-chat-understanding`
前置任务：`07-23-reply-policy`（提供 `ReplyPolicy`、`fallbackReplyPolicy`）

## 落地范围

只改 `apps/api` 和 `packages/contracts`，不加 D1 迁移，不改前端。分层沿用现有 chat 模块：schema 进 `packages/contracts/src/chat/companion-analysis.contract.ts`，质检规则进 `apps/api/src/modules/chat/chat.analysis.ts`，落库接线进 `chat.service.ts`。

回复后质检：LLM 流式回复生成完成、assistant 消息落库前，按本轮 `ReplyPolicy` 和固定规则检测这段回复是否超句数、追问过多、过早给建议、暴露内部标签、破坏沉浸感、命中 forbidden move。第一版只记录不拦截、不重写、不二次生成，结果写进 assistant 消息 `metadata_json`。纯代码规则，不调 LLM。

## 一、contracts 新增 schema

文件 `packages/contracts/src/chat/companion-analysis.contract.ts` 末尾追加，字段照课程原文：

```ts
export const ReplyQualityGuardSchema = z.object({
  status: z.enum(["pass", "warn", "fail"]),
  score: z.number().min(0).max(1),
  sentenceCount: z.number().int().min(0),
  questionCount: z.number().int().min(0),
  adviceCount: z.number().int().min(0),
  violations: z
    .array(
      z.object({
        code: z.enum([
          "too_many_sentences",
          "too_many_questions",
          "too_many_suggestions",
          "internal_label_leak",
          "breaks_immersion",
          "forbidden_lecture",
          "forbidden_over_explain",
          "forbidden_premature_advice",
          "forbidden_intense_flirt",
          "forbidden_diagnosis",
          "forbidden_aggressive_siding",
          "forbidden_pressure",
          "forbidden_real_world_promise",
        ]),
        severity: z.enum(["low", "medium", "high"]),
        evidence: z.string().trim().max(160),
      }),
    )
    .max(12),
});

export type ReplyQualityGuard = z.infer<typeof ReplyQualityGuardSchema>;
```

`packages/contracts/src/index.ts` 在现有 companion-analysis re-export 块补上 `ReplyQualityGuardSchema`（schema）和 `ReplyQualityGuard`（type）。

## 二、chat.analysis.ts 改动

### 兜底对象

空文本（或异常）时的默认结果：

```ts
const fallbackReplyQualityGuard: ReplyQualityGuard = {
  status: "pass",
  score: 1,
  sentenceCount: 0,
  questionCount: 0,
  adviceCount: 0,
  violations: [],
};
```

### 辅助函数

- `normalizeStoredMessage(value)`：已存在（analysis 私有函数，把多空白压成单空格并 trim），直接复用。
- `countReplySentences(text)`：按中英文断句符（`。！？!?…` 以及换行）切句，过滤空段后计数。至少返回 1（非空文本）。
- `countPatternMatches(text, patterns)`：对一组全局正则累计 `match` 数量。
- `advicePatterns`：`[/建议你/g, /你可以/g, /不妨/g, /最好/g, /应该/g, /试着/g, /尝试/g, /可以先/g]`。
- `addReplyGuardViolation(violations, violation)`：push 一条违规，供各检测分支复用。

### evaluateReplyQuality({ assistantText, replyPolicy })

纯代码检测，不调 LLM。流程照课程原文：

1. `text = normalizeStoredMessage(assistantText)`；空文本返回 `fallbackReplyQualityGuard`。
2. `replyPolicy = replyPolicy ?? fallbackReplyPolicy`。
3. `sentenceCount = countReplySentences(text)`、`questionCount = countPatternMatches(text, [/？/g, /\?/g])`、`adviceCount = countPatternMatches(text, advicePatterns)`。
4. 逐类检测，命中记 violation：
   - **句数**：`sentenceCount > sentenceBudget.max` → `too_many_sentences`；超出 2 句以上（`> max + 2`）记 `high`，否则 `medium`。evidence 写"回复 N 句，超过策略上限 M 句。"。
   - **问句**：`questionCount > questionLimit` → `too_many_questions`，`medium`。evidence 写实际问句数与上限。
   - **建议**：`adviceCount > adviceLimit` → `too_many_suggestions`，`medium`。evidence 写实际建议表达数与上限。
   - **内部标签泄露**：命中 `intent`、`emotion`、`route`、`policy`、`safety`、`replyPolicy`、`意图判断`、`情绪路由`、`回复策略`、`metadata` 任一 → `internal_label_leak`，`high`。evidence 写命中的词。
   - **沉浸感破坏**：命中 `作为一个 AI`、`作为一个AI`、`我只是 AI`、`我只是AI`、`我是语言模型`、`我没有真实情感`、`我没有身体` 等 → `breaks_immersion`，`high`。evidence 写命中的句式。
   - **forbidden moves**：遍历 `replyPolicy.forbiddenMoves`，对下表覆盖的动作做对应文本检测，命中记对应 code。
5. `score = Math.max(0, 1 - highCount * 0.35 - mediumCount * 0.18 - lowCount * 0.08)`。
6. `status = highCount > 0 || score < 0.5 ? "fail" : violations.length > 0 ? "warn" : "pass"`。
7. `ReplyQualityGuardSchema.parse({ status, score, sentenceCount, questionCount, adviceCount, violations: violations.slice(0, 12) })` 后返回。

**forbidden move → code + 检测线索**（覆盖 8 个，其余 forbidden 枚举本版不检测）：

| forbiddenMove               | code                           | 文本线索（命中即记）                                                   |
| --------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `lecture`                   | `forbidden_lecture`            | `你要明白`、`你必须`、`正确的做法是`、`你应该要`                       |
| `over_explain`              | `forbidden_over_explain`       | 回复过长（句数明显超预算）或出现`之所以`、`原因是`、`具体来说`密集堆叠 |
| `premature_advice`          | `forbidden_premature_advice`   | `adviceCount > 0`（策略已禁建议却出现建议型表达）                      |
| `intense_flirt`             | `forbidden_intense_flirt`      | `想你`、`爱你`、`亲亲`、`抱紧`、`宝贝` 等强暧昧表达                    |
| `diagnose_user`             | `forbidden_diagnosis`          | `你这是`、`你有点`、`你可能得了`、`焦虑症`、`抑郁症`                   |
| `take_sides_aggressively`   | `forbidden_aggressive_siding`  | `他就是`、`绝对是对方的错`、`你没错都是他`                             |
| `pressure_to_disclose`      | `forbidden_pressure`           | `你倒是说啊`、`到底怎么了`、`必须告诉我`                               |
| `promise_real_world_action` | `forbidden_real_world_promise` | `我帮你去`、`我会到`、`我明天见你`、`我打电话给`                       |

线索表是启发式关键词，命中判定尽量保守（宁可漏报不误报）：短关键词用 `includes`，避免对正常表达误伤。severity 按课程默认给 `medium`，`internal_label_leak` / `breaks_immersion` 给 `high`。实现时线索词列表可在这份表基础上按需增删，但 code 枚举和 severity 档次固定。

### 与理解链路的关系

Reply Quality Guard 不进 LangGraph 图（它在回复生成之后跑）。它是 `chat.analysis.ts` 里一个独立导出的纯函数，由 service 在 assistant 落库前调用。不改 `analyzeConversationUnderstanding` 的返回体。

## 三、chat.service.ts 接线

### replyPolicy 透传到 turn

Reply Quality Guard 需要本轮 `ReplyPolicy`。reply-policy 任务已在 `PreparedCompanionChat['turn']` 里挂上 `replyPolicy` 字段（见 reply-policy 设计第三节）。本任务直接消费该字段。

若接手时 turn 上还没有 `replyPolicy`（reply-policy 尚未落地或未挂全），需先在 `prepareCompanionChat` 把 `replyPolicy` 塞进 turn。实现时先确认 turn 类型上是否已有该字段。

### saveCompanionAssistantTurn 落库

现状：`saveCompanionAssistantTurn` 里 assistant 消息落库未传 `metadataJson`（见 `chat.service.ts`，assistant `insert` 调用当前无 metadata）。本任务补上：

1. assistant 回复文本准备好、落库前，调 `evaluateReplyQuality({ assistantText: <回复文本>, replyPolicy: input.turn.replyPolicy })`。
2. 新增 `toAssistantReplyQualityMetadata({ replyPolicy, guard })`（放 `chat.analysis.ts`，风格照 `buildConversationAnalysisMetadata`）：

```ts
export function toAssistantReplyQualityMetadata(params: {
  replyPolicy: ReplyPolicy | null;
  guard: ReplyQualityGuard;
}) {
  return JSON.stringify({
    analysisVersion: "reply-quality-guard-v1",
    replyPolicy: params.replyPolicy,
    guard: params.guard,
  });
}
```

3. assistant 落库的 `insert`（`chat.repository.ts` 现有的 assistant 消息写入函数）传入该 `metadataJson`。确认落库函数签名支持 `metadataJson`；`companion_conversation_messages` 已有 `metadata_json` 字段，无需迁移。

### assistant 回复文本来源

要确认 `saveCompanionAssistantTurn` 能拿到最终回复全文（流式结束后的拼接结果）。若当前签名里没有回复文本，需从调用方把流式累计的 assistant 文本传进来。实现时先读 service 里流式回复落库的实际路径，确认文本入口，再决定是加 turn 字段还是加函数入参。

## 四、验证

quality gate 顺序：

```
pnpm --filter api check-types
pnpm lint
pnpm format:check
```

无 D1 迁移。功能判定：本地发消息触发一次回复，查 assistant 消息 `metadata_json`：

- `analysisVersion` == `reply-quality-guard-v1`。
- 含 `replyPolicy` 和 `guard` 两个对象。
- `guard.sentenceCount` / `questionCount` / `adviceCount` 与回复实际内容吻合；无违规时 `status` 为 `pass`、`score` 为 1。
- 构造一条超句数回复（策略上限低、回复长），确认 `violations` 含 `too_many_sentences` 且 `status` 变 `warn` 或 `fail`。

## 五、不做

- 不拦截、不重写、不二次生成回复（第一版只记录）。
- 不增加 LLM 调用（纯代码规则，不引入 LangChain evaluator）。
- 不新增 D1 迁移、不新增质量日志表。
- 不改流式输出主流程和用户可见回复。
- 不做后台调试面板、质量统计报表（课程"后续升级"里的方向）。
