# 实施计划

## 完成标准

- Admin 新菜单、数据概览、用户 Token 抽屉、朋友管理和消息反馈均接真实 API。
- 系统朋友与用户朋友使用统一模型，权限与状态规则可验证。
- Web 可以从朋友档案和头像菜单幂等发起单聊、加载历史并发送消息。
- 每次实际上游 AI 请求均写入调用记录，Token 汇总满足校验关系。
- 旧 companion 结构和静态 Admin 占位已删除。
- 类型、Lint、Format、Web build 和 Admin build 全部通过。

## 阶段 1：重建 contracts 与数据库结构

1. 在 `packages/contracts/src/agents/` 扩展 Agent source、status、editable 和 Admin Agent DTO。
2. 在 `packages/contracts/src/chat/` 新增 direct chat 会话、列表、消息、反馈和发起单聊 contracts。
3. 新增 Admin overview、AI usage、AI call 和 message feedback contracts，并从 `packages/contracts/src/index.ts` 导出。
4. 补充需要的稳定错误码，例如 `AGENT_UNAVAILABLE`。
5. 新增破坏性开发 migration：
   - 按外键顺序删除旧 companion、旧 Agent 会话/记忆和相关群聊外键表。
   - 创建 `agents`、`agent_conversations`、`agent_conversation_messages`、`agent_memories`、`agent_message_feedbacks`、`agent_care_plans`、`agent_care_events`。
   - 重建 `agent_group_*` 对 `agents` 的外键。
   - 创建 `ai_call_records` 和 `admin_sensitive_access_audits` 及索引。
6. 同步 Drizzle schema 和 infer record 类型。
7. 更新 `apps/api/dev/seed.sql`，生成可测试的系统朋友、用户朋友、管理员和用户。

阶段检查：

```bash
pnpm --filter @repo/contracts check-types
pnpm --filter @repo/contracts lint
pnpm --filter api check-types
pnpm --filter api lint
pnpm --filter api exec wrangler d1 migrations apply moodmate-local --local
```

回退点：应用破坏性 migration 前保留开发 D1 快照；此阶段回退必须同时恢复旧代码和旧数据库。

## 阶段 2：统一 Agent 与按朋友单聊 API

1. 将 API 内部 `userAgents`/`UserAgentRecord` 调整为统一 Agent 命名。
2. 修改 Web Agent 查询：返回活跃系统朋友和当前用户朋友；系统朋友 `editable=false`。
3. 保留用户朋友创建、编辑和归档，拒绝通过 Web 修改系统朋友。
4. 修改群聊成员授权、Agent 详情、人设预取和记忆读取，允许活跃系统朋友或当前用户朋友。
5. 新建 direct chat route/service/repository/presenter：
   - 列表。
   - 幂等创建或获取。
   - 详情。
   - 消息分页。
   - 流式发送。
   - 消息反馈。
6. 将现有 companion 分析、记忆与回复逻辑改为接收 `userId + agentId + conversationId`，删除旧 companion route 和兼容读取。
7. 将主动关怀改为用户唯一计划加指定 `agentId`；关怀消息写入对应 direct chat。
8. 确保停用/归档朋友的历史只读，不能发起新回复或主动关怀。

阶段检查：

```bash
pnpm --filter api check-types
pnpm --filter api lint
```

手动接口验证：

- 两个用户都能看到系统朋友。
- 用户只能修改自己的用户朋友。
- 重复创建同一单聊返回同一个 conversationId。
- 他人 conversationId 返回 403 或 404。
- 停用系统朋友不能新建或继续发送。
- 群聊可以加入系统朋友，不能加入他人用户朋友。
- 主动关怀未选择朋友时不能启用；朋友停用后停止执行。

## 阶段 3：AI 调用记录

1. 在 `infra/ai` 增加不依赖 D1 的 Provider 调用观察接口。
2. 在 `modules/ai-usage` 实现记录创建、终态更新、错误映射、聚合和明细查询。
3. 包装 `generateText`、`generateObject`、`streamText` 和工具循环：
   - Provider 请求前写 started。
   - 每次 structured output method 尝试单独记录。
   - 每个 tool loop step 单独记录。
   - 流式 finish/error/abort/iterator return 更新终态。
4. 给单聊、群聊和 LLM 配置测试的所有调用点补场景、用户、朋友、会话和 requestId 上下文。
5. 删除生产代码中绕过记录包装直接调用 AI runtime 的路径。
6. 增加 repository 级聚合验证：总量、今日、按朋友、系统流程、usage unavailable、失败率。

阶段检查：

