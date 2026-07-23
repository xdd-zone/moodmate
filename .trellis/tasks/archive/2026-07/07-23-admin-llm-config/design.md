# 技术设计：收敛 LLM 配置到 admin

## 架构总览

配置来源从「web localStorage + 后端环境变量回退」收敛为「D1 单一数据源」：

```
admin UI  ─POST/PATCH/activate/test─▶  admin route handler (BFF)
                                            │  Bearer accessToken
                                            ▼
                                   API /rpc/admin/llm-configs*
                                            │
                                   llm-config.service ──▶ 加解密 (AES-GCM)
                                            │
                                   D1: llm_provider_configs
                                            ▲
web 聊天 ─POST /rpc/chat/companion─▶ chat.service.resolveProviderConfig
                                     读激活配置 + 解密 apiKey
                                            │
                                            ▼
                              chat.provider (OpenAI 协议) / chat.analysis (ChatOpenAI)
```

## 数据模型

新增 D1 表 `llm_provider_configs`（drizzle schema，放 `apps/api/src/modules/llm-config/llm-config.schema.ts`）：

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | uuidv7 |
| name | text notNull | 展示名，如「生产 DeepSeek」 |
| provider_name | text notNull | 协议侧 provider 名，如 DeepSeek/OpenAI/GLM |
| base_url | text notNull | OpenAI 兼容 baseURL |
| model | text notNull | 模型 id |
| api_key_ciphertext | text notNull | AES-GCM 密文（base64） |
| api_key_iv | text notNull | 12 字节 IV（base64） |
| api_key_last4 | text notNull | 明文后四位，脱敏回显用 |
| disable_thinking | integer notNull default 0 | 是否给上游带 `thinking:{type:"disabled"}` |
| is_active | integer notNull default 0 | 激活标记 |
| created_at_ms | integer notNull | |
| updated_at_ms | integer notNull | |

约束：
- 部分唯一索引 `CREATE UNIQUE INDEX llm_provider_configs_active_unique ON llm_provider_configs (is_active) WHERE is_active = 1;` 保证至多一条激活。
- `check` 约束 `is_active IN (0,1)`、`updated_at_ms >= created_at_ms`。

迁移文件 `apps/api/migrations/0009_create_llm_provider_configs.sql`，与 drizzle schema 手写对齐（沿用现有 migrations 手写 SQL 的风格）。

## 加密方案

新增 `apps/api/src/modules/llm-config/llm-config.crypto.ts`（或 `shared/crypto.ts`，就近放模块内）：

- 主密钥来自 `LLM_CONFIG_ENC_KEY`。约定为 base64 编码的 32 字节随机串（AES-256）。env 解析时校验解码后长度 == 32。
- 用 WebCrypto（Workers 原生 `crypto.subtle`）：
  - `importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt","decrypt"])`
  - 加密：随机 12 字节 IV，`encrypt({name:"AES-GCM", iv}, key, plaintext)`，密文与 IV 分别 base64 存列。
  - 解密：读 iv + ciphertext，`decrypt` 回明文。
- 只在 service 层调用，presenter 永不返回明文/密文，只回 `apiKeyLast4`。

## Contract 设计

放 `packages/contracts/src/llm/llm-config.contract.ts`，在 `index.ts` 导出。

- `LlmConfigItemSchema`：id、name、providerName、baseURL、model、disableThinking、isActive、apiKeyLast4、createdAtMs、updatedAtMs（**无明文/密文**）。
- `LlmConfigListResponseSchema`：`{ items: LlmConfigItem[] }`。
- `LlmConfigCreateRequestSchema`：name、providerName、baseURL(url+http/https)、model、apiKey(min1)、disableThinking(默认 false)。
- `LlmConfigUpdateRequestSchema`：同上但 apiKey 可选（留空=不改），至少一个字段。
- `LlmConfigMutationResponseSchema`：`{ config: LlmConfigItem }`。
- `LlmConfigTestRequestSchema`：providerName、baseURL、model、apiKey 可选、configId 可选（无 apiKey 时用 configId 取库中旧 key；两者都无则报错）。
- `LlmConfigTestResponseSchema`：`{ ok: boolean, latencyMs?: number, message?: string }`。

