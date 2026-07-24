# 用户反馈闭环

## Goal

让用户能对某条 MoodMate 回复点赞/点踩，把这份显式偏好稳定持久化、历史回显，并注入下一轮 system prompt，让后续回复在不暴露内部标签的前提下向用户偏好校准。对应 docs/temp/54。

这是"偏好记事本"式的轻量闭环：不做评分体系、不做模型微调、不自动改写人设，只做"把用户对具体回复的显式喜欢/不喜欢带回下一轮"。

## Background（已确认事实）

moodmate 现状（来自代码调研）：

- 单用户单会话模型：`companion_conversations.user_id` unique，无 agentId 维度。反馈按 `(userId, messageId)` 唯一，不需要 agentId。
- 消息表 `companion_conversation_messages`（`chat.schema.ts:44`）：role enum(user/assistant)、status enum(completed/failed)、`metadataJson`。
- contract `CompanionConversationMessageSchema`（`companion-chat.contract.ts:37`）当前**无 feedback 字段**，需新增。
- 历史消息读取：`getCompanionConversation` / `getCompanionConversationMessages`（`chat.service.ts`），经 `presentCompanionConversationMessage`（`chat.presenter.ts`）映射为 contract。
- 聊天生成入口：`prepareCompanionChat`（`chat.service.ts:200`）组装 `messages`，system prompt 由 `buildSystemPrompt`（`chat.service.ts:402`）按序 join 各 `getXxxSystemInstruction`。反馈指令要加进这条链路。
- web 端消息渲染：`chat-conversation.tsx` 已区分 `historicalAssistantMessageIds`（服务端持久化消息）与流式临时消息。反馈按钮只挂在持久化 assistant 消息下——这解决了"流式刚结束时消息 ID 是临时 ID、后端找不到"的问题。
- REST 封装：`apps/web/src/api/chat.api.ts`（http + contract 校验）、`chat.query.ts`（TanStack Query options）。
- 迁移编号从 0011 起。本子任务占用 **0011**（若与其他子任务并行，以各自 implement.md 分配为准）。

## Requirements

- R1：新增 D1 表 `companion_message_feedbacks`，一条记录对应一个用户对一条 assistant 消息的反馈。`(user_id, message_id)` 唯一索引，切换点赞/点踩时 upsert 更新而非新增。
- R2：新增反馈枚举 contract：rating（positive/negative）、reason（good_tone/helpful/warm/remembered_context/bad_tone/too_long/too_cold/too_pushy/wrong_memory/unsafe/other）。`CompanionConversationMessageSchema` 增加 `feedback` 字段（nullable）。
- R3：新增提交反馈接口 `POST /rpc/chat/companion/messages/:messageId/feedback`，requireWebAccess。校验：message 必须是当前用户、assistant 角色、status=completed；upsert 落库。
- R4：历史消息读取时 left join 反馈表，回显 rating/reason/note/updatedAtMs；刷新页面或加载更早历史都能还原点赞/点踩状态。
- R5：聊天生成前读取最近 N 条反馈，格式化为 system 指令注入 `buildSystemPrompt`。指令必须包含"不要在回复中提到评分、点赞、点踩或反馈记录"，保护沉浸感。
- R6：web 端在持久化 assistant 消息气泡下展示点赞/点踩按钮，提交后本地即时反映选中态；只对 `historicalAssistantMessageIds` 中的消息展示按钮。
- R7：反馈闭环不得绕过安全边界、意图判断、回复策略——只在既有策略之上追加一层偏好校准。

## Acceptance Criteria

- [ ] 迁移 0011 建 `companion_message_feedbacks` 表 + `(user_id, message_id)` 唯一索引，`chat.schema.ts` 同步。
- [ ] 对同一条消息先点赞再点踩，库中仍是一条记录，rating 从 positive 更新为 negative。
- [ ] 提交对非 assistant / 非 completed / 他人消息的反馈返回 404 或 400，不落库。
- [ ] 刷新页面后，已反馈的消息气泡仍显示对应点赞/点踩选中态。
- [ ] 提交反馈后，下一轮回复的 system prompt 中包含最近反馈摘要（可通过日志或抓 prompt 验证），且回复不出现"点赞/点踩/反馈"字样。
- [ ] `pnpm check-types`、`pnpm lint` 通过。

## Out of Scope

- 不做模型微调、人设自动改写、复杂评分体系。
- 不做负反馈二级原因弹窗（reason 字段先留接口，UI 仅点赞/点踩两个按钮）。
- 不做多条反馈归纳为偏好画像、质量守卫复盘联动。
- 不做撤销反馈能力（v1 只支持切换 rating）。
- 不做通过流式响应回传 assistant messageId 让刚生成的回复立即可反馈（沿用"仅持久化消息可反馈"）。
