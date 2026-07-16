# 设计 D1 认证表与原子 rotation

## Goal

为 Admin 自研认证建立 9 张 D1 表、Drizzle schema、Wrangler migration、本地 seed 和可证明原子性的 refresh rotation 数据操作。

## Dependency

- 父任务：`07-16-auth-schema`。
- 本任务是认证任务树的第一个实现任务，没有业务子任务依赖。
- Hono Admin auth API 必须等本任务的 migration、repository 和 rotation 验证通过后再启动。

## Requirements

- 按父任务 `design.md` 创建 `users`、`user_emails`、`password_credentials`、`applications`、`application_auth_methods`、`roles`、`user_role_bindings`、`auth_sessions` 和 `refresh_tokens`。
- 外键、唯一约束、状态约束和索引与父任务数据模型一致。
- `refresh_tokens.jti_hash` 全局唯一；非空 `parent_token_id` 唯一。
- rotation 使用一个原生 D1 batch。旧 token 状态不满足条件时，数据库必须让 batch 失败并回滚。
- Drizzle 只负责运行期 schema 和查询。Wrangler 单独管理 migration 历史。
- `apps/api/dev/seed.sql` 使用固定 UUIDv7 和预计算 PBKDF2 hash，初始化一套本地 Admin 数据。
- seed 可以重复执行，只能通过明确带 `--local` 的命令执行。
- 不修改 system 模块的 readiness 行为和 requestId 生成方式。

## Acceptance Criteria

- [x] 空本地 D1 应用 migration 后只有确认的 9 张认证表和 Wrangler 内部表。
- [x] `sqlite_master` 中的表、索引、trigger 与 Drizzle schema 和父任务设计一致。
- [x] 第二次运行 migration 没有待执行 migration，也不产生 Drizzle migration 表。
- [x] seed 连续执行两次都成功，应用、登录方式、角色、管理员、邮箱、密码凭证和角色绑定各只有一份。
- [x] seed 不含明文密码，项目命令不提供远程 seed 快捷入口。
- [x] 登录创建 session 与首个 refresh token 时全部成功或全部回滚。
- [x] rotation 成功时只产生一个后继 token，旧 token 的 `used_at_ms` 和 `replaced_by_token_id` 一致。
- [x] 对同一旧 token 并发执行两次 rotation，最多一个 batch 成功，数据库没有两个后继 token或半条 rotation。
- [x] 旧 token 已使用、已撤销、已过期，或 session 已撤销、已过期时，rotation batch 不写入任何后继记录。
- [x] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 依次通过。

## Out Of Scope

- JWT 签发、密码验证、Hono route 和浏览器 cookie。
- OAuth、Web、邮箱验证和密码重置表。
- 远程 D1 与生产 seed。
