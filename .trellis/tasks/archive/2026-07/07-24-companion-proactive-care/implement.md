# 主动关怀系统 — 执行计划

## 迁移编号分配

本任务固定占用 `0012_companion_proactive_care.sql`。迁移编号已在父任务层统一分配：子任务 B（反馈闭环）用 `0011`，本任务用 `0012`，互不冲突。不论落地先后都按此编号，不复用 `0011`。

## 实施顺序（后端 → contract → 前端）

### 1. Contract（先定类型，前后端共用）

- [ ] 新建 `packages/contracts/src/chat/companion-care.contract.ts`：scene/frequency/tone enum、`CompanionCarePlanSchema`、`UpsertCompanionCarePlanRequestSchema`、`CompanionCareEventSchema`、`GenerateCompanionCareEventRequestSchema`、三个响应 schema，及对应 `z.infer` 类型。
- [ ] `CompanionConversationResponseSchema`（companion-chat.contract.ts）追加 `hasUnreadCareEvent: z.boolean()`。
- [ ] `packages/contracts/src/index.ts` 追加 export（schema 块 + type 块），风格对齐现有 companion-\* 导出。

### 2. Schema + Migration

- [ ] `apps/api/src/modules/chat/chat.schema.ts` 新增 `companionCarePlans`、`companionCareEvents` 两表定义 + 类型导出，对齐现有表的 index/check 写法。
- [ ] 新建 `apps/api/migrations/0012_companion_proactive_care.sql`：建两表 + 索引 + 约束。SQL 与 drizzle schema 保持一致。

### 3. Repository（chat.repository.ts 追加）

- [ ] `findCompanionCarePlan`（含 scenes_json 白名单清洗）
- [ ] `upsertCompanionCarePlan`（先查再 update/insert，保留 created_at_ms）
- [ ] `insertCompanionCareEvent`
- [ ] `listCompanionCareEvents`
- [ ] `markCompanionCareEventsRead`
- [ ] `countUnreadCareEvents`

### 4. Service（chat.service.ts 追加）

- [ ] `calculateNextCareRunAtMs`（纯函数）
- [ ] `buildProactiveCareMessage` + `getCareTonePrefix` + scene 模板表
- [ ] `getCompanionCarePlan`（查不到用默认 upsert）
- [ ] `updateCompanionCarePlan`（算 nextRun → upsert → 返回）
- [ ] `listCompanionCareEvents`
- [ ] `generateCompanionCareEvent`（编排：选 scene → 取会话 → 文案 → 插消息 → 插事件 → 返回）
- [ ] 改造 `getCompanionConversation`：先 `countUnreadCareEvents` → `markCompanionCareEventsRead`（try/catch）→ 读历史 → 响应带 `hasUnreadCareEvent`

### 5. Route（chat.route.ts 追加 4 端点）

- [ ] GET/PATCH `/rpc/chat/companion/care-plan`
- [ ] GET `/rpc/chat/companion/care-events`
- [ ] POST `/rpc/chat/companion/care-events/generate`
- [ ] 检查 `apps/api/src/app.ts` CORS allowMethods 含 PATCH（缺则补）

### 6. Web

- [ ] `apps/web/src/api/chat.api.ts` 追加 4 方法
- [ ] `apps/web/src/api/chat.query.ts` 追加 care queryKey/options
- [ ] `companion-chat.tsx`：`SettingsSection` 加 `"care"`、`settingsMenu` 加项、`settingsTitle.care`、section 渲染分支
- [ ] `settings-panels.tsx` 新增 `CarePanel`（表单 + 保存 + 生成 + 最近记录）
- [ ] 入口未读小圆点：读 `hasUnreadCareEvent`

## 验证命令

按项目根 Execution Rules：代码改完不自动跑 dev/build，仅按质量门跑静态检查。

```bash
pnpm --filter @repo/contracts check-types   # contract 先单独过
pnpm check-types
pnpm lint
pnpm format
```

数据库迁移由用户手动执行验证：

```bash
pnpm --filter @repo/api db:migrate:local
```

## 手动验证建议（交用户，不自动执行）

1. 执行 0012 迁移，确认两表存在。
2. 打开设置 → 主动关怀，确认面板加载默认计划。
3. 改频率/时间/场景/语气，保存后刷新回显。
4. 点生成关怀，确认最近记录新增一条。
5. 确认关怀消息出现在聊天历史（role=assistant）。
6. 确认入口未读提示出现；打开会话后消失。

## 风险文件与回滚点

- `chat.service.ts` 的 `getCompanionConversation` 改造：影响会话主链路，未读统计/已读标记必须 try/catch，失败不能抛。这是唯一碰核心链路的改动，重点 review。
- `CompanionConversationResponseSchema` 加字段：用可选/默认 false，避免老数据/老前端报错。
- 回滚：撤销 route 注册 + 面板 section 即停用；两表保留无害。

## 与其他子任务的协调

- 会话响应 schema（`CompanionConversationResponseSchema`）本任务加 `hasUnreadCareEvent`，反馈闭环任务改的是 `CompanionConversationMessageSchema` 的 `feedback` 字段，两者不同 schema、不冲突。若两任务并行改到 index.ts 导出，注意合并顺序。
