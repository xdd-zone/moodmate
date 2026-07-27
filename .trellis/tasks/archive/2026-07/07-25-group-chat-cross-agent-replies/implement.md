# 执行计划：Agent 间互相回应

改动 3 个文件，全在 `apps/api/src/modules/group-chat/`。按顺序做，每步只服务对应需求。

## 顺序清单

### 1. group-chat.reply.ts — 补充回应生成器

- [ ] 新增本地 helper `normalizeText(value: string, maxLen: number): string`（trim + 截断），仅本文件用。
- [ ] 新增 `buildCrossAgentReply`，与 `buildAgentReply` 并列。入参在 `buildAgentReply` 基础上加 `respondToName: string`、`angle: string`。system prompt 强调"非首轮/承接观点/1-2 句/不重新完整回答/不要求他人继续/不制造争论"等约束；user prompt 复用群聊上下文并点明回应对象与补充角度。输出 `normalizeText(text, 800)`。
  - 对应 R6。

### 2. group-chat.orchestration.ts — 编排主体

- [ ] 顶部新增常量 `groupCrossReplyLimit = 2`、`groupCrossReplyRoundLimit = 1`（就近 `groupReplyAgentLimit` 引用处）。对应 R1。
- [ ] `PlannedAgentReply` 接口新增可选字段 `replyKind` / `respondToAgentId` / `crossReplyReason` / `crossReplyRound`。对应 R2。
- [ ] 首轮回复生成处标记 `replyKind: "primary"`：`generateSingleReply` 的 completed 返回值补该字段（failed 占位可不填，默认按 primary 处理）。对应 R2。
- [ ] 新增 `GroupChatCrossReplyPlanSchema` + 导出 `GroupChatCrossReplyPlan` 类型。对应 R3。
- [ ] 新增 `groupChatCrossReplyPlanPrompt`（ChatPromptTemplate，system 讲清何时 enabled=true/false，human 给 roster + 首轮回复 + 用户消息）。对应 R3。
- [ ] 新增 `planCrossRepliesWithLangChain`：遍历 `STRUCTURED_OUTPUT_METHODS`，`withStructuredOutput(GroupChatCrossReplyPlanSchema)`；全失败返回 `enabled:false` 降级 plan；abort 向上抛。对应 R3/R8。
- [ ] 新增 `normalizeCrossReplyPlan({ plan, agents, primaryReplies })`，过滤链见 design.md。对应 R4。
- [ ] `GroupChatOrchestrationState` 新增 `primaryReplies`、`crossReplyPlan` 两个 Annotation。对应 R5。
- [ ] 新增 `generateCrossAgentRepliesNode`，逻辑见 design.md（读首轮 -> 规划 -> 归一化 -> 串行生成 ≤2 条 -> 合并）。单条生成失败静默跳过。对应 R5/R6/R8。
- [ ] 图接线插入新节点：`generateReplies -> generateCrossReplies -> checkQuality`。对应 R5/AC1。
- [ ] `checkQualityNode` 前的 `applyQualityRevisions` 改造：按 `replyCountByAgentId === 1` 才允许 revision 覆盖。对应 R7。
- [ ] `GroupChatOrchestrationResult` 新增 `crossReplyPlan: GroupChatCrossReplyPlan | null`；正常路径回填 `result.crossReplyPlan ?? null`。对应 R9。
- [ ] `orchestrateGroupChatReplies` 初始 state 补 `primaryReplies: []`、`crossReplyPlan: null`。
- [ ] `runFallbackOrchestration` 返回值补 `crossReplyPlan`（enabled:false 降级 plan），并给 fallback 的 replies 标 `replyKind: "primary"`（复用 generateGroupReplies 已标记则无需重复）。对应 R8。

### 3. group-chat.service.ts — metadata 落库

- [ ] `orchestration` 对象类型与赋值加 `crossReplyPlan: result.crossReplyPlan`。对应 R9。
- [ ] `agentRows` push 时带上 `replyKind` / `respondToAgentId` / `crossReplyReason` / `crossReplyRound`（`GroupChatMessageWithAgentRow` 不含这些字段，用单独变量或扩展本地行类型透传，避免污染 repository 行类型）。
- [ ] agent 消息 `metadataJson` 增补四个字段（`?? "primary"` / `?? null`）。对应 R9。
- [ ] 确认 `presentMessage` 与返回 `agentMessages` 不受影响（metadata 不进契约）。对应 R10/AC7。

## 验证命令

按项目质量门顺序，全绿才算完成（对应 AC8）：

```bash
pnpm check-types
pnpm lint
pnpm format:check
```

format 若有差异，跑 `pnpm format` 修复后重跑 `pnpm format:check`。

## 手动验证要点

项目无集成测试，靠人工/日志验证：

- enabled=false 路径：普通单人消息不追加补充回应，`replies === primaryReplies`。
- enabled=true 路径：群体提问触发首轮多人后，最多追加 2 条 `cross_agent`，`respondToAgentId` 指向首轮 Agent。
- 降级：模拟规划失败 / 整图失败，均不追加补充回应，基础回复正常。
- metadata：抽查一条 cross_agent 消息的 `metadata_json`，含 `replyKind:'cross_agent'`、`respondToAgentId`、`crossReplyReason`、`crossReplyRound:1`，`orchestration.crossReplyPlan` 存在。

## 风险文件与回滚点

- `group-chat.orchestration.ts`：改动最集中，`applyQualityRevisions` 与图接线是易错点。回滚：git 还原三文件即可，无迁移、无状态。
- `group-chat.service.ts`：`agentRows` 透传新字段时注意不要破坏现有 `GroupChatMessageWithAgentRow` 消费方（presenter）。

## start 前检查

- [ ] prd.md / design.md / implement.md 三件齐备并经用户 review。
- [ ] implement.jsonl / check.jsonl 各有真实条目。
