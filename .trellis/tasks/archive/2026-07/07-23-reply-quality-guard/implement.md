# Reply Quality Guard 执行计划（章 51）

对应设计：同目录 `design.md`
父任务：`07-23-agent-chat-understanding`
前置：`07-23-reply-policy` 已产出 `ReplyPolicy`、`fallbackReplyPolicy`，并在 `PreparedCompanionChat['turn']` 挂上 `replyPolicy`。

## 执行顺序

按依赖从下往上：contracts schema → analysis 质检函数 → service 落库。每步能单独 check-types。

### 步骤 0：确认前置

1. grep `ReplyPolicy` / `fallbackReplyPolicy` 确认 reply-policy 已落地（contracts 有导出、analysis 有兜底对象）。没落地就先停，等 reply-policy 完成。
2. 读 `chat.service.ts` 的 `saveCompanionAssistantTurn`，确认三件事：
   - assistant 落库能拿到最终回复全文（流式结束后的拼接文本）。拿不到就要从调用方把累计文本传进来。
   - `turn` 上是否已有 `replyPolicy` 字段（reply-policy 应已挂）。没有则先补。
   - assistant 落库用的 repository 写入函数签名是否支持 `metadataJson`。

### 步骤 1：contracts 加 schema

文件 `packages/contracts/src/chat/companion-analysis.contract.ts` 末尾追加 `ReplyQualityGuardSchema` 和 `ReplyQualityGuard` 类型（字段照 design 第一节，与课程一致）。

`packages/contracts/src/index.ts` 在 companion-analysis re-export 块补上 `ReplyQualityGuardSchema`（schema）+ `ReplyQualityGuard`（type）。

验证：`pnpm --filter @repo/contracts check-types`（或根 `pnpm check-types`）。

### 步骤 2：analysis 质检函数

在 `apps/api/src/modules/chat/chat.analysis.ts`：

1. import 新增 `ReplyQualityGuardSchema`、`ReplyQualityGuard`。
2. 加 `fallbackReplyQualityGuard`（照 design）。
3. 加辅助函数：`countReplySentences`、`countPatternMatches`、`advicePatterns`、`addReplyGuardViolation`（`normalizeStoredMessage` 已存在，复用）。
4. 加 `evaluateReplyQuality({ assistantText, replyPolicy })`（六类检测、score、status、`ReplyQualityGuardSchema.parse`，照 design 第二节）。
5. 加 `toAssistantReplyQualityMetadata({ replyPolicy, guard })`，`analysisVersion: 'reply-quality-guard-v1'`，风格照 `buildConversationAnalysisMetadata`。

验证：`pnpm --filter api check-types`。

### 步骤 3：service 落库接线

在 `apps/api/src/modules/chat/chat.service.ts`：

1. import 加 `evaluateReplyQuality`、`toAssistantReplyQualityMetadata`。
2. 若步骤 0 发现 turn 上没有 `replyPolicy` 或拿不到回复全文，先补齐入口。
3. `saveCompanionAssistantTurn` 里 assistant 落库前：
   - `const guard = evaluateReplyQuality({ assistantText: <回复全文>, replyPolicy: input.turn.replyPolicy })`。
   - assistant 消息落库的 `insert` 传入 `metadataJson: toAssistantReplyQualityMetadata({ replyPolicy: input.turn.replyPolicy, guard })`。

验证：`pnpm --filter api check-types`。

## 最终验证（quality gate 顺序）

```
pnpm --filter api check-types
pnpm lint
pnpm format:check
```

功能判定：本地发消息触发回复，查 assistant 消息 `metadata_json`：

- `analysisVersion` == `reply-quality-guard-v1`。
- 含 `replyPolicy` 和 `guard` 两个对象。
- `guard` 的 sentenceCount / questionCount / adviceCount 与回复实际内容吻合；无违规时 status=pass、score=1。
- 构造超句数场景（策略上限低、回复长），确认 `violations` 含 `too_many_sentences`、status 变 warn/fail。

## 完成标准

- [ ] 步骤 0-3 全部落地并通过各自 check-types。
- [ ] assistant 消息 metadata 写入 `reply-quality-guard-v1`，含 replyPolicy + guard。
- [ ] quality gate 三项全过。
- [ ] 不改流式主流程和用户可见回复；无 D1 迁移。
