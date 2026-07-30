# 多 Agent 基础 — 执行计划

## 前置

- 参考范式文件（只读，勿改）：
  - `apps/api/src/modules/chat/chat.schema.ts`（drizzle 表写法）
  - `apps/api/src/modules/chat/chat.route.ts`（route 分层、requireWebAccess、buildSuccess）
  - `apps/api/migrations/0012_companion_proactive_care.sql`（迁移风格）
  - `apps/web/src/api/chat.api.ts`、`chat.query.ts`（前端 api/query 范式）
  - `apps/web/src/components/chat/companion-chat.tsx`（三栏/头像/遮罩写法参考）

## 执行顺序

### 1. 契约先行（packages/contracts）

- [ ] 新建 `packages/contracts/src/agents/agent.contract.ts`：`UserAgentSchema`、`CreateUserAgentRequestSchema`、`UpdateUserAgentRequestSchema` 及各响应 schema + 对应 type。
- [ ] `packages/contracts/src/index.ts` 导出上述 schema 与 type（照现有 chat 导出块）。
- [ ] 校验：`pnpm --filter @repo/contracts type-check`（无则 `pnpm -w exec tsc --noEmit` 覆盖该包）。

### 2. 迁移（apps/api/migrations）

- [ ] 新建 `0013_user_agents.sql`：`user_agents` / `agent_conversations` / `agent_memories` 三表，含 CHECK 与 INDEX（见 design）。
- [ ] 反引号标识符 + FK cascade + CHECK，照 0012。
- [ ] 确认编号唯一（当前最大 0012）。

### 3. 后端模块（apps/api/src/modules/agents/）

- [ ] `agents.schema.ts`：3 张 drizzle 表 + `$inferSelect` 导出 Record 类型。
- [ ] `agents.repository.ts`：`createUserAgent` / `listUserAgents` / `getUserAgentById` / `listOwnedUserAgentsByIds` / `listActiveAgentMemories` / `updateUserAgent` / `archiveUserAgent`。
- [ ] `agents.presenter.ts`：Record → contract DTO。
- [ ] `agents.service.ts`：创建/列表/详情/编辑/归档业务，trim 与 owner 校验。
- [ ] `agents.route.ts`：`createAgentsRoute()`，5 个端点，全 `requireWebAccess`，`zValidator` + `invalidRequest`。
- [ ] `index.ts` 导出 `createAgentsRoute`。
- [ ] `apps/api/src/routes/index.ts` 注册 `.route("/", createAgentsRoute())`。

### 4. 前端（apps/web）

- [ ] `src/api/agent.api.ts`：5 个 http 函数 + response schema 校验。
- [ ] `src/api/agent.query.ts`：keys 工厂 + queryOptions + mutationOptions。
- [ ] `app/(app)/agents/page.tsx`：薄壳 + guard。
- [ ] `src/components/agents/agents-manager.tsx`：列表 + 创建 Dialog（手写遮罩）+ 编辑 + 归档。
- [ ] 侧栏/导航加入口（照现有 mode 切换或新增链接，视现有导航结构定）。

## 验证命令（项目质量门，按序）

> 先确认 `package.json` scripts 实际名称；以下为推断，执行前核对。

1. 类型检查：`pnpm -w type-check`（或各包 `tsc --noEmit`）
2. Lint：`pnpm -w lint`
3. Format：`pnpm -w format:check`（或 `prettier --check .`）

前一项报错先修完再跑下一项。只修本任务引入的问题，原有错误列出告知用户。

## 迁移应用（本地）

- [ ] 按项目现有方式应用 D1 迁移（查 `apps/api` 是否有 `wrangler d1 migrations apply` 脚本；不确定则问用户，不自行对生产库操作）。

## 风险与回滚点

- 迁移 0013 应用后回滚需反向迁移；上线前确认。
- 契约导出改动会波及全 workspace 类型；改完立即跑 type-check。
- 前端 Dialog 手写遮罩注意焦点与 Escape 关闭，参考 companion-chat 现有交互。

## 完成标准

- [ ] 5 个 `/rpc/agents` 端点可用，越权（他人 agentId）被拒。
- [ ] 能创建、列出、查看、编辑、归档 Agent。
- [ ] `listActiveAgentMemories` / `listOwnedUserAgentsByIds` 可供群聊任务直接 import。
- [ ] 三项质量门全绿。
- [ ] 单聊（companion\_\*）功能未受影响。
