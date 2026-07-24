# 关系阶段系统

对应课程章节 `docs/temp/52-agent-chat-relationship-stage-system.txt`。父任务 `07-23-agent-chat-understanding`，第四个子任务。

## 目标

给聊天链路加入动态关系阶段判断：结合消息数量、会话摘要、最近对话、长期记忆、安全边界、意图、情绪判断当前关系阶段、亲密边界和推进节奏，再让它影响情绪路由和 Reply Policy。阶段放在情绪识别之后、情绪路由之前。

## 前置

- 依赖 `07-23-emotion-routing`（`EmotionRoute` / `buildEmotionRoute`）和 `07-23-reply-policy`（`ReplyPolicy` / `buildReplyPolicy`）已落地。
- 复用现有 `companionConversations.summary` 和 `messageCount` 作为分析器入参，不做 D1 迁移。

## 需求

### Schema（`packages/contracts/src/chat/companion-analysis.contract.ts`）

- 新增 `ConversationRelationshipStageSchema`，字段照课程：
  - `stage`: `new_connection` / `warming_up` / `comfortable_chat` / `trusted_companion` / `close_bond` / `repairing` / `boundary_sensitive` / `dependency_watch`
  - `displayName`(1-80)、`closenessScore`(0-100 整数)、`trustLevel`(low/medium/high)、`stability`(new/warming/stable/deepening/fragile/repairing)、`boundaryMode`(open/warm/careful/firm)、`intimacyPermission`(low/medium/high)、`pacing`(slow_down/hold/advance_gently/repair_first)
  - `riskSignals`: 数组(max 5)，枚举 `low_history`/`dependency_risk`/`boundary_testing`/`conflict`/`pulling_away`/`sexual_boundary`/`emotional_volatility`
  - `relationshipGuidance`: string(max 700)
- 导出类型并从 `index.ts` re-export。

### LangChain 判断器 + 兜底（`chat.analysis.ts`）

- `conversationRelationshipStagePrompt`：明确要求模型不回复用户，只判断关系阶段，结合消息数量、会话摘要、最近对话、记忆、安全、意图、情绪；历史少即使语气亲密也不判定深度亲密；出现误会/失望/冷淡/边界测试/依赖风险优先标 repairing / boundary_sensitive / dependency_watch。
- `analyzeRelationshipStageWithLangChain`：`withStructuredOutput` + 三种 method 兜底，全失败走启发式兜底。
- 启发式兜底：按 `messageCount`、记忆重要度、亲近信号算 `closenessScore`，再按课程阈值分档（>=80&>=75 close_bond；>=36&>=58 trusted_companion；>=16&>=38 comfortable_chat；>=6 warming_up；否则 new_connection）。
- `normalizeRelationshipStage`：产品规则兜底——`messageCount < 6` 拉回 new_connection；`emotional_dependency` 或 `dependency_risk` 切 dependency_watch；`conversation_repair` / conflict / feeling_hurt / hurt / disappointed 切 repairing。

### 接入 LangGraph（`chat.analysis.ts`）

- `ConversationUnderstandingState` 新增 `conversationSummary`、`messageCount`、`relationshipStage` 字段。
- 新增 `analyzeRelationshipStageNode`，图顺序改为 `normalizeInput -> classifyIntent -> detectEmotion -> analyzeRelationshipStage -> routeEmotion -> buildReplyPolicy`。

### 影响路由与策略

- `buildEmotionRoute` 增加 `relationshipStage` 入参：
  - repairing / pacing=repair_first 强制 `relationship_repair`。
  - boundary_sensitive / dependency_watch / boundaryMode=firm 强制 `calm_deescalation`。
  - route=playful_flirt 但 new_connection 或 intimacyPermission=low 时降到 `light_companion`。
- `buildReplyPolicy` 增加 `relationshipStage` 入参：
  - intimacyPermission=low 时 intimacyLevel=low、禁 intense_flirt。
  - pacing=slow_down 压缩句数、减少追问和建议。
  - pacing=repair_first 切 relationship_repair、openingMove=apologize。

### 主流程与落库（`chat.service.ts`）

- `prepareCompanionChat` 给分析器传 `conversationSummary`、`messageCount`。
- metadata 升级为 `conversation-understanding-v2`，写入 safety/intent/emotion/relationshipStage/route/replyPolicy。
- 系统 prompt 注入 `getRelationshipStageSystemInstruction`，末句要求不暴露阶段名称、分数或内部标签。

### 前端阶段展示（`apps/web`）

- moodmate web 为单 companion 单聊页（`apps/web/app/(app)/app`），无 inbox 列表。
- 在单聊页头部展示当前关系阶段（按课程 `getInboxRelationshipStage` 的轻量映射，仅基于 `messageCount`：>=80 亲密连结、>=36 稳定信任、>=16 舒适陪伴、>=6 升温熟悉、否则 初识破冰）。
- 阶段名从会话接口已有的 `messageCount` 推导，不新增业务 API。

## 约束

- 关系阶段是每轮动态结果，写进消息 metadata，不新增独立表、不做 D1 迁移。
- 前端只展示轻量映射版；真正影响回复的以后端 LangGraph 判断为准。
- 阶段是内部策略，不在聊天回复里暴露。

## 完成标准

- [ ] `ConversationRelationshipStageSchema` / 类型定义并导出。
- [ ] LangChain 判断器 + 启发式兜底 + `normalizeRelationshipStage` 产品规则兜底就位。
- [ ] `analyzeRelationshipStage` 节点接入图，顺序正确。
- [ ] 关系阶段影响 `buildEmotionRoute` 和 `buildReplyPolicy`。
- [ ] metadata 升级为 `conversation-understanding-v2`，系统 prompt 注入阶段指令。
- [ ] web 单聊页头部展示当前关系阶段。
- [ ] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 通过。
