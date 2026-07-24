# API 伴侣聊天

## 1. 适用范围

修改固定伴侣会话、聊天历史、长期记忆、会话前置分析（安全边界 / 意图 / 情绪 / 路由）、companion 档案、平台 DeepSeek 配置、OpenAI-compatible Chat Completions 请求或 SSE 转纯文本流时使用本规范。实现位于 `apps/api/src/modules/chat/`，数据库迁移位于 `apps/api/migrations/`。

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

## 8. 会话前置分析（安全边界 + 意图 + 情绪 + 路由）

`POST /rpc/chat/companion` 在回复生成前，先在 service 里跑结构化分析链路，实现位于 `chat.analysis.ts`：

- 安全边界判断 `analyzeConversationSafety` 先执行；安全通过后调用 `analyzeConversationUnderstanding` 跑完整理解图，返回 `{ intent, emotion, relationshipStage, route, replyPolicy }`。入参含 `conversationSummary`、`messageCount`（service 从会话记录取）。
- LangGraph 图结构：`normalizeInput -> classifyIntent -> detectEmotion -> analyzeRelationshipStage -> routeEmotion -> buildReplyPolicy -> END`。intent、emotion、relationshipStage 走 LLM 结构化输出；route、replyPolicy 是纯代码规则（`buildEmotionRoute` / `buildReplyPolicy`），不调 LLM。关系阶段放在情绪识别之后、情绪路由之前，既用意图和情绪做输入，又影响后续 route 和 policy。
- LLM 步骤都用当前 `providerConfig`（请求级 `llmConfig` 或平台 DeepSeek），走 `@langchain/openai` 的 `ChatOpenAI` + `withStructuredOutput`，`temperature: 0`。
- 结构化输出按 `functionCalling -> jsonSchema -> jsonMode` 顺序重试；全部失败用保守 `fallbackSafety` / `fallbackEmotion`，不回退关键词规则。图整体 catch 时三层兜底：intent、emotion 归一化 fallback，route 由 `buildEmotionRoute` 从兜底 intent/emotion 推。
- 分析 schema（`ConversationSafetySchema`、`ConversationIntentSchema`、`ConversationEmotionSchema`、`EmotionRouteSchema`、`ReplyPolicySchema`）定义在 `@repo/contracts`，service 和 analysis 都从 contracts 导入，不在 API 侧重复定义。

情绪归一化与路由（代码治理层，不调 LLM）：

- `normalizeConversationEmotion(emotion, safety)`：去重去空 `secondaryEmotions` 并 slice(0,3)；`self_harm` / `crisis` 收紧为严肃策略（intensity≥0.85、negative、needsComfort/needsDeescalation=true、serious）；`emotional_dependency` 把 playful/light 收到 warm；强负面（intensity≥0.7 且 negative）置 needsComfort；高激活 angry/hurt 置 needsDeescalation。
- `buildEmotionRoute({ safety, intent, emotion, relationshipStage })` 先跑 `computeBaseEmotionRoute`（原分支顺序固定，必须照此：`soft_boundary` 强制 `calm_deescalation`（提前 return，安全优先）-> needsDeescalation/angry -> conversation_repair/agent_feedback -> romantic_flirt/affectionate -> relationship_advice/analyze_situation（先安抚再建议）-> needsComfort/negative（tired 或 companionship_presence 走 `quiet_presence`）-> 默认 `light_companion`），再叠加关系阶段强制修正。
- 关系阶段修正（`relationshipStage` 为 null 时全跳过，兼容未接入路径）：`repairing` 或 pacing=`repair_first` 强制 `relationship_repair`；`boundary_sensitive`/`dependency_watch` 或 boundaryMode=`firm` 强制 `calm_deescalation`；base 算出 `playful_flirt` 但 stage=`new_connection` 或 intimacyPermission=`low` 时降到 `light_companion`。改路线时同步换 `routeGuidance`。

Reply Policy（代码治理层，不调 LLM，接在 route 之后）：

