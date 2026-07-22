# API 头像存储

## 1. 适用范围

修改默认头像上传、头像读取、`AVATAR_BUCKET`、R2 key、版本历史、当前版本切换或 `default_avatar_versions` 时使用本规范。用户头像和 Agent 头像仍未实现。

## 2. 接口与数据签名

```text
POST /rpc/admin/default-avatars
Authorization: Bearer <admin access token>
Content-Type: multipart/form-data
file: File

GET /rpc/admin/default-avatars/current
GET /rpc/admin/default-avatars/history
POST /rpc/admin/default-avatars/:versionId/current
GET /rpc/assets/avatar?key=<default-avatar-key>
```

```ts
uploadDefaultAvatar(input: {
  bindings: ApiBindings;
  createdByUserId: string;
  file: File;
}): Promise<AdminDefaultAvatarUploadResponse>;

getDefaultAvatar(
  bucketBinding: R2Bucket | undefined,
  key: string,
): Promise<R2ObjectBody>;

getCurrentDefaultAvatar(
  database: D1Database | undefined,
): Promise<AdminDefaultAvatarCurrentResponse>;

getDefaultAvatarHistory(
  database: D1Database | undefined,
): Promise<AdminDefaultAvatarHistoryResponse>;

setCurrentDefaultAvatar(input: {
  database: D1Database | undefined;
  versionId: string;
}): Promise<AdminDefaultAvatarSetCurrentResponse>;
```

数据库表为 `default_avatar_versions`。`0002_create_default_avatar_versions.sql` 建表，`0005_add_default_avatar_current.sql` 增加 `is_current` 和部分唯一索引。Drizzle schema 和 repository 位于 `apps/api/src/modules/assets/`。

## 3. 合同

- `AVATAR_BUCKET` 是可选资源 binding。默认开发环境使用 `moodmate-local-avatars`；test 和 production 未配置远端 bucket。
- 文件只接受 `image/jpeg`、`image/png`、`image/webp`，大小必须为 1 到 2,097,152 字节。
- key 固定为 `avatars/default/<timestamp>-<uuidv7>.<jpg|png|webp>`，扩展名由已校验的 multipart MIME type 决定。
- R2 metadata 固定包含原 MIME type、`inline` 文件名和 `public, max-age=31536000, immutable`。
- D1 保存 key、原始文件名、MIME type、字节数、上传人、上传时间和 `is_current`，不保存图片 body。
- `default_avatar_versions_current_unique` 只覆盖 `is_current = 1`，数据库最多允许一个当前版本。
- `0005` 应把 `created_at_ms` 最新、`id` 最大的一条存量记录标为当前；空表不创建占位记录。
- 上传时先写 R2，再用一个 D1 batch 清除旧当前标记并插入新当前版本。切换时先确认版本存在，再用一个 D1 batch 清除旧标记并设置目标版本。
- 当前版本响应允许 `version: null`；历史列表按 `created_at_ms DESC, id DESC` 返回，条目包含 `id`、`key`、文件信息、上传时间和 `isCurrent`。
- 上传成功返回统一 JSON 响应；读取成功直接返回 R2 body、HTTP metadata、`content-length` 和 `etag`。

## 4. 校验与错误矩阵

| 条件                            | HTTP | 业务码                       |
| ------------------------------- | ---- | ---------------------------- |
| 缺少 multipart `file`           | 400  | `COMMON.INVALID_REQUEST`     |
| MIME type 不允许                | 400  | `COMMON.INVALID_REQUEST`     |
| 文件为空                        | 400  | `COMMON.INVALID_REQUEST`     |
| 文件超过 2 MiB                  | 413  | `COMMON.INVALID_REQUEST`     |
| 上传缺少或使用无效 Admin access | 401  | 对应 `AUTH.*`                |
| key 缺失或不符合默认头像格式    | 400  | `COMMON.INVALID_REQUEST`     |
| version id 不符合 UUID 格式     | 400  | `COMMON.INVALID_REQUEST`     |
| version id 不存在               | 404  | `COMMON.NOT_FOUND`           |
| R2 中没有该对象                 | 404  | `COMMON.NOT_FOUND`           |
| `AVATAR_BUCKET` 缺失或 R2 失败  | 503  | `SYSTEM.STORAGE_UNAVAILABLE` |

R2 写入成功但 D1 插入失败时，service 必须尝试删除刚写入的对象。删除失败只写服务端日志，客户端不接收 bucket、key 以外的内部细节。

## 5. 正常、基础和错误案例

- 正常：Admin 上传 PNG，API 返回 `.png` key；R2 metadata 与 D1 一致，新记录成为唯一当前版本，历史列表新增一条。
- 基础：没有版本时当前接口返回 `version: null`、历史接口返回空数组；读取已上传 key 时响应带一年 immutable 缓存和 `etag`。
- 错误：用两个独立数据库请求先清旧标记再设新标记，失败时会留下没有当前版本的中间状态；必须放进一个 D1 batch。

## 6. 必做检查

```bash
pnpm --filter api cf-typegen
pnpm --filter api exec wrangler types --env-interface CloudflareBindings --check
pnpm --filter api exec wrangler d1 migrations apply moodmate-local --local
pnpm --filter api exec wrangler deploy --dry-run --env=""
pnpm --filter api exec wrangler deploy --dry-run --env test
pnpm --filter api exec wrangler deploy --dry-run --env production
pnpm check-types
pnpm lint
pnpm format:check
```

- 用真实本地 Admin access 验证上传；缺失和无效 access 都返回 401。
- 验证允许 MIME、错误 MIME、空文件、超限、无效 key 和未知 key。
- 对读取结果和原文件计算 SHA-256，结果必须相同；同时检查 content type、cache control、content disposition、content length 和 etag。
- 查询 `default_avatar_versions`，确认失败请求没有新增元数据。
- 从包含多条旧记录的 `0002` 状态应用 `0005`，断言最新记录的 `is_current = 1`，其他记录为 `0`。
- 尝试插入第二条 `is_current = 1`，断言部分唯一索引拒绝；切换后断言当前记录数仍为 `1`。
- 验证当前、历史和设为当前端点都要求有效 Admin access；未知版本返回 404。

## 7. 错误与正确写法

```ts
// 错误：route 自己生成 key、写 R2 和拼成功对象
const key = `avatars/default/${file.name}`;
await c.env.AVATAR_BUCKET?.put(key, file);
return c.json({ ok: true, data: { key } });

// 正确：route 只读 HTTP 输入，service 负责文件规则和跨资源写入
const result = await uploadDefaultAvatar({
  bindings: c.env,
  createdByUserId: c.var.adminSession.userId,
  file,
});
return c.json(buildSuccess(result, createMeta(c.var.requestId)), 201);
```

```ts
// 错误：两个独立写入之间可能留下不一致状态
await clearCurrentDefaultAvatar(database);
await markDefaultAvatarCurrent(database, versionId);

// 正确：repository 用一个 batch 完成切换，并由部分唯一索引限制当前版本数量
await db.batch([
  db.update(defaultAvatarVersions).set({ isCurrent: false }),
  db
    .update(defaultAvatarVersions)
    .set({ isCurrent: true })
    .where(eq(defaultAvatarVersions.id, versionId)),
]);
```
