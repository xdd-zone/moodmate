# API 按朋友单聊

## 1. 适用范围

修改单聊会话、聊天历史、长期记忆、会话前置分析（安全边界 / 意图 / 情绪 / 关系阶段 / 路由）、消息反馈、主动关怀或单聊纯文本流时使用本规范。实现位于 `apps/api/src/modules/direct-chat/`（会话与消息）、`apps/api/src/modules/agents/`（朋友与记忆）、`apps/api/src/modules/care/`（主动关怀），数据库迁移位于 `apps/api/migrations/`。模型调用统一走 `@/infra/ai` runtime，业务模块不直接 `fetch` 上游、不构造 OpenAI SDK 类型（详见第 12 节）。

每个用户与每个朋友各有一条独立会话，`agent_conversations` 上有 `UNIQUE(user_id, agent_id)`。系统朋友是全局共享定义，不复制到每个用户名下；不同用户使用同一个系统朋友时，会话、消息、记忆和 Token 用量各自隔离。

## 2. 公开签名

```text
GET    /rpc/direct-chats
POST   /rpc/direct-chats
GET    /rpc/direct-chats/:conversationId
GET    /rpc/direct-chats/:conversationId/messages?cursor=<createdAtMs>
POST   /rpc/direct-chats/:conversationId/messages
POST   /rpc/direct-chats/:conversationId/messages/:messageId/feedback

GET    /rpc/agent-memories?agentId=<uuid>
PATCH  /rpc/agent-memories/:memoryId
DELETE /rpc/agent-memories/:memoryId

GET    /rpc/care-plan
PATCH  /rpc/care-plan
GET    /rpc/care-events
POST   /rpc/care-events/generate

Authorization: Bearer <web access token>
```

`POST /rpc/direct-chats/:conversationId/messages` 成功时返回 `text/plain; charset=utf-8` 文本流，其余接口返回统一 JSON 响应。模块入口是 `createDirectChatRoute()`；route 处理鉴权和 Zod 校验，service 组装业务数据，repository 只读写 D1，presenter 把数据库 record 转为 contracts DTO。

`POST /rpc/direct-chats` 是幂等的发起单聊：已有会话直接返回（`created: false`），没有才创建（`created: true`）。Web 的朋友档案「开始聊天」和聊天头像菜单「发起私聊」调用同一个动作。朋友已停用或归档时不能新建会话，历史会话仍可读但不能触发新回复。

## 3. 合同

- 请求先经过 `requireWebAccess`，再用对应的 Zod schema 校验。
- `agent_conversations` 上 `UNIQUE(user_id, agent_id)`，同一用户与同一朋友只有一条会话。
- 消息、记忆和反馈查询必须同时带当前 `userId`；来源消息联表也要限制为当前用户。
- 会话、消息、记忆都带 `agentId`，AI 调用记录也要带，否则按朋友的 Token 用量统计不出来。
- 首次历史返回最近 40 条；分页查询取 `createdAtMs < cursor` 的最近 40 条，响应按从旧到新排序。
- 当前 v1 游标只使用 `createdAtMs`。同一毫秒多条消息的组合游标不在当前范围。
- 发送前读取最近 18 条服务端消息和最多 12 条启用记忆，再保存本轮用户消息。
- prompt 顺序是系统规则、长期记忆、会话摘要、最近消息、本轮用户输入；本轮输入不得重复加入。
- assistant 文本一边流式返回一边累积；正常结束后保存完整结果，更新 1600 字符滚动摘要和会话计数。
- 长期记忆写入走「候选判断闸门 + LLM 抽取器」两段式（详见第 9 节）；LLM 全失败时退回正则兜底，单轮最多写入 2 条，读取最多 50 条启用记忆做完全相同内容去重。记忆写入失败只记录日志。
- 记忆按 `(user_id, agent_id)` 隔离，查询不返回 `deleted`；PATCH 只允许修改未删除且属于当前用户的记忆；DELETE 把状态改为 `deleted`。
- 用户反馈闭环：点赞/点踩挂在 assistant 消息上，一条消息一条反馈，历史回显并注入下一轮 prompt（详见第 10 节）。
- 模型连接读激活的 `llm_provider_configs`，走 `resolveActiveLlmProviderConfig()`。没有激活配置时返回 503，不回退到环境变量里的固定模型。
- `disableThinking` 通过 `AiModel.providerOptions` 按协议传给 runtime，业务模块不拼原始 request body。结构化输出路径由 runtime 强制关推理，与这个配置无关（见 `ai-runtime.md`）。
- 单聊流式走 `streamText()`，`toTextByteStream()` 只把 `text-delta` 编码成 UTF-8 字节，SSE 解析和 `[DONE]` 收口都在 Provider 内部。
- 成功响应必须设置 `cache-control: no-cache, no-transform` 和 `x-accel-buffering: no`。
- 请求的 `AbortSignal` 必须传给 `streamText()`；90 秒超时在 Provider 内部覆盖响应头和正文流。

