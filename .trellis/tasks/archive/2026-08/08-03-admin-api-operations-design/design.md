# Admin、Agent、单聊与 AI 用量设计

## 1. 设计结论

- Admin 保留真实可用的模块，删除“情绪记录”和“系统设置”静态占位。
- Agent 使用统一实体，通过 `source=system|user` 区分系统内置朋友和用户自建朋友。
- 系统朋友全局共享定义；会话、消息、记忆和 Token 用量按用户隔离。
- 单聊改为“用户 + Agent”唯一会话，Web 复用现有 `/chats/direct/:id` 页面。
- 每个用户保留一份主动关怀计划，并指定一位活跃朋友作为发送者。
- AI 调用按实际上游请求逐次记录，结构化输出切换方法和工具循环中的每次上游请求都单独计数。
- Token 明细不保存 Prompt、回复正文和聊天原文，不计算费用，不自动过期。
- 不新增用户操作记录。运营统计读取业务表和 AI 调用表。
- 项目仍处于开发阶段，旧 companion 数据直接删除，不写数据转换和兼容读取。

## 2. Admin 信息架构

### 2.1 菜单

| 分组 | 菜单     | 路由              | 处理内容                                           | 数据来源                                 |
| ---- | -------- | ----------------- | -------------------------------------------------- | ---------------------------------------- |
| 概览 | 数据概览 | `/overview`       | 用户、消息、朋友、群聊、AI 调用与 Token 的真实统计 | 用户、Agent、会话、消息、群聊、AI 调用表 |
| 运营 | 用户管理 | `/users`          | 用户账号、使用摘要和 Token 用量抽屉                | 用户、会话、消息、AI 调用表              |
| 运营 | 朋友管理 | `/friends`        | 系统朋友维护、用户朋友只读查看                     | `agents` 及会话、记忆、群聊统计          |
| 运营 | 消息反馈 | `/feedback`       | 查看用户主动提交的反馈；详情读取关联的一问一答     | 消息反馈、单聊消息、敏感访问审计         |
| AI   | 模型配置 | `/llm-configs`    | Provider、协议、模型与连接测试                     | 现有 LLM 配置表                          |
| 系统 | 默认头像 | `/default-avatar` | 默认头像版本和当前版本                             | 现有默认头像表与 R2                      |
| 系统 | 角色权限 | `/roles`          | Admin/Web 角色管理                                 | 现有角色表                               |

调整现有入口：

- `/` 改为重定向 `/overview`。
- 侧栏品牌链接改为 `/overview`。
- 删除“情绪记录”菜单、`/moods` 页面和静态示例组件。
- 删除“系统设置”菜单、`/settings` 页面和静态示例组件。
- 管理员资料继续通过顶栏头像进入 `/profile`，不占侧栏菜单。
- Token 用量不增加一级菜单，只从用户列表进入。

### 2.2 数据概览

顶部指标：

| 指标         | 口径                                                         |
| ------------ | ------------------------------------------------------------ |
| 用户总数     | `users.status != deleted`                                    |
| 今日新增     | `users.created_at_ms` 落在今日区间                           |
| 今日活跃     | 今日至少发送一条单聊或群聊用户消息的去重用户数               |
| 今日用户消息 | 单聊 `role=user` 加群聊 `sender_type=user`                   |
| 今日 AI 调用 | `ai_call_records.user_id` 非空的实际上游调用数               |
| 今日 Token   | 今日 `usage_status=reported` 的 `total_tokens` 合计          |
| 今日失败率   | `failed / (completed + failed)`；排除 `started` 和 `aborted` |
| 活跃朋友     | 活跃系统朋友加活跃用户朋友                                   |
| 群聊总数     | `agent_group_chats` 记录数                                   |

页面下方显示：

