# 多 Agent 基础 — 技术设计

## 边界与原则

- 现有 `companion_*` 单聊体系（profile / conversation / message / memory / care / feedback + `chat.analysis.ts` 理解链）**零改动**。本任务只新增独立表与模块，两套并存。
- 本任务只做「多 Agent 的创建、列表、详情、按 Agent 的一对一会话与记忆表结构」，**不做多 Agent 聊天**。多 Agent 一对一聊天与群聊聊天分别属于后续任务，本任务只把表和 Agent 实体准备好。
- Agent 头像第一版用可空 `image_key` 字段承接，**不做上传流程**（复用前端默认头像展示）。上传延后。

## 数据模型（迁移 0013）

新增迁移文件 `apps/api/migrations/0013_user_agents.sql`，照 `0012_companion_proactive_care.sql` 风格（反引号标识符、`FOREIGN KEY ... ON DELETE cascade`、`CONSTRAINT ... CHECK(...)`、显式 `CREATE INDEX`）。

三张表：

### user_agents（用户创建的多个 Agent）

| 列                | 类型                     | 说明                       |
| ----------------- | ------------------------ | -------------------------- |
| id                | text PK                  | uuid                       |
| user_id           | text NN FK→users cascade | 归属用户                   |
| name              | text NN                  | Agent 昵称                 |
| headline          | text                     | 一句话简介                 |
| description       | text                     | 角色说明                   |
| story_background  | text                     | 故事背景（群聊 prompt 用） |
| persona_prompt    | text                     | 人设/性格提示词            |
| tone_prompt       | text                     | 语气提示词                 |
| guardrails_prompt | text                     | 角色边界提示词             |
| default_prompt    | text                     | 默认系统提示词             |
| image_key         | text                     | 头像 key，可空             |
| status            | text NN                  | `active` / `archived`      |
| created_at_ms     | integer NN               |                            |
| updated_at_ms     | integer NN               |                            |

约束与索引：

- `CHECK(status IN ('active','archived'))`
- `CHECK(updated_at_ms >= created_at_ms)`
- `INDEX user_agents_user_status_idx (user_id, status, updated_at_ms)`

字段命名对齐草稿 60 里 `AgentGroupChatAgentRecord`（headline/description/storyBackground/personalityPrompt/tonePrompt/guardrailsPrompt/defaultPrompt/imageKey），群聊直接消费，避免后续改名。草稿里的 `personalityPrompt` 在库列用 `persona_prompt`，Record 字段名保持 `personaPrompt`（群聊 prompt 里映射到 `personalityPrompt` 语义即可）。

### agent_conversations（用户与某个 Agent 的一对一会话，按 Agent 维度）

| 列                 | 类型                           | 说明                      |
| ------------------ | ------------------------------ | ------------------------- |
| id                 | text PK                        |                           |
| user_id            | text NN FK→users cascade       |                           |
| agent_id           | text NN FK→user_agents cascade |                           |
| title              | text                           |                           |
| summary            | text                           |                           |
| message_count      | integer NN default 0           |                           |
| last_message_at_ms | integer                        | 群聊关系阶段/发言频率会读 |
| created_at_ms      | integer NN                     |                           |
| updated_at_ms      | integer NN                     |                           |

约束与索引：

- `UNIQUE(user_id, agent_id)` — 每个用户对每个 Agent 一个一对一会话
- `CHECK(message_count >= 0)`
- `CHECK(updated_at_ms >= created_at_ms)`
- `INDEX agent_conversations_user_agent_idx (user_id, agent_id)`

> 说明：草稿 60 的 `AgentGroupChatAgentRecord` 需要 `conversationMessageCount` 与 `conversationLastMessageAtMs` 来推导关系阶段（smart-speaker 任务）。这两个值就来自本表 `message_count` / `last_message_at_ms`。本任务只建表；群聊成员查询 join 本表取值放在 smart-speaker 任务。会话消息的实际写入（多 Agent 一对一聊天）不在本批次范围，本表在群聊场景下先作为「关系统计载体」，初始值可为 0/null，不影响群聊回复功能，仅影响关系阶段精度。

### agent_memories（用户与某个 Agent 的一对一长期记忆，按 Agent 维度）

结构对齐 `companion_memories`，但多一个 `agent_id`：

| 列                | 类型                           | 说明                                                             |
| ----------------- | ------------------------------ | ---------------------------------------------------------------- |
| id                | text PK                        |                                                                  |
| user_id           | text NN FK→users cascade       |                                                                  |
| agent_id          | text NN FK→user_agents cascade |                                                                  |
| type              | text NN                        |                                                                  |
| content           | text NN                        |                                                                  |
| importance        | integer NN default 3           |                                                                  |
| status            | text NN                        | `active`/`disabled`/`deleted`                                    |
| source_message_id | text                           | 可空，暂不加 FK（多 Agent 一对一消息表本批次不建），留 text 记录 |
| created_at_ms     | integer NN                     |                                                                  |
| updated_at_ms     | integer NN                     |                                                                  |

约束与索引：

- `CHECK(importance BETWEEN 1 AND 5)`
- `CHECK(status IN ('active','disabled','deleted'))`
- `CHECK(updated_at_ms >= created_at_ms)`
- `INDEX agent_memories_user_agent_status_idx (user_id, agent_id, status, importance)`

