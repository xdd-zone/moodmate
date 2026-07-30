# 群聊底座：数据模型 Contract API 成员管理

## Goal

搭起 Agent 群聊的底座：D1 表、共享 Contract、群聊 CRUD 与成员管理 API、前端三栏页面骨架。让「创建群聊、邀请自有 Agent、保存消息、管理成员」这条链路能跑通并持久化。本任务不含回复生成（由 reply-ui / langgraph 任务承接）。

## Background

- 对标 bobo 课程源码的 Agent 群聊第一篇（底座）。原文落点是 bobo 单文件结构，moodmate 落点为模块化结构。
- moodmate 现有单聊：`apps/api/src/modules/chat/`（route/service/repository/schema/provider/presenter/analysis），迁移已到 `0012`，契约在 `packages/contracts/src/chat/`。
- 群聊在 moodmate 属全新能力：契约、后端模块、前端组件全链路新建。

## Confirmed Facts

- 迁移编号顺延 **0014**（原文写 0016，是 bobo 编号，不采用；0013 已被前置任务 multi-agent-foundation 的 `user_agents` 占用）。
- 迁移风格以 `0012_companion_proactive_care.sql` 为准：反引号包名、`text/integer` 列、显式 `FOREIGN KEY ... ON DELETE`、`CONSTRAINT ... CHECK`、独立 `CREATE INDEX`。
- 用户 Agent 表为前置任务 multi-agent-foundation 已建的 `user_agents`（非原文 `user_agent_companions`，也非 `companion_profiles`）；成员表 `agent_id` 外键指向 `user_agents(id)`，`ON DELETE cascade`。
- 群聊模块建在 `apps/api/src/modules/group-chat/`，在 `routes/index.ts` 注册 `createGroupChatRoute()`。
- 契约建在 `packages/contracts/src/chat/group-chat.contract.ts`，并从 `packages/contracts/src/index.ts` 导出。
- 前端组件建在 `apps/web/src/components/group-chat/`，api/query 建 `group-chat.api.ts`/`group-chat.query.ts`，走 `@/src/...` 别名。
- 本地 LLM 配置 web 端已移除；本任务不引入 LLM 配置字段（`SendAgentGroupChatMessageRequest` 的 `llmConfig` 由后续回复任务按需处理，底座不做发送接口的回复逻辑）。

## Requirements

### R1 数据模型（迁移 0014）

- 新增三张表：群聊主表、成员表、消息表。
- 主表记录标题、摘要、消息数、最近消息时间、创建/更新时间。
- 成员表记录 group_chat_id、user_id、agent_id、display_order、status（active/removed）、joined/removed 时间，支持软移除。
- 消息表记录 sender_type（user/agent/system）、可空 agent_id、content、status（completed/failed）、turn_index、metadata_json、created_at。
- 外键均带 `ON DELETE`（群聊删除级联成员与消息；agent 删除时消息 agent_id 置空）。
- 按查询路径建索引（按群聊列出消息、按用户列群聊）。

### R2 Contract 先行

- `AgentGroupChatMemberSchema`：id/agentId/name/headline/imageKey/status/displayOrder/joinedAtMs。
- `AgentGroupChatMessageSchema`：id/groupChatId/senderType/agentId/agentName/agentImageKey/content/status/turnIndex/createdAtMs。
- `CreateAgentGroupChatRequestSchema`：title(1-120) + agentIds(1-6)，Contract 层直接限制上下限。
- 列表/详情/消息分页响应 schema，创建/成员管理请求响应 schema。
- 从 contracts index 导出所有 schema 与类型。

### R3 群聊 CRUD + 成员管理 API

- `GET /rpc/chat/group` 列出当前用户群聊。
- `POST /rpc/chat/group` 创建群聊。
- `GET /rpc/chat/group/:groupChatId` 详情（群聊信息+成员+最近消息）。
- `GET /rpc/chat/group/:groupChatId/messages?cursor=` 分页历史。
- `POST /rpc/chat/group/:groupChatId/members` 添加成员。
- `DELETE /rpc/chat/group/:groupChatId/members/:memberId` 移除成员。
- 三层校验：必须 Web 用户 token；agentIds 去重后 1-6 个；所选 agent 必须属于当前用户（越权返回 403）。
- 成员上限 6 在后端兜底（添加时 `现有+新增 > 6` 返回 422）。

### R4 前端三栏页面骨架

- 新建群聊页面（独立路由，薄壳 + guard + client 组件），三栏：左群聊列表、中消息窗口、右成员管理/邀请。
- 创建群聊入口（选择 1-6 个 Agent）。
- 成员管理：移除成员、邀请自有 Agent（前端过滤已在群内的 Agent）。
- 消息窗口本任务只做展示历史消息（发送与回复由 reply-ui 任务接管），骨架需为其预留。

## Acceptance Criteria

- [ ] 迁移 0014 可执行，三张表与索引创建成功，外键与 CHECK 约束符合 0012 风格。
- [ ] 契约 schema 全部定义并从 index 导出，`agentIds` 上下限（1-6）在 schema 层生效。
- [ ] 创建群聊：选他人 Agent 返回 403；超 6 个被截断/拒绝；成功后主表+成员表按顺序写入。
- [ ] 详情接口返回群聊信息、成员列表、最近消息。
- [ ] 添加成员超过 6 返回 422；移除成员走软移除（status/removed_at_ms）。
- [ ] 消息分页接口按 cursor 返回更早消息，无更多时 nextCursor 为空。
- [ ] 前端三栏页面可创建群聊、切换群聊、加载详情、管理成员；邀请列表过滤已在群成员。
- [ ] `tsc --noEmit`、`eslint`、`prettier --check` 全绿（受影响包）。

## Out of Scope

- 回复生成、Agent 选择策略、Prompt 组装、发送接口回复链路（reply-ui / langgraph 任务）。
- 乐观更新、历史分页前端交互细节（reply-ui 任务）。
- @ 提及、跨 Agent 回复、智能发言权（各自任务）。

## Dependencies

- 无前置子任务。本任务是其余 5 个子任务的基础，须最先完成。
