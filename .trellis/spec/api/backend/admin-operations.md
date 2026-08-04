# API 运营数据

## 1. 适用范围

修改 Admin 的数据概览、用户运营视图、Token 用量、AI 调用明细、朋友管理或消息反馈处理时使用本规范。实现位于 `apps/api/src/modules/admin-operations/`（Admin 专用读取与朋友管理）和 `apps/api/src/modules/ai-usage/`（调用记录写入），contract 在 `packages/contracts/src/admin/operations.contract.ts`。

Admin 接口与 Web 接口分开定义 route、contract 和 presenter，可以共用 service 或 repository 的底层读取能力。Admin 默认不能浏览用户聊天原文，唯一例外是用户主动提交的消息反馈详情，且必须先写审计。

## 2. 公开签名

```text
GET    /rpc/admin/overview
GET    /rpc/admin/users/:userId
GET    /rpc/admin/users/:userId/ai-usage
GET    /rpc/admin/users/:userId/ai-calls
GET    /rpc/admin/agents
GET    /rpc/admin/agents/:agentId
POST   /rpc/admin/agents/system
PATCH  /rpc/admin/agents/system/:agentId
POST   /rpc/admin/agents/system/:agentId/disable
POST   /rpc/admin/agents/system/:agentId/enable
DELETE /rpc/admin/agents/system/:agentId
GET    /rpc/admin/message-feedbacks
GET    /rpc/admin/message-feedbacks/:feedbackId
PATCH  /rpc/admin/message-feedbacks/:feedbackId

Authorization: Bearer <admin access token>
```

全部经 `requireAdminAccess`。Admin 前端不直接拿 access token，请求走 `apps/admin/app/api/operations/[...path]` 的 BFF 代理。

## 3. 合同

### 统计时间口径

「今日」按 `Asia/Shanghai` 自然日计算，接口返回统计区间的开始和结束毫秒值。SQL 里用 `strftime('%Y-%m-%d', ms / 1000, 'unixepoch', '+8 hours')` 分组，不用服务器本地时区。

### Token 归属

`ai_call_records.subject_type` 只有两个值，用户总量必须等于两者之和，不做分摊：

- `agent`：能关联到具体朋友的调用。当前是 `direct_reply`、`group_agent_reply`、`direct_memory_judgement`、`direct_memory_extraction`、`direct_care_generation`。记忆归朋友，因为记忆本身按 `(user_id, agent_id)` 存。
- `system`：无法关联具体朋友的系统流程。当前是四个单聊分析场景、群聊的意图 / 情绪 / 发言选择 / 跨 Agent 计划 / 回复质检，以及 `llm_config_test`。

新增 scenario 时必须同时决定 `subject_type`，否则「朋友用量 + 系统流程 = 用户总量」这条会被打破。校验方式：

```sql
SELECT subject_type, sum(coalesce(total_tokens, 0)) FROM ai_call_records WHERE user_id = ? GROUP BY subject_type;
SELECT sum(coalesce(total_tokens, 0)) FROM ai_call_records WHERE user_id = ?;
```

### usage 缺失

上游没返回 usage 时，`usage_status` 记 `unavailable`，三个 token 字段留 NULL，不写 0。汇总时用 `CASE WHEN usage_status = 'reported' THEN ... ELSE 0 END`，不要直接 `sum(total_tokens)` 后再 `coalesce`——那样分不清「没上报」和「真的是 0」。

### 失败口径按 operation 聚合

一次逻辑调用会因 structured output 方法降级产生多条 attempt 记录，`(operation_id, attempt_index)` 上有唯一索引。中间尝试失败但最终成功时不算失败，所以失败数按 `operation_id` 分组算，不按记录行数：

```sql
SELECT count(*) FROM (
  SELECT operation_id FROM ai_call_records
  WHERE status IN ('completed', 'failed') AND ...
  GROUP BY operation_id
  HAVING max(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) = 0
)
```

实测差距很大：同一批数据按记录行数是 29.4%，按 operation 是 0%。三处都要用这个口径——概览的 `failedToday`、用户详情的 `failed_ai_call_count`、用量汇总的 `failed_call_count`。「最近失败」列表也要排掉已有 completed 的 operation，否则列出来的全是降级噪音。

