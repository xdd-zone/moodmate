# API 头像存储

## 1. 适用范围

修改默认头像上传、头像读取、`AVATAR_BUCKET`、R2 key 或 `default_avatar_versions` 时使用本规范。当前只实现 Admin 默认头像上传；用户头像、Agent 头像、版本列表和回滚尚未实现。

## 2. 接口与数据签名

```text
POST /rpc/admin/default-avatars
Authorization: Bearer <admin access token>
Content-Type: multipart/form-data
file: File

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
```

数据库表为 `default_avatar_versions`，migration 是 `apps/api/migrations/0002_create_default_avatar_versions.sql`。Drizzle schema 和 repository 位于 `apps/api/src/modules/assets/`。

## 3. 合同

- `AVATAR_BUCKET` 是可选资源 binding。默认开发环境使用 `moodmate-local-avatars`；test 和 production 未配置远端 bucket。
- 文件只接受 `image/jpeg`、`image/png`、`image/webp`，大小必须为 1 到 2,097,152 字节。
- key 固定为 `avatars/default/<timestamp>-<uuidv7>.<jpg|png|webp>`，扩展名由已校验的 multipart MIME type 决定。
- R2 metadata 固定包含原 MIME type、`inline` 文件名和 `public, max-age=31536000, immutable`。
- D1 只保存 key、原始文件名、MIME type、字节数、上传人和上传时间，不保存图片 body。
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
| R2 中没有该对象                 | 404  | `COMMON.NOT_FOUND`           |
| `AVATAR_BUCKET` 缺失或 R2 失败  | 503  | `SYSTEM.STORAGE_UNAVAILABLE` |

R2 写入成功但 D1 插入失败时，service 必须尝试删除刚写入的对象。删除失败只写服务端日志，客户端不接收 bucket、key 以外的内部细节。

## 5. 正常、基础和错误案例

- 正常：Admin 上传 PNG，API 返回 `.png` key；R2 metadata 与 D1 的 `content_type`、`size_bytes` 一致。
- 基础：读取已上传 key，响应 body 与原文件一致，带一年 immutable 缓存和 `etag`。
- 错误：前端自己拼任意 bucket 路径，或把完整 URL 写入 D1；读取接口只接受当前默认头像 key 格式。

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