- 最近 7 天或 30 天的用户消息、AI 调用和 Token 趋势。
- Token 使用最高的用户，点击后打开用户用量抽屉。
- Token 使用最高的朋友；系统流程单独显示，不混入朋友排名。
- 最近失败的 AI 调用，只展示场景、Provider、模型、错误分类、时间和 requestId。

所有“今日”统计使用 `Asia/Shanghai` 自然日。响应返回 `timezone`、`fromMs`、`toMs` 和 `generatedAtMs`，页面不自行计算统计区间。

### 2.3 用户管理与 Token 抽屉

用户列表增加：

- 关键字、状态筛选和分页。
- 注册时间、最近登录、最近活跃。
- 单聊消息数、群聊消息数、朋友数、群聊数。
- “Token 用量”操作按钮。

Token 抽屉使用“用量汇总 / 调用明细”两个页签。

用量汇总顶部：

- 累计输入、输出、总 Token。
- 今日输入、输出、总 Token。
- 累计调用、今日调用、失败调用。
- 最近调用时间。

用量主体表：

- 主体名称。
- 主体类型：朋友或系统流程。
- 朋友来源：系统、用户；系统流程显示 `-`。
- 累计输入、输出、总 Token和调用次数。
- 今日输入、输出、总 Token和调用次数。
- 最近调用时间。

调用明细：

- 筛选：时间、朋友、场景、模型、状态。
- 字段：开始时间、场景、主体、会话类型和 ID、Provider、模型、输入、输出、总 Token、耗时、状态、错误分类、requestId。
- `usage_status=unavailable` 显示“上游未返回”，不显示为 `0`。
- 不提供 Prompt、回复正文或跳转到完整会话的入口。

用户总量的校验关系：

```text
用户总 Token = 所有朋友 Token + 系统流程 Token
```

`llm_config_test` 没有终端用户，不进入任何用户抽屉。

### 2.4 朋友管理

列表筛选：

- 来源：全部、系统、用户。
- 状态：全部、启用、停用、已归档。
- 关键字：朋友名称、用户名称或邮箱。

列表字段：

- 头像、名称、来源、所属用户、状态。
- 使用用户数：只对系统朋友显示。
- 会话数、消息数、记忆数、参与群聊数。
- 最近使用、创建时间、更新时间。

详情抽屉展示基础资料、人设、语气、边界、默认 Prompt 和上述统计。用户朋友只读。系统朋友允许：

- 创建和编辑。
- 停用与重新启用。
- 从未产生会话、记忆、群聊成员或 AI 调用时删除。
- 已被使用后只允许停用，不允许删除。

系统朋友停用后：

- 不再出现在用户的新建会话和群聊成员选择中。
- 不能继续触发 AI 回复。
- 已有单聊、群聊消息和统计仍能查看。

### 2.5 消息反馈

列表不返回聊天正文，只展示：

- 提交时间、用户、朋友、评分、原因、用户备注、处理状态。

打开详情时单独请求关联内容。详情只返回：

- 触发该回复的单条用户消息。
- 被反馈的单条 AI 回复。
- 反馈评分、原因和备注。

详情接口先写管理员敏感访问审计，再返回内容。审计写入失败时不返回消息正文。详情不返回同一会话的其他消息。

## 3. 数据模型

### 3.1 `agents`

替换现有 `user_agents`：

| 字段                                  | 说明                                |
| ------------------------------------- | ----------------------------------- |
| `id`                                  | UUIDv7 主键                         |
| `source`                              | `system` 或 `user`                  |
| `owner_user_id`                       | 用户朋友所属用户；系统朋友为 `null` |
| `name`、`headline`、`description`     | 展示资料                            |
| `story_background`                    | 背景故事                            |
| `persona_prompt`、`tone_prompt`       | 人设和语气                          |
| `guardrails_prompt`、`default_prompt` | 边界和默认 Prompt                   |
| `image_key`                           | 头像 key                            |
| `status`                              | `active`、`disabled`、`archived`    |
| `created_at_ms`、`updated_at_ms`      | 时间                                |

约束：

