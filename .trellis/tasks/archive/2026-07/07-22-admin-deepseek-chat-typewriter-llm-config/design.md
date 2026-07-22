# 技术设计

## 1. 实现边界

本任务把三章课程内容实现成一个最终状态，不保留中间版本：

- 第 35 章的 Web、Contract、Hono API 和 DeepSeek 调用边界保留。
- 第 36 章已经把 LangChain 流改成直接读取 OpenAI-compatible SSE，因此最终代码不新增 LangChain 依赖。
- 第 38 章在同一个聊天入口增加用户请求级 LLM 配置，平台 DeepSeek 继续作为默认配置。

参考项目只用于核对调用关系。Moodmate 不复制 bobo 的收件箱、Agent 数据、群聊、记忆、聊天持久化或已经扩展的 Responses API 能力。

## 2. 依赖方向

```text
apps/web
  -> @repo/contracts
  -> @repo/ui
  -> @ai-sdk/react + ai

apps/api
  -> @repo/contracts
  -> OpenAI-compatible /chat/completions

packages/contracts
  -> zod
```

浏览器不直接调用模型服务。`apps/api` 负责鉴权、提示词、供应商选择、上游请求和 SSE 转换。

## 3. 请求与响应合同

新增 `packages/contracts/src/chat/companion-chat.contract.ts`：

- `CompanionChatPartSchema`：只要求 `type` 是非空字符串，使用 `passthrough()` 接受 AI SDK 增加的 part 字段。
- `CompanionChatMessageSchema`：只接受 `user` 和 `assistant`，每条消息包含 1 到 50 个 part。
- `CompanionChatLlmConfigSchema`：包含 `providerName`、`baseURL`、`model`、`apiKey`。
- `CompanionChatRequestSchema`：包含 1 到 20 条 `messages`，`llmConfig` 可选。

当前只有固定 MoodMate 伴侣。人物设定不由浏览器传入，避免用户通过请求体覆盖系统提示词。后续实现人物定制时，再从当前用户拥有的 Agent 记录读取设定。

接口固定为：

```text
POST /rpc/chat/companion
Authorization: Bearer <web access token>
Content-Type: application/json

响应：text/plain; charset=utf-8
```

## 4. API 模块

新增 `apps/api/src/modules/chat/`：

```text
chat/
├── index.ts
├── chat.route.ts
├── chat.service.ts
└── chat.provider.ts
```

职责：

- `chat.route.ts`：声明路径、执行 `requireWebAccess`、校验 JSON、调用 service、返回流响应。
- `chat.service.ts`：提取文本 part、构造 MoodMate 系统提示词、选择请求级或平台 LLM 配置。
- `chat.provider.ts`：调用 `/chat/completions`，解析 SSE，把 `delta.content` 写入 `ReadableStream<Uint8Array>`。

不创建 repository、presenter 或 migration，因为本任务不保存消息和 LLM 配置。

### 4.1 环境变量

`ApiBindings` 和 `getApiEnv()` 增加：

```text
DEEPSEEK_API_KEY     可选，敏感值
DEEPSEEK_BASE_URL    可选 URL
DEEPSEEK_MODEL       可选非空字符串
```

`wrangler.jsonc` 保存 `DEEPSEEK_BASE_URL=https://api.deepseek.com` 和 `DEEPSEEK_MODEL=deepseek-v4-flash`。代码在变量未设置时也使用这两个官方默认值。`apps/api/.dev.vars.example` 只写占位说明，真实 Key 继续放在已忽略的 `apps/api/.dev.vars` 或 Wrangler secret。

### 4.2 配置优先级

1. 请求包含通过 Contract 校验的 `llmConfig` 时，使用该配置。
2. 请求未包含时，使用平台 `DEEPSEEK_*`。
3. 平台 API Key 也缺失时，抛出 `AppError`，前端显示需要配置 LLM。

用户 Key 只存在于当前请求内存。日志只记录上游 HTTP 状态，不记录请求 header、body、API Key 或上游响应正文。

平台 DeepSeek 请求按官方 Chat Completions 协议发送 `model`、`messages`、`stream: true` 和 `thinking: { type: "disabled" }`。V4 Flash 默认启用思考模式，日常伴侣对话显式关闭思考模式以缩短最终文本的首字等待，并避免忽略 `reasoning_content` 时出现长时间空白。用户自定义 OpenAI-compatible 配置不发送 DeepSeek 专属的 `thinking` 字段。

### 4.3 提示词

系统提示词只声明当前产品边界：

- 身份是 MoodMate AI 伴侣和虚拟朋友。
- 使用自然、尊重、不过度依赖的中文交流。
- 不自称医生、心理咨询师或治疗工具，不提供诊断、疗效承诺和医疗替代建议。
- 用户提到现实危险或紧急情况时，鼓励联系当地紧急服务或可信任的人，不假装能提供线下救援。

这是模型行为边界，不把 Moodmate 描述成医疗产品。

### 4.4 SSE 转换

上游响应按行解析 `data:`。二进制 chunk 可能截断一行，因此保留 `buffer`，直到读到下一行。遇到 `[DONE]` 关闭流；只写入字符串类型的 `choices[0].delta.content`。

返回 header：

