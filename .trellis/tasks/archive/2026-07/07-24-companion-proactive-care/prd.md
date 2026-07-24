# 主动关怀系统

## Goal

让 MoodMate 伴侣从"被动回复"走向"主动陪伴"：用户可为伴侣配置一份主动关怀计划，并手动生成一条关怀消息。关怀消息作为 assistant 消息写入真实聊天历史，同时记录为关怀事件用于追踪未读/已读。这是 MVP 阶段的最小闭环，先证明主动消息能进入聊天系统、能被看见、能被追踪，为后续接入 Cron、通知、LLM 润色留好接口。

对应参考文档：`docs/temp/55-agent-chat-proactive-care-system.txt`（描述 bobo/ai-agent 的实现，本任务在 moodmate 架构上重做）。

## Background（已确认事实）

moodmate 是单用户单伴侣模型，与 bobo 的多 Agent 差异导致落点重映射：

- 无"Agent 列表/详情页"，无 inbox 伴侣列表 UI。bobo 文档 55 里"首页 Agent 列表展示最新消息 + 未读徽标"这一环，在 moodmate 落地为：**写入聊天历史 + 聊天入口轻量未读提示**（已与用户确认）。
- 关怀配置/事件不挂 agentId 维度，直接 per-user（`companion_conversations.user_id` unique，每用户一个会话）。
- 表名前缀 `companion_*`，schema 在 `apps/api/src/modules/chat/chat.schema.ts`。
- 消息写入复用 `insertCompanionConversationMessage`（`chat.repository.ts:87`，用 `db.batch` 原子插消息 + 更新会话 `messageCount`/`lastMessageAtMs`）。
- 打开会话的入口是 `GET /rpc/chat/companion/conversation`（`chat.route.ts:43` → `getCompanionConversation`），未读标记已读挂在这里。
- 迁移当前最大 `0010`。三件套迁移号已在父任务层统一分配：反馈闭环（子任务 B）用 `0011`，本任务用 `0012`，互不冲突。
- 关怀文案 MVP 用规则模板生成（同 bobo 文档 55），不接 LLM。理由：主动关怀要稳定可用，不应依赖用户是否配置了第三方 LLM；MVP 验证的是数据闭环而非文案精致度。

## Requirements

- R1：新增两张表 `companion_care_plans`（每用户唯一关怀计划）、`companion_care_events`（每次生成记录 + 未读/已读状态），迁移号 `0012`，schema 加入 `chat.schema.ts`。
- R2：新增 contract：关怀场景/频率/语气 enum、关怀计划 schema、Upsert 请求、生成事件请求、各响应 schema，经 `packages/contracts/src/index.ts` 导出。
- R3：新增 4 个 API（均 `requireWebAccess`，per-user）：
  - `GET /rpc/chat/companion/care-plan`：读取关怀计划，无则自动创建默认计划（默认不开启）。
  - `PATCH /rpc/chat/companion/care-plan`：新增或修改关怀计划，保存时计算 `next_run_at_ms`。
  - `GET /rpc/chat/companion/care-events`：列出最近关怀事件。
  - `POST /rpc/chat/companion/care-events/generate`：生成一条主动关怀消息。
- R4：生成关怀消息的完整流程：校验用户 → 查/建计划 → 选 scene → 取/建会话 → 规则模板生成文案 → 写入 `companion_conversation_messages`（role=assistant，metadata 标记 `source: "proactive_care"`）→ 写入 `companion_care_events`（status=generated）→ 更新会话统计。
- R5：未读闭环：打开会话接口（`getCompanionConversation`）读取历史前，先把该用户 status=generated 且未读的关怀事件标记为 read；会话响应或专门字段暴露"是否有未读关怀"，供聊天入口显示轻量提示。
- R6：容错——未读统计与已读标记用 try/catch 包裹，新表不可用时不拖垮会话主流程（同 bobo 的稳健策略）。
- R7：web 端在设置面板新增"主动关怀"section，可配置开关/频率/时间/场景/语气/自定义文案并保存，可手动生成关怀消息，可查看最近关怀记录；生成后刷新会话查询让新消息进入聊天历史。

## Acceptance Criteria

- [x] 执行迁移后 `companion_care_plans`、`companion_care_events` 两表存在，含唯一索引与外键。（迁移 0012 SQL 与 drizzle schema 一致，两表 + 索引 + 外键 + check 齐全；实际建表待用户手动执行迁移验证）
- [x] `GET /rpc/chat/companion/care-plan` 首次调用自动创建默认计划（enabled=false，frequency=daily，preferredTime=21:30，scenes 含 long_absence/night，tone=gentle）。（`getCompanionCarePlan` 查不到用 `CARE_DEFAULT_PLAN` upsert）
- [x] `PATCH` 保存计划后重新 `GET` 能回显所有字段；enabled=true 时 `next_run_at_ms` 有值。（`updateCompanionCarePlan` 先 `calculateNextCareRunAtMs` 再 upsert）
- [x] `POST .../care-events/generate` 后：`companion_conversation_messages` 新增一条 assistant 消息（metadata.source=proactive_care），`companion_care_events` 新增一条 status=generated 记录，会话 messageCount +1。（`generateCompanionCareEvent` 编排；messageCount 由 `insertCompanionConversationMessage` 的 db.batch 更新）
- [x] 打开会话接口后，该用户未读关怀事件变为 read，未读提示消失。（`getCompanionConversation` 先 `countUnreadCareEvents` 后 `markCompanionCareEventsRead`）
- [x] 新表不可用（未迁移）时，会话历史接口仍能正常返回（容错生效）。（未读统计与已读标记各自 try/catch，失败按无未读处理不抛）
- [x] web 设置面板可保存计划、生成关怀消息、查看最近记录；生成的关怀消息出现在聊天历史里。（`CarePanel`；生成后 invalidate 会话 query）
- [x] `pnpm check-types`、`pnpm lint` 通过。（另 `pnpm format` 也通过）

## Out of Scope

- 不做 Cloudflare Cron 自动定时推送（仅计算并保存 `next_run_at_ms` 留给后续）。
- 不做浏览器/邮件/短信等外部通知。
- 不做 LLM 动态生成关怀文案（仅规则模板；接 LLM 时外层流程不变，只替换文案生成函数）。
- 不做同一天多次主动、订阅等级限制、时区精算等调度约束（接 Cron 时再做）。

## Technical Notes

- 关怀 scene enum：`morning` / `night` / `long_absence` / `stress_support` / `relationship_warmup` / `anniversary`。
- 频率 enum：`daily` / `weekly` / `custom`；语气 enum：`light` / `gentle` / `intimate`。
- 生成时未传 scene 则取计划首个 scene；计划也无可用 scene 时退回 `long_absence`。
- 关怀事件 status：`generated`（已生成未读）/ `read`（用户已打开会话）。
- 详细数据模型、API 契约、流程见 `design.md`；执行顺序见 `implement.md`。