- `source=system` 时 `owner_user_id is null`，状态只能是 `active|disabled`。
- `source=user` 时 `owner_user_id is not null`，状态只能是 `active|archived`。
- Web 修改和归档接口只能操作当前用户拥有的 `source=user` 记录。
- Web 读取和聊天可以使用活跃系统朋友或当前用户拥有的活跃用户朋友。

### 3.2 按朋友单聊

`agent_conversations`：

- `id`、`user_id`、`agent_id`。
- `title`、`summary`、`message_count`、`last_message_at_ms`。
- `created_at_ms`、`updated_at_ms`。
- 唯一索引：`user_id + agent_id`。

`agent_conversation_messages`：

- `id`、`conversation_id`、`turn_id`。
- `role=user|assistant`、`content`、`status=completed|failed`。
- `metadata_json`、`created_at_ms`。
- 消息通过 conversation 取得用户和朋友，不重复保存 `agent_id`。

`agent_memories` 继续使用 `user_id + agent_id` 隔离，外键改为 `agents.id`。

`agent_message_feedbacks` 关联 assistant 消息，并保存 `user_id`、`conversation_id`、`turn_id`、评分、原因、备注和时间。相同用户对同一 assistant 消息最多一条反馈。

`agent_care_plans`：

- 每个 `user_id` 最多一条。
- `agent_id` 指向负责关怀的朋友；启用计划时不能为空。
- 保存现有 frequency、preferred time、scenes、tone、custom prompt、next run 和时间字段。
- 执行前再次校验朋友仍可被该用户使用且状态为 `active`。

`agent_care_events`：

- 关联 `user_id`、`agent_id`、care plan、direct conversation 和 assistant message。
- 保存 scene、generated/read 状态、生成时间和已读时间。
- 消息正文只保存在 direct message；care event 不再重复保存一份正文。

现有 `companion_conversations`、`companion_conversation_messages`、`companion_profiles`、`companion_memories`、`companion_message_feedbacks` 和 companion care 数据直接删除。开发阶段不复制记录、不保留兼容接口。

### 3.3 `ai_call_records`

一行代表一次真实上游模型请求，不代表一轮用户聊天。

| 字段                                                 | 说明                                             |
| ---------------------------------------------------- | ------------------------------------------------ | --------- | -------------------- | -------- |
| `id`                                                 | 调用记录 ID                                      |
| `operation_id`                                       | 同一次业务 AI 操作；结构化方法切换和工具循环共用 |
| `attempt_index`                                      | 同一 operation 内的实际请求序号                  |
| `request_id`                                         | Hono requestId；Cron 使用任务 requestId          |
| `user_id`                                            | 用量归属用户；Admin 测试为 `null`                |
| `initiator_type`、`initiator_id`                     | `web_user                                        | admin     | system` 及发起者     |
| `subject_type`                                       | `agent                                           | system`   |
| `agent_id`                                           | 归属具体朋友时填写                               |
| `agent_name_snapshot`、`agent_source_snapshot`       | 保留历史展示名称和来源                           |
| `scenario`                                           | 稳定业务场景枚举                                 |
| `conversation_type`、`conversation_id`               | `direct                                          | group     | none` 及关联 ID      |
| `llm_config_id`                                      | 使用的模型配置；配置删除后允许为空               |
| `api`、`provider_name`、`model`                      | 调用时的配置快照                                 |
| `structured_output_method`                           | `json_schema                                     | function  | json_object`或`null` |
| `status`                                             | `started                                         | completed | failed               | aborted` |
| `usage_status`                                       | `pending                                         | reported  | unavailable`         |
| `prompt_tokens`、`completion_tokens`、`total_tokens` | usage 不可用时为 `null`                          |
| `finish_reason`                                      | 规范化 finish reason                             |
| `error_code`                                         | 稳定错误分类，不保存上游原始正文                 |
| `duration_ms`                                        | 完成后写入                                       |
| `started_at_ms`、`finished_at_ms`                    | 调用时间                                         |

