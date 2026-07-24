# Agent 聊天安全边界与意图识别

对应课程章节：

- docs/temp/47-agent-chat-safety-boundary.txt（安全边界判断）
- docs/temp/48-agent-chat-intent-langgraph.txt（意图识别 + LangGraph）

参考课程项目：/Users/wuwanzhu/Code/bobo/ai-agent/apps/api/src/routes/chat/inbox.route.ts

## Goal

在 MoodMate 伴侣聊天回复生成之前，增加两个结构化前置分析步骤：

1. 安全边界判断：先判断本轮用户输入是否碰到安全边界，据此分流（正常聊天 / 软边界 / 转向 / 拒绝 / 危机支持）。
2. 意图识别：安全通过后，用 LangChain + LangGraph 判断用户真实意图，把结果作为隐藏策略注入回复 prompt。

两步结果都写入 `companion_conversation_messages.metadata_json`，并用安全结果控制本轮是否允许记忆抽取。

## 与课程项目的差异（已确认事实）

- LLM 配置：MoodMate 的 `CompanionChatLlmConfig` 只有 `providerName/baseURL/model/apiKey`，没有课程项目的 `wireApi/reasoningEffort`。安全/意图判断沿用同一份配置。
- 无 Agent 概念：MoodMate 是固定「MoodMate 伴侣」，没有多 Agent、`agentName`、`guardrailsPrompt`。安全 prompt 中 Agent 相关字段用固定值或省略。
- 记忆抽取：MoodMate 现走关键词正则 `saveCandidateMemories`，不改抽取逻辑，只用 `allowMemoryExtraction` 控制是否执行这一步。
- 传输层：MoodMate 回复走裸 `fetch` 流式调用（`chat.provider.ts`），不改这条链路。安全/意图分析走 LangChain（非流式）。
- 落库字段：`companion_conversation_messages.metadata_json` 字段已存在，当前插入写死 `null`，本次改为写入分析结果。
- 依赖：MoodMate 未安装 `@langchain/*`，需新增 `@langchain/core`、`@langchain/openai`、`@langchain/langgraph`。

## Requirements

### 安全边界（第 47 章）

- 定义 `ConversationSafetySchema`（safetyLevel / category / boundaryAction / reason / responseGuidance / allowMemoryExtraction）。
- `buildLangChainChatModel`：用 `ChatOpenAI` 复用当前 provider 配置，`temperature: 0`。因无 wireApi，固定走 chat completions 协议。
- `getStructuredOutputMethods`：按 `functionCalling -> jsonSchema -> jsonMode` 顺序尝试。
- `analyzeConversationSafety`：多 method 重试；全部失败用保守 `fallbackSafety`（caution + soft_boundary + 禁止记忆抽取）。
- `normalizeConversationSafety`：业务一致性兜底（crisis 强制 crisis_support、block 强制 refuse、拒绝/危机禁止记忆抽取等）。
- `buildBoundaryResponse`：refuse / crisis_support 直接返回固定安全回复，不进普通聊天模型。
- `getSafetySystemInstruction`：caution / redirect / soft_boundary 时把安全策略注入 system prompt。

### 意图识别（第 48 章）

- 定义 `CompanionIntentPrimarySchema` 与 `ConversationIntentSchema`（primary / secondary / confidence / userNeed / requestedAgentAction / relationshipSignal / replyExpectation / shouldClarify / clarifyingQuestion / promptGuidance）。
- `analyzeConversationIntent`：用 LangGraph（normalizeInput -> classifyIntent 两节点）编排，输入包含安全结果。
- `normalizeConversationIntent`：低置信度降级 unclear、次要意图去重、依赖风险时策略变克制等。
- 失败兜底 `fallbackIntent`（unclear + 先承接再追问）。
- `getIntentSystemInstruction`：把意图作为隐藏策略注入 system prompt（安全之后、记忆之前）。

### 落库与分流

- 用户消息落库时写入 `metadata_json`（`analysisVersion: conversation-analysis-v1` + safety + intent）。
- refuse / crisis_support：直接生成固定回复并落库 assistant 消息，不进聊天模型，跳过意图判断。
- 记忆抽取受 `safety.allowMemoryExtraction` 控制。

## 已确认决策

- 分析代码放独立分析模块（不塞进 chat.service，参考课程项目但按 MoodMate 模块化风格拆分）。
- 分析用的 Zod schema（`ConversationSafetySchema` / `ConversationIntentSchema` 等）放 `@repo/contracts`。
- 走 `@langchain` 全套（`@langchain/core` + `@langchain/openai` + `@langchain/langgraph`）做结构化输出和编排。

## Acceptance Criteria

- [x] 安全边界判断在用户消息落库前执行，结果写入 `metadata_json`。
- [x] refuse / crisis_support 直接返回固定回复，不调用普通聊天模型，且 assistant 消息完整落库。
- [x] caution / redirect / soft_boundary 时安全策略注入 system prompt。
- [x] 意图识别用 LangGraph 编排，安全通过后执行，结果写入 `metadata_json` 并注入回复 prompt。
- [x] 安全或意图分析失败时走保守兜底，主聊天链路仍可用。
- [x] `allowMemoryExtraction` 为 false 时跳过本轮记忆抽取。
- [x] `pnpm check`（类型 + Lint + Format）全部通过。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- 传输层（`chat.provider.ts`）与记忆抽取算法本次不改，只接分析步骤。