## 4. 校验与错误矩阵

| 条件                                                    | 错误码                        | HTTP       |
| ------------------------------------------------------- | ----------------------------- | ---------- |
| 缺少或无效 Web access token                             | 现有 `AUTH.*`                 | 401        |
| 请求 schema 或历史游标无效                              | `COMMON.INVALID_REQUEST`      | 400        |
| 所有 part 都没有非空文本                                | `COMMON.INVALID_REQUEST`      | 400        |
| `conversationId` 不属于当前用户                         | `AUTH.FORBIDDEN`              | 403        |
| 朋友不存在、属于其他用户或已归档                        | `AGENT.UNAVAILABLE`           | 409        |
| 记忆不存在、属于其他用户或已删除                        | `COMMON.NOT_FOUND`            | 404        |
| 反馈目标消息非当前用户的已完成 assistant 消息           | `COMMON.NOT_FOUND`            | 404        |
| D1 未绑定或未应用迁移                                   | `SYSTEM.DATABASE_UNAVAILABLE` | 503        |
| 没有激活的模型配置                                      | `SYSTEM.INTERNAL_ERROR`       | 503        |
| 首个 text-delta 前 `AiError`（连接 / 认证 / HTTP 失败） | `SYSTEM.INTERNAL_ERROR`       | 503        |
| 首个 text-delta 前 `AiError`（`timeout`）               | `SYSTEM.UPSTREAM_TIMEOUT`     | 504        |
| 首个 text-delta 后出错或空文本                          | 终止纯文本流                  | 200 后断流 |

`streamText()` 的 `AiError` 由 route 在预取到首个 text-delta 前捕获，经 `toChatAppError`（`chat.ai-model.ts`）转成 `AppError`，走全局 `onError` 出干净 JSON：`timeout` → 504、`network` → 503「无法连接模型服务」、其余 → 503「模型请求失败」。`aborted` 保持取消语义向上抛，不转 503。首个 text-delta 后（响应头已提交 200）的错误与空文本仍在流内 `controller.error`，客户端已在 200 流中断。`toChatAppError` 的映射在单聊与群聊两条路径共用。

服务端日志只记录可安全字段（上游状态码、providerName、model、requestId、durationMs），不记录 API Key、Authorization、请求正文或上游响应正文。

## 5. 正常、基础、错误案例

- 正常：登录用户从朋友档案发起单聊，恢复历史，发送消息后用户消息先写入，assistant 流结束后写入回复、摘要和候选记忆。
- 基础：同一朋友重复发起单聊返回原会话；没有历史和记忆时只用系统规则与本轮输入请求模型。
- 错误：只按 `conversationId` 或 `memoryId` 查询，其他用户拿到 ID 后可以越权读取或修改数据。

## 6. 必做检查

- `pnpm --filter api check-types` 和 `pnpm --filter api lint`。
- 未登录请求断言：401、`AUTH.ACCESS_MISSING`、统一 meta。
- D1 检查：`(user_id, agent_id)` 唯一、历史从旧到新、40 条游标分页无重复、记忆软删除后不能查询或修改。
- 隔离检查：两个用户各自与同一个系统朋友聊天，会话、消息、记忆和 Token 用量互不可见。
- 幂等检查：同一用户对同一朋友重复调用 `POST /rpc/direct-chats`，返回同一个 `conversationId`。
- 停用检查：系统朋友停用或用户朋友归档后不能新建会话、不能继续触发回复，历史仍可读。
- 发送检查：用户消息在生成前存在；失败时用户消息保留；正常流结束后完整 assistant 文本、摘要、计数和时间更新。
- prompt 检查：最近 18 条、启用记忆 12 条、摘要和本轮输入顺序正确，本轮输入只出现一次。
- 记忆检查：规则分类、重要度、单轮 2 条上限、50 条内完全相同内容去重和失败不影响聊天。
- 流断言：200、纯文本 Content-Type、禁缓存 header、Unicode 正文。
- 连接级错误断言：首个 text-delta 前的 `AiError` 走 `toChatAppError` 出干净 JSON（timeout 504、network/其余 503），不落 200 断流。
- 空文本断言：无 text-delta 时 `toTextByteStream` 默认 `errorOnEmpty` 断流，`onComplete` 不触发、不写库。
- 取消检查：客户端中止后，`AbortSignal` 传给 `streamText()` 并向上传播；`aborted` 不转 503。
- AI 记录检查：一轮对话在 `ai_call_records` 里产生 6 条（5 个分析场景 + `direct_reply`），每条都带 `agentId`，且 `subject_type` 划分符合 `admin-operations.md` 的口径。

## 7. 错误与正确写法