`CompanionChatRequestSchema` 删除 `llmConfig`。保留 `CompanionChatLlmConfigSchema` 供后端内部类型复用。

## API 后端

新增模块 `apps/api/src/modules/llm-config/`：

- `llm-config.route.ts`：6 个 RPC，全部 `requireAdminAccess`，service 层 `assertCanManageLlmConfig(roles)` 校验 `admin_owner`（复用 role-policy 思路）。
- `llm-config.repository.ts`：CRUD + 激活事务（先全部置 0 再置目标 1，用 D1 batch 保证顺序）。
- `llm-config.service.ts`：加解密、脱敏、测试连接编排。
- `llm-config.presenter.ts`：记录转 `LlmConfigItem`。
- `llm-config.schema.ts`：drizzle 表定义。
- `index.ts`：导出 `createLlmConfigRoute`，在 `routes/index.ts` 注册。

测试连接：service 内直接 `fetch(baseURL + "/chat/completions")` 发一条最小 `{model, messages:[{role:"user",content:"ping"}], max_tokens:1, stream:false}`，捕获状态与错误，返回 `{ok, latencyMs, message}`；不落库。带超时（复用 `chat.provider` 的 90s 或更短，测试用 15s）。

## 聊天/分析改造

`chat.service.ts`：
- `resolveProviderConfig` 改为 `async`，读激活配置：无则抛 `AppError(SYSTEM..., "请先在管理后台配置并激活模型", 503)`。
- 解密 apiKey，返回 `ChatProviderConfig`（含 `disableThinking`，去掉 `isPlatformDeepSeek`）。
- `prepareCompanionChat` 里 `resolveProviderConfig(...)` 调用点改 `await`。

`chat.provider.ts`：`isPlatformDeepSeek ? {thinking:...}` 改为 `disableThinking ? {thinking:{type:"disabled"}} : {}`。

`ChatProviderConfig`：`extends CompanionChatLlmConfig`，把 `isPlatformDeepSeek: boolean` 换成 `disableThinking?: boolean`。

## env 改造

`apps/api/src/shared/env.ts`：
- 删除 `DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL` 及默认常量。
- 新增 `LLM_CONFIG_ENC_KEY: string`（必填），解析时 base64 解码校验 32 字节，否则抛错。
- 同步 `worker-configuration.d.ts`、`hono-env.ts` 的 `ApiBindings`。
- `.dev.vars` / wrangler 说明补 `LLM_CONFIG_ENC_KEY` 生成方式（如 `openssl rand -base64 32`）。

## admin 前端

- 页面 `apps/admin/app/(dashboard)/llm-configs/page.tsx`（server component 拉列表 + client 表单组件）。
- BFF：`apps/admin/app/api/llm-configs/route.ts`（GET/POST）、`[id]/route.ts`（PATCH）、`[id]/activate/route.ts`、`[id]/delete/route.ts`、`test/route.ts`，对齐 roles 现有 handler 风格。
- `apps/admin/src/server/llm-configs/api.ts`：封装 6 个调用，风格照抄 `server/roles/api.ts`。
- UI：列表卡片（name/provider/model/后四位/激活徽章）+ 新建/编辑对话框 + 激活/删除按钮 + 测试连接按钮（回显 ok/message/latency）。

## 关键权衡

- **单激活用部分唯一索引而非应用层校验**：DB 层强约束，杜绝并发下双激活。
- **IV 与密文分列**：便于排查，无需自定义拼接格式。
- **测试连接 max_tokens:1**：最小成本验证 key/baseURL/model 可达，不追求真实回复质量。
- **resolveProviderConfig 改 async**：唯一侵入性改动点，调用链只在 `prepareCompanionChat` 一处。

## 回滚考虑

- 迁移 `0009` 为纯新增表，回滚 drop 表即可，不影响既有数据。
- env 删除 `DEEPSEEK_*` 是破坏性变更：部署前必须先在 D1 建好并激活一条配置，再切流量。implement 阶段在 AC 中标注上线顺序。
