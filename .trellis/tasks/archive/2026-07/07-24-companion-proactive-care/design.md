# 主动关怀系统 — 技术设计

## 架构边界

主动关怀不是独立通知系统，而是聊天系统的一种消息来源。核心约束：生成关怀时，除写 `companion_care_events`，必须写入 `companion_conversation_messages`，这样它才能自然出现在聊天历史，也能被后续记忆、摘要、反馈等系统复用。

四层：contract（enum + schema）→ schema/migration（两表）→ repository（计划/事件 CRUD + 已读标记）→ service（生成编排 + 文案模板）→ route（4 个端点）→ web（设置面板 + 入口未读提示）。

## 数据模型

迁移文件：`apps/api/migrations/0012_companion_proactive_care.sql`。schema 加入 `apps/api/src/modules/chat/chat.schema.ts`。

### companion_care_plans（每用户唯一关怀计划）

字段：

- `id` TEXT 主键（uuidv7）
- `user_id` TEXT NOT NULL → `users.id` ON DELETE CASCADE
- `enabled` INTEGER NOT NULL（0/1）
- `frequency` TEXT NOT NULL（daily/weekly/custom）
- `preferred_time` TEXT（如 "21:30"，可空）
- `scenes_json` TEXT NOT NULL（JSON 数组，如 `["long_absence","night"]`）
- `tone` TEXT NOT NULL（light/gentle/intimate）
- `custom_prompt` TEXT（可空）
- `next_run_at_ms` INTEGER（可空，MVP 计算保存留给 Cron）
- `created_at_ms` / `updated_at_ms` INTEGER NOT NULL

约束/索引：

- UNIQUE(`user_id`)：一个用户一份计划。
- INDEX(`enabled`, `next_run_at_ms`)：留给 Cron 扫描。
- CHECK：frequency/tone 取值白名单；`updated_at_ms >= created_at_ms`。

### companion_care_events（每次生成记录 + 未读状态）

字段：

- `id` TEXT 主键（uuidv7）
- `user_id` TEXT NOT NULL → `users.id` CASCADE
- `care_plan_id` TEXT → `companion_care_plans.id` ON DELETE SET NULL
- `conversation_id` TEXT NOT NULL → `companion_conversations.id` CASCADE
- `message_id` TEXT NOT NULL → `companion_conversation_messages.id` CASCADE
- `scene` TEXT NOT NULL
- `status` TEXT NOT NULL（generated/read）
- `message` TEXT NOT NULL（关怀文案副本）
- `metadata_json` TEXT（可空）
- `generated_at_ms` INTEGER NOT NULL
- `read_at_ms` INTEGER（可空）

约束/索引：

- INDEX(`user_id`, `generated_at_ms`)：列出最近事件。
- INDEX(`message_id`)：按消息反查。
- INDEX(`user_id`, `status`, `read_at_ms`)：未读扫描。
- CHECK：status 白名单。

drizzle 类型导出：`CompanionCarePlanRecord`、`CompanionCareEventRecord`（同文件既有导出风格）。

## Contract 设计

新建 `packages/contracts/src/chat/companion-care.contract.ts`（与既有 companion-\*.contract.ts 并列），经 `index.ts` 手动 re-export。

```ts
export const CompanionCareSceneSchema = z.enum([
  "morning",
  "night",
  "long_absence",
  "stress_support",
  "relationship_warmup",
  "anniversary",
]);
export const CompanionCareFrequencySchema = z.enum([
  "daily",
  "weekly",
  "custom",
]);
export const CompanionCareToneSchema = z.enum(["light", "gentle", "intimate"]);

export const CompanionCarePlanSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  frequency: CompanionCareFrequencySchema,
  preferredTime: z.string().max(20).nullable(),
  scenes: z.array(CompanionCareSceneSchema).min(1).max(6),
  tone: CompanionCareToneSchema,
  customPrompt: z.string().max(800).nullable(),
  nextRunAtMs: z.number().int().nonnegative().nullable(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const UpsertCompanionCarePlanRequestSchema = z.object({
  enabled: z.boolean(),
  frequency: CompanionCareFrequencySchema,
  preferredTime: z.string().trim().max(20).optional().nullable(),
  scenes: z.array(CompanionCareSceneSchema).min(1).max(6),
  tone: CompanionCareToneSchema,
  customPrompt: z.string().trim().max(800).optional().nullable(),
});

export const CompanionCareEventSchema = z.object({
  id: z.string().min(1),
  scene: CompanionCareSceneSchema,
  status: z.enum(["generated", "read"]),
  message: z.string(),
  messageId: z.string().min(1),
  generatedAtMs: z.number().int().nonnegative(),
  readAtMs: z.number().int().nonnegative().nullable(),
});

export const GenerateCompanionCareEventRequestSchema = z.object({
  scene: CompanionCareSceneSchema.optional(),
});

// 响应
export const CompanionCarePlanResponseSchema = z.object({
  plan: CompanionCarePlanSchema,
});
export const CompanionCareEventsResponseSchema = z.object({
  items: z.array(CompanionCareEventSchema),
});
export const GenerateCompanionCareEventResponseSchema = z.object({
  event: CompanionCareEventSchema,
});
```

会话响应扩展（未读提示）：在 `CompanionConversationResponseSchema` 增加 `hasUnreadCareEvent: z.boolean()`（默认 false），供聊天入口显示轻量提示。此字段属本任务，与反馈闭环的 `feedback` 字段互不冲突（不同字段）。

## Repository 层（chat.repository.ts 追加）

