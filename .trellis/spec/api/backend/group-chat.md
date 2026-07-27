# API Agent 群聊

## 1. 适用范围

修改 Agent 群聊的创建、成员管理、消息历史、发送与多 Agent 回复生成时使用本规范。实现位于 `apps/api/src/modules/group-chat/`，共享契约在 `packages/contracts/src/chat/group-chat.contract.ts`，数据库迁移是 `apps/api/migrations/0014_*.sql`（三张表：`agent_group_chats` / `agent_group_chat_members` / `agent_group_chat_messages`）。群聊成员指向多 Agent 体系的 `user_agents`，与单聊 `companion_*` 链路无关。

与单聊的核心差异：群聊回复**非流式**，一次返回完整的 `agentMessages` 数组；**不接收请求级 `llmConfig`**，服务端固定用平台默认模型。

## 2. 公开签名

```text
GET    /rpc/chat/group
POST   /rpc/chat/group
GET    /rpc/chat/group/:groupChatId
GET    /rpc/chat/group/:groupChatId/messages?cursor=<createdAtMs>
POST   /rpc/chat/group/:groupChatId/members
DELETE /rpc/chat/group/:groupChatId/members/:memberId
POST   /rpc/chat/group/:groupChatId/send

Authorization: Bearer <web access token>
```

模块入口 `createGroupChatRoute()`；route 处理鉴权和 Zod 校验，service 组装业务与越权校验，repository 只读写 D1，presenter 把 record 转 DTO。全部接口返回统一 JSON 响应（无流式）。`send` 是本规范重点，其余为群聊底座。

## 3. 合同

- 所有接口先经 `requireWebAccess`，再校验。`send` 用 path param `groupChatId` + `SendAgentGroupChatMessageRequestSchema`（只含 `message`，trim 1-2000，**不含 llmConfig / groupChatId**）。
- 归属校验：`requireGroupChat` 确认群聊属当前 `userId`，否则 403；返回群聊记录供后续复用。
- 成员上限：一个群最多 6 个 Agent；每轮最多 3 个 Agent 回复（`groupReplyAgentLimit = 3`），上限在后端 `selectAgentsForReply` 里兜底，不依赖前端。
- v1 发言权规则（`selectAgentsForReply`）：点名（`userText` 含成员 name）→ 返回被点名成员（≤3）；群体关键词 `/(你们|大家|一起|分别|都说|怎么看|意见)/` → 返回前 min(3, 成员数) 个；否则默认单个。均保持 `displayOrder` 顺序。
- 人设补拉：`listActiveMembers` 只返回展示字段（name/headline/imageKey/displayOrder），**没有人设 prompt**。选中成员后必须用 `listOwnedUserAgentsByIds` 按 agentId 拉完整 `UserAgentRecord`，`buildAgentReply` 用完整记录构造 prompt。
- 记忆隔离：每个 Agent 回复只注入自己的 `listActiveAgentMemories({ userId, agentId, limit: 6 })`，禁止跨 Agent 记忆污染。
- 顺序生成：for 循环串行生成，把已生成回复累积进下一轮 `recentMessages`（`[...recent, userMsg, ...已生成 agentMsgs]`），**禁用 `Promise.all`**，让后一个 Agent 看到同轮前面 Agent 说了什么。
- 单 Agent 失败降级：某个 Agent 的 LLM 调用失败时，该条落 `status: 'failed'` + 占位文案，不中断整轮，其余 Agent 继续。
- provider：`resolveActiveLlmProviderConfig(bindings)` 解析一次平台默认配置，循环复用。`createGroupChatText` 用 `stream: false` 调 `{baseURL}/chat/completions`，解析 `choices[0].message.content`。
- 落库：一轮内 1 条 user + N 条 agent 用 `insertGroupChatMessages` 批量 `db.batch` 一次写入；同轮消息 `createdAtMs` 逐条 +1ms 递增，配合 `(created_at_ms, id)` 索引保证回看顺序稳定；共用同一 `turnIndex = (recent.at(-1)?.turnIndex ?? 0) + 1`。
- 统计更新：`updateGroupChatStats` 只更新 `messageCount(+本轮条数)` / `lastMessageAtMs` / `updatedAtMs`，**v1 不动 summary，不抽记忆**。
- 消息 metadata：user 记 `source: group_chat_user`；agent 记 `source: group_chat_agent` / `selectedBy: v1_rules` / `model` / `providerName`（**无 wireApi**，该字段是 bobo 结构，moodmate provider 不存在）。
- 历史分页：首屏取最近 50 条（正序）；`messages?cursor=` 取 `createdAtMs < cursor` 的最近 50 条正序；`nextCursor` 仅当返回数达上限时给最早一条的 `createdAtMs`，否则 null。
- 无 active 成员：跳过生成循环，仍写用户消息并更新统计，返回空 `agentMessages`，不报错。

