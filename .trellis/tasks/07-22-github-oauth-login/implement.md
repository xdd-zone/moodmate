# GitHub OAuth 登录实施清单

- [x] 新增 GitHub OAuth contracts，并从 `packages/contracts/src/index.ts` 导出。
- [x] 新增 OAuth D1 migration，并同步 `auth.schema.ts`。
- [x] 扩展 auth repository：登录方式检查、账号查找与绑定、用户创建、ticket 创建与原子消费。
- [x] 提取可复用的 Web session/token 签发函数，供密码登录和 ticket 登录共同调用。
- [x] 实现 GitHub OAuth service：配置、state、GitHub token/profile/email、callback、ticket 登录。
- [x] 在 auth route 注册 authorize、callback 和 ticket/login。
- [x] 同步 API binding、环境解析、Wrangler 和 `.dev.vars.example`。
- [x] 新增 Web typed API 和登录动作，在登录表单接入 GitHub 按钮。
- [x] 新增 `/login/github/callback` 页面，处理 state、ticket、重复 effect 和错误状态。
- [x] 在隔离 D1 目录执行全部 migrations，并运行 `PRAGMA foreign_key_check`。
- [x] 通过 `pnpm check-types` 和 `pnpm lint`，本次任务范围内文件通过 Prettier。
- [x] 根目录 `pnpm format:check` 已通过。
- [x] 运行 `pnpm --filter web build`，启动本地服务并检查登录页和 callback 页面。

## 回滚点

- contracts、API 和 Web 必须在同一改动中保持字段一致。
- 不修改现有密码登录、refresh token rotation 和浏览器 session schema。
- GitHub OAuth 外部调用无法在没有真实凭证时完成端到端授权；本地验证覆盖 URL、迁移、页面和无凭证错误路径。
