# 实现头像对象存储

## Goal

把默认头像文件存入 Cloudflare R2，把上传元数据写入 D1，并通过 API 提供受保护的上传入口和统一的读取入口。

## Background

- 需求来源：`docs/temp/31-avatar-storage.txt`。
- `apps/api` 已有 Admin 密码登录、access token 鉴权、D1 binding、Drizzle schema 和 Wrangler migration。
- `apps/api` 尚未配置 R2，也没有 `assets` 模块、头像 contract 或头像元数据表。
- `docs/architecture.md` 把默认头像归到 `assets` 模块，后台路径预留为 `/rpc/admin/default-avatars`。

## Requirements

### R1. 存储边界

- 头像文件本体写入 `AVATAR_BUCKET`，D1 只保存 key、原始文件名、MIME type、字节数、上传人和上传时间。
- R2 key 使用 `avatars/default/<timestamp>-<uuidv7>.<extension>`，扩展名只能由已校验的 MIME type 推导。
- 每次上传生成新 key，R2 对象写入 `public, max-age=31536000, immutable`。

### R2. 文件校验

- multipart 字段名固定为 `file`。
- 只接受 `image/jpeg`、`image/png` 和 `image/webp`。
- 拒绝空文件和超过 2 MiB 的文件。
- 所有客户端可见报错使用现有 `AppError` 和统一失败响应。

### R3. Admin 上传

- `POST /rpc/admin/default-avatars` 必须通过现有 `requireAdminAccess`。
- 上传成功后写入 R2，再写入 `default_avatar_versions`。
- 元数据写入失败时尝试删除刚上传的 R2 对象，避免留下无数据库记录的对象。
- 成功响应返回头像 key 和上传时间，不返回 bucket 地址或内部数据库 record。

### R4. 头像读取

- `GET /rpc/assets/avatar?key=<key>` 从 `AVATAR_BUCKET` 读取对象，不要求 Admin access。
- key 缺失或格式无效时返回 400；对象不存在时返回 404。
- 响应保留 R2 的 HTTP metadata，并返回 `etag`。

### R5. Schema、migration 与 binding

- 新增 `default_avatar_versions` Drizzle schema 和 `0002` Wrangler migration。
- `created_by_user_id` 引用现有 `users.id`，用户删除时设为 `NULL`。
- 默认开发环境配置名为 `moodmate-local-avatars` 的 `AVATAR_BUCKET`；test 和 production 的远端 bucket 不在没有真实资源信息时伪造。
- 修改 Wrangler binding 后重新生成并提交 `worker-configuration.d.ts`。

## Acceptance Criteria

- [x] AC1：合法 JPG、PNG 或 WebP 可由有效 `admin_owner` 上传，R2 key、HTTP metadata 和 D1 元数据一致。对应 R1、R2、R3。
- [x] AC2：缺少文件、错误 MIME、空文件和超过 2 MiB 分别被拒绝，R2 与 D1 不产生记录。对应 R2。
- [x] AC3：未登录或无效 access token 不能调用上传接口。对应 R3。
- [x] AC4：读取接口可返回已上传对象的 body、content type、cache control 和 etag；未知 key 返回 404。对应 R4。
- [x] AC5：从空本地 D1 应用 migration 后存在 `default_avatar_versions`、外键和创建时间索引。对应 R5。
- [x] AC6：`pnpm --filter api cf-typegen` 与 Wrangler types check 通过。对应 R5。
- [x] AC7：依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。

## Out Of Scope

- 普通 Web 用户上传或修改个人头像。
- Admin 默认头像列表、选择当前版本、回滚、删除和旧对象清理。
- Web/Admin 页面和请求函数。
- test、production 的真实 R2 bucket 创建、远端 migration 或部署。
- 图片解码、尺寸检查、裁剪、转码和内容安全扫描。