主要索引：

- `user_id + started_at_ms`。
- `user_id + agent_id + started_at_ms`。
- `scenario + started_at_ms`。
- `status + started_at_ms`。
- `llm_config_id + started_at_ms`。
- `operation_id + attempt_index` 唯一。

场景至少包括：

- 单聊：`direct_safety_analysis`、`direct_intent_analysis`、`direct_emotion_analysis`、`direct_relationship_analysis`、`direct_reply`、`direct_memory_judgement`、`direct_memory_extraction`、`direct_care_generation`。
- 群聊：`group_intent_analysis`、`group_emotion_analysis`、`group_agent_selection`、`group_agent_reply`、`group_cross_reply_plan`、`group_cross_reply`、`group_reply_quality`。
- 管理：`llm_config_test`。

朋友归属规则：

- `direct_reply`、单聊记忆判断与提取、`direct_care_generation`、`group_agent_reply`、`group_cross_reply` 归具体朋友。
- 安全、意图、情绪、关系、发言选择、补充计划和质检归“系统流程”。
- 没有 `user_id` 的管理调用不进入用户统计。

记录过程：

1. 每次调用 Provider 前插入 `status=started`、`usage_status=pending`。
2. 成功后更新 Token、finish reason、耗时和 `completed`。
3. 上游没有 usage 时更新为 `usage_status=unavailable`，Token 保持 `null`。
4. 上游错误更新 `failed` 和稳定 `error_code`；用户取消更新 `aborted`。
5. 完成更新失败时记录结构化服务日志，原记录保持 `started`；后台把超过 10 分钟的 started 显示为“状态未知”，不计入失败率。

初始记录写入失败时不发起上游请求，避免产生完全无法追踪的调用。流式响应由包装后的异步迭代器在 finish、error、abort 和 iterator return 时更新记录。

### 3.4 `admin_sensitive_access_audits`

- `id`、`admin_user_id`、`action`。
- `resource_type=message_feedback`、`resource_id`。
- `request_id`、`created_at_ms`。
- 不保存消息正文、反馈正文或 Prompt。

## 4. API 边界

### 4.1 Web API

| Method   | 路径                                                             | 用途                                         |
| -------- | ---------------------------------------------------------------- | -------------------------------------------- |
| `GET`    | `/rpc/agents`                                                    | 返回活跃系统朋友和当前用户朋友；支持状态筛选 |
| `GET`    | `/rpc/agents/:agentId`                                           | 返回可访问朋友详情和 `editable`              |
| `POST`   | `/rpc/agents`                                                    | 创建用户朋友                                 |
| `PATCH`  | `/rpc/agents/:agentId`                                           | 只修改当前用户朋友                           |
| `DELETE` | `/rpc/agents/:agentId`                                           | 只归档当前用户朋友                           |
| `GET`    | `/rpc/direct-chats`                                              | 当前用户单聊列表                             |
| `POST`   | `/rpc/direct-chats`                                              | 传 `agentId`，幂等创建或返回会话             |
| `GET`    | `/rpc/direct-chats/:conversationId`                              | 单聊和朋友摘要                               |
| `GET`    | `/rpc/direct-chats/:conversationId/messages`                     | 游标分页历史                                 |
| `POST`   | `/rpc/direct-chats/:conversationId/messages`                     | 发送并流式返回朋友回复                       |
| `POST`   | `/rpc/direct-chats/:conversationId/messages/:messageId/feedback` | 提交反馈                                     |
| `GET`    | `/rpc/care-plan`                                                 | 当前用户主动关怀设置                         |
| `PATCH`  | `/rpc/care-plan`                                                 | 保存关怀朋友和计划设置                       |
| `GET`    | `/rpc/care-events`                                               | 最近主动关怀记录                             |
| `POST`   | `/rpc/care-events/generate`                                      | 开发阶段手动触发一次关怀                     |

