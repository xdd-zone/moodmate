# Reply Policy 引擎

对应课程章节 50（`docs/temp/50-agent-chat-reply-policy-engine.txt`）。父任务 `07-23-agent-chat-understanding`。

## 目标

在情绪路由之后加一层 Reply Policy，把 route 转成本轮可执行的回复行为准则（句数、节奏、开场动作、允许/禁止动作、追问上限、建议上限、亲密度）。route 决定走哪条线，Reply Policy 决定这一轮具体怎么说。

## 前置

- 依赖 `07-23-emotion-routing` 已产出 `EmotionRoute`、`buildEmotionRoute`、`fallbackEmotionRoute` 和对话理解图。

## 需求

### Schema（`packages/contracts/src/chat/companion-analysis.contract.ts`）

- 新增 `ReplyPolicySchema` 和 `ReplyPolicy` 类型，字段按课程原文：
  - `policy`：`quiet_presence` / `warm_companion` / `deep_empathy` / `playful_flirt` / `calm_boundary` / `relationship_repair` / `gentle_clarify` / `practical_support` / `roleplay_flow` / `memory_ack`
  - `sentenceBudget`：`{ min, max }`，各为 1-8 整数
  - `rhythm`：`still` / `soft` / `natural` / `lively` / `focused`
  - `openingMove`：`acknowledge` / `comfort` / `mirror` / `apologize` / `play` / `answer` / `clarify` / `set_boundary`
  - `allowedMoves`：枚举数组，最多 6 个（取值见课程原文）
  - `forbiddenMoves`：枚举数组，最多 8 个（取值见课程原文）
  - `questionLimit`：0-2 整数
  - `adviceLimit`：0-3 整数
  - `intimacyLevel`：`low` / `medium` / `high`
  - `styleGuidance`：字符串，trim，最长 700
- 从 `packages/contracts/src/index.ts` 导出。

### 分析逻辑（`apps/api/src/modules/chat/chat.analysis.ts`）

- `fallbackReplyPolicy`：`gentle_clarify`，句数 1-3，先承接再只问一个低压力问题，不给建议。
- `sentenceBudgetForRoute(route)`：把 `route.responseLength` 转成句数范围（very_short 1-2、short 1-3、medium 2-5、long 3-7）。
- `buildReplyPolicy({ safety, intent, emotion, route })`：纯代码规则。
  - 三者全空返回 `fallbackReplyPolicy`。
  - 从 route 得到基础方向，按 `route.route` 进入不同 policy 分支（各分支 allowed/forbidden、questionLimit、adviceLimit、intimacyLevel 按课程原文）。
  - `memory_update` / `preference_setting` 意图强制走 `memory_ack`，句数压到最多 2。
  - 二次修正：safety 非 `continue` 时降亲密度并禁 `intense_flirt`、`promise_real_world_action`；强负面情绪禁 `intense_flirt`、`premature_advice` 并把 lively 降为 soft；route 不允许追问则 `questionLimit=0`；不允许建议则 `adviceLimit=0`。
  - 用 `ReplyPolicySchema.parse` 校验后返回。
- 对话理解图新增 `buildReplyPolicy` 节点，接在 `routeEmotion` 之后到 END。State 增加 `replyPolicy`。
- `analyzeConversationUnderstanding` 返回体增加 `replyPolicy`，图执行失败时兜底也要构建 `buildReplyPolicy`。
- `getReplyPolicySystemInstruction(replyPolicy)`：注入句数范围、节奏、开场、亲密度、追问上限、建议上限、允许/禁止动作、风格指导，末句声明这不是固定话术、不要暴露内部标签。
- metadata 版本升级为 `conversation-understanding-v2`，`buildConversationAnalysisMetadata` 增加 `replyPolicy`。

### 主流程接入（`apps/api/src/modules/chat/chat.service.ts`）

- system prompt 组装在情绪路由之后追加 `getReplyPolicySystemInstruction`。
- `replyPolicy` 随理解结果一起拿到，写进用户消息 metadata。
- Reply Policy 需要传给 assistant 落库（供章 51 质检使用），在 `turn` 或 `saveCompanionAssistantTurn` 入参里带上 `replyPolicy`。

## 验收标准

- [ ] `ReplyPolicySchema` 和类型已定义并导出。
- [ ] `buildReplyPolicy` 覆盖课程各 route 分支和二次修正规则。
- [ ] 对话理解图含 `buildReplyPolicy` 节点，返回体含 `replyPolicy`。
- [ ] system prompt 注入 Reply Policy；metadata 升到 `conversation-understanding-v2`。
- [ ] 无 D1 迁移。
- [ ] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 通过。

## 约束

- Reply Policy 是纯代码规则，不额外调用 LLM。
- 不改动安全边界和意图判断的既有行为。
