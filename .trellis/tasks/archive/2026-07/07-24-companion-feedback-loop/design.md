# 用户反馈闭环 — 技术设计

## 边界与落点

改动分布在四层，全部沿用 moodmate 现有分层与命名：

| 层            | 文件                                                               | 改动                                                                                                                |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 迁移          | `apps/api/migrations/0011_companion_message_feedbacks.sql`（新建） | 建反馈表 + 唯一索引                                                                                                 |
| schema        | `apps/api/src/modules/chat/chat.schema.ts`                         | 新增 `companionMessageFeedbacks` 表定义 + 推断类型                                                                  |
| contract      | `packages/contracts/src/chat/companion-chat.contract.ts`           | 新增 rating/reason/feedback schema，`CompanionConversationMessageSchema` 加 feedback 字段，新增提交请求/响应 schema |
| contract 导出 | `packages/contracts/src/index.ts`                                  | 手动 re-export 新 schema 与类型                                                                                     |
| repository    | `apps/api/src/modules/chat/chat.repository.ts`                     | 新增 upsert 反馈、list 最近反馈、消息查询 left join 反馈                                                            |
| service       | `apps/api/src/modules/chat/chat.service.ts`                        | 新增提交反馈编排、反馈注入 prompt、读取最近反馈                                                                     |
| presenter     | `apps/api/src/modules/chat/chat.presenter.ts`                      | 消息映射带上 feedback                                                                                               |
| route         | `apps/api/src/modules/chat/chat.route.ts`                          | 新增 POST feedback 端点                                                                                             |
| web api       | `apps/web/src/api/chat.api.ts` + `chat.query.ts`                   | 新增 submitFeedback 调用 + mutation                                                                                 |
| web ui        | `apps/web/src/components/chat/chat-conversation.tsx`               | assistant 气泡下加点赞/点踩按钮                                                                                     |

## 数据模型

```sql
CREATE TABLE companion_message_feedbacks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES companion_conversations(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES companion_conversation_messages(id) ON DELETE CASCADE,
  rating TEXT NOT NULL,            -- positive | negative
  reason TEXT,
  note TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
CREATE UNIQUE INDEX companion_message_feedbacks_user_message_unique
  ON companion_message_feedbacks(user_id, message_id);
```

- 无 agentId：moodmate 单伴侣模型，反馈唯一键是 `(user_id, message_id)`。
- 沿用 schema 现有约束风格（`check` 约束校验 rating enum，与现有表一致）。
- drizzle 变量 `companionMessageFeedbacks`，推断类型 `CompanionMessageFeedbackRecord`。

## Contract 设计

```ts
export const CompanionMessageFeedbackRatingSchema = z.enum([
  "positive",
  "negative",
]);
export const CompanionMessageFeedbackReasonSchema = z.enum([
  "good_tone",
  "helpful",
  "warm",
  "remembered_context",
  "bad_tone",
  "too_long",
  "too_cold",
  "too_pushy",
  "wrong_memory",
  "unsafe",
  "other",
]);
export const CompanionMessageFeedbackSchema = z.object({
  rating: CompanionMessageFeedbackRatingSchema,
  reason: CompanionMessageFeedbackReasonSchema.nullable(),
  note: z.string().nullable(),
  updatedAtMs: z.number().int().nonnegative(),
});
// CompanionConversationMessageSchema 追加：
//   feedback: CompanionMessageFeedbackSchema.nullable()
export const SubmitCompanionMessageFeedbackRequestSchema = z.object({
  rating: CompanionMessageFeedbackRatingSchema,
  reason: CompanionMessageFeedbackReasonSchema.optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});
export const SubmitCompanionMessageFeedbackResponseSchema = z.object({
  feedback: CompanionMessageFeedbackSchema,
});
```

`CompanionConversationMessageSchema` 加 `feedback` 字段后，`CompanionConversationResponseSchema` / `CompanionConversationMessagesResponseSchema` 自动带上，前端历史回显无需额外结构。

## 数据流

### 提交反馈

```
POST /rpc/chat/companion/messages/:messageId/feedback (requireWebAccess)
  -> findCompanionAssistantMessageForFeedback(userId, messageId)
       校验 role=assistant && status=completed && userId 匹配
       不存在 -> AppError(COMMON_NOT_FOUND, 404)
  -> upsertCompanionMessageFeedback(先查后 update/insert，保留 createdAtMs)
  -> 返回 feedback
```

### 历史回显

`getCompanionConversation` / `getCompanionConversationMessages` 的消息查询 left join `companion_message_feedbacks`（`userId + messageId`），presenter 组装 feedback 字段。沿用现有 presenter 映射风格。

### Prompt 注入

`prepareCompanionChat` 内，在组装 system prompt 前读取最近反馈：

```
listRecentCompanionMessageFeedbacks(userId, limit)  -- 按 updatedAtMs desc
  -> getFeedbackSystemInstruction(feedbacks)
       空 -> ""
       非空 -> "近期用户对回复的反馈：\n<格式化>\n请把正向反馈视为用户偏好风格，
               把负向反馈视为需要避免的问题；不要在回复中提到评分、点赞、点踩或反馈记录。"
```

注入位置：`buildSystemPrompt` 新增一个 feedback 参数，在 `getReplyPolicySystemInstruction` 之后、记忆列表之前 join。保持 `.filter(Boolean).join("\n")` 风格，空指令自动省略。

## 复用与一致性

- upsert 沿用 moodmate 现有"先查后 update/insert"风格（参考 repository 中同类写法），保留 `createdAtMs`。
- left join 沿用 `listCompanionMemories` 已有的 leftJoin 写法（`chat.repository.ts:172`）。
- route 校验错误沿用 `invalidRequest` + `AppError(BizCode.COMMON_NOT_FOUND, ...)` 风格。
- web mutation 沿用 `chat.query.ts` 的 TanStack Query 封装；提交成功后 invalidate 会话 query 回显选中态。

## 兼容性

- 新表、新字段、新端点，纯增量。老会话消息 feedback 为 null，前端正常显示无选中态。
- feedback left join 用 try/catch 容错：若某环境未跑 0011 迁移，历史消息接口不应整体崩（沿用 moodmate 现有对增强表的容错思路）。

## 风险点

- messageId 时序：只对 `historicalAssistantMessageIds`（服务端持久化）消息展示按钮，避开流式临时 ID。前端已有此区分能力。
- prompt 膨胀：限制注入条数（建议 limit=5），只取 rating + 简短原因，不塞全文。
