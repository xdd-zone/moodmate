# 记忆候选判断（子任务 A，对应 docs/temp/53）

## Goal

在长期记忆写入前加一道 LLM 候选判断闸门，并把现有正则启发式抽取升级为「候选判断 + 独立 LLM 抽取器」两段式，只让有长期价值的对话进入抽取、入库，降低脏记忆与成本。

## Background（已确认事实）

- 现有记忆链路是正则启发式：`chat.service.ts` 的 `saveCompanionAssistantTurn`（343-400）在安全允许后调 `saveCandidateMemories`（558-595）→ `extractCandidateMemories`（524-540，`MEMORY_TRIGGER_PATTERN` 命中 + `classifyMemoryType` 分类）→ `insertCompanionMemory`。抽取源是用户文本，按 content 去重，每轮最多 2 条，无 LLM。
- 安全边界已在链路前置：`input.turn.allowMemoryExtraction` 为 false 时 `saveCompanionAssistantTurn` 直接 return（383-385）。候选判断必须在这道 return 之后（安全允许后）执行。
- LangChain 复用模式在 `chat.analysis.ts`：`ChatPromptTemplate.fromMessages` + `buildLangChainChatModel` + `model.withStructuredOutput(Schema, { name, method })`，遍历 `STRUCTURED_OUTPUT_METHODS = ["functionCalling","jsonSchema","jsonMode"]`（28-32）逐方法重试，全失败回退 `fallbackXxx` 常量。
- provider 配置：`resolveProviderConfig`（597-609）返回 `ChatProviderConfig`。当前 `saveCompanionAssistantTurn` 未持有 providerConfig，需从 turn 或重新 resolve 拿到。
- 去重现状：`saveCandidateMemories` 用 `listActiveCompanionMemories`（limit `COMPANION_MEMORY_DEDUPLICATION_LIMIT`）取已有记忆，按 content Set 去重。
- 记忆类型现状：`companion_memories.type` 是自由文本，现值为中文「边界/偏好/关系目标/对话风格」。抽取器输出需映射到这套现有中文类型，不引入新枚举列。

## Requirements

- R1：新增记忆候选判断层，位于安全边界之后、抽取器之前。只回答「本轮是否值得进入长期记忆抽取」，不产出最终记忆。
- R2：候选判断先走本地 fast reject（空内容、短寒暄、常见确认语、与已有记忆完全重复、疑似敏感凭证），命中直接跳过，不调 LLM。
- R3：未被 fast reject 的对话进入 LangChain 结构化判断，输出候选结论（是否抽取、类别、稳定性、重要度、置信度、原因、候选事实）。复用现有三方法重试 + fallback 关键词兜底模式。
- R4：候选结论经规范化闸门：small_talk/temporary_emotion/assistant_generated/duplicate/unsafe 类别、temporary 稳定性、importance<=0、低置信度且低重要度，均强制 shouldExtract=false。
- R5：候选判断通过后，调用独立 LLM 抽取器，围绕候选事实做精抽，产出结构化记忆（content/type/importance），再经 content 去重后入库。抽取器同样复用三方法重试 + fallback（fallback 可退回现有正则 `extractCandidateMemories` 逻辑）。
- R6：抽取器输出的 type 映射到现有中文记忆类型（边界/偏好/关系目标/对话风格/重要事实等），importance 落在 1-5。
- R7：候选判断/抽取失败不得影响主聊天回复；异常按现有 `saveCompanionAssistantTurn` 的 try/catch 吞掉并记日志。
- R8：不新增 D1 表、不新增对外 contract 字段（候选判断是运行时决策）。相关 Zod schema 放在 API 侧内部，不进 packages/contracts。

## Acceptance Criteria

- [ ] AC1：普通寒暄（好/嗯/哈哈/晚安）、纯感谢、一次性情绪，本地 fast reject 跳过，不调 LLM、不入库。
- [ ] AC2：明确记忆信号（「我喜欢」「以后别再」「记住」「我的边界」等）能通过候选判断并成功抽取入库。
- [ ] AC3：与已有记忆完全重复的用户输入被跳过，不重复入库。
- [ ] AC4：疑似敏感凭证（密码/验证码/身份证/银行卡/token 等）被 fast reject 跳过。
- [ ] AC5：LLM 不可用时，抽取退回正则兜底，链路不报错、主回复不受影响。
- [ ] AC6：安全边界判定不允许抽取时，候选判断与抽取器都不执行。
- [ ] AC7：`pnpm check-types`、`pnpm lint` 通过。

## Out of Scope

- 不新增候选审计表（`companion_memory_candidate_logs` 之类）。
- 不做候选类别与记忆类型的强绑定映射表（第一版用软映射）。
- 不做用户确认「我可以记住这一点吗」交互。
- 不改动前端记忆管理面板（MemoryPanel）。

## Notes

迁移编号：本子任务无新表，不占用迁移号。