- `buildReplyPolicy({ safety, intent, emotion, route, relationshipStage })` 把 `EmotionRoute` 转成本轮可执行回复策略（policy / sentenceBudget / rhythm / openingMove / allowedMoves / forbiddenMoves / questionLimit / adviceLimit / intimacyLevel / styleGuidance）。执行顺序固定：三者全空返回 `fallbackReplyPolicy` -> `route ?? fallbackEmotionRoute`、`emotion ?? fallbackEmotion` -> `sentenceBudgetForRoute(route)` 定句数 -> 初始默认 -> `switch(route.route)` 覆盖 7 个分支 -> memory_ack 覆盖 -> 4 条二次修正 -> 关系阶段修正 -> `forbiddenMoves` 去重 -> `ReplyPolicySchema.parse`。
- 关系阶段修正（`relationshipStage` 为 null 时跳过）：intimacyPermission=`low` 置 intimacyLevel=low 并禁 `intense_flirt`；pacing=`slow_down` 收 rhythm=soft、禁 `premature_advice`/`pressure_to_disclose`/`intense_flirt`、questionLimit 与 adviceLimit 压到 1、句数上限压到 3；pacing=`repair_first` 切 `relationship_repair`、openingMove=apologize、禁 `intense_flirt`/`take_sides_aggressively`/`over_explain`、adviceLimit=0、句数上限压到 3。去重在此之后仍生效。
- `sentenceBudgetForRoute(route)`：responseLength 四路映射（very_short 1-2 / short 1-3 / medium 2-5 / long 3-7）。
- switch 只覆盖 7 个 route（quiet_presence / warm_comfort / deep_comfort / playful_flirt / calm_deescalation / relationship_repair / practical_support）；`light_companion` / `gentle_clarification` 无 case，落初始默认（warm_companion）。
- `memory_update` / `preference_setting` 意图在 switch 后强制覆盖为 `memory_ack`，句数压到 `min=1`、`max=Math.min(max, 2)`。
- 4 条二次修正 push forbidden：safety 非 `continue` 降亲密度并禁 `intense_flirt` / `promise_real_world_action`；强负面（intensity≥0.75 且 negative）禁 `intense_flirt` / `premature_advice` 并把 lively 降 soft；不追问置 `questionLimit=0`；不建议置 `adviceLimit=0`。
- 陷阱：各分支叠加二次修正 push 后 `forbiddenMoves` 可能越 `.max(8)`，parse 前必须 `[...new Set(forbiddenMoves)]` 去重。课程原文直接 push 不去重，是相对课程的稳健处理，不改语义。

关系阶段（`analyzeRelationshipStage` 节点，情绪之后、路由之前）：

- `analyzeRelationshipStageWithLangChain` 结合 messageCount、会话摘要、最近对话、记忆、safety、intent、emotion 判断关系阶段，走 `withStructuredOutput` + 三种 method 兜底，全失败走 `heuristicRelationshipStage` 启发式兜底，两条路径都再过 `normalizeRelationshipStage`。
- `heuristicRelationshipStage`：`memoryScore`(记忆重要度和，上限 20) + `historyScore`(min(70, floor(messageCount\*1.6))) + `warmthScore`(seeking_closeness/affectionate 记 10，warming_up/playful 记 6) 算 closenessScore，按阈值从高到低分档：`messageCount>=80 && closeness>=75` close_bond；`>=36 && >=58` trusted_companion；`>=16 && >=38` comfortable_chat；`>=6` warming_up；否则 new_connection。
- `normalizeRelationshipStage(stage, { safety, intent, emotion, messageCount })` 三条产品规则按顺序执行：messageCount<6 且不在 boundary_sensitive/dependency_watch/repairing 时拉回 new_connection；`emotional_dependency` 或 relationshipSignal `dependency_risk` 切 dependency_watch；conversation_repair / conflict / feeling_hurt / hurt / disappointed 切 repairing。末尾 `ConversationRelationshipStageSchema.parse`。启发式和 LLM 两条路径都要过这层。
- 关系阶段对 route / policy 的具体修正见上面 `buildEmotionRoute` / `buildReplyPolicy` 两节。
- 关系阶段是每轮动态结果，写进消息 metadata，不新增独立表、不做 D1 迁移；复用 `companionConversations.summary` 和 `messageCount` 作分析器入参。

分流与落库：

