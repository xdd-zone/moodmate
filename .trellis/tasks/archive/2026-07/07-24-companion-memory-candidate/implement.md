# 记忆候选判断 — 执行计划

## 前置

无迁移，无 contract 变更。纯 API 逻辑改造。

## 执行顺序

1. `chat.analysis.ts`：新增候选判断能力
   - 定义 `CompanionMemoryCandidateSchema` + 类型 + `fallbackMemoryCandidate` 思路（关键词兜底函数 `buildFallbackMemoryCandidate`）。
   - 定义 `shouldSkipMemoryCandidateFast(params)`：空/短寒暄/确认语/重复/敏感 五类本地快速拒绝。
   - 定义 `judgeMemoryCandidateWithLangChain(params)`：`ChatPromptTemplate` + `withStructuredOutput` 遍历 `STRUCTURED_OUTPUT_METHODS` 重试，全失败调 `buildFallbackMemoryCandidate`。
   - 定义 `normalizeMemoryCandidate(candidate)`：强制闸门规则。
   - 导出组合入口 `judgeCompanionMemoryCandidate(params)`：fast reject → LangChain → normalize。

2. `chat.analysis.ts`：新增 LLM 抽取器
   - 定义 `CompanionExtractedMemorySchema` + 类型。
   - 定义 `extractCompanionMemoriesWithLangChain(params)`：注入候选判断结论，结构化输出重试，失败返回 null（由 service 退回正则）。

3. `chat.service.ts`：改造串联
   - `saveCandidateMemories` 改签名，接收 `assistantText` / `providerConfig` / `previousSummary`。
   - 先 `listActiveCompanionMemories`，传给 fast reject + 判断。
   - 通过判断后调抽取器；抽取器返回空则退回现有 `extractCandidateMemories(userText)`。
   - content 去重后 `insertCompanionMemory`。
   - `saveCompanionAssistantTurn` 调用处补齐新参数（providerConfig 来源见 design：优先 turn 携带）。
   - 判断跳过时 `console.info` 记录 category/confidence/reason。

4. 确认 `prepareCompanionChat` 的 `turn` 能带出 `providerConfig`（已有 `chat.providerConfig`，把它挂到 turn 或在 save 时传入）。

## 验证命令

```bash
pnpm --filter @repo/api check-types
pnpm --filter @repo/api lint
pnpm check-types
```

## 风险点 / 回滚

- 风险文件：`chat.service.ts`（触碰核心保存链路）。改动限定在 `saveCandidateMemories` 及其调用点，不动消息插入与摘要逻辑。
- 回滚：还原 `chat.analysis.ts` 新增块 + `chat.service.ts` 的 `saveCandidateMemories` 改动即可，无数据层副作用。

## 完成标准

- fast reject 五类命中路径可跳过 LLM。
- 判断通过 → 抽取 → 去重入库；判断不通过 → 不写记忆并留日志。
- 两层 LLM 失败均有兜底，聊天保存链路不因记忆逻辑抛错中断（现有 try/catch 已包裹）。
- 类型检查、lint 通过。