- `findCompanionCarePlan({ database, userId })`：查计划；`scenes_json` 解析为数组并做白名单过滤（JSON 字段无 enum 约束，读出要清洗）。
- `upsertCompanionCarePlan({...})`：先查再 update/insert（保留 `created_at_ms`），返回 planId。
- `insertCompanionCareEvent({...})`：默认 status=generated，read_at_ms=null。
- `listCompanionCareEvents({ database, userId, limit })`：按 generated_at_ms desc。
- `markCompanionCareEventsRead({ database, userId, nowMs })`：update status=generated & read_at_ms IS NULL → status=read, read_at_ms=now。**调用方 try/catch 包裹**。
- `countUnreadCareEvents({ database, userId })`：供会话响应 `hasUnreadCareEvent`，**try/catch 包裹**，失败返回 0。

## Service 层（chat.service.ts 追加）

- `getCompanionCarePlan({ bindings, userId })`：查不到则用默认值 upsert 后返回。默认：enabled=false，frequency=daily，preferredTime="21:30"，scenes=["long_absence","night"]，tone="gentle"，customPrompt=null，nextRunAtMs=null。
- `updateCompanionCarePlan({ bindings, userId, payload })`：算 `next_run_at_ms`（`calculateNextCareRunAtMs`：未开启返回 null；按 preferredTime 设定时/分，若已过则 +1 天或 +7 天）→ upsert → 返回 plan。
- `listCompanionCareEvents({ bindings, userId })`。
- `generateCompanionCareEvent({ bindings, userId, scene? })`：核心编排（见下）。
- `buildProactiveCareMessage({ scene, tone, customPrompt })`：规则模板。tone 决定前缀，customPrompt 优先；否则按 scene 取模板文案（morning/night/long_absence/stress_support/relationship_warmup/anniversary 六条，文案见 bobo 文档 55，可按 MoodMate 语气微调）。

### 生成编排流程

```
校验用户 → getCompanionCarePlan（查/建）
  → 选 scene（入参 > 计划首个 scene > long_absence）
  → requireCompanionConversation（取/建会话，复用现有）
  → buildProactiveCareMessage（模板文案）
  → insertCompanionConversationMessage（role=assistant，status=completed，
       metadataJson={ source:"proactive_care", scene, tone }）
  → insertCompanionCareEvent（status=generated）
  → 返回 event（含 messageId）
```

注意：`insertCompanionConversationMessage` 已用 db.batch 原子更新会话 messageCount/lastMessageAtMs，无需再单独更会话统计。

### 未读闭环接入

`getCompanionConversation`（现有）在读取历史前追加：

```ts
await markCompanionCareEventsRead({ database, userId, nowMs }); // try/catch
```

但这会导致"打开即已读"，无法在会话响应里体现未读——因此顺序改为：**先 `countUnreadCareEvents` 得到 hasUnreadCareEvent，再 markRead，再读历史**。这样响应能带上"本次打开前有未读"的标记，前端据此做一次性轻量提示（如入口小圆点，打开后消失）。

## Route 层（chat.route.ts 追加 4 端点，均 requireWebAccess）

```
GET   /rpc/chat/companion/care-plan            → getCompanionCarePlan
PATCH /rpc/chat/companion/care-plan            → updateCompanionCarePlan（zValidator UpsertCompanionCarePlanRequestSchema）
GET   /rpc/chat/companion/care-events          → listCompanionCareEvents
POST  /rpc/chat/companion/care-events/generate → generateCompanionCareEvent（zValidator GenerateCompanionCareEventRequestSchema）
```

CORS：确认 `apps/api/src/app.ts` 的 allowMethods 已含 PATCH（若无则补）。

## Web 层

- API client `apps/web/src/api/chat.api.ts` 追加 4 方法：`getCompanionCarePlan` / `updateCompanionCarePlan`(PATCH) / `getCompanionCareEvents` / `generateCompanionCareEvent`(POST)。
- query options `chat.query.ts` 追加 care-plan / care-events 的 queryKey 与 options。
- 设置面板：`SettingsSection` 增加 `"care"`；`settingsMenu` 加一项（如 icon Heart，label "主动关怀"）；`settingsTitle.care`；section 渲染分支加 `<CarePanel />`。
- 新增 `CarePanel`（放 `settings-panels.tsx`，与 MemoryPanel 并列）：表单配置计划（开关/频率/时间/场景多选/语气/自定义文案）+ 保存按钮 + 生成关怀按钮 + 最近记录列表。保存/生成后 invalidate 相关 query；生成后额外 invalidate `companionChatKeys.conversation()` 让关怀消息进入聊天历史。
- 入口未读提示：`CompanionChatApp` 读取会话响应的 `hasUnreadCareEvent`，在设置入口或"主动关怀" section 菜单项上显示轻量小圆点。

## 兼容与回滚

- 纯增量：新表、新 contract、新端点、新面板 section。改动既有代码仅两处：`CompanionConversationResponseSchema` 加可选字段 `hasUnreadCareEvent`、`getCompanionConversation` 加未读统计+已读标记。
- 会话响应新增字段用默认 false，未迁移环境经容错返回 false，老前端忽略该字段不受影响。
- 回滚：移除路由注册与面板 section 即停用功能；两表可保留（无害）。

## 关键设计取舍

- MVP 用规则模板而非 LLM：主动关怀要稳定可用，不依赖用户 LLM 配置。接 LLM 时外层流程不变，只替换 `buildProactiveCareMessage`。
- 未读统计与已读标记全程 try/catch：主动关怀是增强能力，新表不可用不能拖垮会话主流程（会话历史是核心链路）。
- 路由顺序：care 端点是静态路径，与现有 `/memories/:memoryId` 动态路径无冲突，但仍放在同一 route builder 链上按现有风格追加。
