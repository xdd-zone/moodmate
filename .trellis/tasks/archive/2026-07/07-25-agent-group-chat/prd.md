# Agent 群聊功能（父任务）

## Goal

在 moodmate 里从零实现 AI 电子伴侣的 Agent 群聊：用户创建群聊、邀请自己的多个 Agent、发消息，由系统选择合适的 1-3 个 Agent 回复。功能分 6 个子任务递进实现，从群聊底座一路做到智能发言权判断和 @ 提及。

本任务是父任务，只负责源需求集、子任务映射、跨子任务验收和统一落点约束，不承担直接实现工作。实现落在 6 个子任务里。

## Background

需求来自 6 篇实现复盘草稿（`docs/temp/56-61`），这些草稿描述的是 bobo 课程源码（`/Users/wuwanzhu/Code/bobo/ai-agent`）里的群聊实现。moodmate 与 bobo 同源同栈（Turborepo + pnpm + Hono/Cloudflare Workers + D1 + Next.js + contracts），但目录组织已演进，落点需要做映射，不能照搬 bobo 路径。

### 关键落点映射（modmate 实际 vs 草稿里的 bobo）

| 维度              | 草稿(bobo)                                           | moodmate 实际落点                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 后端结构          | 单文件 `apps/api/src/routes/chat/group.route.ts`     | 模块化 `apps/api/src/modules/group-chat/`（`.route/.service/.repository/.schema/.analysis/.provider/.presenter.ts`），照 `modules/chat/` 分层                                                                       |
| LangGraph         | 需引入                                               | 已就位：`apps/api/package.json` 已有 `@langchain/core`、`@langchain/langgraph`、`@langchain/openai`；`modules/chat/chat.analysis.ts` 已有成熟范式（`StateGraph`/`Annotation.Root`/`withStructuredOutput`/多节点图） |
| 迁移编号          | 0016                                                 | 顺延分配：multi-agent-foundation 用 **0013**，group-chat-foundation 用 **0014**；文件名照 `0012_companion_proactive_care.sql` 风格                                                                                  |
| 迁移写法          | 裸 SQL                                               | 反引号标识符 + `FOREIGN KEY ... ON DELETE cascade` + `CONSTRAINT ... CHECK(...)` + 显式 `CREATE INDEX`，照 0012                                                                                                     |
| 契约位置          | `packages/contracts/src/chat/group-chat.contract.ts` | 同路径；并在 `packages/contracts/src/index.ts` 导出（照现有 chat 契约导出方式）                                                                                                                                     |
| 路由注册          | `.route('/rpc/chat/group', groupChatRoute)`          | `apps/api/src/routes/index.ts` 里 `.route("/", createGroupChatRoute())`，端点前缀在模块内定义为 `/rpc/chat/group`                                                                                                   |
| Web 本地 LLM 配置 | 复用本地 LLM 配置                                    | web 端已移除（提交 `1db3b85`），群聊**不引入** `llmConfig`，与现状单聊一致，服务端用平台默认模型                                                                                                                    |
| Web 回复形态      | 非流式，一次返回 `agentMessages` 数组                | 非流式（已与用户确认）；前端用 react-query `onMutate` 自建乐观更新（项目暂无现成范例）                                                                                                                              |
| Web 目录          | `apps/web/app/(dashboard)/group-chats/page.tsx`      | 无 `(dashboard)` group；建 `apps/web/app/(app)/group-chats/page.tsx`（薄壳）+ `apps/web/src/components/group-chat/` 组件 + `src/api/group-chat.api.ts` + `group-chat.query.ts`；路径别名是 `@/src/...`              |
| Web UI 依赖       | 用 Dialog/Avatar 等                                  | `packages/ui` 无 Dialog/Avatar/ScrollArea/Popover；三栏用 Tailwind grid，Dialog 与候选浮层手写遮罩层，头像用带背景色 `<span>` + lucide 图标，滚动用原生 `overflow-y-auto`                                           |

## 子任务映射

| 顺序 | 子任务目录                                 | 对应草稿       | 交付物摘要                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | `07-25-multi-agent-foundation`             | 无（前置补齐） | 新增独立多 Agent 体系并与现有单聊并存：`user_agents` 表（单用户多 Agent，含人设/头像/边界）、按 agent 维度的 `agent_conversations` / `agent_memories`、创建/列表/详情 API 与契约。为群聊提供"可被邀请的多个 Agent"和"按 Agent 的一对一记忆"。现有 `companion_*` 单聊零改动 |
| 1    | `07-25-group-chat-foundation`              | 56             | 迁移（3 张群聊表）、`group-chat.contract.ts`、基础 API（列表/创建/详情/历史分页/成员增删）、创建群聊与成员管理后端；成员外键指向 `user_agents`                                                                                                                             |
| 2    | `07-25-group-chat-reply-ui`                | 57             | v1 规则版 `selectAgentsForReply`、回复 Prompt、`POST /send` 完整链路、群聊三栏页面、乐观更新、历史分页 UI                                                                                                                                                                  |
| 3    | `07-25-group-chat-langgraph-orchestration` | 58             | 把 v1 规则升级为 LangGraph 图：`classifyIntent -> selectAgents -> generateReplies -> checkQuality`，串行/并行生成、结构化输出适配、全链路降级回退到 v1 规则                                                                                                                |
| 4    | `07-25-group-chat-cross-agent-replies`     | 59             | 新增 `generateCrossReplies` 节点，首轮后最多追加 2 条、1 轮 Agent 间补充回应，规划器 + 归一化 + 保守质量修订 + metadata                                                                                                                                                    |
| 5    | `07-25-group-chat-smart-speaker-selection` | 60             | 新增 `detectEmotion` 节点，发言权综合人设/关系阶段/最近发言频率/用户情绪，fallback 从关键词升级为打分排序                                                                                                                                                                  |
| 6    | `07-25-group-chat-mentions`                | 61             | @ 提及：前端输入补全（候选浮层 + 键鼠交互）写入 `@昵称` 文本；服务端 `findExplicitlyMentionedAgents` 显式提及识别，调度前置覆盖                                                                                                                                            |

