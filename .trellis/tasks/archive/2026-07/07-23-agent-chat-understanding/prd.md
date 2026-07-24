# Agent 聊天理解链路：情绪路由到关系阶段

## 背景

对应课程章节 49-52，把课程 ai-agent 项目里已经落地的对话理解链路移植进 moodmate：

- 49 情绪路由（LangGraph）
- 50 Reply Policy Engine
- 51 Reply Quality Guard
- 52 关系阶段系统

课程参考实现：`/Users/wuwanzhu/Code/bobo/ai-agent`，核心在 `apps/api/src/routes/chat/inbox.route.ts`（单文件约 3900 行）。

moodmate 现状（已核对源码）：

- chat 模块在 `apps/api/src/modules/chat/`，已拆成 service/analysis/repository/presenter/route/schema。
- `chat.analysis.ts` 已用 LangGraph 编排 `safety -> intent`，metadata 版本 `conversation-analysis-v1`。
- 分析器 schema 集中在 `packages/contracts/src/chat/companion-analysis.contract.ts`。
- 会话表 `companion_conversations` 有 `userId` unique 约束，一个用户只有一个 companion；已有 `summary`、`messageCount` 字段。
- 消息表 `companion_conversation_messages` 已有 `metadata_json` 字段。
- assistant 消息落库时当前没有写 metadata。
- web 前端是单 companion 单聊页 `apps/web/app/(app)/app`，没有 inbox 列表。

## 与课程的结构差异（本任务的处理方式）

课程假设 multi-agent（每个 Agent 有 `agentName`、`guardrailsPrompt`、人设），moodmate 是单 companion（固定 `COMPANION_SYSTEM_PROMPT`，无 Agent 实体）。已确认的处理：

1. 新建 Agent 实体，给分析器提供 `agentName`、`agentGuardrails` 入参。因为 moodmate 是单 companion，落地为"当前用户的 companion 档案"：一张表存 name + persona + guardrails，配套最小 contract 和读写接口，不做完整多 Agent CRUD。这是四章的前置基础，放在第一个子任务（情绪路由）开头实现。
2. 关系阶段所需的 `conversationSummary`、`messageCount` 直接复用会话表现有字段，不新增 D1 迁移。
3. 关系阶段展示放在单聊页头部，显示当前阶段，不做 inbox 列表。
4. metadata 按课程补齐：user 消息写完整理解结果（safety/intent/emotion/relationshipStage/route/replyPolicy），assistant 消息写 reply-quality-guard 结果。

## 目标链路

```
用户输入
  -> Safety Boundary（已有）
  -> Intent Detection（已有）
  -> Emotion Detection（章49）
  -> Relationship Stage（章52）
  -> Emotion Route（章49）
  -> Reply Policy（章50）
  -> LLM 流式回复（已有）
  -> Reply Quality Guard（章51）
  -> 消息落库（补齐 metadata）
```

LangGraph 节点顺序（课程最终形态）：

```
normalizeInput -> classifyIntent -> detectEmotion
  -> analyzeRelationshipStage -> routeEmotion -> buildReplyPolicy
```

## 子任务

- 07-23-emotion-routing（章49）：Agent 实体前置基础 + 情绪识别 Schema + 情绪路由代码规则 + LangGraph 接入 detectEmotion/routeEmotion + user 消息 metadata 升级到 v1 情绪版。
- 07-23-reply-policy（章50）：Reply Policy Schema + buildReplyPolicy 规则 + buildReplyPolicy 节点 + prompt 注入 + metadata 升级。
- 07-23-reply-quality-guard（章51）：Reply Quality Guard Schema + evaluateReplyQuality 规则 + 在 assistant 落库时执行并写 metadata。
- 07-23-relationship-stage（章52）：关系阶段 Schema + LangChain 判断器 + 启发式兜底 + 规范化 + LangGraph 节点 + 影响 route/policy + prompt 注入 + 单聊页头部阶段展示。

子任务实现顺序建议：emotion-routing -> reply-policy -> relationship-stage -> reply-quality-guard。关系阶段要影响 route 和 policy，所以放在两者之后；quality guard 依赖 reply policy 的 sentenceBudget/forbiddenMoves，放最后。

## 约束

- 保持 moodmate 现有分层：schema 进 `packages/contracts/src/chat/companion-analysis.contract.ts`，分析逻辑进 `apps/api/src/modules/chat/chat.analysis.ts`，装配进 `chat.service.ts`。
- 不把课程 3900 行单文件原样搬进来，按 moodmate 已有的拆分风格落地。
- 情绪识别、关系阶段交给 LLM 结构化输出；情绪路由、Reply Policy、Quality Guard 用代码规则。
- 每层失败都要有兜底，不能因为分析失败让聊天中断。
- 安全边界优先：命中 boundaryResponse 时不进入后续理解链路。
- 分析结果只作为隐性策略注入 system prompt，回复中不暴露内部标签。

## 验收标准

- [ ] 四个子任务全部完成并各自通过验收。
- [ ] 单聊完整链路跑通：safety -> intent -> emotion -> relationshipStage -> route -> replyPolicy -> 回复 -> quality guard。
- [ ] user 消息 metadata 含 safety/intent/emotion/relationshipStage/route/replyPolicy；assistant 消息 metadata 含 reply-quality-guard 结果。
- [ ] 单聊页头部展示当前关系阶段。
- [ ] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 全通过。

## 备注

- 具体字段和分支规则以课程 49-52 章节文档为准（`docs/temp/49-52`）。
- 各子任务 prd 记录本章的字段清单、分支规则和落地文件。
