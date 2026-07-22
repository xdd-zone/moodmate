# API 伴侣聊天

## 1. 适用范围

修改 `/rpc/chat/companion`、平台 DeepSeek 配置、OpenAI-compatible Chat Completions 请求或 SSE 转纯文本流时使用本规范。实现位于 `apps/api/src/modules/chat/`。

## 2. 公开签名

```text
POST /rpc/chat/companion
Authorization: Bearer <web access token>
Content-Type: application/json

200 Content-Type: text/plain; charset=utf-8
```

模块入口是 `createChatRoute()`。route 调 `prepareCompanionChat()`，再调 `createCompanionTextStream()`。

## 3. 合同

- 请求先经过 `requireWebAccess`，再用 `CompanionChatRequestSchema` 校验。
- 请求级 `llmConfig` 优先；未提供时读取平台 `DEEPSEEK_*`。
- `DEEPSEEK_API_KEY` 可选且敏感；`DEEPSEEK_BASE_URL` 默认 `https://api.deepseek.com`；`DEEPSEEK_MODEL` 默认 `deepseek-v4-flash`。
- 平台请求发送 `thinking: { type: "disabled" }`；用户 Provider 只发送标准 `model`、`messages` 和 `stream`。
- 上游 SSE 只读取 `choices[0].delta.content`，以 `data: [DONE]` 结束。
- 成功响应必须设置 `cache-control: no-cache, no-transform` 和 `x-accel-buffering: no`。
- 请求的 `AbortSignal` 必须传给上游 `fetch()`；90 秒超时覆盖响应头和正文流。

## 4. 校验与错误矩阵

| 条件                        | 错误码                    | HTTP       |
| --------------------------- | ------------------------- | ---------- |
| 缺少或无效 Web access token | 现有 `AUTH.*`             | 401        |
| 请求 schema 无效            | `COMMON.INVALID_REQUEST`  | 400        |
| 所有 part 都没有非空文本    | `COMMON.INVALID_REQUEST`  | 400        |
| 平台 Key 缺失               | `SYSTEM.INTERNAL_ERROR`   | 503        |
| 上游连接失败或 HTTP 失败    | `SYSTEM.INTERNAL_ERROR`   | 503        |
| 上游响应头超时              | `SYSTEM.UPSTREAM_TIMEOUT` | 504        |
| SSE JSON 损坏或没有文本     | 终止纯文本流              | 200 后断流 |

服务端日志只记录上游状态码，不记录 API Key、Authorization、请求正文或上游响应正文。

## 5. 正常、基础、错误案例

- 正常：登录用户携带本地配置，API 代理 Provider 并返回纯文本流。
- 基础：只配置 `DEEPSEEK_API_KEY`，API 使用官方 Base URL 和 `deepseek-v4-flash`。
- 错误：route 直接返回上游 SSE，AI SDK 的 `TextStreamChatTransport` 会把 `data:` 和 JSON 当作正文。

## 6. 必做检查

- `pnpm --filter api check-types` 和 `pnpm --filter api lint`。
- 未登录请求断言：401、`AUTH.ACCESS_MISSING`、统一 meta。
- 本地 SSE Provider 断言：200、纯文本 Content-Type、禁缓存 header、Unicode 正文。
- SSE 检查：分块行、CRLF、`[DONE]`、无 content 的 usage chunk、损坏 JSON 和空流。
- 取消检查：客户端中止后，上游 `fetch()` 收到同一个取消信号。

## 7. 错误与正确写法

```ts
// 错误：把用户 Key 写入日志
console.error({ apiKey: config.apiKey, body });

// 正确：只记录不含敏感值的状态
console.warn("模型服务返回错误状态", { status: upstream.status });
```
