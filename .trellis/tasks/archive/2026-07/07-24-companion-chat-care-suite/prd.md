# 陪伴聊天增强三件套（父任务）

## Goal

在 moodmate 现有陪伴聊天体系上，补齐三个相互独立、可分别验证的增强能力，让 AI 陪伴从"能回复"走向"越来越懂用户、并能主动陪伴"：

1. 记忆候选判断（对应 docs/temp/53）：在长期记忆抽取前加一道 LLM 闸门，只让有长期价值的对话进入抽取。
2. 用户反馈闭环（对应 docs/temp/54）：用户可对某条 assistant 回复点赞/点踩，反馈持久化、历史回显、并注入下一轮 system prompt 校准回复风格。
3. 主动关怀系统（对应 docs/temp/55）：伴侣可按计划主动发一条关怀消息，写入真实聊天历史，首页/入口显示未读并可标记已读。

## Background（已确认事实）

来源：docs/temp/53-55 参考文档（描述的是原项目 bobo/ai-agent 的实现）+ moodmate 代码调研。

moodmate 与 bobo 架构差异（关键，不能照搬 bobo 落点）：

- schema 按模块分散，陪伴相关表在 `apps/api/src/modules/chat/chat.schema.ts`，不在集中式 `db/schema.ts`。
- 表名前缀是 `companion_*`（如 `companion_conversations`/`companion_conversation_messages`/`companion_memories`/`companion_profiles`），不是 bobo 的 `agent_*`。
- 聊天逻辑分层在 `apps/api/src/modules/chat/`：`chat.route.ts`（Hono 路由）、`chat.service.ts`（编排）、`chat.repository.ts`（Drizzle 查询）、`chat.analysis.ts`（LangChain/LangGraph 分析层，约 2127 行）、`chat.presenter.ts`（DTO 映射）、`chat.provider.ts`（裸 fetch SSE 流式主回复）。
- migrations 在 `apps/api/migrations/`，当前最大编号 `0010`，下一个新迁移从 `0011` 起。
- contracts 在 `packages/contracts/src/chat/`（`companion-chat.contract.ts` / `companion-analysis.contract.ts`），通过 `packages/contracts/src/index.ts` 手动 re-export。
- web 端无 `app/` 目录；单聊主界面是 `apps/web/src/components/chat/companion-chat.tsx`（`CompanionChatApp`），设置面板在 `apps/web/src/components/settings/settings-panels.tsx`（含 `MemoryPanel` 等）；REST 封装在 `apps/web/src/api/chat.api.ts` + `chat.query.ts`。
- moodmate 是单用户单伴侣模型：`companion_conversations.user_id` unique（每用户一个会话），`companion_profiles.user_id` unique，无"伴侣列表/多 agent"概念，无独立 agentId 维度。

前置能力落地情况（三件套依赖，均已就位）：

- 长期记忆抽取：已实现但是正则启发式版。落点 `chat.service.ts` 的 `saveCompanionAssistantTurn` → `saveCandidateMemories` → `extractCandidateMemories`（正则 `MEMORY_TRIGGER_PATTERN` + `classifyMemoryType`，抽取源是用户文本、按内容去重、每轮最多 2 条、无 LLM）。文档 53 要把这道口子升级为 LLM 候选判断。
- 安全边界：`analyzeConversationSafety`（chat.analysis.ts），命中时走 `buildBoundaryResponse`，`allowMemoryExtraction` 语义已在链路中。
- 意图/情绪/关系阶段/回复策略：均由 `analyzeConversationUnderstanding`（LangGraph StateGraph）产出，system 指令由各 `getXxxSystemInstruction` 生成，在 `buildSystemPrompt` 中按序 join。
- 回复质量守卫：`evaluateReplyQuality` 已跑，仅记录进 assistant metadata，未做拦截/重生成。
- LangChain 结构化输出复用模式：`buildLangChainChatModel` + `model.withStructuredOutput(Schema, { name, method })`，遍历 `STRUCTURED_OUTPUT_METHODS = ["functionCalling","jsonSchema","jsonMode"]` 逐方法重试，全失败回退 `fallbackXxx` 常量。新功能应复用这一模式。
- LLM provider 配置读取：`resolveProviderConfig`（chat.service.ts）→ `resolveActiveLlmProviderConfig`（llm-config.service.ts），返回含 apiKey/baseURL/model 的 `ActiveLlmProviderConfig`。

三件套现状：表、contract、service 逻辑全部未实现（仅有同名 intent 枚举值和启发式记忆）。

## 子任务拆分

三个交付物相互独立、可分别 plan/implement/check/archive，按父子结构拆：

- 子任务 A（53）：记忆候选判断。改造点集中在 API 分析/service 层，无新表、无新 contract 对外字段（候选判断是运行时决策）。
- 子任务 B（54）：用户反馈闭环。新增 1 张表 + contract + 反馈 API + 历史回显 + prompt 注入 + web UI 按钮。
- 子任务 C（55）：主动关怀系统。新增 2 张表 + contract + 关怀计划/事件 API + 写入真实会话 + 未读/已读 + web UI 设置面板。

依赖关系：三者对彼此无硬依赖，可并行推进。迁移编号父任务层统一分配：子任务 A 无迁移；子任务 B（反馈闭环）用 `0011`；子任务 C（主动关怀）用 `0012`。不论落地先后都按此编号，不复用。

## Requirements（父任务层，跨子任务）

- R1：三个功能各自遵循 moodmate 现有分层与命名（`companion_*` 表、`modules/chat/*` 分层、contracts 手动 re-export），不引入 bobo 的 `agent_*` 命名或单文件巨型路由。
- R2：三个功能都不得绕过安全边界。记忆候选判断在安全允许后才执行；反馈注入与主动关怀都在既有安全/策略约束内。
- R3：迁移编号统一分配——A 无迁移、B 用 `0011`、C 用 `0012`，互不冲突；不修改已执行迁移。
- R4：新增 contract 一律经 `packages/contracts/src/index.ts` 导出，前后端类型一致。

## Acceptance Criteria（父任务层）

- [ ] 三个子任务分别创建，各自有独立 prd.md，且各自 acceptance 可独立验证。
- [ ] 三个子任务的迁移编号不冲突。
- [ ] 三个功能均复用现有 LangChain 结构化输出重试+fallback 模式（涉及 LLM 的部分）。
- [ ] 集成后 `pnpm check-types`、`pnpm lint` 通过（父任务最终集成检查）。

## Out of Scope

- 不做 Cloudflare Cron 自动定时推送（主动关怀 MVP 仅手动生成 + 保留 next_run_at 字段）。
- 不做浏览器/邮件/短信等外部通知。
- 不做记忆候选审计表（53 第一版不加审计表）。
- 不做反馈驱动的模型微调、人设自动改写、复杂评分体系。

## 已定决策（原 Open Questions，已拍板）

- D1：记忆链路采用"候选判断（LLM 闸门）+ 独立 LLM 抽取器"两段式，替换现有正则启发式抽取（子任务 A）。
- D2：主动关怀 UI 走"写入真实聊天历史 + 聊天入口轻量未读提示"，不做首页伴侣列表（moodmate 无此 UI）（子任务 C）。
- D3：主动关怀文案 MVP 用规则模板，不接 LLM（子任务 C）。
- D4：反馈按钮挂在历史 assistant 气泡下，仅对服务端已持久化消息展示（复用 `historicalAssistantMessageIds`）（子任务 B）。
- D5：主动关怀"手动生成"入口放 settings 新增 care section（moodmate 无 agent 详情页）（子任务 C）。
