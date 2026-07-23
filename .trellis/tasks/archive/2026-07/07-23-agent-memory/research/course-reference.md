# 课程参考与当前项目差异

## 参考范围

- 需求来源：`docs/temp/41-agent-memory-overview.txt` 至 `docs/temp/46-agent-memory-web-and-manage.txt`。
- 课程项目：`/Users/wuwanzhu/Code/bobo/ai-agent`。
- 对应参考提交：`5afad9a`，提交标题为“长期记忆”。

## 可以复用的行为

- 首次历史返回 40 条，prompt 使用最近 18 条消息。
- 长期记忆按重要度和更新时间排序，单次注入最多 12 条。
- 会话摘要由既有摘要、最近 8 条消息和本轮对话拼接，保留末尾 1600 个字符。
- 用户消息在调用 LLM 前写入；assistant 完整文本在流结束后写入。
- 长期记忆在 assistant 回复成功后提取，单轮最多写入 2 条。
- 历史分页使用最早消息的 `createdAtMs` 作为游标，服务端返回顺序为从旧到新。
- 长期记忆支持 `active`、`disabled` 和 `deleted`，删除为软删除。

## 必须适配的差异

- 课程项目通过 `user_agent_companions` 支持多个 Agent，所有会话、消息和记忆都有 `agent_id`。
- Moodmate 当前只有固定伴侣，聊天入口是 `POST /rpc/chat/companion`，不存在 Agent 表和 Agent 管理页面。
- 本任务不补建多 Agent 系统。会话直接按 `user_id` 唯一，伴侣身份由当前产品固定为 MoodMate。
- 课程项目的记忆页面按 Agent 筛选。Moodmate 只有一个伴侣，记忆管理直接放进现有应用设置区域。
- 课程项目 HTTP 客户端已经支持 PATCH 和 DELETE。Moodmate 当前只支持 GET 和 POST，需要在现有 HTTP 模块增加这两个方法。
- 课程项目首页需要比较 Agent 的最后回复和消息表的最新记录。Moodmate 当前只有一个会话项，恢复后的 `useChat` 消息可以直接提供预览文本。

## 当前代码边界

- 共享聊天契约：`packages/contracts/src/chat/companion-chat.contract.ts`。
- API 聊天模块：`apps/api/src/modules/chat/`。
- D1 client：`apps/api/src/infra/db/d1.ts`。
- Web 聊天容器：`apps/web/src/components/chat/companion-chat.tsx`。
- Web 消息展示：`apps/web/src/components/chat/chat-conversation.tsx`。
- Web 请求入口：`apps/web/src/lib/http/index.ts`。
- 当前数据库迁移最新编号为 `0007`，本任务新增 `0008`。

## 相关项目规范

- `.trellis/spec/api/backend/index.md`
- `.trellis/spec/api/backend/companion-chat.md`
- `.trellis/spec/contracts/shared/companion-chat.md`
- `.trellis/spec/web/frontend/companion-chat.md`
- `.trellis/spec/web/frontend/http-query-guidelines.md`
- `.trellis/spec/guides/cross-layer-thinking-guide.md`
