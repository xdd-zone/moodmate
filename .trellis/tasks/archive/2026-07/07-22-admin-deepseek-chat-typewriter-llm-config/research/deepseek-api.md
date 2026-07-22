# DeepSeek API 核对结果

核对日期：2026-07-22。

来源：

- `https://api-docs.deepseek.com/zh-cn/`
- `https://api-docs.deepseek.com/zh-cn/api/create-chat-completion`
- `https://api-docs.deepseek.com/zh-cn/quick_start/pricing`
- `https://api-docs.deepseek.com/zh-cn/news/news260424`

本任务使用以下官方协议：

- OpenAI-compatible Base URL：`https://api.deepseek.com`
- 对话接口：`POST /chat/completions`
- 模型：`deepseek-v4-flash`
- 鉴权：`Authorization: Bearer <API_KEY>`
- 流式请求：`stream: true`
- 流式响应：SSE，文本增量位于 `choices[0].delta.content`，以 `data: [DONE]` 结束
- 非思考模式：`thinking: { "type": "disabled" }`

`deepseek-v4-flash` 支持思考和非思考模式，默认使用思考模式。本任务的固定伴侣对话使用非思考模式，避免忽略 `reasoning_content` 时延迟最终文本显示。用户自定义 OpenAI-compatible Provider 不发送 DeepSeek 专属字段。

旧模型名 `deepseek-chat` 和 `deepseek-reasoner` 将于北京时间 2026-07-24 23:59 弃用，本任务不使用这两个名称。
