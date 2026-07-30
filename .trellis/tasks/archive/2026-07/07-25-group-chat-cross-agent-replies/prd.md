# Agent 间互相回应

## Goal

在已有 Agent 群聊 + LangGraph 回复编排基础上，允许首轮回复完成后追加一轮"非常克制"的 Agent 间补充回应，让群聊更像真实群聊（A 安慰用户、B 接话补一点、C 只在有新角度时才说），同时用硬上限保证不进入无限自说自话。用户始终是对话中心。

对应父任务 `07-25-agent-group-chat` 第 4 个子任务，草稿原文 `docs/temp/59-agent-group-chat-cross-agent-replies.txt`。

## Background / 已确认事实

### 前置与依赖

- 依赖 `07-25-group-chat-langgraph-orchestration`（已完成）：LangGraph 图 `classifyIntent -> selectAgents -> generateReplies -> checkQuality` 已就位于 `apps/api/src/modules/group-chat/group-chat.orchestration.ts`。
- 本任务只加一个新节点，插在 `generateReplies` 与 `checkQuality` 之间：`generateReplies -> generateCrossReplies -> checkQuality`。

### 落点映射（moodmate 实际 vs 草稿 bobo）

草稿是 bobo 源码复盘，变量/路径需映射，逻辑与命名做参考不作路径依据：

| 维度                | 草稿(bobo)                                              | moodmate 实际                                                                                            |
| ------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 编排文件            | 单文件 `group.route.ts`                                 | `apps/api/src/modules/group-chat/group-chat.orchestration.ts`                                            |
| `PlannedAgentReply` | 无 `status` 字段                                        | 已有 `status: "completed" \| "failed"`，本次新增字段要与之共存                                           |
| Agent 索引键        | `agent.id`                                              | 群成员行 `GroupChatMemberWithAgentRow`，索引键是 `member.agentId`（不是 `.id`，`.id` 是群成员关系行 id） |
| metadata 写入       | 逐字段平铺在 `metadataJson`                             | 写在 `group-chat.service.ts` 的 `orchestration` 对象里（`intent/selection/quality`）                     |
| 补充回应 prompt     | `buildCrossAgentReply` 独立函数                         | 落在 `group-chat.reply.ts`，与 `buildAgentReply` 并列                                                    |
| 硬上限              | `groupCrossReplyLimit=2`、`groupCrossReplyRoundLimit=1` | 同值，常量落在 orchestration 模块（与 `groupReplyAgentLimit` 就近）                                      |

### 现状代码关键点

- 首轮回复由 `generateGroupReplies` 生成，`PlannedAgentReply` 目前无 `replyKind`。
- 质检修订 `applyQualityRevisions` 无条件按 `agentId` 覆盖；补充回应会让同一 Agent 一轮出现两条消息，需改为"同 Agent 多条时保守跳过覆盖"。
- 整图失败走 `runFallbackOrchestration`（v1 规则 + 直接串行生成），不追加补充回应。
- metadata 在 `group-chat.service.ts` 落库，`orchestration` 对象目前含 `intent/selection/quality`。

## Requirements