用户无权访问他人用户朋友、会话、消息和记忆。系统朋友只有 `active` 时才能新建会话、加入群聊或发送消息。

### 4.2 Admin API

| Method   | 路径                                        | 用途                                    |
| -------- | ------------------------------------------- | --------------------------------------- |
| `GET`    | `/rpc/admin/overview`                       | 概览指标、趋势、Top 用户/朋友、最近失败 |
| `GET`    | `/rpc/admin/users`                          | 扩展后的用户列表与业务计数              |
| `GET`    | `/rpc/admin/users/:userId/ai-usage`         | 累计、今日和主体汇总                    |
| `GET`    | `/rpc/admin/users/:userId/ai-calls`         | 分页调用明细                            |
| `GET`    | `/rpc/admin/agents`                         | 朋友列表和筛选                          |
| `GET`    | `/rpc/admin/agents/:agentId`                | 朋友详情与统计                          |
| `POST`   | `/rpc/admin/agents/system`                  | 创建系统朋友                            |
| `PATCH`  | `/rpc/admin/agents/system/:agentId`         | 编辑系统朋友                            |
| `POST`   | `/rpc/admin/agents/system/:agentId/disable` | 停用系统朋友                            |
| `POST`   | `/rpc/admin/agents/system/:agentId/enable`  | 重新启用系统朋友                        |
| `DELETE` | `/rpc/admin/agents/system/:agentId`         | 删除从未使用的系统朋友                  |
| `GET`    | `/rpc/admin/message-feedbacks`              | 反馈列表，不含消息正文                  |
| `GET`    | `/rpc/admin/message-feedbacks/:feedbackId`  | 审计后返回关联的一问一答                |

所有 Admin API 使用 `requireAdminAccess`，第一版继续要求 `admin_owner`，不新增角色与权限矩阵。

`packages/contracts` 新增 Admin 与 Web 各自的 Zod schema 和 DTO。Admin DTO 不复用 Web DTO隐藏字段；数据库 record、聚合 SQL 结果和页面 view model 不进入 contracts。

## 5. AI runtime 接入

`apps/api/src/infra/ai` 继续保持 Provider、Hono 和 D1 无关。增加 Provider 调用观察接口，只传规范化模型、usage、finish reason、错误和耗时。

`apps/api/src/modules/ai-usage` 负责：

- 定义业务场景和归属上下文。
- 创建记录观察器并写 D1。
- 包装 `generateText`、`generateObject` 和 `streamText`。
- 对结构化输出方法切换、工具循环 step 和流式终态逐次记录。
- 提供 Admin 聚合与明细 repository。

业务模块必须通过带场景上下文的包装函数调用 AI。`infra/ai` 的单元测试可以使用 no-op observer，生产调用不能省略上下文。

## 6. Web 发起单聊流程

```text
朋友列表或朋友档案
  -> 点击“开始聊天”
  -> POST /rpc/direct-chats { agentId }
  -> API 校验系统朋友 active，或用户朋友属于当前用户且 active
  -> 按 userId + agentId 查找
  -> 已存在则返回，未存在则创建
  -> Web 跳转 /chats/direct/:conversationId
  -> 加载单聊详情与消息
  -> POST /rpc/direct-chats/:id/messages
  -> AI 调用写 ai_call_records
  -> 保存 assistant 消息并刷新列表摘要
```

复用位置：

- 朋友档案页现有“开始聊天”按钮改为 mutation。
- 朋友头像菜单现有“发起私聊暂未开放”改为同一 mutation。
- 朋友卡片可以增加消息图标按钮，但不是完成主流程的必要条件。
- 现有 `/chats/direct/:id` 路由、聊天布局、消息区和 composer 保留。
- 会话列表从单条 companion query 改为 direct chats list query，与群聊列表继续合并展示。

失败状态：

