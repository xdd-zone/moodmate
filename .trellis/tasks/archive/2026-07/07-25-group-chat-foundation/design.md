# 群聊底座 技术设计

## 落点与依赖基线（代码已确认）

- 前置任务 multi-agent-foundation 已合入（commit `4b7d0fa`），产物：
  - 迁移 `apps/api/migrations/0013_user_agents.sql`（`user_agents` / `agent_conversations` / `agent_memories`）。
  - 模块 `apps/api/src/modules/agents/`（route/service/repository/presenter/schema/index）。
  - 契约 `packages/contracts/src/agents/agent.contract.ts`，已从 `packages/contracts/src/index.ts` 导出。
- 本任务迁移顺延 **0014**（0013 已被占用）。
- 群聊成员外键指向 `user_agents(id)`，不是 `companion_profiles`。
- Web 端 api/query 命名用单数：`group-chat.api.ts` / `group-chat.query.ts`（与现有 `agent.api.ts` 一致的单文件命名风格）。

## 架构与边界

后端沿用 `modules/agents/` 与 `modules/chat/` 的四层：`route`（HTTP + 校验 + `buildSuccess`）→ `service`（业务编排 + 越权判定）→ `repository`（drizzle + `db.batch`）→ `presenter`（record→contract）。新增 `apps/api/src/modules/group-chat/`：

```
group-chat.route.ts        端点 /rpc/chat/group*，requireWebAccess，zValidator，parse 响应
group-chat.service.ts      越权校验、成员上限兜底、创建/详情/历史/成员编排
group-chat.repository.ts   三张表 CRUD，db.batch 保证主表+成员一致写入
group-chat.presenter.ts    record→contract（成员/消息/群聊列表项/详情）
group-chat.schema.ts       drizzle 定义三张表
index.ts                   export { createGroupChatRoute }
```

`routes/index.ts` 追加 `.route("/", createGroupChatRoute())`。

本任务**不建** `.analysis.ts` / `.provider.ts`（回复生成由 reply-ui / langgraph 承接）。

## 数据模型（迁移 0014，drizzle + SQL 双写）

照 `0012` / `0013` 风格：反引号标识符、`text`/`integer` 列、显式 `FOREIGN KEY ... ON DELETE`、`CONSTRAINT ... CHECK`、独立 `CREATE INDEX`。同时在 `group-chat.schema.ts` 写 drizzle 定义（与迁移 SQL 一一对应）。

### agent_group_chats（群聊主表）

- `id` text PK
- `user_id` text NOT NULL → users.id ON DELETE cascade
- `title` text NOT NULL
- `summary` text
- `message_count` integer NOT NULL DEFAULT 0
- `last_message_at_ms` integer
- `created_at_ms` / `updated_at_ms` integer NOT NULL
- CHECK：`message_count >= 0`；`updated_at_ms >= created_at_ms`
- INDEX：`(user_id, updated_at_ms)`（按用户列群聊）

### agent_group_chat_members（成员表，软移除）

- `id` text PK
- `group_chat_id` text NOT NULL → agent_group_chats.id ON DELETE cascade
- `agent_id` text NOT NULL → user_agents.id ON DELETE cascade
- `user_id` text NOT NULL → users.id ON DELETE cascade（冗余便于按用户校验）
- `display_order` integer NOT NULL
- `status` text NOT NULL：`active` / `removed`
- `joined_at_ms` integer NOT NULL
- `removed_at_ms` integer
- CHECK：`status IN ('active','removed')`
- UNIQUE INDEX：`(group_chat_id, agent_id)`（同一 agent 在一个群只有一行；重复邀请走复活更新而非新插）
- INDEX：`(group_chat_id, status, display_order)`

> 成员表 agent 外键用 cascade：agent 归档≠删除（agents 是软归档 `status=archived`，不删行），真正删行的级联清理成员是合理的。消息表的 agent_id 才需要 set null（见下）。

### agent_group_chat_messages（消息表）