### 前置任务说明（为何新增 multi-agent-foundation）

6 篇草稿默认 bobo 的"单用户多 Agent"模型（`user_agent_companions` 表、按 agent 的一对一记忆），而 moodmate 现状是**单用户单 Agent**：`companion_profiles`、`companion_conversations` 均带 `UNIQUE(user_id)`，`companion_memories` 按 `user_id` 存，没有"可被邀请进群的多个 Agent"这个实体。群聊的第一步（建群选 Agent）在现状下无 Agent 可选。

经与用户确认，采用**方案 A：新增独立多 Agent 体系，与现有单聊并存**。因此在所有群聊子任务之前插入前置任务 `07-25-multi-agent-foundation`，补齐 `user_agents` 及按 agent 维度的会话/记忆表与创建/列表 API。现有 `companion_*` 单聊链路（含 `chat.analysis.ts` 理解链、care、feedback、memory）零改动。

### 子任务顺序即依赖

父/子结构不是依赖系统。这里的依赖顺序写死在各子 prd/implement：**multi-agent-foundation 是群聊全部子任务的地基**（提供 `user_agents` 与按 Agent 记忆）；foundation 依赖 multi-agent-foundation 的 `user_agents` 表；reply-ui 依赖 foundation 的表与契约；langgraph 依赖 reply-ui 的 `buildAgentReply`/`selectAgentsForReply`；cross-agent、smart-speaker 依赖 langgraph 的图与状态；mentions 依赖 langgraph 的 `selectGroupAgentsNode` 与 reply-ui 的输入框。按 0→6 顺序实现、检查、归档。

## 全局约束（所有子任务遵守）

- 后端一律走 `modules/group-chat/` 模块化分层，禁止在 `routes/` 下建单文件路由。
- 契约先行：前后端共享类型只在 `packages/contracts/src/chat/group-chat.contract.ts` 定义并导出，禁止在 route 或前端重复定义 payload。
- 硬上限：一个群聊最多 6 个 Agent；每轮最多 3 个 Agent 回复（`groupReplyAgentLimit = 3`）；Agent 间补充回应最多 2 条、1 轮。上限同时在前端体验与后端规则里存在，后端负责最终兜底。
- 越权防护：创建群聊/加成员时，选择的 Agent 必须属于当前 Web 用户，否则拒绝。
- 记忆隔离：每个 Agent 回复只注入它自己与用户的一对一长期记忆，禁止跨 Agent 记忆污染。
- 降级原则：LangGraph 用来增强体验，任何节点/整图失败都要回退到 v1 规则，不能让基础群聊聊不了。
- 每个子任务完成后按项目质量门跑：类型检查 → lint → format（见各子任务 implement.md 的具体命令）。

## Acceptance Criteria（跨子任务集成验收）

- [ ] 6 个子任务全部实现、通过各自质量检查并归档。
- [ ] 用户能创建群聊、邀请 1-6 个自己的 Agent、移除成员，成员上限后端兜底生效。
- [ ] 用户发普通消息默认 1 个 Agent 回复；群体提问（你们/大家/一起/分别/怎么看/意见）触发多个（≤3）Agent 回复。
- [ ] `@昵称` 提及的 Agent 一定优先回复，且不被 LangGraph 智能调度覆盖。
- [ ] 用户情绪/关系阶段/最近发言频率参与发言权判断（smart-speaker 生效后）。
- [ ] 首轮回复后按规则最多追加 2 条、1 轮 Agent 间补充回应，且不进入无限自说自话。
- [ ] LangGraph 任一节点或整图失败时，系统回退到 v1 规则仍能正常返回回复。
- [ ] 每个 Agent 只拿到自己的一对一长期记忆。
- [ ] 前端三栏页面可创建群聊、切换群聊、发消息、乐观更新与失败回滚、加载更早消息。
- [ ] Agent 消息 `metadata_json` 记录编排轨迹（intent/selection/speakingContext/crossReplyPlan/quality/model/wireApi）。

## Out of Scope

- 流式群聊回复（SSE / AI SDK stream）——本批次一律非流式返回完整数组。
- 群聊级长期记忆表（`agent_group_chat_memories`）——只保留群聊 `summary` 字段。
- 后台编排分析页（消费 metadata 的可视化）。
- 无限多 Agent 自主多轮讨论。
- embedding / 分类器做能力匹配——smart-speaker 仅用关键词 + 启发式打分。
- 用户级群聊互动强度偏好（安静/均衡/热闹）。
- 引入本地 LLM 配置 UI（web 端已移除，不恢复）。

## Notes

- 6 篇草稿是"实现复盘"文体，含 bobo 具体路径与变量名；实现时以本 PRD 的落点映射为准，草稿里的代码片段作为逻辑与命名参考，不作为路径依据。
- 草稿原文保存在 `docs/temp/56-61`，各子任务 research 里按需摘录关键片段。