```bash
pnpm --filter api check-types
pnpm --filter api lint
```

手动数据验证：

- 一次单聊回复产生分析、回复、记忆相关的独立调用行。
- 群聊结构化方法切换时 attemptIndex 连续且 operationId 相同。
- Token 总量等于朋友加系统流程。
- usage 缺失为 null，不计成 0。
- abort 不进入失败率。

## 阶段 4：Admin API 与 BFF

1. 新建 Admin overview module，按 `Asia/Shanghai` 生成统计区间并实时聚合。
2. 扩展 users module：业务计数、最近活跃、AI 用量汇总和调用明细。
3. 为 agents module 增加 Admin 列表、详情、系统朋友创建/编辑/停用/启用/删除。
4. 增加 message feedback Admin 列表和详情；详情先写审计再返回一问一答。
5. 将新 routes 挂到 `apps/api/src/routes/index.ts`。
6. 在 `apps/admin/app/api`、`src/server`、`src/api` 和 Query 层增加对应 BFF 与请求函数。
7. 所有响应使用 contracts 解析，浏览器不接触 Admin access token。

阶段检查：

```bash
pnpm --filter api check-types
pnpm --filter api lint
pnpm --filter admin check-types
pnpm --filter admin lint
```

## 阶段 5：Web 发起单聊

1. 将聊天列表从单条 companion query 改为 direct chats list query，并继续与群聊合并。
2. 将 direct chat 页面改为按 URL conversationId 查询详情与消息。
3. 将 composer 发送目标改为 `/rpc/direct-chats/:conversationId/messages`。
4. 新增发起单聊 mutation，成功后跳转 `/chats/direct/:conversationId`。
5. 接入朋友档案“开始聊天”按钮。
6. 接入头像菜单“发起私聊”，删除“暂未开放”状态。
7. 在主动关怀设置中增加唯一的关怀朋友选择器和不可用提示。
8. 系统朋友隐藏编辑和归档操作，用户朋友保留现有操作。
9. 补齐 loading、重复点击、停用朋友和请求失败状态。

阶段检查：

```bash
pnpm --filter web check-types
pnpm --filter web lint
pnpm --filter web build
```

手动流程：

- 用户朋友档案 -> 开始聊天 -> 创建会话 -> 发送消息 -> 刷新后历史仍在。
- 再次从同一朋友发起 -> 打开原会话。
- 系统朋友走同一流程，但没有编辑和归档操作。
- 选择关怀朋友并手动触发后，消息进入对应单聊，Token 归该朋友。
- 移动端和桌面端不出现按钮、标题和抽屉重叠。

## 阶段 6：Admin 页面与菜单

1. 重构 `AdminShell` 菜单分组和默认跳转。
2. 实现 `/overview`，所有数字来自 overview API。
3. 扩展 `/users` 列表并实现 Token 用量抽屉的汇总与明细页签。
4. 实现 `/friends` 列表、筛选和详情；系统朋友提供管理表单，用户朋友只读。
5. 实现 `/feedback` 列表和受审计的详情抽屉。
6. 删除 `/moods`、`/settings` 及对应静态组件与无用样式。
7. 更新 Admin 登录页中仍引用“情绪记录”的说明。
8. 更新 `docs/architecture.md` 当前源码状态、Admin 模块、Agent 与单聊边界，只改本次相关章节。

阶段检查：

```bash
pnpm --filter admin check-types
pnpm --filter admin lint
pnpm --filter admin build
```

手动页面验证：

- `http://localhost:6154/overview` 的指标与 D1 查询一致。
- 用户 Token 抽屉的累计、今日、朋友和系统流程校验相等。
- 用户朋友无编辑按钮；系统朋友可创建、编辑、停用和重新启用。
- 反馈列表不含消息正文；详情打开后新增一条审计。
- Latte/Mocha、桌面和移动端均无重叠，键盘可访问主要操作。

## 最终质量检查

严格按顺序运行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter web build
pnpm --filter admin build
```

项目当前没有集成测试配置。实现时优先为 AI 记录归属、统计聚合、Agent 权限和幂等会话补可运行的最小测试；若仍未增加测试脚本，最终报告必须列出手动验证结果。

## 提交前检查

- 对照 `prd.md` 逐项核对验收条件。
- 检查 contracts 没有数据库 record 或页面 view model。
- 检查 Admin 与 Web 使用各自 DTO 和 BFF/API 请求层。
- 检查生产 AI 调用没有绕过记录包装。
- 检查不含旧 companion 兼容分支和用户操作事件表。
- 检查没有费用字段、价格配置、自动过期任务和虚构统计。
