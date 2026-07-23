# Agent 记忆系统执行计划

## 1. 数据库和共享契约

- [x] 新增 `0008_companion_chat_memory.sql`，创建会话、消息和记忆表及索引。
- [x] 在聊天模块新增对应 Drizzle schema。
- [x] 扩展 companion chat contract，加入 `conversationId`、历史响应和记忆管理 schema。
- [x] 从 `packages/contracts/src/index.ts` 导出新增 schema 和类型。

检查点：contracts 和数据库字段逐项对应，接口不导出数据库 record。

## 2. API 持久化与历史接口

- [x] 新增 chat repository，支持默认会话、消息分页、会话更新和记忆读写。
- [x] 新增 presenter，把数据库字段转换为 contracts DTO。
- [x] 在现有 chat route 增加会话、分页和记忆管理接口。
- [x] 所有 repository 读写带当前 Web `userId`。
- [x] 校验空游标、非数字游标、非当前会话 ID 和不存在的记忆 ID。

检查点：历史按从旧到新返回；删除只修改状态；查询不返回 `deleted`。

## 3. 发送、prompt 和回复保存

- [x] 重构 chat service，使用服务端历史、摘要和启用记忆组装 prompt。
- [x] 在调用 LLM 前保存本轮用户消息并更新会话。
- [x] 扩展文本流转换，在正常结束时返回完整 assistant 文本。
- [x] 保存 assistant 消息并更新摘要、消息数和最近消息时间。
- [x] 实现规则记忆提取、重要度、完全相同内容去重和每轮两条上限。
- [x] 记忆写入失败只记录日志，不使已完成的回复失败。

检查点：本轮用户文本只进入 prompt 一次；流失败不保存不完整 assistant 文本；现有本地 LLM 配置和平台 DeepSeek 选择逻辑保持不变。

## 4. Web 历史恢复

- [x] 新增 companion chat API 请求函数和 query key。
- [x] 聊天组件先加载服务端会话，再初始化 `useChat`。
- [x] 发送请求附带 `conversationId`，仍只提交最近 20 条 UI 消息。
- [x] 增加加载更早消息入口和进行中状态。
- [x] 历史 assistant 文本直接完整显示，新回复继续逐字显示。
- [x] 对话完成后刷新会话缓存和左侧最新消息预览。

检查点：加载、失败、无历史、有历史和无更多历史五种状态都可区分。

## 5. Web 记忆管理

- [x] 为 Web HTTP 客户端增加 PATCH 和 DELETE。
- [x] 新增记忆 API 请求和 TanStack Query 配置。
- [x] 在设置菜单增加记忆区域。
- [x] 展示记忆类型、内容、重要度、状态、更新时间和来源消息。
- [x] 支持编辑、启用、停用和软删除，并显示提交与失败状态。

检查点：删除后不再显示；停用后仍可查看和重新启用；表单输入满足 contracts 限制。

## 6. 验证

按顺序运行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter web build
```

本地 D1 手动验证命令：

```bash
pnpm --filter api exec wrangler d1 migrations apply moodmate-local --local
```

手动检查：

- [ ] 首次打开无历史会话。
- [x] 发送消息后刷新，用户消息和 assistant 回复仍存在。
- [ ] 模型请求失败后刷新，用户消息仍存在。
- [ ] 超过 40 条后加载更早消息，顺序正确且没有重复。
- [ ] 符合关键词规则的消息产生长期记忆，重复内容只保存一次。
- [ ] 编辑、停用、启用和删除记忆后页面与服务端一致。
- [x] Latte、Mocha、移动端、桌面端和减少动态效果模式可用。

## 回退点

- 数据库迁移为纯新增。业务代码回退时保留新增表，不执行删除表操作。
- contracts、API 和 Web 必须作为一组回退，避免前端读取不存在的字段或接口。
- 若流结束保存逻辑影响现有输出，先恢复 provider 的原始纯文本转换，再停用历史写入，不改认证和 LLM 配置逻辑。
