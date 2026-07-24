# 记忆候选判断 — 技术设计

## 边界与落点

改动集中在 API 侧两个文件，不动 contracts、不动前端、不加表。

- `apps/api/src/modules/chat/chat.analysis.ts`：新增候选判断器与 LLM 抽取器（复用现有 LangChain 模式），及各自的 fallback。
- `apps/api/src/modules/chat/chat.service.ts`：改造 `saveCompanionAssistantTurn` → `saveCandidateMemories` 区域，串联「候选判断 → 抽取器 → 去重入库」。

## 数据流

现状：

```
saveCompanionAssistantTurn
  -> 插入 assistant 消息
  -> if !allowMemoryExtraction: return
  -> saveCandidateMemories(userText)
       -> extractCandidateMemories(正则)
       -> listActiveCompanionMemories 去重
       -> insertCompanionMemory
```

改造后：

```
saveCompanionAssistantTurn
  -> 插入 assistant 消息
  -> if !allowMemoryExtraction: return
  -> saveCandidateMemories({ providerConfig, userText, assistantText, existingMemories, summary })
       -> listActiveCompanionMemories(existing)            // 复用，供 fast reject + 判断 + 去重
       -> shouldSkipMemoryCandidateFast(本地规则)           // 命中即 return
       -> judgeMemoryCandidateWithLangChain(...)            // LLM 闸门，失败走关键词兜底
       -> if !candidate.shouldExtract: log + return
       -> extractMemoriesWithLangChain({ candidate, ... })  // LLM 精抽，失败退回正则 extractCandidateMemories
       -> content 去重（Set）
       -> insertCompanionMemory（type 映射到中文类型，importance 1-5）
```

关键：`saveCompanionAssistantTurn` 当前不持有 providerConfig。方案——在 `prepareCompanionChat` 产出的 `turn` 上带上 `providerConfig`（`chat.turn` 已在链路中构造），`saveCompanionAssistantTurn` 从 `input.turn.providerConfig` 读取。若 turn 不便扩展，则在 `saveCandidateMemories` 内调 `resolveProviderConfig(bindings)` 重新解析（有额外一次解密开销，但简单）。优先前者。

## 候选判断 Schema（API 内部，不进 contracts）

```ts
const CompanionMemoryCandidateSchema = z.object({
  shouldExtract: z.boolean(),
  confidence: z.number().min(0).max(1),
  category: z.enum([
    "preference",
    "boundary",
    "relationship_goal",
    "conversation_style",
    "important_fact",
    "identity_profile",
    "temporary_emotion",
    "small_talk",
    "assistant_generated",
    "duplicate",
    "unsafe",
    "unclear",
  ]),
  stability: z.enum(["stable", "likely_stable", "temporary", "unclear"]),
  importance: z.number().int().min(0).max(5),
  reason: z.string().trim().max(300),
  candidateFacts: z.array(z.string().trim().min(1).max(120)).max(3),
});
```

## 抽取器 Schema（API 内部）

```ts
const CompanionExtractedMemorySchema = z.object({
  memories: z
    .array(
      z.object({
        content: z.string().trim().min(1).max(500),
        type: z.enum(["偏好", "边界", "关系目标", "对话风格", "重要事实"]),
        importance: z.number().int().min(1).max(5),
      }),
    )
    .max(3),
});
```

抽取器 prompt 注入候选判断结论（类别/稳定性/重要度/候选事实）作为精抽方向。

## Fast Reject 规则（本地，无 LLM）

按 docs/temp/53 复刻，落到 moodmate：

1. userText / assistantText 为空 → skip（unclear）
2. userText 长度 < 6 且无记忆信号正则 → skip（small_talk）
3. 命中常见确认语正则（好/嗯/哦/哈哈/谢谢/晚安/ok…）→ skip（small_talk）
4. `normalizeStoredMessage(userText)` 与任一 existingMemory.content 规范化后相等 → skip（duplicate）
5. 命中敏感凭证正则（密码/验证码/身份证/银行卡/手机号/token/api key/secret/密钥）→ skip（unsafe）

## 规范化闸门

模型返回后强制约束（同 docs/temp/53）：

- category ∈ {small_talk, temporary_emotion, assistant_generated, duplicate, unsafe} → shouldExtract=false
- stability === "temporary" 或 importance <= 0 → shouldExtract=false
- confidence < 0.55 且 importance < 4 → shouldExtract=false

## 兜底

- 候选判断 LLM 全失败 → `buildFallbackMemoryCandidate`：关键词信号（记住/以后/我喜欢/边界/生日/工作…）命中才 shouldExtract=true，否则 false。
- 抽取器 LLM 全失败 → 退回现有 `extractCandidateMemories(userText)` 正则逻辑，保证不空转。

## 兼容与回滚

- 无表变更、无 contract 变更，回滚只需还原两文件改动。
- LLM 不可用场景由双层 fallback 覆盖，行为退化到接近现状（正则抽取），不会使聊天链路失败。

## 权衡

- 每轮通过 fast reject 后最多两次 LLM 调用（判断 + 抽取）。fast reject 兜住大量寒暄轮次，控制成本。
- 抽取器 type 用固定中文枚举收口，避免自由文本类型继续发散；与现有数据里的中文类型一致。