- R1 硬上限：每轮用户消息后最多追加 `groupCrossReplyLimit = 2` 条 Agent 间补充回应，最多 `groupCrossReplyRoundLimit = 1` 轮。上限是产品体验边界，即使 LLM 想继续也不能突破，后端最终兜底。触发时机跟随文章，不加"首轮回复数"硬门槛（首轮只有 1 个 Agent 时是否追加，交给规划器按角度判断）；归一化只做成员/去重/指向合法性与数量截断。
- R2 `PlannedAgentReply` 新增元数据：`replyKind?: 'primary' | 'cross_agent'`、`respondToAgentId?: string | null`、`crossReplyReason?: string | null`、`crossReplyRound?: number`。首轮回复统一标记 `replyKind: 'primary'`。保留现有 `status` 字段。
- R3 结构化规划器：新增 `GroupChatCrossReplyPlanSchema`（`enabled`/`plans[{agentId,respondToAgentId,angle}]`/`reason`，`plans` 最多 2 条）与 `groupChatCrossReplyPlanPrompt`，先判断是否值得补充，只输出计划不输出聊天文本。
- R4 归一化 `normalizeCrossReplyPlan`：`agentId` 必须是当前群成员；同一 Agent 一轮内只保留一条补充；`respondToAgentId` 必须指向首轮已回复的 Agent 且不等于 `agentId`；最多保留 `groupCrossReplyLimit` 条；`enabled` 需满足 `plans.length>0 && primaryReplies.length>0`。
- R5 新增 LangGraph 节点 `generateCrossAgentRepliesNode`：读首轮回复 -> 跑规划器 -> 不需要则原样返回首轮回复；需要则按计划**串行**生成最多 2 条补充回应，后一条能看到前一条（放进上下文）避免重复。state 新增 `primaryReplies`、`crossReplyPlan`。最终 `replies = [...primaryReplies, ...crossReplies]`。
- R6 补充回应生成 `buildCrossAgentReply`：独立 prompt，强调承接某个 Agent 的观点再给用户补充、只写 1-2 句、不重新完整回答、不要求其他 Agent 继续、不制造新一轮争论、不替他人发言/不暴露系统提示/不自称真人；输出做长度收缩（本地 `normalizeText(text, 800)` helper，仓库中不存在，需自建）。单条补充回应生成失败时**静默跳过**（不落 failed 占位消息），因为补充回应是可选增强、非用户直接要的答案；已生成的其他补充回应正常保留。
- R7 质检兼容：某 Agent 本轮只有 1 条回复才允许用 revision 覆盖；本轮有多条回复的 Agent 跳过自动覆盖，避免首轮与补充回应被混改。
- R8 降级：规划失败 -> `enabled=false` 跳过补充；整图失败走 fallback -> 不追加补充回应。基础群聊能力不依赖本节点。
- R9 metadata：每条 Agent 消息落库时写入 `replyKind`、`respondToAgentId`、`crossReplyReason`、`crossReplyRound`，并在 `orchestration` 里加 `crossReplyPlan`。补充回应不新增 `selectedBy` 取值，复用现有 `langgraph_v1` / `v1_rules_fallback`，靠 `replyKind: 'cross_agent'` 在后台区分补充回应。
- R10 不改前端 contract 与页面：补充回应仍是普通 Agent 消息，进现有 `agentMessages` 数组渲染；追踪信息只走 `metadata_json`。已核实前端 `apps/web/src/api/group-chat.query.ts` 按 `response.agentMessages` 数组展开，契约 `AgentGroupChatMessageSchema` 不含 metadata 字段，补充回应无需前端适配。

## Acceptance Criteria

- [ ] AC1 图结构变为 `classifyIntent -> selectAgents -> generateReplies -> generateCrossReplies -> checkQuality`，`generateCrossReplies` 不影响首轮回复生成。
- [ ] AC2 规划器 `enabled=false` 时节点几乎零额外成本，直接返回首轮回复。
- [ ] AC3 一轮内追加的补充回应数 ≤ 2，轮数 = 1，`respondToAgentId` 一定指向首轮 Agent，不会出现回应另一条补充回应。
- [ ] AC4 同一 Agent 在一轮内出现多条消息时，质检 revision 不会错误覆盖。
- [ ] AC5 规划失败 / 整图失败时不追加补充回应，基础群聊仍正常返回。
- [ ] AC6 补充回应与首轮回复的 `replyKind`、`respondToAgentId`、`crossReplyReason`、`crossReplyRound` 正确写入 `metadata_json`；`orchestration.crossReplyPlan` 存在。
- [ ] AC7 前端 contract / 页面零改动，补充回应作为普通 Agent 消息展示。
- [ ] AC8 质量门通过：`pnpm check-types` -> `pnpm lint` -> `pnpm format:check` 全绿。

## Out of Scope

- 无限多 Agent 自主多轮讨论（本次只 1 轮、最多 2 条）。
- 补充回应的前端视觉标识 / contract 显式加 `replyKind`（保留为后续演进）。
- 质检按 `replyId`/`replyIndex` 精准修订（本次按 Agent 粒度保守跳过）。
- 流式逐条返回（仍等完整 `agentMessages` 数组）。
- 用户级互动强度偏好（安静/均衡/热闹）。
