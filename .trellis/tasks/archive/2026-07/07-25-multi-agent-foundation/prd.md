# 多 Agent 基础：user_agents 与独立一对一体系

## Goal

给 moodmate 新增一套独立的多 Agent 体系：一个 Web 用户可以创建、列出、查看、编辑、删除多个 Agent，每个 Agent 有独立人设，并具备按 Agent 维度的一对一会话与长期记忆结构。这套体系与现有单用户单 companion 链路完全并存，互不改动，专门为后续 Agent 群聊提供「可被邀请进群的多个 Agent」这一地基。

这是群聊全部子任务的前置任务。没有它，群聊第一步（建群选 Agent）无 Agent 可选。

## Background

- moodmate 现状是单用户单 Agent：`companion_profiles`、`companion_conversations` 都带 `UNIQUE(user_id)`，`companion_memories` 按 `user_id` 存。没有「一个用户拥有多个 Agent」的实体。
- 6 篇群聊草稿（`docs/temp/56-61`）默认 bobo 的多 Agent 模型（`user_agent_companions` 表 + 按 agent 的一对一记忆）。
- 经用户确认采用方案 A：新增独立多 Agent 体系，与现有单聊并存。现有 `companion_*` 链路（含 `chat.analysis.ts` 理解链、care、feedback、memory 提取）零改动。

### 现有后端范式（实现须对齐，来自 `apps/api/src/modules/chat/` 与 `modules/profile/`）

- 模块目录：`apps/api/src/modules/<domain>/` = `index.ts` + `.route.ts` + `.service.ts` + `.repository.ts` + `.schema.ts`（drizzle 表）+ 按需 `.presenter.ts`。
- route：`createXxRoute()` 返回链式 `new Hono<ApiHonoEnv>()`，用 `requireWebAccess` 中间件，取 `c.var.webSession.userId`；入参用 `zValidator` + 失败抛 `invalidRequest(msg, issues)`；出参 `Schema.parse(result)` 后 `c.json(buildSuccess(data, createMeta(c.var.requestId)))`。
- schema：`sqliteTable` + `check/index/unique`，末尾 `export type XxRecord = typeof xx.$inferSelect`；外键 `.references(() => users.id, { onDelete: "cascade" })`。
- 迁移：`apps/api/migrations/`，编号顺延 **0013**，文件名与写法照 `0012_companion_proactive_care.sql`（反引号标识符、`FOREIGN KEY ... ON DELETE cascade`、`CONSTRAINT ... CHECK(...)`、显式 `CREATE INDEX`）。
- 契约：`packages/contracts/src/chat/` 下新增 `agent.contract.ts`，并从 `packages/contracts/src/index.ts` 导出。
- 路由注册：`apps/api/src/routes/index.ts` 里 `.route("/", createAgentRoute())`。
- LLM Provider：单聊在 `chat.service.ts` 构造 `ChatProviderConfig`（`{ apiKey, baseURL, model, wireApi, ... }`），本前置任务不涉及回复生成，暂不需要 provider。

### 前端范式（来自 web 调研）

- Next.js App Router，无 `(dashboard)` group；路由页是薄壳（metadata + guard），本体在 `apps/web/src/components/<domain>/`。
- api 封装 `apps/web/src/api/<domain>.api.ts`（用单例 `http`，每请求传 zod schema），react-query 封装 `<domain>.query.ts`（keys 工厂 + queryOptions/mutationOptions）。
- 路径别名 `@/src/...`。`packages/ui` 无 Dialog/Avatar/ScrollArea；表单用 `@repo/ui/input`、`@repo/ui/button`、`@repo/ui/field` 等，头像用带背景色 `<span>` + lucide 图标。

## Requirements

### 数据模型（迁移 0013）

- R1 新增 `user_agents` 表：`id`、`user_id`（FK users, cascade）、`name`、`headline`（简介，可空）、`description`（角色说明，可空）、`persona_prompt`（人设/默认提示词，可空）、`guardrails_prompt`（角色边界，可空）、`image_key`（头像，可空）、`status`（`active`/`archived`）、`display_order`、`created_at_ms`、`updated_at_ms`。带 `user_id + status` 或 `user_id + display_order` 索引，时间戳 CHECK。
- R2 新增 `agent_conversations` 表：按 (user, agent) 维度的一对一会话统计：`id`、`user_id`（FK）、`agent_id`（FK user_agents, cascade）、`summary`、`message_count`（默认 0，CHECK ≥ 0）、`last_message_at_ms`、时间戳。`UNIQUE(user_id, agent_id)`。此表为群聊「关系阶段/发言频率」信号预留（smart-speaker 任务会读它）。
- R3 新增 `agent_memories` 表：按 (user, agent) 维度的长期记忆：`id`、`user_id`（FK）、`agent_id`（FK user_agents, cascade）、`type`、`content`、`importance`（默认 3，CHECK 1-5）、`status`（`active`/`disabled`/`deleted`）、`created_at_ms`、`updated_at_ms`。带 `user_id + agent_id + status + importance` 索引。群聊回复注入「当前 Agent 自己的一对一记忆」即读此表。
- R4 drizzle 表定义写入新模块 `apps/api/src/modules/agent/agent.schema.ts`，导出 `UserAgentRecord`、`AgentConversationRecord`、`AgentMemoryRecord`。

