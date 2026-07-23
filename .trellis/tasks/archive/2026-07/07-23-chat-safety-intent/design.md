# 技术设计：聊天安全边界与意图识别

## 分层落点

| 改动 | 文件 | 说明 |
| --- | --- | --- |
| 分析 schema | `packages/contracts/src/chat/companion-analysis.contract.ts`（新增） | safety + intent 的 Zod schema 与类型 |
| contracts 导出 | `packages/contracts/src/index.ts` | 导出新 schema 和类型 |
| 分析实现 | `apps/api/src/modules/chat/chat.analysis.ts`（新增） | LangChain 模型构造、安全分析、意图分析（LangGraph）、归一化、兜底、prompt 注入、metadata 组装 |
| 接入分析 | `apps/api/src/modules/chat/chat.service.ts` | `prepareCompanionChat` 前置分析、prompt 注入、boundary 短路、记忆门控 |
| metadata 落库 | `apps/api/src/modules/chat/chat.repository.ts` | `insertCompanionConversationMessage` 支持传入 `metadataJson` |
| boundary 分流 | `apps/api/src/modules/chat/chat.route.ts` | 短路时返回固定文本流，不走上游模型 |
| 依赖 | `apps/api/package.json` + `pnpm-workspace.yaml` catalog | `@langchain/core`、`@langchain/openai`、`@langchain/langgraph` |

## 关键取舍

### 1. LangChain 模型构造（简化课程实现）

MoodMate 的 `ChatProviderConfig` 没有 `wireApi` / `reasoningEffort`，全部走 Chat Completions。

```ts
function buildLangChainChatModel(providerConfig: ChatProviderConfig) {
  return new ChatOpenAI({
    model: providerConfig.model,
    apiKey: providerConfig.apiKey,
    temperature: 0,
    configuration: { baseURL: providerConfig.baseURL },
  });
}

function getStructuredOutputMethods() {
  return ["functionCalling", "jsonSchema", "jsonMode"] as const;
}
```

`baseURL` 已在 `resolveProviderConfig` 里 `normalizeBaseURL` 去掉尾部斜杠，直接用。

### 2. 无 Agent 概念

MoodMate 是固定「MoodMate 伴侣」。安全 / 意图 prompt 中：
- `agentName` 固定为「MoodMate」。
- 无 `guardrailsPrompt`，prompt 中 Agent 自定义边界规则填「暂无」。
- 意图 prompt 仍传入 safety 结果、长期记忆、最近消息。

### 3. boundary 短路用 discriminated result

`prepareCompanionChat` 返回联合类型，让 route 层决定走流式还是固定文本：

```ts
type PrepareCompanionChatResult =
  | { kind: "stream"; prepared: PreparedCompanionChat }
  | { kind: "boundary"; text: string; turn: PreparedCompanionChat["turn"] };
```

- `boundary`：`refuse` / `crisis_support`。service 已写入用户消息 metadata；route 直接把固定文本包成流返回，并调用 `saveCompanionAssistantTurn` 落库 assistant 消息（`allowMemoryExtraction` 恒为 false）。
- `stream`：正常链路，安全策略与意图已注入 system prompt。

route 层判断 `kind`，业务判断仍在 service，route 只处理 HTTP 边界。

### 4. 分析执行顺序（在 `prepareCompanionChat` 内）

```
取最近消息 + 启用记忆
  -> analyzeConversationSafety（写 metadata、决定分流）
  -> buildBoundaryResponse
     -> 有值：写用户消息 metadata（safety，intent=null），返回 boundary result
     -> 无值：analyzeConversationIntent（安全通过后）
              写用户消息 metadata（safety + intent）
              组装 system prompt（safety instruction + intent instruction）
              返回 stream result
```

用户消息插入时机不变（分析后落库），但 `metadataJson` 改为写入分析结果。

### 5. metadata 格式

```ts
function toConversationAnalysisMetadata(input: {
  safety: ConversationSafety;
  intent: ConversationIntent | null;
}) {
  return JSON.stringify({
    analysisVersion: "conversation-analysis-v1",
    safety: input.safety,
    intent: input.intent,
  });
}
```

### 6. 记忆抽取门控

`saveCompanionAssistantTurn` 现无条件调 `saveCandidateMemories`。改为 `turn` 带 `allowMemoryExtraction`，为 false 时跳过。不改关键词抽取算法本身。

### 7. 兜底

- 安全分析全 method 失败 -> `fallbackSafety`（caution + soft_boundary + 禁止记忆抽取）。
- 意图分析异常 -> `fallbackIntent`（unclear + 先承接再追问）。
- 兜底不影响主聊天：兜底后仍进普通聊天，只是注入保守策略。

## 不改动范围

- `chat.provider.ts` 流式传输链路。
- 关键词记忆抽取算法（`extractCandidateMemories` / `classifyMemoryType`）。
- 接口签名、路由路径、请求 / 响应 schema（`CompanionChatRequestSchema` 不变）。
- D1 迁移（`metadata_json` 字段已存在）。

## 验证

`pnpm check-types` -> `pnpm lint` -> `pnpm format:check`。
