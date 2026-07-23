# 执行计划：收敛 LLM 配置到 admin

## 实施顺序

按「contract → API 后端 → 聊天改造 → admin 前端 → web 移除 → env/迁移收尾」推进，每层先能编译再进下一层。

### 阶段 1 contract（packages/contracts）

1. 新建 `src/llm/llm-config.contract.ts`：列表项、创建、更新、激活、删除响应、测试请求/响应 schema 与类型。
2. `src/index.ts` 导出新 schema。
3. 改 `src/chat/companion-chat.contract.ts`：`CompanionChatRequestSchema` 删 `llmConfig`；保留 `CompanionChatLlmConfigSchema`。

### 阶段 2 API 后端加密与模块

4. 新建 `apps/api/src/modules/llm-config/llm-config.crypto.ts`：AES-GCM 加解密（WebCrypto）。
5. 新建 `llm-config.schema.ts`：drizzle 表 `llm_provider_configs`。
6. 新建迁移 `apps/api/migrations/0009_create_llm_provider_configs.sql`：建表 + 部分唯一索引 + check。
7. 新建 `llm-config.repository.ts`：CRUD + 激活 batch 事务。
8. 新建 `llm-config.presenter.ts`：记录转脱敏列表项。
9. 新建 `llm-config.service.ts`：权限校验、加解密编排、测试连接 fetch。
10. 新建 `llm-config.route.ts` + `index.ts`：6 个 RPC。
11. `routes/index.ts` 注册 `createLlmConfigRoute`。

### 阶段 3 env 与聊天/分析改造

12. `shared/env.ts`：删 `DEEPSEEK_*`，加 `LLM_CONFIG_ENC_KEY`（base64→32 字节校验）。
13. `shared/hono-env.ts`、`worker-configuration.d.ts`：同步 bindings 类型。
14. `chat.service.ts`：`resolveProviderConfig` 改 async 读激活配置 + 解密；无激活抛错；`ChatProviderConfig` 用 `disableThinking?` 替 `isPlatformDeepSeek`；调用点加 `await`。
15. `chat.provider.ts`：thinking 分支改用 `disableThinking`。
16. 确认 `chat.analysis.ts` 无需改（已是 OpenAI 协议）。

### 阶段 4 admin 前端

17. `apps/admin/src/server/llm-configs/api.ts`：封装 6 个调用（照抄 roles 风格）。
18. `apps/admin/app/api/llm-configs/*` route handlers。
19. `apps/admin/app/(dashboard)/llm-configs/page.tsx` + 客户端表单/列表组件。
20. 若有侧边导航配置，加入「模型配置」入口。

### 阶段 5 web 移除

21. 删 `apps/web/src/auth/local-llm-config.ts`、`components/chat/llm-settings.tsx`。
22. `companion-chat.tsx`：移除 `readEnabledLocalLlmConfig`、`llmConfig` 请求字段、`LlmSettings` 面板与导航入口。
23. `settings-panels.tsx`：`DataPanel` 移除本地 LLM 清除项（若清空则移除该面板入口）。

### 阶段 6 收尾

24. `.dev.vars` / wrangler 文档补 `LLM_CONFIG_ENC_KEY`；本地生成一个测试密钥。
25. 本地跑迁移，手测：admin 建配置→激活→web 聊天可用→测试连接。

## 验证命令

```bash
pnpm check              # check-types + lint + format，必须全绿
```

grep 校验残留：

```bash
rg "local-llm-config|readEnabledLocalLlmConfig|LlmSettings" apps/web
rg "isPlatformDeepSeek|DEEPSEEK_API_KEY|DEEPSEEK_BASE_URL|DEEPSEEK_MODEL" apps/api
rg "llmConfig" packages/contracts apps/web
```

以上应无业务残留（contract 内 `CompanionChatLlmConfigSchema` 保留属正常）。

## 风险点与回滚

- **破坏性 env 变更**：删 `DEEPSEEK_*` 后，上线前必须先在目标环境 D1 建好并激活一条配置，配好 `LLM_CONFIG_ENC_KEY`，否则聊天全挂。上线顺序：建表迁移 → 配 secret → admin 建配置并激活 → 部署删旧 env 的版本。
- **加密密钥丢失**：`LLM_CONFIG_ENC_KEY` 变更或丢失会导致存量密文无法解密，需重填所有 apiKey。密钥务必稳定保存。
- **`resolveProviderConfig` 改 async**：确认所有调用点已 `await`（仅 `prepareCompanionChat` 一处）。
- **部分唯一索引**：SQLite 支持 `CREATE UNIQUE INDEX ... WHERE`，确认 D1 生效；激活事务需先清后置。

## 完成前检查

- [ ] `pnpm check` 全绿。
- [ ] 三条 grep 无业务残留。
- [ ] 本地手测四步全通（建/激活/聊天/测试连接）。
- [ ] 迁移可正向执行；密文非明文（抽查 D1 记录）。
