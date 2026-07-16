# Admin BFF 与登录态设计

## Source

共同 BFF 与 cookie 规则以父任务 `../07-16-auth-schema/design.md` 第 7 节和 `../07-16-auth-schema/research/runtime-auth-findings.md` 的 Next.js 部分为准。本任务只调用已经稳定的 Hono contracts，不复制认证规则。

## Server Boundary

`src/server/auth/` 保存 server-only Hono client、cookie helper 和 Origin 校验。Route Handler 读取 cookie，调用 Hono，映射为浏览器 safe session response。

```text
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/session
POST /api/auth/logout
```

登录与 refresh 同时更新 access/refresh cookie。cookie `Path=/`，不设置 `Domain`，production 才启用 `Secure`。Max-Age 使用 API 返回的实际剩余时间，不在 BFF 重新固定成 30 天。

## Browser Boundary

浏览器 HTTP helper 使用相对 URL。auth state 只保存 safe session DTO。token、`jti` 和原始 Hono token response 不进入 Client Component。

请求遇到 `AUTH.ACCESS_EXPIRED` 时：

```text
原请求 401
  -> 复用或创建 refresh Promise
  -> refresh 成功
  -> 原请求重试一次
```

refresh Promise 完成后清空模块变量。重试请求若再次 401，直接退出，不再 refresh。多标签页各自拥有 Promise，严格 replay 的限制按父任务约定接受。

## Route Protection

`proxy.ts` 只处理明显缺少两个认证 cookie 的页面请求。受保护页面和 Route Handler 仍通过 session/Hono 验证真实状态。

`proxy.ts` 排除 `/api`、`/_next`、favicon 和静态文件。它不访问 Hono，避免每次页面导航引入网络延迟和 refresh 竞争。

## UI

`/login` 提供邮箱、密码、提交按钮和服务端错误反馈。根页面显示 safe session 中的管理员信息和 logout 按钮。控件样式遵循现有 Admin 和 `@repo/ui` 规范，不在认证任务中重做整体后台界面。

## Rollback

BFF Route Handler 与页面入口分开提交和验证。出现问题时可以恢复现有根页面并移除 auth Route Handler 注册；回滚时先清除两个认证 cookie，D1 和 Hono 状态不回改。
