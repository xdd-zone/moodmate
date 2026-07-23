# 执行计划

## 顺序

1. **依赖**：`pnpm-workspace.yaml` catalog 加 `@langchain/core`、`@langchain/openai`、`@langchain/langgraph`；`apps/api/package.json` dependencies 引用 `catalog:`；`pnpm install`。
2. **contracts**：新增 `packages/contracts/src/chat/companion-analysis.contract.ts`，定义 safety + intent schema 与类型；在 `packages/contracts/src/index.ts` 导出。
3. **repository**：`insertCompanionConversationMessage` 支持可选 `metadataJson`，默认 null。
4. **分析模块**：新增 `apps/api/src/modules/chat/chat.analysis.ts`：
   - `buildLangChainChatModel` / `getStructuredOutputMethods`
   - `formatRecentMessages` / `formatActiveMemories`
   - safety：prompt、`invokeConversationSafetyAnalysis`、`normalizeConversationSafety`、`analyzeConversationSafety`、`fallbackSafety`、`buildBoundaryResponse`、`getSafetySystemInstruction`
   - intent：schema 用 contracts、prompt、LangGraph（normalizeInput -> classifyIntent）、`normalizeConversationIntent`、`analyzeConversationIntent`、`fallbackIntent`、`getIntentSystemInstruction`
   - `toConversationAnalysisMetadata`
5. **service**：`prepareCompanionChat` 接入分析、prompt 注入、返回联合类型；`turn` 加 `allowMemoryExtraction`；`saveCompanionAssistantTurn` 门控记忆抽取。
6. **route**：`POST /rpc/chat/companion` 按 `kind` 分流。
7. **验证**：`pnpm check-types` -> `pnpm lint` -> `pnpm format:check`。

## 验证点（对齐 PRD Acceptance Criteria）

- 安全判断在用户消息落库前执行，metadata 写入分析结果。
- refuse / crisis_support 不进上游模型，assistant 消息完整落库。
- caution / redirect / soft_boundary 注入安全策略。
- 意图用 LangGraph 编排，注入 prompt。
- 分析失败走兜底，主链路可用。
- `allowMemoryExtraction=false` 跳过记忆抽取。
