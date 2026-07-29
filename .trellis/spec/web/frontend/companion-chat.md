# Web 伴侣聊天

## 1. 适用范围

修改 `/chats/direct/[id]` 对话、历史恢复、长期记忆管理、AI SDK transport、本地 LLM 配置或 assistant 逐字显示时使用本规范。`ChatWorkspaceGuard` 恢复登录态，`ChatWorkspace` 统一单聊与群聊的会话列表和外壳，消息协议仍由各自组件处理，请求函数位于 `apps/web/src/api/`。

## 2. 公开签名

```ts
readLocalLlmConfig(): LocalLlmConfig | null;
readEnabledLocalLlmConfig(): CompanionChatLlmConfig | null;
saveLocalLlmConfig(input: LocalLlmConfig): LocalLlmConfig;
clearLocalLlmConfig(): void;
fetchWithClientSession: typeof fetch;
getCompanionConversation(options?): Promise<CompanionConversationResponse>;
getCompanionConversationMessages(cursor, options?): Promise<CompanionConversationMessagesResponse>;
getCompanionMemories(options?): Promise<CompanionMemoriesResponse>;
updateCompanionMemory(memoryId, input, options?): Promise<UpdateCompanionMemoryResponse>;
deleteCompanionMemory(memoryId, options?): Promise<DeleteCompanionMemoryResponse>;
submitCompanionMessageFeedback(messageId, input, options?): Promise<SubmitCompanionMessageFeedbackResponse>;
```

AI SDK 使用 `TextStreamChatTransport<UIMessage>` 请求 `${NEXT_PUBLIC_API_BASE_URL}/rpc/chat/companion`。

## 3. 合同

- 本地存储 key 是 `web:local-llm-config:v1`，读取 JSON 后必须通过 Zod schema。
- 保存前去掉字段首尾空格和 Base URL 末尾 `/`。
- 只有 `enabled: true` 的完整配置会进入聊天请求。
- API Key 只保存在当前浏览器，并在发送聊天时交给 Moodmate API 代理。
- transport 使用 `fetchWithClientSession`，复用 access token、单例 refresh Promise 和一次重试规则。
- 进入 `/chats` 后并行读取默认单聊和群聊列表，按最后消息时间进入最近会话；两边都没有消息时优先单聊。
- `/chats/direct/[id]` 加载和失败状态不能初始化 `useChat`；路由 ID 与服务端 `conversationId` 不一致时替换为规范 URL。
- `useChat` 使用服务端 `conversationId` 和最近 40 条消息初始化；没有历史时继续显示现有开场文案，不创建伪消息。
- 每次发送只带最近 20 条 AI SDK 消息、服务端 `conversationId` 和最新本地配置。
- “加载更早消息”使用服务端游标，把去重后的旧消息插入当前数组头部，并更新下一游标。
- 服务端恢复和分页得到的 assistant 消息直接完整显示；只有本轮新 assistant 消息使用逐字显示。
- assistant 完整文本保留在 AI SDK messages，可见文本使用 `Array.from()` 每 18ms 推进一个 Unicode 字符。
- `prefers-reduced-motion: reduce` 时直接显示完整文本。
- 一轮正常结束后使会话 query 失效，用当前 AI SDK 消息更新会话预览，不因 query 刷新清空聊天。
- 聊天页头部副标题按 `serverConversation.messageCount` 经 `getRelationshipStageLabel` 映射成关系阶段名（>=80 亲密连结、>=36 稳定信任、>=16 舒适陪伴、>=6 升温熟悉、否则 初识破冰）。只展示阶段名，不展示分数或信任等级；真正影响回复的关系阶段以后端 LangGraph 判断为准。
- 记忆管理放在设置的“记忆”区域，展示类型、内容、重要度、状态、更新时间和可空来源消息。
- 记忆编辑、启停和删除成功后使 `companionChatKeys.memories()` 失效；删除前必须二次确认。
- HTTP 客户端的 PATCH 带 JSON 请求体；DELETE 不发送请求体，两者沿用认证刷新和统一响应解析。
- 反馈按钮（点赞/点踩）只挂在 `historicalAssistantMessageIdSet` 内的持久化 assistant 消息气泡下，避开流式临时 ID；按钮带 `aria-label`/`aria-pressed`，按 `feedback.rating` 显示选中态。提交走 `submitCompanionMessageFeedback` mutation，成功后本地即时更新选中态并使会话 query 失效回显。

## 4. 校验与错误矩阵

| 条件                         | 页面行为                                   |
| ---------------------------- | ------------------------------------------ |
| localStorage JSON 或字段损坏 | 删除该 key，回到平台配置                   |
| 配置不完整或 URL 无效        | 不保存，显示需要补全的字段                 |
| 配置关闭或删除               | 下次请求不带 `llmConfig`                   |
| access token 到期            | 刷新 session 后重试一次                    |
| session 无效                 | 清除本地 session 并进入 `/`                |
| 模型请求失败                 | 保留消息，显示检查配置和关闭错误的操作     |
| 用户停止生成                 | 调 `stop()`，保留已经收到的 assistant 文本 |
| 历史会话读取失败             | 显示重试入口，不初始化空聊天替代服务端数据 |
| 更早历史读取失败             | 保留当前消息，显示局部重试入口             |
| 没有长期记忆                 | 显示空状态，不渲染编辑表单                 |
| 记忆更新或删除失败           | 保留当前项目，显示对应操作错误             |

## 5. 正常、基础、错误案例

- 正常：页面恢复历史，用户加载更早消息，新回复继续逐字显示，并在设置中管理已有记忆。
- 基础：新用户收到空历史和空记忆列表，聊天页显示现有开场内容。
- 错误：query 刷新后直接用服务端最近 40 条覆盖 `useChat`，会丢失用户已加载的更早消息。

## 6. 必做检查

- `pnpm --filter web check-types`、`pnpm --filter web lint` 和 `pnpm --filter web build`。
- 本地配置检查：保存、刷新读取、关闭、删除、损坏 JSON。
- transport 检查：消息最多 20 条、非文本 part 可发送、refresh 只发生一次。
- 历史检查：加载、失败、空历史、有历史、加载更早和没有更多历史。
- 分页检查：旧消息插入头部、ID 去重、顺序从旧到新，历史 assistant 不重新逐字播放。
- 记忆检查：加载、空数据、编辑、启用、停用、删除确认、来源为空和请求失败。
- 反馈检查：按钮只在持久化 assistant 消息展示、点赞切点踩即时更新选中态、刷新后回显、流式临时消息不出现按钮、aria 标注可访问。
- 逐字检查：中文、emoji、内容替换、大块文本和减少动态效果。
- 布局检查：Latte、Mocha、移动端导航、桌面对话主区、记忆表单、输入框和错误操作不重叠。

## 7. 错误与正确写法

```ts
// 错误：加载更早消息时覆盖当前消息
setMessages(olderMessages);

// 正确：按 ID 去重后插入数组头部
setMessages((current) => {
  const currentIds = new Set(current.map((message) => message.id));
  return [
    ...olderMessages.filter((message) => !currentIds.has(message.id)),
    ...current,
  ];
});
```