```text
content-type: text/plain; charset=utf-8
cache-control: no-cache, no-transform
x-accel-buffering: no
```

前端停止请求时，`c.req.raw.signal` 传给上游 `fetch()`，同步取消模型请求。

协议依据为 DeepSeek 中文官方文档：`https://api-docs.deepseek.com/zh-cn/`、`https://api-docs.deepseek.com/zh-cn/api/create-chat-completion` 和 `https://api-docs.deepseek.com/zh-cn/quick_start/pricing`。

## 5. Web 页面

### 5.1 页面结构

`/app` 保持服务端页面入口，现有 `WebDashboardGuard` 继续恢复本地 session 和校验 profile。登录成功后渲染消费者聊天 App：

```text
桌面：伴侣/导航侧栏 | 对话主区域
移动：紧凑顶部栏 + 对话主区域 + 底部视图切换
```

对话是默认和主要视图。LLM 配置、主题切换、账号与退出属于辅助视图，不用大号营销文案，也不把整个页面拆成卡片网格。

第一版只显示一个固定伴侣 `MoodMate`。角色创建、选择和长期记忆属于后续任务。

### 5.2 聊天组件

新增 Web 私有组件：

```text
src/components/chat/companion-chat.tsx
src/components/chat/chat-conversation.tsx
src/components/chat/chat-composer.tsx
src/components/chat/llm-settings.tsx
```

`useChat()` 管理消息、提交、streaming、停止和错误。`TextStreamChatTransport` 指向 API 子站；`prepareSendMessagesRequest()` 每次发送时读取最新 session 和本地 LLM 配置，补齐 `Authorization`、`messages` 和可选 `llmConfig`。

聊天内容用适合连续流更新的轻量组件渲染。输入区支持：

- Enter 发送，Shift+Enter 换行。
- 空白内容不能提交。
- submitted/streaming 时显示停止按钮。
- 失败信息说明失败位置，并保留重新输入入口。

### 5.3 逐字显示

AI SDK 的 `messages` 保存完整真实消息，额外状态 `visibleAssistantTextById` 只控制显示。

- `Array.from()` 计算和截取 Unicode 字符。
- 每 18ms 推进 1 个字符。
- 新文本不再以已显示文本开头时，从第一个字符重新开始。
- 消息被删除或切换时清理已不存在的 id。
- `prefers-reduced-motion: reduce` 时直接显示完整内容，不执行逐字 timer。

网络流和显示层互不替代：API 尽早写出内容，Web 保证可见节奏。

### 5.4 本地 LLM 配置

新增 `apps/web/src/auth/local-llm-config.ts`。存储 key 使用带版本的 `web:local-llm-config:v1`，本地 schema 包含 Contract 字段和 UI 专属 `enabled`。

- 首次读取和 JSON 解析都经过 Zod `safeParse()`。
- 保存时去掉首尾空格和 Base URL 尾部 `/`。
- 配置不完整时不允许保存为启用状态。
- `readEnabledLocalLlmConfig()` 只返回 Contract 允许的四个字段。
- 删除操作移除整份配置和 API Key。
- 保存或删除后派发自定义事件，让设置页和聊天 transport 读取同一份最新值。

界面明确说明 API Key 存在当前浏览器，并会在聊天时发送到 Moodmate API 代理；不写安全承诺。

## 6. 视觉方向

- 目标用户：订阅 AI 伴侣服务、通过日常对话获得长期陪伴的消费者。
- 核心场景：打开应用后立即继续对话；必要时切换到本地 LLM 配置。
- 气质：安静、亲近、清楚，像成熟的聊天 App，不像后台、医疗系统或营销首页。
- 使用现有 Maple Mono、Latte/Mocha 和语义 token；不新增独立品牌色或渐变装饰。
- 桌面侧栏保持较高信息密度；移动端不隐藏聊天、配置、主题和退出这些关键操作。
- 图标使用 `lucide-react`，未知图标提供 `title` 或可访问名称。

## 7. 失败处理

| 失败位置             | 服务行为                  | 用户看到的结果                         |
| -------------------- | ------------------------- | -------------------------------------- |
| 未登录或 access 无效 | 现有认证错误码与 401      | 登录状态失效，返回登录页或提示重新登录 |
| 请求结构错误         | `COMMON.INVALID_REQUEST`  | 聊天请求内容无效                       |
| 平台 Key 缺失        | `SYSTEM.INTERNAL_ERROR`   | 需要配置本地 LLM 或平台 DeepSeek       |
| 上游网络失败         | `SYSTEM.UPSTREAM_TIMEOUT` | 模型服务暂时不可用，可稍后重试         |
| 上游 HTTP 失败       | 服务端只记录状态码        | 模型请求失败，不显示上游正文           |
| 流读取失败           | 终止当前流                | 保留已显示内容并显示失败状态           |
| 本地配置损坏         | 删除无效 localStorage 值  | 回到未配置状态                         |

## 8. 兼容与回退

- 不修改数据库和现有登录协议。
- `/app` 从账号占位页变成聊天 App，登录入口和 URL 不变。
- 用户关闭或删除本地配置后立即回到平台 DeepSeek。
- 回滚时删除 chat 模块、chat Contract 和 Web 聊天组件，并恢复 `WebDashboardGuard` 原内容；其他模块不受影响。