## 4. 校验与错误矩阵

| 条件                            | 错误码                    | HTTP |
| ------------------------------- | ------------------------- | ---- |
| 缺少或无效 Web access token     | 现有 `AUTH.*`             | 401  |
| 请求 schema 或游标无效          | `COMMON.INVALID_REQUEST`  | 400  |
| 群聊不属于当前用户              | `AUTH.FORBIDDEN`          | 403  |
| 创建/加成员时 Agent 不属于用户  | `AUTH.FORBIDDEN`          | 403  |
| 加成员后 active 总数超过 6      | `COMMON.INVALID_REQUEST`  | 422  |
| 平台模型配置缺失（无 active）   | `SYSTEM.INTERNAL_ERROR`   | 503  |
| 上游连接失败或 HTTP 失败        | `SYSTEM.INTERNAL_ERROR`   | 503  |
| 上游响应超时（90s）             | `SYSTEM.UPSTREAM_TIMEOUT` | 504  |
| 单 Agent 生成失败               | 该条落 `status: failed`   | 200  |

单 Agent 失败不影响整轮 HTTP 状态；只有整体链路（无模型配置、归属失败等）才返回错误码。服务端日志只记上游状态码，不记 API Key、Authorization、请求正文或上游响应正文。

## 5. 正常、基础、错误案例

- 正常：登录用户发普通消息，`selectAgentsForReply` 选 1 个 Agent，补拉人设 + 自己的记忆，生成回复，1 条 user + 1 条 agent 批量落库，返回完整数组。
- 基础：发"你们怎么看"触发群体关键词，前 min(3, 成员数) 个 Agent 按 displayOrder 顺序串行生成，后者能看到前者本轮回复。
- 错误：把成员展示行（无人设 prompt）直接传给 `buildAgentReply`，Agent 拿不到 defaultPrompt/guardrailsPrompt，回复不符合人设；或用 `Promise.all` 并发生成，Agent 之间看不到彼此本轮发言，出现重复撞车。

## 6. 必做检查

- `pnpm --filter api check-types` 和 `pnpm --filter api lint`。
- 越权检查：他人群聊 send / 详情 / 历史都返回 403；创建/加成员选他人 Agent 返回 403。
- 上限检查：`selectAgentsForReply` 无论成员多少每轮回复数 ≤3；加成员超过 6 返回 422。
- 人设检查：选中成员的 prompt 来自 `listOwnedUserAgentsByIds` 的完整记录，不是 `listActiveMembers` 的展示行。
- 记忆隔离检查：每个 Agent 的 prompt 只含自己的 `listActiveAgentMemories`。
- 顺序生成检查：代码里是 for 循环 + 累积 `recentMessages`，无 `Promise.all`；同轮消息 `createdAtMs` 严格递增。
- 降级检查：单 Agent 上游失败时该条 `status: failed` + 占位文案，其余 Agent 与整轮响应正常。
- 统计检查：send 后 `messageCount` 增本轮条数，`lastMessageAtMs`/`updatedAtMs` 更新，`summary` 不变。
- 分页检查：首屏 50 条正序；`nextCursor` 只在达上限时非空，前端 prepend 去重无重复。

## 7. 错误与正确写法

```ts
// 错误：把成员展示行当人设，且并发生成
const texts = await Promise.all(
  selected.map((member) =>
    buildAgentReply({ agent: member /* 无 defaultPrompt */, ... }),
  ),
);

// 正确：补拉完整人设 + 串行累积，让后者看到前者本轮发言
const records = await listOwnedUserAgentsByIds({
  userId,
  agentIds: selected.map((m) => m.agentId),
});
const recordMap = new Map(records.map((r) => [r.id, r]));
const agentRows: NewGroupChatMessage[] = [];
for (const member of selected) {
  const memories = await listActiveAgentMemories({ userId, agentId: member.agentId, limit: 6 });
  const text = await buildAgentReply({
    agent: recordMap.get(member.agentId)!,
    recentMessages: [...recent, userRow, ...agentRows],
    activeMemories: memories,
    providerConfig,
    signal,
  }).catch(() => AGENT_REPLY_FALLBACK);
  agentRows.push(/* ...status 按成功与否 */);
}
```
