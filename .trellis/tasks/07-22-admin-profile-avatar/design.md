# 管理员资料与个人头像设计

## 边界

- `packages/contracts` 定义 Admin profile DTO、头像 key、头像来源和上传响应。
- `apps/api` 读取当前 Admin 用户资料，保存个人头像元数据，写入和读取 R2。
- `apps/admin` 只调用同源 BFF。BFF 从 HttpOnly cookie 取 access token，处理续期和上游响应校验。
- 页面不生成 R2 key，不读取 Hono token，不直接依赖 API 源码或数据库类型。

## 数据模型

新增 `user_avatar_assets` 表：

| 字段            | 约束           | 用途                           |
| --------------- | -------------- | ------------------------------ |
| `id`            | UUID，主键     | 头像记录 id                    |
| `user_id`       | 外键，唯一     | 当前头像归属；每个用户最多一条 |
| `avatar_key`    | 唯一           | R2 对象 key                    |
| `file_name`     | 非空           | 原文件名                       |
| `content_type`  | jpeg/png/webp  | 文件类型                       |
| `size_bytes`    | 1 至 2,097,152 | 文件大小                       |
| `created_at_ms` | 正整数         | 当前头像上传时间               |

个人头像只保留当前记录，不提供历史列表。key 格式为 `avatars/users/<userId>/<timestamp>-<uuidv7>.<ext>`，扩展名由 API 校验后的 MIME type 决定。

## Contract

Admin profile 响应包含：

- `id`、`displayName`、`email`、`status`、`roles`
- `createdAtMs`、`updatedAtMs`、`lastLoginAtMs`
- `avatar: { key, source } | null`

`source` 为 `personal` 或 `default`。API 优先返回当前用户的个人头像；没有个人头像时读取当前默认头像；两者都没有时返回 `null`。

上传成功返回个人头像 key 和更新时间。session id 与会话到期时间继续读取现有 `AdminSession`，不重复放进 profile DTO。

## API

新增接口：

```text
GET  /rpc/admin/profile
POST /rpc/admin/profile/avatar
GET  /rpc/admin/profile/avatar?key=<resolved-avatar-key>
```

三个接口都使用 `requireAdminAccess`。图片读取接口只接受以下 key：

- 当前用户的个人头像 key。
- 当前默认头像 key。

其他用户的个人头像 key 返回 403；格式错误返回 400；合法但 R2 中不存在返回 404。

上传流程：

```text
校验 Admin session 和文件
  -> API 生成个人头像 key
  -> 写入新 R2 对象
  -> D1 upsert 当前用户头像元数据
  -> D1 失败时删除新对象
  -> D1 成功后尽力删除旧对象
  -> 返回新头像信息
```

资料读取由 repository 查询用户主体、主邮箱和有效 Admin 角色；service 读取个人头像和当前默认头像后选择返回值；presenter 生成 Contract DTO。

## Admin 请求流

```text
Profile 页面或顶部账号区域
  -> TanStack Query
  -> /api/profile 或 /api/profile/avatar
  -> withAdminSessionRecovery
  -> Hono Admin profile API
  -> D1 / R2
```

新增 BFF 路径：

```text
GET  /api/profile
POST /api/profile/avatar
GET  /api/profile/avatar/image?key=...
```

POST 校验同源 Origin。FormData 不手写 `content-type`。图片 BFF 只转发图片 body 和允许的响应头。

## 页面

- `/profile` 页面展示账号资料和当前会话，不提供资料编辑表单。
- 上传区域显示当前解析后的头像和文件限制。
- 顶部账号区域使用现有 Admin session 显示姓名，使用 profile query 显示头像，并链接到 `/profile`。
- 上传 mutation 成功后失效 profile query；session query 不因头像变化而失效。
- 页面和顶部区域共用 Admin 专用头像展示组件，组件留在 `apps/admin`，不移入 `packages/ui`。

## 兼容与失败处理

- migration 只新增表，不改现有认证表和默认头像表。
- 没有 `AVATAR_BUCKET` 时资料仍可返回文字字段；头像读取或上传返回存储不可用。
- 存量用户默认没有个人头像，自动使用当前默认头像或姓名首字。
- 替换头像后旧 R2 对象删除失败不会撤销已保存的新头像，只记录服务端错误。
- 回滚代码时新表可以保留，不影响现有登录、用户管理和默认头像功能。