```ts
// 错误：只按记忆 ID 更新
await db.update(agentMemories).where(eq(agentMemories.id, memoryId));

// 正确：同时限制用户和未删除状态
await db
  .update(agentMemories)
  .where(
    and(
      eq(agentMemories.id, memoryId),
      eq(agentMemories.userId, userId),
      ne(agentMemories.status, "deleted"),
    ),
  );
```

## 8. 会话前置分析（安全边界 + 意图 + 情绪 + 关系阶段）

发送消息时先在 service 里跑四项结构化分析，实现位于 `direct-chat.analysis.ts`，入口是 `analyzeDirectConversation()`：

- 四项并行（`Promise.all`）：`ConversationSafetySchema`、`ConversationIntentSchema`、`ConversationEmotionSchema`、`ConversationRelationshipStageSchema`。返回 `{ safety, intent, emotion, relationship }`。
- 每项都走 `generateStructuredJson()`（`direct-chat.structured.ts`），失败时各自退到对应的 `fallback*` 常量，不整体放弃。四个兜底值定义在 `direct-chat.analysis.ts` 顶部。
- 每项各带独立 observer，在 `ai_call_records` 里对应 `direct_safety_analysis`、`direct_intent_analysis`、`direct_emotion_analysis`、`direct_relationship_analysis` 四个 scenario。
- 分析结果经 `buildDirectAnalysisGuidance()` 转成 system prompt 片段注入回复生成。
- 分析 schema 定义在 `@repo/contracts` 的 `companion-analysis.contract.ts`，service 和 analysis 都从 contracts 导入，不在 API 侧重复定义。

`generateStructuredJson()` 的两层结构（`direct-chat.structured.ts`）：

- 先试 `generateObject()`，它内部按 `json_schema -> function -> json_object` 轮询，并强制关闭推理（见 `ai-runtime.md`）。
- 三种方法都抛 `invalid_response` 或 `invalid_output` 时，退到 `generatePlainJson()`：把完整 JSON Schema 写进 system prompt、走纯 `generateText`、本地解析并过 Zod，同时剥掉可能出现的 markdown 代码围栏。这一层对任何能出文本的上游都有效，是最后兜底，不要因为「现在用不到」删掉。
- 回退路径也要套 `withThinkingDisabled()`。它同样是结构化输出用途，推理会吃掉输出预算导致 JSON 截断。
- `createDeferredObserver()` 把 `generateText` 的 `onComplete` 延后到 Zod 校验之后：模型返回了内容但结构不对时记 `invalid_output`，不能先记成功再改。

已移除的两层：EmotionRoute、ReplyPolicy 和 Reply Quality Guard 现在只存在于群聊（见 `group-chat.md`），单聊不再有 LangGraph 图、路由分支和回复质检。单聊分析也不再经 LangChain，prompt 直接构造 `AiMessage[]`。改单聊分析时不要照搬群聊的编排结构。

结构化输出 prompt 契约（必做）：分析 prompt 的 system 段要显式列出 JSON 字段名、类型和允许的枚举值。走到 `json_object` 或纯文本回退时，schema 不会以协议形式约束模型，缺字段契约时模型会自创字段名，导致 Zod 校验失败、全程走兜底。判断分析是否真正生效：查用户消息 `metadata_json`，真实结果的 `reason` / `emotionalCue` 贴合内容且 `confidence` 高；兜底恒为 `caution` / `unclear` / `0` 和固定文案。

## 9. 长期记忆（判断 + 抽取两段式）

实现位于 `direct-chat.memory.ts`，入口 `organizeDirectChatMemories()`，在 assistant 消息落库后调用，受 `safety.allowMemoryExtraction` 门控。

两段式，两个内部 Zod schema 只在 API 侧定义，不进 `@repo/contracts`：

- 判断段 `memoryJudgementSchema`：`{ shouldStore: boolean, reason: string(<=240) }`，scenario `direct_memory_judgement`。`shouldStore` 为 false 直接返回，不写记忆。
- 抽取段 `memoryExtractionSchema`：`{ memories: Array<{ content: string(1-2000), importance: int(1-5), type: string(1-80) }> }`，数组上限 2 条，scenario `direct_memory_extraction`。

记忆按 `(user_id, agent_id)` 隔离，写入前与已有启用记忆做内容去重。整段被 try/catch 包裹，任何异常只记日志，不影响 assistant 落库和用户可见回复。

## 10. 消息反馈（点赞 / 点踩）

表 `agent_message_feedbacks`，唯一索引 `(user_id, message_id)`。除用户侧的 `rating` / `reason` / `note` 外，还有三个 Admin 侧字段：`status`（`pending` / `processed`，默认 `pending`）、`processed_by_admin_user_id`、`processed_at_ms`。CHECK 约束要求 `status = 'pending'` 时 `processed_at_ms` 必须为 NULL，`processed` 时必须非空——更新处理状态时两个字段一起写，否则整条写入失败。