- `id` text PK
- `group_chat_id` text NOT NULL → agent_group_chats.id ON DELETE cascade
- `sender_type` text NOT NULL：`user` / `agent` / `system`
- `agent_id` text → user_agents.id ON DELETE set null（agent 删行后历史消息保留，作者置空）
- `content` text NOT NULL
- `status` text NOT NULL：`completed` / `failed`
- `turn_index` integer NOT NULL
- `metadata_json` text
- `created_at_ms` integer NOT NULL
- CHECK：`sender_type IN ('user','agent','system')`；`status IN ('completed','failed')`
- INDEX：`(group_chat_id, created_at_ms, id)`（按群列消息 + 游标分页）

## Contract（packages/contracts/src/chat/group-chat.contract.ts）

新建文件并从 `index.ts` 导出全部 schema 与类型（照 agent.contract 导出方式）。

- `AgentGroupChatMemberSchema`：`id / agentId / name / headline(nullable) / imageKey(nullable) / status(active|removed) / displayOrder / joinedAtMs`
- `AgentGroupChatMessageSenderTypeSchema`：enum `user|agent|system`
- `AgentGroupChatMessageStatusSchema`：enum `completed|failed`
- `AgentGroupChatMessageSchema`：`id / groupChatId / senderType / agentId(nullable) / agentName(nullable) / agentImageKey(nullable) / content / status / turnIndex / createdAtMs`
- `AgentGroupChatListItemSchema`：`id / title / summary(nullable) / messageCount / lastMessageAtMs(nullable) / memberCount / createdAtMs / updatedAtMs`
- `AgentGroupChatDetailSchema`：`{ groupChat: <主表信息>, members: AgentGroupChatMemberSchema[], recentMessages: AgentGroupChatMessageSchema[] }`
- 请求/响应：
  - `CreateAgentGroupChatRequestSchema`：`title` 1-120（trim），`agentIds` `z.array(z.string().min(1)).min(1).max(6)`（上下限在 schema 层生效）
  - `AgentGroupChatListResponseSchema`：`{ items: AgentGroupChatListItemSchema[] }`
  - `CreateAgentGroupChatResponseSchema` / `AgentGroupChatDetailResponseSchema`：`{ groupChat }` / detail
  - `AgentGroupChatMessagesResponseSchema`：`{ items: AgentGroupChatMessageSchema[], nextCursor: number | null }`
  - `AddAgentGroupChatMembersRequestSchema`：`agentIds` `.min(1).max(6)`
  - `AddAgentGroupChatMembersResponseSchema` / `RemoveAgentGroupChatMemberResponseSchema`：返回更新后的 detail 或成员列表 + `success`

> `SendAgentGroupChatMessageRequestSchema` 与 `llmConfig` **不在本任务定义**（reply-ui 按需新增），本任务不引入 LLM 配置字段。

## API（端点前缀 /rpc/chat/group）

| 方法   | 路径                                             | service                  | 校验要点                                                               |
| ------ | ------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------- |
| GET    | `/rpc/chat/group`                                | `listGroupChatsForUser`  | requireWebAccess                                                       |
| POST   | `/rpc/chat/group`                                | `createGroupChatForUser` | agentIds 去重后 1-6；`listOwnedUserAgentsByIds` 校验全部属己，缺失→403 |
| GET    | `/rpc/chat/group/:groupChatId`                   | `getGroupChatDetail`     | 群聊必须属当前用户，否则 403                                           |
| GET    | `/rpc/chat/group/:groupChatId/messages?cursor=`  | `getGroupChatMessages`   | cursor 为上一页最早 `createdAtMs`，可选；归属校验                      |
| POST   | `/rpc/chat/group/:groupChatId/members`           | `addGroupChatMembers`    | 归属校验；`现有 active + 新增去重 > 6` → 422                           |
| DELETE | `/rpc/chat/group/:groupChatId/members/:memberId` | `removeGroupChatMember`  | 归属校验；软移除（status=removed, removed_at_ms）                      |

