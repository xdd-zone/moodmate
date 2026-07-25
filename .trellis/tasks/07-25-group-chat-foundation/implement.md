# 群聊底座 执行计划

## 顺序清单

按 contract → migration/schema → repository → service → route → 前端 数据流方向落地，先后端跑通再接前端。

### 1. Contract 先行（packages/contracts）

- [ ] 新建 `packages/contracts/src/chat/group-chat.contract.ts`，按 design「Contract」节定义全部 schema + `z.infer` 类型。
- [ ] `agentIds` 上下限 `.min(1).max(6)` 写在 schema 层；`title` `.trim().min(1).max(120)`。
- [ ] 不定义 `SendAgentGroupChatMessageRequestSchema` 与 `llmConfig`。
- [ ] `packages/contracts/src/index.ts` 追加导出全部 schema 与类型（照 `agents/agent.contract` 段落的成对 export/export type 写法）。

### 2. 迁移 + drizzle schema（apps/api）

- [ ] 新建 `apps/api/migrations/0014_group_chat_foundation.sql`：三张表 + 索引，照 `0012`/`0013` 风格（反引号、显式 `FOREIGN KEY ... ON DELETE`、`CONSTRAINT ... CHECK`、独立 `CREATE INDEX`）。
- [ ] 新建 `apps/api/src/modules/group-chat/group-chat.schema.ts`：drizzle 三表定义 + `$inferSelect` 类型，与 SQL 一一对应。外键：members.agent_id / group_chat_id / user_id cascade；messages.group_chat_id cascade、agent_id set null。

### 3. repository（apps/api）

- [ ] `group-chat.repository.ts`：
  - `insertGroupChatWithMembers`（`db.batch`：主表 1 行 + 成员 N 行，display_order=index）。
  - `listGroupChatsForUser`（join/子查询算 memberCount，按 updated_at_ms desc）。
  - `getGroupChatById`（归属校验用）。
  - `listActiveMembers` / `listGroupChatMessages`（游标 `created_at_ms < cursor`，limit+reverse，照 chat.repository 分页写法）。
  - `addOrReviveMembers`（存在 removed 行→复活 update；否则插新行；display_order 续接）。
  - `removeMember`（软移除：status=removed、removed_at_ms）。
  - `countActiveMembers`。

### 4. service + presenter（apps/api）

- [ ] `group-chat.presenter.ts`：`presentMember` / `presentMessage` / `presentListItem` / `presentDetail`。
- [ ] `group-chat.service.ts`：`listGroupChatsForUser` / `createGroupChatForUser` / `getGroupChatDetail` / `getGroupChatMessages` / `addGroupChatMembers` / `removeGroupChatMember`。
  - 越权：`getGroupChatById` 不属己 → `AppError(BizCode.AUTH_FORBIDDEN, ..., 403)`（复用 agents 的 `forbidden()` 模式）。
  - agentIds 去重后用 `listOwnedUserAgentsByIds`（agents.repository 已有）校验属己，缺失 → 403。
  - 成员上限：`countActiveMembers + 去重新增 > 6` → `AppError(BizCode.COMMON_INVALID_REQUEST, ..., 422)`。

### 5. route + 注册（apps/api）

- [ ] `group-chat.route.ts`：6 个端点（前缀 `/rpc/chat/group`），`requireWebAccess` + `zValidator`（param/query/json）+ 响应 `Schema.parse` + `buildSuccess(data, createMeta(...))`，照 `agents.route.ts` / `chat.route.ts`。
- [ ] `group-chat/index.ts`：`export { createGroupChatRoute }`。
- [ ] `apps/api/src/routes/index.ts`：import + `.route("/", createGroupChatRoute())`。

### 6. 前端数据层（apps/web/src）

- [ ] `apps/web/src/api/group-chat.api.ts`：6 个函数走 `http` + contract schema（照 `agent.api.ts`）。
- [ ] `apps/web/src/api/group-chat.query.ts`：`groupChatKeys`（all/list/detail(id)/messages(id)）+ query/mutation options（创建/加成员/移除 `onSuccess` invalidate list + detail）。

### 7. 前端三栏页面（apps/web）

- [ ] `apps/web/app/(app)/group-chats/page.tsx`：薄壳 + metadata → `<GroupChatsGuard />`。
- [ ] `apps/web/src/components/group-chat/`：
  - `group-chats-guard.tsx`（照 `agents-guard.tsx` 登录守卫）。
  - `group-chat-workspace.tsx`（三栏 grid）。
  - 左栏群聊列表 + 新建群聊 Dialog（手写遮罩，选 1-6 Agent）。
  - 中栏只读消息区（`overflow-y-auto` 渲染 recentMessages，底部预留发送框占位）。
  - 右栏成员列表 + 移除 + 邀请候选（过滤已在群 active 成员）。
  - 头像用带背景色 `<span>` + lucide 图标。

## 验证命令（受影响包，按 类型 → lint → format 顺序）

```bash
# contracts
pnpm --filter @repo/contracts check-types
pnpm --filter @repo/contracts lint
pnpm --filter @repo/contracts format:check

# api
pnpm --filter api check-types
pnpm --filter api lint
pnpm --filter api format:check

# web
pnpm --filter web check-types
pnpm --filter web lint
pnpm --filter web format:check
```

> contracts 先过（api/web 依赖其类型）。format 用 `format:check`，报错时 `format` 自动修复后复跑。

## 手动验收（对照 prd Acceptance Criteria）

- [ ] 创建群聊选他人 Agent → 403；选 >6 个 → schema 层拒绝（contract 层 max(6)）。
- [ ] 创建成功后主表 1 行 + 成员按 display_order 顺序 N 行。
- [ ] 详情返回群聊信息 + 成员 + recentMessages。
- [ ] 添加成员使 active 超 6 → 422，不写库；removed 成员重新邀请走复活。
- [ ] 移除成员 = 软移除（status/removed_at_ms），不删行。
- [ ] messages 游标返回更早消息，无更多时 nextCursor 为 null。
- [ ] 前端可建群/切群/看详情/管成员，邀请列表过滤已在群成员。

## 风险与回滚点

- 高风险文件：`packages/contracts/src/index.ts`、`apps/api/src/routes/index.ts`（追加式改动，勿动既有行）。
- 迁移只做 `CREATE`；本地已部分建表时先手动 drop 再重跑，避免 `already exists`。
- 回滚：撤 0014 迁移 + 删 group-chat 模块/契约/前端目录 + 摘 `routes/index.ts` 与 contracts `index.ts` 的两处导出。