Contract 在 `companion-care.contract.ts` 与 `direct-chat.contract.ts`，rating 枚举 `positive` / `negative`。历史消息响应带 `feedback` 字段，left join 时同时限定 `messageId` 和 `userId`。

提交端点强制目标必须是当前用户的、`role = assistant` 且 `status = completed` 的消息，不满足返回 404 且不落库。切换 rating 时保留 `createdAtMs`，同一 `(user_id, message_id)` 始终一条记录。

Admin 侧的反馈列表与详情见 `admin-operations.md`，详情要先写敏感访问审计再返回消息正文。

## 11. 主动关怀

表 `agent_care_plans`（每用户唯一，`UNIQUE(user_id)`）和 `agent_care_events`，实现位于 `care.service.ts`，四个端点见第 2 节。

与旧版的关键区别是计划要指定发送者：`agent_care_plans.agent_id` 指向具体朋友，关怀消息写入该朋友与用户的单聊会话，AI 调用和 Token 都归这个朋友。规则：

- 开启主动关怀前必须选朋友。`agentId` 为空时不允许 `enabled = true`。
- 可选范围是活跃系统朋友或当前用户拥有的活跃朋友，不允许多个朋友同时关怀。
- 关怀朋友被系统停用或被用户归档后，计划停止执行，用户重新选朋友才能继续。
- `scenes_json` 没有 enum 约束，读出必须按白名单过滤（`scenesFromJson()`），未知 scene 收口为默认值。
- `next_run_at_ms` 只计算并保存，当前不接 Cron。

关怀文案走 `generateText()` 并带 observer，scenario 是 `care_message`，`subject_type` 为 `agent`。默认值：`enabled=false`、`frequency=daily`、`scenes=DEFAULT_SCENES`、`tone=gentle`、`agentId=null`。

## 12. AI runtime 边界（单聊 / 群聊共用）

模型调用统一走 `@/infra/ai` runtime，业务模块不直接 `fetch` 上游、不构造 OpenAI SDK 类型。单聊 service 直接把 `resolveActiveLlmProviderConfig()` 的结果当 `AiModel` 用；群聊经 `chat.ai-model.ts` 桥接，两条路径共用同一个错误映射：

- `toAiModel(config: ChatProviderConfig): AiModel`：按 `config.api` 选协议，`disableThinking` 映射到对应协议的 `providerOptions`（`openai-chat-completions` 与 `openai-responses` 各一个键）。新增协议时要同步这里，否则该协议下配置项静默失效。
- `toAiMessages(ChatCompletionMessage[]): AiMessage[]`：按 role 显式收敛到联合类型（system / user / assistant）。
- `toChatAppError(error): unknown`：`AiError` → `AppError`（timeout 504、network 503「无法连接模型服务」、其余上游 503「模型请求失败」）；`aborted` 原样返回 `AiError` 向上抛，非 `AiError` 原样抛出。

单聊流式取消 fetch 后，连接级错误由 SDK 在异步迭代中以 `error` 事件懒暴露；若直接把事件流交给 `toTextByteStream`，错误会在 `c.body` 提交 200 之后才炸，拿不到干净 JSON。所以 route 在提交响应头前做预取：

- 先驱动 `streamText()` 的 iterator 到「首个 `text-delta`」或提前出现的 `error` / 流结束；`iterator.next()` 抛错或收到 `error` 事件时，经 `toChatAppError` 转 `AppError` 抛出，在写响应头前走全局 `onError` 出 JSON。
- 预取阶段消费的事件（含首个 `text-delta`）先 push 进 `buffered`，再用 `replayEventStream(buffered, iterator)` 回放给 `toTextByteStream`：先 yield buffered、再从同一 iterator 续读，不重复消费也不丢事件。
- 首个 `text-delta` 之后（响应头已提交 200）的错误与空文本仍走 `toTextByteStream` 的 `controller.error`，与迁移前 SSE 阶段一致。

群聊回复是普通 async 函数，`generateGroupChatText` 直接 `try/catch` 调 `generateText()` 并用 `toChatAppError` 转换，无需预取；空文本仍抛 503「没有返回可用的回复内容」。

### Gotcha：流式响应的连接级错误必须在 `c.body` 提交前处理

> 全局 `onError` 只认 `AppError` 且只在响应头未提交时生效。SDK 流的连接、认证、超时错误在异步迭代中懒暴露，若在 `c.body(stream, 200, ...)` 之后才抛，客户端已收到 200，得不到干净 JSON 错误。
>
> 因此流式路径必须预取到首个 `text-delta` 前，把 `AiError` 转 `AppError` 抛出；确认有正文后再提交响应头。首个 delta 之后的错误只能留在流里 `controller.error`。