- 朋友不存在或无权访问：404/403，留在当前页面。
- 朋友停用或归档：409 `AGENT_UNAVAILABLE`。
- 重复点击：mutation 复用同一请求状态，API 唯一约束保证只产生一个会话。
- AI 调用失败：用户消息保留，assistant 写 `failed` 或按现有边界规则返回；AI 调用记录保存错误分类。
- 用户取消流式响应：记录 `aborted`，不重试，不生成第二次回复。

## 7. 实时统计与后续汇总

第一版直接查询明细表并按时间区间 `group by`。不增加 `apps/worker`、Cron 或每日汇总表。

只有出现以下任一情况时再设计日汇总：

- 概览或 Token 抽屉查询超过确定的性能目标。
- D1 容量需要清理历史 `ai_call_records`。
- 需要跨年度保留汇总但删除逐次明细。

增加日汇总前不能删除明细，否则累计 Token 会变小。

### 7.1 主动关怀流程

```text
Web 设置页选择关怀朋友并开启计划
  -> PATCH /rpc/care-plan
  -> API 校验朋友 active 且当前用户可用
  -> 保存用户唯一计划
  -> 到期执行或开发阶段手动触发
  -> 再次校验朋友状态
  -> 幂等取得 userId + agentId 单聊
  -> 生成关怀回复，Token 归该朋友
  -> 保存 assistant message 和 care event
```

- 未选择朋友时不能启用。
- 朋友停用或归档后不执行计划，接口返回 `requiresAgentSelection=true`。
- 重新选择活跃朋友后恢复执行；旧关怀记录仍指向原朋友。
- 第一版继续在 `apps/api` 内保留关怀能力，不新增 worker；自动运行需要接入时使用 Workers Cron。

## 8. 兼容、重建与回退

这是开发阶段的破坏性结构调整：

- 新 migration 按外键依赖顺序删除旧 companion 和旧 Agent 相关表，再创建 `agents`、按朋友单聊、主动关怀、AI 调用和审计表。
- 不复制旧 companion 数据，不提供双读、双写和兼容 endpoint。
- `agent_group_*` 外键改为引用 `agents`；群聊业务改为允许活跃系统朋友和当前用户朋友。
- 开发环境重置后重新 seed 管理员、用户、模型配置和测试朋友。

代码回退必须和数据库一起回退到重建前的开发快照；不能只回退 TypeScript 后继续使用新表。

## 9. 已发现的文档与代码风险

- `docs/architecture.md` 的“当前源码状态”仍写登录、D1、Agent、群聊和 LLM 未实现，与当前源码不一致；实现阶段要只修正相关章节。
- Admin 的 `/moods` 与 `/settings` 使用大量静态示例，违反 `docs/apps/admin-design.md` 中“未接真实接口不展示虚构统计”的规则。
- Web 的多个朋友 UI 与每用户唯一 companion API 不一致，当前“开始聊天”无法定位具体朋友。
- AI runtime 已返回 usage，但所有业务调用都可以直接忽略；若观察接口仍为可选，后续新调用容易漏记。
- 系统朋友引入后，现有 `listOwnedUserAgentsByIds` 不能继续作为群聊唯一授权判断，必须改为“系统 active 或当前用户拥有”。

## 10. 验证重点

- 系统朋友对所有用户可见，但配置不可由 Web 修改。
- 两个用户与同一系统朋友的会话、消息和记忆完全隔离。
- 每个用户只能启用一份主动关怀计划，消息和 Token 归选定朋友。
- 用户不能访问或拉入他人的用户朋友。
- 同一用户重复发起同一朋友单聊只返回一个会话。
- 群聊和单聊的每次实际上游请求各有一条 AI 调用记录。
- 用户 Token 总量等于朋友用量加系统流程用量。
- usage 缺失、失败、取消和过期 started 状态显示正确。
- Admin 反馈列表不含正文；详情只能返回一问一答，并成功写审计。
- `/moods` 和 `/settings` 不再出现在菜单和默认跳转中。
