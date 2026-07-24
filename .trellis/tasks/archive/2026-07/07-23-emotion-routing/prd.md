# 情绪路由 LangGraph（章 49）

对应课程章节：`docs/temp/49-agent-chat-emotion-routing-langgraph.txt`
父任务：`07-23-agent-chat-understanding`

## Goal

在现有 safety + intent 的对话理解链路上，加一层情绪识别和情绪路由：LLM 结构化识别情绪，代码规则选择回复路线，结果注入最终聊天 prompt 并写入 user 消息 metadata。

这是四章里第一个任务，同时承担全链路前置基础（Agent 实体、summary/messageCount 入参接入）。

## 前置基础（本任务内完成，后续三章复用）

课程分析器需要 `agentName` 和 `agentGuardrails` 入参，moodmate 目前是单 companion、固定 system prompt、无 Agent 实体。本任务新建最小 companion 档案，不做 full multi-agent CRUD。

- 新增 D1 迁移：给 `companion_conversations` 加 `agent_name`、`agent_guardrails` 两个可空字段（或新建单表 `companion_profiles` 挂在 userId 上，二选一，实现时按现有 schema 风格定，记录在 design 里）。
- `chat.service.ts` 读取该档案，供给分析器 `agentName` / `agentGuardrails`；缺省时用固定占位（如 agentName 用 "MoodMate"，guardrails 用现有 `COMPANION_SYSTEM_PROMPT` 中的边界句）。
- 章 52 需要的 `conversationSummary` 和 `messageCount` 直接复用 `companion_conversations` 现有字段，本前置不额外加。

## Requirements

- 在 `packages/contracts/src/chat/companion-analysis.contract.ts` 新增：
  - `ConversationEmotionSchema`：`primaryEmotion` / `secondaryEmotions`(max 3) / `intensity`(0-1) / `valence` / `arousal` / `needsComfort` / `needsDeescalation` / `needsClarification` / `emotionalCue` / `replyTone`，枚举值与课程一致。
  - `EmotionRouteSchema`：`route`(9 种) / `responseLength` / `shouldAskQuestion` / `shouldGiveAdvice` / `shouldUsePetName` / `shouldMirrorEmotion` / `routeGuidance`。
  - 导出对应 TS 类型，并在 `packages/contracts/src/index.ts` re-export。
- 在 `chat.analysis.ts`：
  - 新增 `fallbackEmotion`、`fallbackEmotionRoute` 两个兜底对象，取值与课程一致（兜底走 `gentle_clarification`，先承接再轻问，不给建议）。
  - 新增情绪识别 prompt，明确要求模型不回复用户、不做诊断，入参含 agentName / agentGuardrails / safety / intent / activeMemories / recentMessages / userText。
  - `detectConversationEmotionWithLangChain`：复用现有 `STRUCTURED_OUTPUT_METHODS` 逐个尝试，全失败回退 `fallbackEmotion`。
  - `normalizeConversationEmotion(emotion, safety)`：清理重复/空次要情绪；safety 为 self_harm/crisis 时收紧为严肃策略；强负面自动 needsComfort；高激活 angry/hurt 自动 needsDeescalation；emotional_dependency 时避免 playful/light 语气。
  - `buildEmotionRoute({ safety, intent, emotion })`：纯代码规则，分支顺序照课程——soft_boundary 优先降温 → needsDeescalation/angry → conversation_repair/agent_feedback → romantic_flirt/affectionate → relationship_advice/analyze_situation（先安抚再建议）→ needsComfort/negative（tired 走 quiet_presence）→ 默认 light_companion。
  - LangGraph 状态新增 `emotion`、`route` 字段；图结构从 `normalizeInput → classifyIntent` 扩展为 `normalizeInput → classifyIntent → detectEmotion → routeEmotion`。
  - 现有导出的 `analyzeConversationIntent` 升级或新增 `analyzeConversationUnderstanding`，返回 `{ intent, emotion, route }`；LangGraph 失败时构建兜底 route。
  - 新增 `getEmotionRouteSystemInstruction({ emotion, route })`，把路由作为隐藏策略拼进 system prompt，末句要求不暴露内部标签。
- `chat.service.ts`：
  - safety 通过后调用对话理解图，拿到 emotion + route。有 boundaryResponse 时跳过（安全优先）。
  - system prompt 组装追加 `getEmotionRouteSystemInstruction`。
  - user 消息落库 metadata 升级为 `conversation-understanding-v1`，含 safety / intent / emotion / route（沿用现有 `companion_conversation_messages.metadata_json`，无需为此加迁移）。

## Acceptance Criteria

- [ ] 前置基础到位：分析器能拿到 agentName / agentGuardrails，缺省有占位，不报错。
- [ ] 情绪识别失败时走 `fallbackEmotion`，不影响本轮聊天回复。
- [ ] 路由为纯代码规则，soft_boundary 时强制 `calm_deescalation`，tired + companionship 走 `quiet_presence`。
- [ ] user 消息 metadata 写入 `conversation-understanding-v1`（safety+intent+emotion+route）。
- [ ] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 全过（只跑本次改动相关，按项目 quality gate）。

## Notes

- 本章只改 API 与 contracts，不改前端。
- 不做 multi-turn 情绪趋势、路由效果评估、A/B。
- Agent 实体只做最小档案，够供分析器入参即可，不做管理 UI。
