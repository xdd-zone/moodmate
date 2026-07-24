# 用户反馈闭环 — 执行计划

迁移编号：**0011**（与另两个子任务错开：候选判断无迁移，主动关怀用 0012）。

## 顺序清单

### 1. 迁移 + schema

- [ ] 新建 `apps/api/migrations/0011_companion_message_feedbacks.sql`：建表 + 唯一索引 `(user_id, message_id)` + rating check 约束。
- [ ] `chat.schema.ts` 新增 `companionMessageFeedbacks` 表定义（沿用 index/check 风格）+ 推断类型 `CompanionMessageFeedbackRecord`。

### 2. contract

- [ ] `companion-chat.contract.ts` 新增：rating/reason/feedback schema、`SubmitCompanionMessageFeedbackRequestSchema`、`SubmitCompanionMessageFeedbackResponseSchema`；`CompanionConversationMessageSchema` 追加 `feedback: CompanionMessageFeedbackSchema.nullable()`；补 z.infer 类型。
- [ ] `packages/contracts/src/index.ts` 手动 re-export 新 schema + 类型。

### 3. repository

- [ ] `upsertCompanionMessageFeedback`（先查后 update/insert，保留 createdAtMs）。
- [ ] `findCompanionAssistantMessageForFeedback`（校验 assistant + completed + userId）。
- [ ] `listRecentCompanionMessageFeedbacks`（按 updatedAtMs desc + limit）。
- [ ] 会话/历史消息查询 left join 反馈表，带出 feedback 列（try/catch 容错）。

### 4. service + presenter

- [ ] `submitCompanionMessageFeedback` 编排：查消息 -> upsert -> 返回。
- [ ] presenter 消息映射带上 feedback。
- [ ] `prepareCompanionChat` 读取最近反馈；`getFeedbackSystemInstruction` 生成指令；`buildSystemPrompt` 新增 feedback 参数并按序 join。

### 5. route

- [ ] `POST /rpc/chat/companion/messages/:messageId/feedback`：`requireWebAccess` + param(messageId=uuid) + json(SubmitRequest) 校验，调 service，返回 SubmitResponse。

### 6. web

- [ ] `chat.api.ts` 新增 `submitCompanionMessageFeedback`。
- [ ] `chat.query.ts` 新增 mutation + 成功后 invalidate 会话 query。
- [ ] `chat-conversation.tsx`：历史 assistant 气泡下加点赞/点踩按钮（`ThumbsUp`/`ThumbsDown`，lucide 已在用），仅 `historicalAssistantMessageIdSet.has(id)` 的消息展示；带 aria-label；根据 feedback.rating 显示选中态。

## 验证命令

```bash
pnpm --filter @repo/api db:migrate:local   # 应用 0011
pnpm check-types
pnpm lint
```

按 AGENTS.md Execution Rules：不自动跑 dev server / 浏览器验证，交用户手动验收。

## 风险 / 回滚点

- `CompanionConversationMessageSchema` 加字段影响所有消息响应——改后先 check-types 全量过。
- left join 容错必须加，否则未迁移环境历史接口崩。
- 回滚：删迁移文件 + schema 表 + contract 字段 + route，纯增量易回退。

## 手动验收建议

- 应用迁移后，对一条 assistant 回复点赞，刷新页面选中态还在。
- 点赞切点踩，DB 中同一 `(user_id, message_id)` 仍是一条记录。
- 连续给几条负反馈后，下一轮回复风格有可感知调整，且回复中不出现"点赞/点踩/反馈"字样。
