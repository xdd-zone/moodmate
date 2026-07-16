# Hono Admin 认证 API 实施

1. 使用 `trellis-before-dev` 读取 contracts、API、错误和跨层规范。
2. 定义 auth contracts、DTO 和业务错误码并导出。
3. 扩展 API secret 环境变量和示例配置。
4. 实现 password、token hash 和 JWT 工具并覆盖正常、篡改、过期和错误 claims。
5. 实现登录 service 与 route。
6. 实现 access middleware 和 Admin session route。
7. 实现 refresh service 与 route，调用前置任务的原子 rotation。
8. 实现 logout service 与 route。
9. 注册 auth route，不改变 system route 行为。
10. 在本地 Wrangler 验证登录、session、refresh、并发 replay、角色撤销和 logout。
11. 检查响应与日志不含秘密字段。
12. 运行 `trellis-check`，再依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。
13. 通过 `trellis-update-spec` 记录可复用的 auth 分层、错误和 secret 规则。

关键回滚点：contracts 和全部本地 HTTP 验证稳定前，不启动 `07-16-admin-auth-bff`。
