# API 伴侣聊天

## 1. 适用范围

修改固定伴侣会话、聊天历史、长期记忆、平台 DeepSeek 配置、OpenAI-compatible Chat Completions 请求或 SSE 转纯文本流时使用本规范。实现位于 `apps/api/src/modules/chat/`，数据库迁移位于 `apps/api/migrations/`。

## 2. 公开签名

```text
GET /rpc/chat/companion/conversation
GET /rpc/chat/companion/messages?cursor=<createdAtMs>
POST /rpc/chat/companion
GET /rpc/chat/companion/memories
PATCH /rpc/chat/companion/memories/:memoryId
DELETE /rpc/chat/companion/memories/:memoryId

Authorization: Bearer <web access token>
```

`POST /rpc/chat/companion` 成功时返回 `text/plain; charset=utf-8` 文本流，其余接口返回统一 JSON 响应。模块入口是 `createChatRoute()`；route 处理鉴权和 Zod 校验，service 组装业务数据，repository 只读写 D1，presenter 把数据库 record 转为 contracts DTO。

## 3. 合同

- 请求先经过 `requireWebAccess`，再用 `CompanionChatRequestSchema` 校验。
- `companion_conversations.user_id` 唯一，每个用户只有一段默认 MoodMate 会话。
- 消息和记忆查询必须同时带当前 `userId`；来源消息联表也要限制为当前用户。
- 首次历史返回最近 40 条；分页查询取 `createdAtMs < cursor` 的最近 40 条，响应按从旧到新排序。
- 当前 v1 游标只使用 `createdAtMs`。同一毫秒多条消息的组合游标不在当前范围。
- 发送前读取最近 18 条服务端消息和最多 12 条启用记忆，再保存本轮用户消息。
- prompt 顺序是系统规则、长期记忆、会话摘要、最近消息、本轮用户输入；本轮输入不得重复加入。
- assistant 文本一边流式返回一边累积；正常结束后保存完整结果，更新 1600 字符滚动摘要和会话计数。
- 规则记忆单轮最多写入 2 条，读取最多 50 条启用记忆做完全相同内容去重。记忆写入失败只记录日志。
- 记忆查询不返回 `deleted`；PATCH 只允许修改未删除且属于当前用户的记忆；DELETE 把状态改为 `deleted`。
- 请求级 `llmConfig` 优先；未提供时读取平台 `DEEPSEEK_*`。
- `DEEPSEEK_API_KEY` 可选且敏感；`DEEPSEEK_BASE_URL` 默认 `https://api.deepseek.com`；`DEEPSEEK_MODEL` 默认 `deepseek-v4-flash`。
- 平台请求发送 `thinking: { type: "disabled" }`；用户 Provider 只发送标准 `model`、`messages` 和 `stream`。
- 上游 SSE 只读取 `choices[0].delta.content`，以 `data: [DONE]` 结束。
- 成功响应必须设置 `cache-control: no-cache, no-transform` 和 `x-accel-buffering: no`。
- 请求的 `AbortSignal` 必须传给上游 `fetch()`；90 秒超时覆盖响应头和正文流。

## 4. 校验与错误矩阵

| 条件                              | 错误码                        | HTTP       |
| --------------------------------- | ----------------------------- | ---------- |
| 缺少或无效 Web access token       | 现有 `AUTH.*`                 | 401        |
| 请求 schema 或历史游标无效        | `COMMON.INVALID_REQUEST`      | 400        |
| `conversationId` 不是当前默认会话 | `COMMON.INVALID_REQUEST`      | 400        |
| 所有 part 都没有非空文本          | `COMMON.INVALID_REQUEST`      | 400        |
| 记忆不存在、属于其他用户或已删除  | `COMMON.NOT_FOUND`            | 404        |
| D1 未绑定或未应用迁移             | `SYSTEM.DATABASE_UNAVAILABLE` | 503        |
| 平台 Key 缺失                     | `SYSTEM.INTERNAL_ERROR`       | 503        |
| 上游连接失败或 HTTP 失败          | `SYSTEM.INTERNAL_ERROR`       | 503        |
| 上游响应头超时                    | `SYSTEM.UPSTREAM_TIMEOUT`     | 504        |
| SSE JSON 损坏或没有文本           | 终止纯文本流                  | 200 后断流 |

服务端日志只记录上游状态码，不记录 API Key、Authorization、请求正文或上游响应正文。

## 5. 正常、基础、错误案例

