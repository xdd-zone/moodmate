# 智能发言权判断 — 执行计划

## 有序清单

1. **仓库层**（`group-chat.repository.ts`）
   - `GroupChatMemberWithAgentRow` 增 `conversationMessageCount` / `conversationLastMessageAtMs`。
   - `listActiveMembers` 加 `leftJoin(agentConversations)`（`userId` + `agentId` 双条件），select 增两字段（messageCount 用 `coalesce(..., 0)`）。
   - import `agentConversations`（`@/modules/agents/agents.schema`）。

2. **新文件**（`group-chat.speaking.ts`）
   - 类型：`AgentSpeakingContext` / `GroupSpeakingContext`；`GroupChatUserEmotion` 用 type-only import 自 orchestration。
   - `getRelationshipStageFromMessageCount` / `getRelationshipScore`。
   - `buildGroupSpeakingContext`（纯函数，新鲜度 + 关系阶段汇总）。
   - `scoreAgentForFallbackSelection`（关系/新鲜度/最近发言 + 情绪-人设关键词匹配）。

3. **orchestration.ts**
   - `GroupChatUserEmotionSchema` + 导出 `GroupChatUserEmotion` 类型。
   - 情绪 prompt + `detectGroupUserEmotionWithLangChain`（三法轮询，abort 向上抛）+ `buildFallbackGroupUserEmotion`。
   - state 增 `userEmotion` / `speakingContext`。
   - `detectEmotionNode`；图插入 `classifyIntent -> detectEmotion -> selectAgents`。
   - 选择器 prompt 加 `{speakingContext}` 变量 + 决策原则；`selectGroupAgentsWithLangChain` 格式化上下文传入。
   - `selectionFromLocalRules` 从 state 取 `speakingContext` + `agentRecordsById` 传 `selectAgentsForReply`。
   - `runFallbackOrchestration` 先 `buildGroupSpeakingContext` 再打分。
   - `GroupChatOrchestrationResult` 增 `speakingContext`；入口返回带上。

4. **reply.ts**
   - `selectAgentsForReply` 增可选 `speakingContext` / `agentRecordsById`，点名优先不变，非点名走打分。

5. **service.ts**
   - `orchestration` 类型与落库 metadata 增 `speakingContext`。

## 验证命令

```bash
pnpm --filter @repo/api exec tsc --noEmit
pnpm --filter @repo/api lint
pnpm --filter @repo/api exec prettier --check "src/modules/group-chat/**/*.ts"
```

（先查根 `package.json` / turbo 是否有 `type-check` / `lint` / `format` 脚本，有则优先用项目脚本。）

## 风险点 / 回滚

- **循环依赖**：speaking 与 orchestration 互相 import。优先 type-only import `GroupChatUserEmotion`；若 tsc 报运行时环，把 schema 下沉 speaking。
- **打分要人设文本**：`GroupChatMemberWithAgentRow` 无 persona 字段，打分需 `agentRecordsById`。fallback 路径确保先备好该 map。
- **presenter 泄漏**：新增两个会话统计字段不能进前端契约，核对 `presentMember` / `presentMessage` 未透传。
- **多 Agent 并行回复顺序**：`multi_parallel` 下打分 selectedAgents 顺序变化不影响正确性，仅影响展示序。

## start 前检查

- design.md / implement.md / 两个 jsonl 真实条目就位。
- 与父任务全局约束一致（硬上限、越权、记忆隔离、降级原则）。
