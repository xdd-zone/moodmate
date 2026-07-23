# 收敛 LLM 配置到 admin

## Goal

把大模型配置从 web 端浏览器本地存储迁移到 admin 管理后台统一管理。web 用户不再自带 provider / apiKey，聊天与分析统一使用 admin 里激活的那条 OpenAI 协议配置。后端只接入 OpenAI 协议模型（OpenAI、DeepSeek、GLM 等兼容 OpenAI 的服务）。

## Background

现状（探索确认）：

- web 端本地配置：`apps/web/src/auth/local-llm-config.ts` 用 localStorage 存 `providerName / baseURL / model / apiKey / enabled`，`components/chat/llm-settings.tsx` 提供编辑界面，`components/settings/settings-panels.tsx` 的 `DataPanel` 提供清除入口。
- web 发消息：`components/chat/companion-chat.tsx:134` 调 `readEnabledLocalLlmConfig()`，启用时把 `llmConfig` 塞进 `/rpc/chat/companion` 请求体（`companion-chat.tsx:142`）。
- API 解析配置：`apps/api/src/modules/chat/chat.service.ts:540` 的 `resolveProviderConfig`，请求带 `llmConfig` 就用它，否则回退到 `DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL` 环境变量。
- 上游请求：`chat.provider.ts:38` 已是标准 OpenAI 协议 `POST {baseURL}/chat/completions`；平台 DeepSeek 会额外带 `thinking: { type: "disabled" }`（`isPlatformDeepSeek` 标志）。
- 分析模块：`chat.analysis.ts:139` 用 `@langchain/openai` 的 `ChatOpenAI`，同样只需 `baseURL / apiKey / model`，与聊天共用同一个 `providerConfig`。
- admin 架构：BFF 模式，`apps/admin/app/api/*` route handler 转发到后端 `/rpc/admin/*`，`apps/admin/src/server/*/api.ts` 封装请求。权限用 `requireAdminAccess` 中间件 + `admin_owner` 角色（`role-policy.ts`、`user.service.ts:103` 的 `assertCanManageUsers`）。
- API 模块结构：`route / service / repository / presenter / schema` 五件套，路由在 `apps/api/src/routes/index.ts` 注册；D1 迁移在 `apps/api/migrations`，最新 `0008`。
- contract：`packages/contracts/src/chat/companion-chat.contract.ts` 有 `CompanionChatLlmConfigSchema`（provider/baseURL/model/apiKey），被 web、api 共用。

## Decisions

已与用户确认：

1. **存储与加密**：API Key 用主密钥 AES-GCM 加密后存 D1。主密钥走 Cloudflare Workers Secret 环境变量 `LLM_CONFIG_ENC_KEY`。admin 读列表脱敏，apiKey 只回显后四位。
2. **数量模型**：支持多条模型配置，任意时刻至多一条为激活（activated）。
3. **分析复用**：安全分析、意图分析与聊天共用激活配置，不单独配模型。
4. **无激活配置**：聊天直接报错要求先在 admin 配置并激活，不做环境变量回退。删除 `DEEPSEEK_*` 环境变量与 `isPlatformDeepSeek` 分支，配置来源收敛到 D1 唯一。
5. **测试连接**：独立 RPC，用当前表单的 baseURL/model/apiKey 发一次最小 `chat/completions` 验证，不落库。编辑旧配置且未重填 key 时允许传配置 id，后端用库里解密的旧 key 测试。
6. **更新语义**：更新接口 apiKey 可选，留空则保留原加密值。
7. **权限**：沿用 `admin_owner` 角色，与用户管理一致。
8. **compat 标志**：OpenAI 协议下暂只需最小字段（provider/baseURL/model/apiKey）。是否禁用 thinking 之类的差异，通过一个可选布尔 `disableThinking` 承载（替代原 `isPlatformDeepSeek` 硬编码），默认关闭。

## Requirements

### R1 web 端移除本地 LLM 配置

- 删除 `apps/web/src/auth/local-llm-config.ts`。
- 删除 `components/chat/llm-settings.tsx` 及其在 `companion-chat.tsx` 的入口（`onOpenLlmSettings`、`section === "llm"` 面板、导航按钮）。
- `companion-chat.tsx` 发消息不再带 `llmConfig`。
- `settings-panels.tsx` 的 `DataPanel` 移除本地 LLM 配置清除项；若清空后 `DataPanel` 无内容则一并移除其入口。

### R2 contract 调整

- `CompanionChatRequestSchema` 移除 `llmConfig` 字段。
- 保留 `CompanionChatLlmConfigSchema`（provider/baseURL/model/apiKey）供后端内部复用。
- 新增 admin LLM 配置相关 schema：列表项（脱敏）、创建请求、更新请求、激活请求、测试请求与结果、mutation 响应。放在 `packages/contracts/src/llm/` 或复用 chat 目录，命名与现有 contract 一致。

