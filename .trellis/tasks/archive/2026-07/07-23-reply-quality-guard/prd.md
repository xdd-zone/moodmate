# Reply Quality Guard

对应课程章节 `docs/temp/51-agent-chat-reply-quality-guard.txt`。父任务 `07-23-agent-chat-understanding`，第三个子任务。

## 目标

给聊天链路补一层回复后质检：LLM 回复生成完成后，按 Reply Policy 和固定规则检测这段回复是否超句数、追问过多、过早给建议、暴露内部标签、破坏沉浸感。第一版只记录不拦截，把结果写进 assistant 消息的 `metadata_json`。

## 前置

- 依赖 `07-23-reply-policy` 已产出 `ReplyPolicy` 和 `fallbackReplyPolicy`。
- assistant 消息落库入口在 `saveCompanionAssistantTurn`（`apps/api/src/modules/chat/chat.service.ts`），当前不写 metadata，本任务补上。

## 需求

### Schema（`packages/contracts/src/chat/companion-analysis.contract.ts`）

- 新增 `ReplyQualityGuardSchema`，字段按课程：
  - `status`: `pass` / `warn` / `fail`
  - `score`: 0-1
  - `sentenceCount` / `questionCount` / `adviceCount`: 非负整数
  - `violations`: 数组（最多 12），每项含 `code` / `severity`(low/medium/high) / `evidence`(max 160)
  - `code` 枚举照课程：`too_many_sentences`、`too_many_questions`、`too_many_suggestions`、`internal_label_leak`、`breaks_immersion`、`forbidden_lecture`、`forbidden_over_explain`、`forbidden_premature_advice`、`forbidden_intense_flirt`、`forbidden_diagnosis`、`forbidden_aggressive_siding`、`forbidden_pressure`、`forbidden_real_world_promise`
- 导出 `ReplyQualityGuard` 类型，从 `packages/contracts/src/index.ts` re-export。

### 质检实现（`apps/api/src/modules/chat/chat.analysis.ts`）

- `evaluateReplyQuality({ assistantText, replyPolicy })`：纯代码检测，不调 LLM。
  - 空文本返回 `fallbackReplyQualityGuard`。
  - 句数：超过 `replyPolicy.sentenceBudget.max` 记 `too_many_sentences`，超出 2 句以上记 high。
  - 问句：统计 `？` / `?`，超过 `questionLimit` 记 `too_many_questions`。
  - 建议：按建议型表达正则（`建议你`、`你可以`、`不妨`、`最好`、`应该`、`试着`、`尝试`、`可以先`）统计，超过 `adviceLimit` 记 `too_many_suggestions`。
  - 内部标签泄露：命中 `intent`、`emotion`、`route`、`policy`、`safety`、`replyPolicy`、`意图判断`、`情绪路由`、`回复策略`、`metadata` 记 `internal_label_leak`。
  - 沉浸感破坏：命中 `作为一个 AI`、`我只是 AI`、`我是语言模型`、`我没有真实情感`、`我没有身体` 等记 `breaks_immersion`。
  - forbidden moves：按 `replyPolicy.forbiddenMoves` 做对应检测（lecture / over_explain / premature_advice / intense_flirt / diagnose_user / take_sides_aggressively / pressure_to_disclose / promise_real_world_action）。
  - 分数：`Math.max(0, 1 - high*0.35 - medium*0.18 - low*0.08)`。
  - 状态：有 high 或 score < 0.5 为 `fail`，否则有违规为 `warn`，无违规为 `pass`。
  - 最终 `ReplyQualityGuardSchema.parse` 校验返回。
- 定义 `fallbackReplyQualityGuard`（status pass、score 1、计数 0、violations 空）。

### 落库（`chat.service.ts`）

- `saveCompanionAssistantTurn` 里，assistant 消息落库前调用 `evaluateReplyQuality`。
- 需要把本轮 `replyPolicy` 带进 `turn`（在 `prepareCompanionChat` 阶段塞入 `PreparedCompanionChat['turn']`）。
- 新增 `toAssistantReplyQualityMetadata({ replyPolicy, guard })`，写 `analysisVersion: 'reply-quality-guard-v1'`。
- `insertCompanionConversationMessage` 传入该 metadata（当前 assistant 落库未传 metadataJson，本任务补上）。

## 约束

- 第一版只记录不拦截、不重写、不二次生成，不增加 LLM 调用。
- 不新增 D1 迁移，复用 `metadata_json` 字段。
- 不改动流式输出主流程和用户可见回复。

## 完成标准

- [ ] `ReplyQualityGuardSchema` / 类型定义并从 contracts 导出。
- [ ] `evaluateReplyQuality` 覆盖句数、问句、建议、标签泄露、沉浸感、forbidden moves 六类检测。
- [ ] assistant 消息落库时写入 `reply-quality-guard-v1` metadata，含 replyPolicy 与 guard。
- [ ] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 通过。
