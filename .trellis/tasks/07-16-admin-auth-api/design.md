# Hono Admin 认证 API 设计

## Source

共同协议以父任务 `../07-16-auth-schema/design.md` 第 4、5、6 节为准。本任务使用 `07-16-auth-d1-schema` 提供的 Drizzle schema、repository 和原子 rotation，不重新实现数据库事务。

## Module Boundary

```text
packages/contracts/src/auth/*
apps/api/src/modules/auth/
  auth.route.ts
  auth.service.ts
  auth.repository.ts
  auth.presenter.ts
  auth.middleware.ts
  jwt.ts
  password.ts
  token-hash.ts
```

实际文件可按单一职责拆分，但不增加框架式 service/repository 基类。

## Login

route 校验 email/password，service 读取 application 和 auth method，查询登录记录并执行 password verify。账号不存在时验证 dummy hash。验证成功后读取 `admin_owner`，生成 session 与 token pair，再通过一个 D1 batch 创建 session 和首个 refresh token。

所有凭证失败使用相同客户端消息。失败计数达到 5 次后锁定 15 分钟，成功登录清零失败状态并更新 `last_login_at_ms`。

## Access

auth middleware 从 Bearer header 读取 access token，固定 `HS256` 并校验全部 claims。JWT 合法后查询 session，确认 session、user 和 application 与 claims 一致且仍有效。

`AUTH.ACCESS_EXPIRED` 只表示 JWT 到期；缺失、篡改、session 撤销和 claim 不匹配使用各自的非续期错误，避免 Admin 进入 refresh 循环。

## Refresh

service 验 refresh JWT 和 `jti_hash`，读取 token、session、user 和最新角色。普通无效 token 返回 `AUTH.REFRESH_INVALID`；已使用 token和 rotation 竞争失败返回 `AUTH.REFRESH_REPLAYED`，并撤销 session。

新 token 的 `exp` 不超过已有 session 截止时间。rotation 成功后再把 token pair 交给 presenter；任何数据库失败都不返回已签发 token。

## Logout

BFF 提交 refresh token，并在可用时附带 access Bearer。service 通过有效凭证取得 session ID，批量撤销 session 和未失效 refresh token。重复撤销返回成功。无法识别任何 session 时 API 返回凭证错误，BFF 仍负责清除 cookie。

## Security Notes

- secret 只从 Worker bindings 读取。
- token hash 使用 SHA-256；密码不能使用普通 SHA-256。
- Hono 不读取或设置 Admin 浏览器 cookie。
- presenter 明确选择 safe session 字段，不返回数据库 record。
- 生产 IP 限流是后续部署条件，不在本任务伪造进程内计数器。