越权 403 复用 agents 的 `AppError(BizCode.AUTH_FORBIDDEN, ..., 403)`；422 用 `BizCode.COMMON_INVALID_REQUEST` + 422（成员超限属业务规则拒绝）。route 层对 param（`groupChatId`/`memberId` 用 `z.uuid()` 或 `z.string().min(1)`）与 query（cursor 用 `z.coerce.number().int().nonnegative().optional()`）做 zValidator。

### 创建群聊事务（db.batch）

1. 校验 agentIds 去重、数量 1-6、全部属己（`listOwnedUserAgentsByIds` 返回数量 = 去重后数量，否则 403）。
2. `db.batch`：插主表 1 行 + 按 agentIds 顺序插 N 行成员（`display_order` = index，`status=active`，`user_id` 冗余写入）。
3. 返回 `{ groupChat }`（或按 contract 返回 detail）。

### 添加成员上限兜底

- 查现有 `active` 成员数 → 与去重后新增合并 → 若已存在 `removed` 行则复活（update status/removed_at_ms=null/display_order 续接），否则插新行。
- 合并后 `active` 总数 > 6 → 抛 422，不写库。
- 新增 agentIds 必须属己，否则 403。

## 前端（apps/web）

边界（已与用户确认）：foundation 建**完整三栏壳 + 成员管理**，消息区**只读**展示历史；reply-ui 接管发送/乐观更新/回复渲染/分页交互。

- 路由薄壳：`apps/web/app/(app)/group-chats/page.tsx` → `<GroupChatsGuard />`（照 `agents/page.tsx` + `agents-guard.tsx`：`readClientSession` 未登录 `router.replace("/login")`）。
- 组件目录 `apps/web/src/components/group-chat/`：
  - `group-chats-guard.tsx`：登录守卫，通过后渲染 `GroupChatWorkspace`。
  - `group-chat-workspace.tsx`：三栏 Tailwind grid（左列表 / 中消息 / 右成员）。
  - 左栏：群聊列表 + 「新建群聊」入口（手写遮罩 Dialog，选 1-6 个自有 Agent）。
  - 中栏：消息窗口，`overflow-y-auto` 只读渲染 `recentMessages`；为发送框预留底部占位（reply-ui 填充）。
  - 右栏：成员列表 + 移除 + 「邀请 Agent」候选（前端过滤已在群 active 成员的 agentId）。
  - 头像：带背景色 `<span>` + lucide 图标（`packages/ui` 无 Avatar）。
- 数据层：
  - `apps/web/src/api/group-chat.api.ts`：`getGroupChats` / `getGroupChatDetail` / `getGroupChatMessages` / `createGroupChat` / `addGroupChatMembers` / `removeGroupChatMember`，走 `http` + contract schema。
  - `apps/web/src/api/group-chat.query.ts`：`groupChatKeys`（all/list/detail/messages），queryOptions + mutationOptions（创建/加成员/移除成员 `onSuccess` invalidate list + detail）。
- UI 依赖约束：三栏用 grid，Dialog/候选浮层手写遮罩，滚动用原生 `overflow-y-auto`，不引入 `packages/ui` 里不存在的 Dialog/Avatar/Popover/ScrollArea。

## 兼容与回滚

- 纯新增：新迁移、新模块、新契约、新前端目录，不改 `companion_*` / `agents` 现有链路。
- 回滚 = 撤销 0014 迁移 + 删除 group-chat 模块/契约/前端目录 + 摘除 `routes/index.ts` 与 contracts `index.ts` 的导出行。
- 迁移只做 `CREATE TABLE/INDEX`，重跑前需确认本地 D1 未部分建表。

## 关键取舍

- 成员表 `(group_chat_id, agent_id)` UNIQUE + 软移除复活：避免同一 agent 多次进出产生重复行，重复邀请变 update。
- 消息 agent 外键 set null 而非 cascade：agent 真删后保留群聊历史完整性。
- `user_id` 在成员表冗余：成员归属校验与「按用户列群聊」免 join 主表。
- 本任务发送接口与回复逻辑完全不做，contract 不含 `llmConfig`，避免与 reply-ui 抢定义。