### R3 API 后端 admin LLM 配置模块

- 新增 `apps/api/src/modules/llm-config/` 模块（route/service/repository/presenter/schema）。
- 新增 D1 表 `llm_provider_configs`：id、name（展示名）、providerName、baseURL、model、apiKeyCiphertext、apiKeyIv、apiKeyLast4、disableThinking、isActive、createdAtMs、updatedAtMs。用部分唯一索引保证至多一条 `is_active = 1`。
- RPC（均 `requireAdminAccess` + `admin_owner`）：
  - `GET /rpc/admin/llm-configs` 列表（脱敏）
  - `POST /rpc/admin/llm-configs` 创建
  - `PATCH /rpc/admin/llm-configs/:id` 更新（apiKey 可选）
  - `POST /rpc/admin/llm-configs/:id/activate` 激活（同时把其他配置置为非激活）
  - `POST /rpc/admin/llm-configs/:id/delete` 删除（不能删除唯一激活配置时的处理：见 AC）
  - `POST /rpc/admin/llm-configs/test` 测试连接（参数为表单值；带 id 且无 key 时用库里旧 key）
- 加密：新增 `apps/api/src/shared/crypto` 或 `modules/llm-config` 内的加解密工具，用 `LLM_CONFIG_ENC_KEY` 派生 AES-GCM 密钥。密文与 IV 分列存储。
- env：`apps/api/src/shared/env.ts` 增加 `LLM_CONFIG_ENC_KEY`（必填，长度校验），删除 `DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL`。同步 `worker-configuration.d.ts`、`.dev.vars` / wrangler 配置说明。

### R4 API 聊天/分析消费激活配置

- `chat.service.ts` 的 `resolveProviderConfig` 改为从 D1 读激活配置并解密 apiKey；无激活配置抛 `AppError`（提示去 admin 配置并激活）。
- 移除 `isPlatformDeepSeek`，`ChatProviderConfig` 增加可选 `disableThinking`；`chat.provider.ts` 据此决定是否带 `thinking: { type: "disabled" }`。
- 分析模块 `chat.analysis.ts` 继续接收 `providerConfig`，无需改动其内部逻辑（已是 OpenAI 协议）。

### R5 admin 前端配置页面

- 新增 `apps/admin/app/(dashboard)/llm-configs`（或 settings 下子页）页面：列表 + 新建/编辑表单 + 激活/删除 + 测试连接按钮。
- 新增 `apps/admin/app/api/llm-configs/*` route handler 与 `apps/admin/src/server/llm-configs/api.ts`，风格对齐 roles/users。
- 表单字段：name、providerName、baseURL、model、apiKey（编辑时可留空表示不改）、disableThinking。
- 测试连接：调独立测试 RPC，展示成功/失败与错误信息。

## Acceptance Criteria

- [ ] web 端无任何 LLM 本地配置入口与代码；grep `local-llm-config`、`llmConfig`、`LlmSettings` 无残留引用。
- [ ] web 聊天请求体不含 `llmConfig`；`CompanionChatRequestSchema` 无 `llmConfig` 字段。
- [ ] admin 能新建、编辑、激活、删除 LLM 配置；列表 apiKey 仅显示后四位。
- [ ] 任意时刻数据库中至多一条 `is_active = 1`；激活一条会自动取消其他配置的激活。
- [ ] apiKey 在 D1 中为 AES-GCM 密文（非明文），主密钥来自 `LLM_CONFIG_ENC_KEY`。
- [ ] 更新配置时留空 apiKey 保留原值；重填则更新密文与后四位。
- [ ] admin 测试连接能对当前表单值发起最小 chat/completions 并回显结果；编辑未重填 key 时用旧 key 测试。
- [ ] 无激活配置时，web 聊天返回明确错误提示（去 admin 配置并激活），不再回退环境变量。
- [ ] `DEEPSEEK_*` 环境变量与 `isPlatformDeepSeek` 分支已删除；`LLM_CONFIG_ENC_KEY` 已加入 env 校验与类型声明。
- [ ] `pnpm check`（check-types + lint + format）全部通过。

## Out of Scope

- 非 OpenAI 协议模型（Anthropic messages、Google 等）的接入。
- 引入 pi-ai（`@earendil-works/pi-ai`）依赖；仅借鉴其 provider+baseURL+model+apiKey+compat 的配置思路，不落地该库。
- 每个用户/会话独立选模型；本次仅平台级单一激活配置。
- 配置的用量统计、成本追踪、密钥轮换流程。
- admin 配置的审计日志。
