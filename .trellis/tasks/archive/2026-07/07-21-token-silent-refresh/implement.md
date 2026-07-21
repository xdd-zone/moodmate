# Token 静默刷新执行清单

## 1. 合同

- [x] 新增 Web 密码登录、refresh、session、token response 和 profile schema/type。
- [x] 从 `@repo/contracts` 根入口导出新增合同。
- [x] 运行 `pnpm --filter @repo/contracts check-types`。

## 2. 数据库

- [x] 新增 migration，重建 `auth_sessions` 与 `refresh_tokens`，允许 `session_type IN ('admin', 'web')`，恢复索引与 rotation trigger。
- [x] 更新 Drizzle schema 的 session type enum 与 check。
- [x] 更新开发 seed：启用 Web password method，并给本地账号绑定 `web_user`。
- [x] 在新的临时 D1 目录依次应用全部 migration 与 seed，检查外键、check、索引和 trigger。

## 3. API 认证

- [x] 扩展 JWT 签发与校验，支持 Admin/Web app 与各自 audience，保持 Admin 默认行为。
- [x] 把登录、角色、session 查询参数化为 application 维度，保留原子 rotation 写入。
- [x] 在 service 增加 Web password login、refresh 和 profile access，并复用完整安全检查。
- [x] 在 middleware 和 Hono variables 增加 Web session。
- [x] 增加 Web login、refresh 和 profile routes，使用 Zod validator 与统一响应。
- [x] 运行 `pnpm --filter api check-types`。

## 4. Web Session 与 HTTP

- [x] 新增 `client-session.ts`，实现内存缓存、schema 校验的 `localStorage` 恢复、保存、清除和变化事件。
- [x] 新增 Web login client 与 profile API。
- [x] 扩展 HTTP 模块：自动附加 access token、只识别 `AUTH.ACCESS_EXPIRED`、合并并发 refresh、保存 rotation 结果、重试原请求一次。
- [x] 验证显式 Authorization、服务端请求、AbortError 和非过期错误不触发 refresh。

## 5. Web 页面

- [x] 新增 `/login` 服务端页面和客户端登录表单。
- [x] 新增 `WebDashboardGuard`，处理本地 session、profile、加载、失败清理和路由替换。
- [x] 替换 `/app` 占位内容，显示已验证用户状态和继续记录入口。
- [x] 检查手机与桌面布局、键盘焦点、Latte/Mocha 和错误状态。

## 6. 完整验证

- [x] 在隔离 D1 上启动 API，使用 curl 验证 Web login、profile、refresh、rotation、replay 与 Web/Admin token 隔离。
- [x] 启动 Web，登录后确认浏览器刷新页面可恢复登录态。
- [x] 临时缩短 access token TTL 后通过浏览器与 Wrangler 日志验证：profile 401、一次 refresh 200、profile 重试 200；验证后恢复 15 分钟 TTL。
- [x] `pnpm check-types` 与 `pnpm lint` 通过；本次变更路径 Format 检查通过。全仓 Format 只剩 3 个任务开始前已有的 Trellis 文件不符合格式。
- [x] 运行 `pnpm --filter web build`。
- [x] 运行 `trellis-check` 全范围检查，修复本次改动产生的问题后重复质量门禁。

## 7. 回退点

- 合同、API 与 Web 必须作为一组通过跨层检查，不能保留只有一侧的新协议。
- migration 未在空库和含现有 Admin session 的数据库验证前，不进入提交阶段。
- 并发 refresh、replay 或应用隔离任一验证失败时，回到 API/HTTP 实现步骤，不绕过安全检查。