`aborted` 不计入分母，它包括用户取消和运行时中断（客户端关页面走这条），不是模型故障。相关的错误分类见 `ai-runtime.md`。

### 错误消息

`ai_call_records.error_message` 存上游原始报错文本，沿 cause 链拼接后截断到 500 字符，例如 `模型服务无法处理该请求 <- 400 This response_format type is unavailable now`。只存协议层报错，不含 prompt 与模型回复。`error_code` 会把三种完全不同的根因压成同一个值，排查靠这一列。

### 朋友管理

- 列表同时返回系统朋友和用户自建朋友，`source` 字段区分，支持「全部 / 系统 / 用户」筛选，不靠名称或 `owner_user_id` 是否为空推断。
- 系统朋友可创建、编辑、停用、启用；已被用户使用过的不能删除，只能停用，历史会话和统计继续关联原记录。
- 用户自建朋友 Admin 只读，不提供修改入口。

### 敏感访问审计

`GET /rpc/admin/message-feedbacks/:feedbackId` 返回关联的用户消息与 AI 回复，调用时必须先往 `admin_sensitive_access_audits` 写一条记录再返回正文，含管理员 ID、`resource_type='message_feedback'`、`resource_id`、`request_id` 和时间。审计表不存聊天原文，只存谁在什么时候看了哪条反馈。反馈详情不扩展成会话浏览入口，不返回同一会话的其他消息。

## 4. 校验与错误矩阵

| 条件                          | 错误码                        | HTTP |
| ----------------------------- | ----------------------------- | ---- |
| 缺少或无效 Admin access token | 现有 `AUTH.*`                 | 401  |
| 角色不足                      | `AUTH.FORBIDDEN`              | 403  |
| 分页、筛选或 ID 参数无效      | `COMMON.INVALID_REQUEST`      | 400  |
| 用户、朋友或反馈不存在        | `COMMON.NOT_FOUND`            | 404  |
| 删除已被使用的系统朋友        | `AGENT.UNAVAILABLE`           | 409  |
| D1 未绑定或未应用迁移         | `SYSTEM.DATABASE_UNAVAILABLE` | 503  |

## 5. 正常、基础、错误案例

- 正常：管理员打开概览看到真实汇总，进用户列表点 Token 用量抽屉，逐层下钻到调用明细。
- 基础：没有任何调用记录时各项计数为 0、失败率为 0，不报错也不显示占位数据。
- 错误：按记录行数算失败率，把 structured output 降级的中间尝试算成业务失败，看板失败率虚高到 30% 以上而业务实际全部成功。

## 6. 必做检查

- `pnpm --filter api check-types` 和 `pnpm --filter api lint`。
- 恒等式检查：`朋友用量 + 系统流程用量 = 用户总量`，用上面两段 SQL 对数。
- usage 检查：`usage_status = 'unavailable'` 的行三个 token 字段全为 NULL，没有被写成 0。
- 失败率检查：制造一次 structured output 降级（例如把配置切到 json_schema 不可用的协议），确认概览 `failedToday` 为 0，而按记录行数算会大于 0。
- 审计检查：打开一次反馈详情后 `admin_sensitive_access_audits` 多一条，且表里没有聊天正文。
- 时区检查：「今日」区间按 `Asia/Shanghai` 计算，跨零点时归属正确。
- 越权检查：Web token 访问 Admin 接口返回 401 或 403；浏览器侧拿不到 Admin access token。

## 7. 错误与正确写法

```sql
-- 错误：按记录行数算失败，降级的中间尝试被算成业务失败
SELECT count(*) FROM ai_call_records WHERE status = 'failed' AND started_at_ms >= ?;

-- 正确：按 operation 聚合，只统计没有任何 completed 记录的逻辑调用
SELECT count(*) FROM (
  SELECT operation_id FROM ai_call_records
  WHERE status IN ('completed', 'failed') AND started_at_ms >= ?
  GROUP BY operation_id
  HAVING max(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) = 0
);
```