### 契约

- R5 `packages/contracts/src/chat/agent.contract.ts` 定义并导出：`UserAgentSchema`（展示用：id/name/headline/description/imageKey/status/displayOrder/createdAtMs）、`CreateUserAgentRequestSchema`（name 必填 1-120，headline/description/personaPrompt/guardrailsPrompt/imageKey 可选，带长度上限）、`UpdateUserAgentRequestSchema`（同字段可选）、以及各响应 Schema（列表/详情/创建/更新/删除）。从 `packages/contracts/src/index.ts` 导出。

### API（模块 `modules/agent/`，前缀 `/rpc/agents`）

- R6 `GET /rpc/agents`：列出当前用户的 Agent（默认按 displayOrder，排除 archived）。
- R7 `POST /rpc/agents`：创建 Agent，归属当前用户，返回创建结果。
- R8 `GET /rpc/agents/:agentId`：读取单个 Agent 详情，非本人拥有返回 403。
- R9 `PATCH /rpc/agents/:agentId`：编辑 Agent，越权 403。
- R10 `DELETE /rpc/agents/:agentId`：删除（软删 status=archived 或物理删，二选一在 design 定），越权 403。
- R11 所有端点走 `requireWebAccess`，`userId` 取自 `c.var.webSession.userId`，越权一律拒绝（复用群聊约束里的越权防护原则）。
- R12 提供 repository 函数 `listOwnedAgentsByIds({ db, userId, agentIds })`：按 id 批量查当前用户拥有的 Agent，供群聊 foundation 建群时做归属校验（草稿 56 里的 `listOwnedAgentCompanionsByIds`）。

### 前端（最小可用管理 UI）

- R13 新增路由 `apps/web/app/(app)/agents/page.tsx`（薄壳 + guard）+ `apps/web/src/components/agent/` 组件：列出我的 Agent、创建 Agent（手写遮罩层表单，无 Dialog 依赖）、编辑、删除。
- R14 api 封装 `apps/web/src/api/agent.api.ts` + `agent.query.ts`（keys 工厂 + queryOptions/mutationOptions，创建/编辑/删除后 invalidate 列表）。
- R15 UI 仅需覆盖 Agent 的增删改查，不涉及与 Agent 的一对一聊天页面（本任务不做多 Agent 单聊 UI，只做群聊所需的 Agent 管理）。

## Acceptance Criteria

- [ ] 迁移 0013 可执行，新增 `user_agents`、`agent_conversations`、`agent_memories` 三表，约束与索引符合 0012 风格。
- [ ] `agent.schema.ts` 导出三个 Record 类型，`tsc --noEmit` 通过。
- [ ] `agent.contract.ts` 定义的 schema 从 `@repo/contracts` 可导入。
- [ ] 一个用户能通过 API 创建多个 Agent；列表只返回自己的、排除 archived。
- [ ] 读取/编辑/删除他人 Agent 返回 403。
- [ ] `listOwnedAgentsByIds` 对混入他人 agentId 的入参只返回属于当前用户的记录。
- [ ] 现有 `companion_*` 单聊链路零改动：单聊相关测试/类型/lint 不因本任务报错。
- [ ] 前端 `/agents` 页可创建、列出、编辑、删除 Agent，创建后列表即时刷新。
- [ ] 类型检查 → lint → format 三项全过。

## Out of Scope

- 与单个 Agent 的一对一聊天 UI 和回复链路（本任务只建 Agent 管理 + 数据结构；一对一聊天不在群聊需求内）。
- 把现有 `companion_*` 单聊迁移/合并到新体系（明确并存，不迁移）。
- agent_conversations / agent_memories 的写入链路（本任务只建表 + 供群聊读取的 repository；记忆提取写入不做）。
- Agent 头像上传（image_key 字段预留，上传能力若无现成复用则延后，用现有头像存储或占位）。

## Notes

- `agent_conversations` 与 `agent_memories` 在本任务只建表 + 提供读取用 repository（群聊 smart-speaker/回复注入会读）。写入这些表的链路不在本批次，字段结构一次建到位避免后续再改迁移。
- 头像 image_key：先查是否能复用现有 `avatar-storage`/assets 模块；不能则本任务用占位、字段留空，不阻塞群聊。
