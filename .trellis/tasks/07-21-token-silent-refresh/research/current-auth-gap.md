# 当前认证实现与第 34 节差异

## 现有实现

- `apps/web/src/lib/http/index.ts` 使用原生 `fetch`、`Headers` 和 `createApiResponseSchema()`，已处理网络失败、AbortError、非法 JSON、非法响应结构和业务错误。
- `apps/api/src/modules/auth/auth.service.ts` 已实现 Admin 登录、access 校验、refresh rotation 和 logout。
- `apps/api/src/modules/auth/auth.repository.ts` 的 `rotateRefreshToken()` 通过 D1 batch 原子插入新 token、标记旧 token 并更新 session。
- `apps/api/src/modules/auth/jwt.ts` 当前固定 `app=admin`、`aud=moodmate-admin`，签发与校验函数需要扩展 application 参数，同时保留 Admin 默认行为。
- `packages/contracts/src/common/biz-code.ts` 使用 `AUTH.ACCESS_EXPIRED` 表示 access token 到期。现有 Admin 规范也规定只有这个错误码可以触发静默刷新。

## 数据库缺口

- `apps/api/migrations/0001_create_auth_schema.sql` 的 `auth_sessions_type_check` 只允许 `admin`。
- `apps/api/src/modules/auth/auth.schema.ts` 的 Drizzle enum 与 check 同样只允许 `admin`。
- `apps/api/dev/seed.sql` 已创建 `web` application 和 `web_user` role，但没有启用 Web password method，也没有把开发账号绑定到 `web_user`。
- 需要新增顺序 migration，重建带约束的 SQLite 表并保留现有 session 与 refresh token 数据；不能修改已提交 migration 来假设数据库从未部署。

## 前端缺口

- `apps/web/app/(app)/app/page.tsx` 仍是占位页。
- `apps/web/app/(auth)/login/page.tsx`、`apps/web/src/auth/`、Web profile API 和页面 guard 尚不存在。
- 浏览器 session 应保存最小登录数据，并在读取 `localStorage` 时用共享 schema 校验，不能直接类型断言 JSON。

## 实现约束

- 按现有 HTTP 结构扩展，不引入 Axios。
- Hono route 只处理输入校验与统一响应，认证动作留在 service，D1 查询和写入留在 repository。
- Web 与 Admin token 使用相同 secrets，但必须通过 `app` 和 audience 隔离。
- 浏览器只在 `AUTH.ACCESS_EXPIRED` 时刷新，避免无效 token、缺失 token 或权限错误进入循环。
