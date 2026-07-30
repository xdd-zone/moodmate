# 草稿 60 关键片段与 moodmate 落点映射

来源：`docs/temp/60-agent-group-chat-smart-speaker-selection.txt`。草稿写的是 bobo 单文件 `group.route.ts`，本任务落到 moodmate 模块化分层。下面只留实现要用的逻辑与常量，路径以本 PRD/design 为准。

## 1. 图结构变化

草稿：`classifyIntent -> selectAgents -> generateReplies -> generateCrossReplies -> checkQuality`
升级为：`classifyIntent -> detectEmotion -> selectAgents -> generateReplies -> generateCrossReplies -> checkQuality`

在选 Agent 前插入一个轻量情绪识别节点。moodmate 现状图缺 detectEmotion，需新增节点 + 一条 `classifyIntent -> detectEmotion -> selectAgents` 的边改写。

## 2. 会话统计（moodmate 落点：改 listActiveMembers）

草稿在成员记录上加两字段：

- `conversationMessageCount`：`coalesce(agentConversations.messageCount, 0)`
- `conversationLastMessageAtMs`：`agentConversations.lastMessageAtMs`
  通过 `leftJoin(agentConversations, and(eq(userId), eq(agentId)))` 关联。无新迁移。

moodmate：`GroupChatMemberWithAgentRow` 加这两字段，`listActiveMembers` 加 `leftJoin(agentConversations)`。

## 3. 发言权上下文结构（moodmate 落点：group-chat.speaking.ts）

```
type AgentSpeakingContext = {
  agentId: string
  conversationMessageCount: number
  recentReplyCount: number
  lastSpokeTurnsAgo: number | null
  relationshipStage: 'new_connection' | 'warming_up' | 'trusted' | 'close_bond'
  relationshipScore: number
  freshnessScore: number
}
type GroupSpeakingContext = {
  userEmotion: GroupChatUserEmotion
  agentContexts: AgentSpeakingContext[]
}
```

## 4. 关系阶段启发式（消息数 4 档）

```
messageCount >= 80 -> close_bond
messageCount >= 30 -> trusted
messageCount >= 8  -> warming_up
else               -> new_connection
```

分数：close_bond 0.95 / trusted 0.78 / warming_up 0.52 / new_connection 0.25。

## 5. 最近发言频率与新鲜度

```
recentAgentMessages = recentMessages.filter(senderType==='agent' && agentId).slice(-18)
messagesByAgent = recentAgentMessages.filter(agentId===agent.id)
lastMessage = messagesByAgent.at(-1)
lastSpokeTurnsAgo = lastMessage ? max(0, maxTurnIndex - lastMessage.turnIndex) : null
freshnessBase = lastSpokeTurnsAgo === null ? 1 : min(1, lastSpokeTurnsAgo / 6)
freshnessPenalty = min(0.75, messagesByAgent.length * 0.16)
freshnessScore = max(0, round2(freshnessBase - freshnessPenalty))
```

maxTurnIndex 取 recentMessages 里最大的 turnIndex。

## 6. 用户情绪 schema（群聊专用）

```
GroupChatUserEmotionSchema = z.object({
  primaryEmotion: enum(neutral/happy/sad/anxious/angry/lonely/stressed/confused/romantic/playful/unknown),
  intensity: number().min(0).max(1),
  needsComfort: boolean,
  needsAdvice: boolean,
  needsDeescalation: boolean,
  socialEnergy: enum(low/medium/high),
  reason: string().trim().max(400),
})
```

情绪 prompt 只判断情绪与陪伴需求，不生成回复、不选 Agent。

## 7. 情绪 fallback（关键词兜底）

```
sad = /(难过|伤心|委屈|想哭|失落|崩溃|没人懂|孤独|孤单)/
anxious = /(焦虑|紧张|慌|害怕|担心|压力|睡不着|不安)/
angry = /(生气|愤怒|烦死|气死|吵架|不爽|火大)/
romantic = /(喜欢|想你|暧昧|心动|恋爱|约会|亲密|撒娇)/
playful = /(哈哈|笑死|好玩|逗|开玩笑|hh|lol)/i
happy = /(开心|高兴|快乐|惊喜|太好了|舒服了)/
confused = /(怎么办|不知道|纠结|迷茫|怎么选|不懂|为什么)/
needsComfort = sad||anxious||angry|| /陪陪|安慰|抱抱|难受/
needsAdvice = confused|| /(建议|分析|复盘|怎么做|帮我想|选择)/
needsDeescalation = angry|| /(冷静|别吵|缓一缓|降温)/
```

primaryEmotion 按上面布尔命中优先级归一；socialEnergy 由 playful/happy 命中给 high、消极情绪给 low、否则 medium（草稿未写死，按此推导）。

## 8. fallback 打分（scoreAgentForFallbackSelection）

点名仍优先直接返回；非点名场景改打分排序：

```
if (context) {
  score += context.relationshipScore * 1.6
  score += context.freshnessScore * 1.8
  score -= context.recentReplyCount * 0.45
  if (context.lastSpokeTurnsAgo === 0) score -= 0.9
}
// 人设关键词匹配 profileText = headline+description+personaPrompt+tonePrompt+defaultPrompt
if (needsComfort && /(温柔|陪伴|情绪|安慰|稳定|倾听|治愈|共情)/.test(profileText)) score += 2.4
if (needsAdvice && /(理性|分析|建议|计划|复盘|清醒|判断|策略)/.test(profileText)) score += 2.1
if (needsDeescalation && /(克制|边界|冷静|稳定|成熟|安全)/.test(profileText)) score += 2.2
```

排序：`sort((a,b) => b.score - a.score || a.agent.displayOrder - b.agent.displayOrder)`，取前 limit。
limit：多人场景（点名多个 / 群体提问关键词 / intent.shouldUseMultipleAgents）用 groupReplyAgentLimit，否则 1。

## 9. 选择器 prompt 升级

selection prompt 从「意图 + 名单」升级为「意图 + 情绪 + 人设 + 关系阶段 + 发言频率」。user message 增一段 `发言权上下文：{speakingContext}`，含用户主情绪/强度/需求/社交能量，以及每个 Agent 的关系阶段/一对一消息数/最近发言次数/距上次发言轮数/新鲜度。

## 10. metadata 与前端

metadata 的 `orchestration` 增 `speakingContext` 字段。前端协议不变，仍返回 `agentMessages` 数组，无需改 UI。

## 11. 边界（有意保留）

关系阶段仅从消息数推导；fallback 人设匹配用关键词非 embedding；发言频率只看最近一段群聊；情绪是群聊局部轻量版；无用户级互动强度偏好。