- 正常：登录用户恢复历史，发送消息后用户消息先写入，assistant 流结束后写入回复、摘要和候选记忆。
- 基础：没有历史和记忆时创建默认会话，只用系统规则与本轮输入请求平台 DeepSeek。
- 错误：只按 `conversationId` 或 `memoryId` 查询，其他用户拿到 ID 后可以越权读取或修改数据。

## 6. 必做检查

- `pnpm --filter api check-types` 和 `pnpm --filter api lint`。
- 未登录请求断言：401、`AUTH.ACCESS_MISSING`、统一 meta。
- D1 检查：默认会话唯一、历史从旧到新、40 条游标分页无重复、记忆软删除后不能查询或修改。
- 用户隔离检查：会话、消息、记忆和来源消息都不能读取其他用户数据。
- 发送检查：用户消息在上游请求前存在；失败时用户消息保留；正常流结束后完整 assistant 文本、摘要、计数和时间更新。
- prompt 检查：最近 18 条、启用记忆 12 条、摘要和本轮输入顺序正确，本轮输入只出现一次。
- 记忆检查：规则分类、重要度、单轮 2 条上限、50 条内完全相同内容去重和失败不影响聊天。
- 本地 SSE Provider 断言：200、纯文本 Content-Type、禁缓存 header、Unicode 正文。
- SSE 检查：分块行、CRLF、`[DONE]`、无 content 的 usage chunk、损坏 JSON 和空流。
- 取消检查：客户端中止后，上游 `fetch()` 收到同一个取消信号。

## 7. 错误与正确写法

```ts
// 错误：只按记忆 ID 更新
await db.update(companionMemories).where(eq(companionMemories.id, memoryId));

// 正确：同时限制用户和未删除状态
await db
  .update(companionMemories)
  .where(
    and(
      eq(companionMemories.id, memoryId),
      eq(companionMemories.userId, userId),
      ne(companionMemories.status, "deleted"),
    ),
  );
```

## 8. 会话前置分析（安全边界 + 意图识别）

`POST /rpc/chat/companion` 在回复生成前，先在 service 里跑两步结构化分析，实现位于 `chat.analysis.ts`：

- 安全边界判断 `analyzeConversationSafety` 先执行；意图识别 `analyzeConversationIntent` 用 LangGraph 编排，仅在安全通过后执行。
- 两步都用当前 `providerConfig`（请求级 `llmConfig` 或平台 DeepSeek），走 `@langchain/openai` 的 `ChatOpenAI` + `withStructuredOutput`，`temperature: 0`。
- 结构化输出按 `functionCalling -> jsonSchema -> jsonMode` 顺序重试；全部失败用保守 `fallbackSafety` / `fallbackIntent`，不回退关键词规则。
- 分析 schema（`ConversationSafetySchema`、`ConversationIntentSchema`）定义在 `@repo/contracts`，service 和 analysis 都从 contracts 导入，不在 API 侧重复定义。

分流与落库：

- 用户消息落库前完成安全分析，安全 + 意图结果通过 `buildConversationAnalysisMetadata`（`analysisVersion: conversation-analysis-v1`）写入 `metadata_json`。
- `boundaryAction` 为 `refuse` / `crisis_support` 时，`buildBoundaryResponse` 直接返回固定文本流，不调用上游模型；assistant 消息仍完整落库。
- `caution` / `redirect` / `soft_boundary` 时，`getSafetySystemInstruction` 和 `getIntentSystemInstruction` 把策略注入 system prompt，顺序为安全、意图、长期记忆、会话摘要。
- 记忆抽取受 `safety.allowMemoryExtraction` 门控；为 false 时 `saveCompanionAssistantTurn` 跳过 `saveCandidateMemories`。

结构化输出 prompt 契约（必做）：

- 两个分析 prompt 的 system 段必须显式列出 JSON 字段名、类型和允许的枚举值，并要求「只返回 JSON、不要 markdown 代码块或多余文字」。
- 原因：DeepSeek 官方模型（`deepseek-v4-flash`）是推理模型，`functionCalling` / `jsonSchema` 在三方中转或部分场景会失败，最终落到 `jsonMode`；`jsonMode` 不会把 schema 结构喂给模型，缺字段契约时模型会自创字段名（如 `safety` / `intent`），导致 Zod parse 失败并全程走兜底。
- 判定功能是否真正生效：查用户消息 `metadata_json`，真实结果的 `reason` 是贴合内容的具体文案且 `confidence` 高；兜底恒为 `caution` / `other` / `unclear` / `0.3` 与固定文案。
