# 管理员资料与个人头像

## Goal

新增 `/profile` 管理员资料页。管理员可以查看当前账号和会话信息、上传自己的头像；没有个人头像时显示当前默认头像。页面和顶部账号入口都使用同一份真实资料，不再显示硬编码姓名与头像。

## Background

- 课程参考项目 `/profile` 展示用户资料、当前会话和个人头像上传，资料读取与头像接口位于 `user` 模块。
- Moodmate 已有 `AdminSession`，包含 `userId`、姓名、邮箱、角色、session id 和过期时间。
- Moodmate 已有默认头像版本管理、R2 `AVATAR_BUCKET`、2 MiB 文件限制和 jpeg/png/webp 校验，但尚未实现个人头像。
- `apps/admin/src/components/layout/admin-shell.tsx` 的账号姓名和头像仍是硬编码内容。
- `docs/architecture.md` 规定头像文件放 R2，数据库保存 key、文件信息、创建时间和归属，前端不能生成 R2 key。

## Requirements

1. 新增 Admin profile Contract。资料响应包含当前用户 id、姓名、主邮箱、账号状态、有效 Admin 角色、账号时间字段和解析后的头像；不能包含 access token、refresh token、密码字段或数据库内部 record。
2. 新增个人头像 Contract。头像结果包含 key 和来源；来源只允许 `personal` 或 `default`。个人头像和默认头像都不存在时返回 `null`。
3. 新增 D1 migration 和 Drizzle schema，保存当前个人头像的 user id、R2 key、原文件名、MIME type、字节数和创建时间。每个用户最多保留一条当前个人头像元数据。
4. 新增受 Admin access 保护的资料读取、个人头像上传和头像图片读取接口。接口只能读取或修改当前登录管理员自己的个人头像；默认头像只作为显示回退。
5. 个人头像文件只接受 jpeg/png/webp，大小为 1 至 2 MiB。R2 key 由 API 生成，包含用户 id 和不可预测 id，前端不能提交或拼接 key。
6. 上传顺序为先写 R2，再写 D1。D1 写入失败时删除新对象；替换成功后尽力删除旧对象，删除失败只记服务端日志。
7. 新增 Admin 同源 BFF、`src/api` 请求函数和 TanStack Query 配置。浏览器不能读取 token 或 `API_BASE_URL`，access 过期继续使用 `withAdminSessionRecovery()`。
8. 新增 `/profile` 页面，显示姓名、邮箱、角色、账号状态、创建时间、最近登录时间、session id 和会话到期时间，并提供个人头像上传入口。
9. 顶部账号区域改为 `/profile` 入口，姓名来自 Admin session，头像来自 profile query。个人头像不存在时显示当前默认头像；两者都不存在时显示姓名首字。
10. 上传成功后失效 profile query，使资料页和顶部账号区域同步刷新。文件校验失败、API 失败和存储不可用时显示具体错误。

## Acceptance Criteria

- [ ] 登录后可从顶部账号入口进入 `/profile`，页面资料与当前 Admin session 和 D1 用户记录一致。
- [ ] 上传 jpeg/png/webp 个人头像后，资料页和顶部账号区域立即显示新头像；刷新页面后仍保持。
- [ ] 未上传个人头像时显示当前默认头像；默认头像也不存在时显示姓名首字，不生成虚构图片。
- [ ] 非允许 MIME、空文件和超过 2 MiB 的文件在页面和 API 两层都被拒绝，并显示具体原因。
- [ ] 个人头像 R2 key 由 API 生成，D1 保存文件元数据和当前用户归属；一个用户最多一条当前个人头像记录。
- [ ] 当前管理员不能通过头像读取接口读取另一个用户的个人头像 key。
- [ ] 浏览器请求只访问 Admin 同源 BFF，响应和 Query cache 不包含 token 或服务端环境变量。
- [ ] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter admin build` 通过。
- [ ] 本地 D1 migration、允许文件上传、默认头像回退、刷新保持和越权读取完成验证。

## Out of Scope

- 修改姓名、邮箱、密码、角色或账号状态。
- 删除个人头像、恢复为默认头像和个人头像历史版本。
- 在用户管理列表中展示或修改用户头像。
- Web 用户资料页和 Web 个人头像上传。
- 修改默认头像版本管理行为。