> 群聊回复注入「当前 Agent 与用户的一对一记忆」（草稿 57/58）就查本表：`WHERE user_id=? AND agent_id=? AND status='active' ORDER BY importance DESC LIMIT 6`。本任务提供 `listActiveAgentMemories({ userId, agentId, limit })` repository 函数供群聊复用。第一版记忆可能为空（多 Agent 一对一聊天尚未产出记忆），群聊 prompt 里按「暂无可用长期记忆」处理，不阻塞。

## 后端模块（modules/agents/）

照 `modules/chat/` 分层新建 `apps/api/src/modules/agents/`：

- `agents.schema.ts` — 上述 3 张 drizzle 表 + `$inferSelect` 导出：`UserAgentRecord` / `AgentConversationRecord` / `AgentMemoryRecord`。
- `agents.repository.ts` — DB 访问：
  - `createUserAgent(db, {...})`
  - `listUserAgents(db, { userId })` — 返回 status='active'，按 updated_at_ms desc
  - `getUserAgentById(db, { userId, agentId })`
  - `listOwnedUserAgentsByIds(db, { userId, agentIds })` — 群聊建群校验用（草稿 56 的 `listOwnedAgentCompanionsByIds` 对应物）
  - `listActiveAgentMemories(db, { userId, agentId, limit })` — 群聊回复注入记忆用
  - `archiveUserAgent(db, { userId, agentId })` — 软归档（status='archived'）
- `agents.service.ts` — 业务：创建（trim/校验）、列表、详情、归档；返回 presenter 结构。
- `agents.presenter.ts` — Record → contract DTO（imageKey→可空，时间戳透传）。
- `agents.route.ts` — `createAgentsRoute()` 链式 Hono，全部 `requireWebAccess`，`c.var.webSession.userId` 取用户，`zValidator` 校验，`buildSuccess(data, createMeta(c.var.requestId))` 返回。
- `index.ts` — 导出 `createAgentsRoute`。

### API 端点

| 方法   | 路径                   | 说明                        |
| ------ | ---------------------- | --------------------------- |
| GET    | `/rpc/agents`          | 列出当前用户的 active Agent |
| POST   | `/rpc/agents`          | 创建 Agent                  |
| GET    | `/rpc/agents/:agentId` | Agent 详情                  |
| PATCH  | `/rpc/agents/:agentId` | 编辑 Agent（名称/人设等）   |
| DELETE | `/rpc/agents/:agentId` | 软归档（status=archived）   |

路由注册：`apps/api/src/routes/index.ts` 加 `.route("/", createAgentsRoute())`。

## 契约（packages/contracts/src/agents/agent.contract.ts）

新建目录 `agents/`，文件 `agent.contract.ts`。核心 schema：

- `UserAgentSchema`：id/name/headline/description/storyBackground/personaPrompt/tonePrompt/guardrailsPrompt/defaultPrompt/imageKey(nullable)/status/createdAtMs/updatedAtMs
- `CreateUserAgentRequestSchema`：name(min1 max120 trim)、其余提示词字段可空/可选、有长度上限
- `UpdateUserAgentRequestSchema`：同上字段 partial
- 响应：`UserAgentListResponseSchema` / `UserAgentDetailResponseSchema` / `CreateUserAgentResponseSchema` / `UpdateUserAgentResponseSchema` / `DeleteUserAgentResponseSchema`

在 `packages/contracts/src/index.ts` 导出（照现有 chat 契约导出方式：type + schema 双导出）。

## 前端（最小管理 UI）

范围克制，够群聊建群选 Agent 即可：

- `apps/web/src/api/agent.api.ts` — `getUserAgents` / `createUserAgent` / `getUserAgentDetail` / `updateUserAgent` / `deleteUserAgent`，用 `http` + response schema。
- `apps/web/src/api/agent.query.ts` — keys 工厂 + queryOptions + mutationOptions（照 `chat.query.ts`）。
- `apps/web/app/(app)/agents/page.tsx` — 薄壳 + `WebDashboardGuard`。
- `apps/web/src/components/agents/agents-manager.tsx` — Agent 列表 + 创建表单（手写遮罩层 Dialog，`packages/ui` 无 Dialog）+ 编辑 + 归档。头像用带背景色 `<span>` + lucide 图标占位。

> 前端范围可按需进一步收缩：群聊建群下拉能列出 Agent 即为最低可用。列表 + 创建为必须，编辑/归档为加分项，若时间紧可移入 Out of Scope 由后续补。

## 兼容与回滚

- 纯增量：只加表、加模块、加路由注册、加契约导出、加前端页面。不改任何 `companion_*` 表与 `modules/chat`。
- 回滚：迁移 0013 未上生产前可直接删文件；模块与契约新增可整体移除，不影响单聊。
- 迁移一旦应用，D1 回滚需写反向迁移（drop 三张表）——上线前确认。

## 关键取舍

- 为什么不复用 `companion_profiles`：它 `UNIQUE(user_id)`，天然单 Agent，改造会动到单聊全链路（含 80KB 的 `chat.analysis.ts`），风险和工作量都大。并存方案把单聊风险隔离到零。
- 为什么 `agent_conversations` / `agent_memories` 现在就建但不写入：群聊 smart-speaker（关系阶段）与回复（记忆注入）会读它们；提前建表让群聊任务不必回头补迁移。空数据不阻塞群聊，只降低关系/记忆精度，可接受。
- 字段命名提前对齐草稿的 `AgentGroupChatAgentRecord`，避免群聊任务里再做字段映射改名。