- 用户消息落库前完成安全分析，safety + intent + emotion + relationshipStage + route + replyPolicy 通过 `buildConversationAnalysisMetadata`（`analysisVersion: conversation-understanding-v3`）写入 `metadata_json`。字段顺序：safety / intent / emotion / relationshipStage / route / replyPolicy。v2 是「含 replyPolicy、不含 relationshipStage」的旧字段集，加 relationshipStage 后字段集变化，故升 v3。
- `boundaryAction` 为 `refuse` / `crisis_support` 时，`buildBoundaryResponse` 直接返回固定文本流，不调用上游模型；assistant 消息仍完整落库。存在 boundaryResponse 时不进理解链路，intent/emotion/relationshipStage/route/replyPolicy 全为 null。
- `caution` / `redirect` / `soft_boundary` 时，`getSafetySystemInstruction`、`getIntentSystemInstruction`、`getEmotionRouteSystemInstruction`、`getRelationshipStageSystemInstruction` 和 `getReplyPolicySystemInstruction` 把策略注入 system prompt，顺序为安全、意图、情绪路由、关系阶段、Reply Policy、长期记忆、会话摘要（关系阶段影响 route，指令排在 route 之后、policy 之前）。情绪路由、关系阶段和 Reply Policy 指令末句都要求不暴露内部标签。
- `replyPolicy` 随理解结果挂到 `PreparedCompanionChat['turn']` 上并透传到 assistant 落库，供 Reply Quality Guard 质检使用。
- 记忆抽取受 `safety.allowMemoryExtraction` 门控；为 false 时 `saveCompanionAssistantTurn` 跳过 `saveCandidateMemories`。

Reply Quality Guard（回复后质检，纯代码，不调 LLM）：

- `evaluateReplyQuality({ assistantText, replyPolicy })` 在 `saveCompanionAssistantTurn` 里 assistant 消息落库前跑，检测这段回复是否超句数、追问过多、过早给建议、暴露内部标签、破坏沉浸感、命中 forbidden move。空文本返回 `fallbackReplyQualityGuard`（status pass、score 1、计数全 0）；`replyPolicy` 为 null 时退到 `fallbackReplyPolicy`。
- 六类检测：句数按 `sentenceBudget.max` 判，超出 2 句以上记 high，否则 medium；问句统计 `？`/`?` 超 `questionLimit`；建议按 `advicePatterns` 统计超 `adviceLimit`；内部标签泄露和破坏沉浸感命中关键词记 high；forbidden move 遍历 `replyPolicy.forbiddenMoves`，只对 `FORBIDDEN_MOVE_CLUES` 覆盖的 7 个动作做关键词检测，另加 `premature_advice` 与 adviceCount 联动记 `forbidden_premature_advice`。
- `score = 1 - high*0.35 - medium*0.18 - low*0.08`（下限 0）；`status` 有 high 或 score<0.5 为 fail，否则有违规为 warn，无违规为 pass；`violations` 上限 12 条，评分与状态都按截断后的列表算。
- 第一版只记录不拦截、不重写、不二次生成，结果由 `toAssistantReplyQualityMetadata({ replyPolicy, guard })` 以 `analysisVersion: reply-quality-guard-v1` 写进 assistant 消息 `metadata_json`（含 `replyPolicy` 和 `guard` 两个对象），不进 LangGraph 图，不改流式主流程和用户可见回复。
- 不新增 D1 迁移，复用 `companion_conversation_messages.metadata_json` 字段（此前 assistant 落库未传 metadata，本层补上）。

companion 档案前置基础：

- `companion_profiles` 表（迁移 0010）挂在 `user_id` 上（唯一），存 `display_name` / `persona` / `guardrails`，三个业务字段全可空。当前只做只读 `getCompanionProfile`，没有写入接口和管理 UI。
- service 解析：`agentName` 缺省 `"MoodMate"`，`agentGuardrails` 缺省 null（分析 prompt 里显示暂无）。persona 本阶段不注入 prompt。
- `agentName` / `agentGuardrails` 作为分析器入参供给情绪识别 prompt；后续关系阶段章节复用同一档案入参。

结构化输出 prompt 契约（必做）：

- 三个 LLM 分析 prompt（safety / intent / emotion）的 system 段必须显式列出 JSON 字段名、类型和允许的枚举值，并要求「只返回 JSON、不要 markdown 代码块或多余文字」。
- 原因：DeepSeek 官方模型（`deepseek-v4-flash`）是推理模型，`functionCalling` / `jsonSchema` 在三方中转或部分场景会失败，最终落到 `jsonMode`；`jsonMode` 不会把 schema 结构喂给模型，缺字段契约时模型会自创字段名（如 `safety` / `intent` / `emotion`），导致 Zod parse 失败并全程走兜底。
- 判定功能是否真正生效：查用户消息 `metadata_json`，真实结果的 `reason` / `emotionalCue` 是贴合内容的具体文案且 `confidence` 高；兜底恒为 `caution` / `other` / `unclear` / `0.3`、emotion 恒为 `neutral` + 固定 cue 文案。
