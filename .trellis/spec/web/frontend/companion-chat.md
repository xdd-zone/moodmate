# Web 伴侣聊天

## 1. 适用范围

修改 `/app` 对话、AI SDK transport、本地 LLM 配置或 assistant 逐字显示时使用本规范。页面入口继续由 `WebDashboardGuard` 恢复登录态，聊天实现位于 `apps/web/src/components/chat/`。

## 2. 公开签名

```ts
readLocalLlmConfig(): LocalLlmConfig | null;
readEnabledLocalLlmConfig(): CompanionChatLlmConfig | null;
saveLocalLlmConfig(input: LocalLlmConfig): LocalLlmConfig;
clearLocalLlmConfig(): void;
fetchWithClientSession: typeof fetch;
```

AI SDK 使用 `TextStreamChatTransport<UIMessage>` 请求 `${NEXT_PUBLIC_API_BASE_URL}/rpc/chat/companion`。

## 3. 合同

- 本地存储 key 是 `web:local-llm-config:v1`，读取 JSON 后必须通过 Zod schema。
- 保存前去掉字段首尾空格和 Base URL 末尾 `/`。
- 只有 `enabled: true` 的完整配置会进入聊天请求。
- API Key 只保存在当前浏览器，并在发送聊天时交给 Moodmate API 代理。
- transport 使用 `fetchWithClientSession`，复用 access token、单例 refresh Promise 和一次重试规则。
- 每次发送只带最近 20 条 AI SDK 消息，并读取最新本地配置。
- assistant 完整文本保留在 AI SDK messages，可见文本使用 `Array.from()` 每 18ms 推进一个 Unicode 字符。
- `prefers-reduced-motion: reduce` 时直接显示完整文本。

## 4. 校验与错误矩阵

| 条件                         | 页面行为                                   |
| ---------------------------- | ------------------------------------------ |
| localStorage JSON 或字段损坏 | 删除该 key，回到平台配置                   |
| 配置不完整或 URL 无效        | 不保存，显示需要补全的字段                 |
| 配置关闭或删除               | 下次请求不带 `llmConfig`                   |
| access token 到期            | 刷新 session 后重试一次                    |
| session 无效                 | 清除本地 session 并进入 `/login`           |
| 模型请求失败                 | 保留消息，显示检查配置和关闭错误的操作     |
| 用户停止生成                 | 调 `stop()`，保留已经收到的 assistant 文本 |

## 5. 正常、基础、错误案例

- 正常：启用本地配置后发送消息，请求携带最新配置并逐字显示纯文本流。
- 基础：没有本地配置时只发送 messages，API 使用平台 DeepSeek。
- 错误：把完整文本直接替换成可见文本；较大的网络 chunk 会整段跳出，失去逐字效果。

## 6. 必做检查

- `pnpm --filter web check-types`、`pnpm --filter web lint` 和 `pnpm --filter web build`。
- 本地配置检查：保存、刷新读取、关闭、删除、损坏 JSON。
- transport 检查：消息最多 20 条、非文本 part 可发送、refresh 只发生一次。
- 逐字检查：中文、emoji、内容替换、大块文本和减少动态效果。
- 布局检查：移动端导航、桌面对话主区、输入框和错误操作不重叠。

## 7. 错误与正确写法

```ts
// 错误：只靠网络 chunk 大小控制显示速度
return message.parts.map(renderPart);

// 正确：真实消息与可见文本分开保存
const visibleText = visibleAssistantTextById[message.id] ?? "";
```
