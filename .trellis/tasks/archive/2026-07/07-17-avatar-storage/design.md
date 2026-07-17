# 头像对象存储设计

## Module Boundary

```text
packages/contracts/src/assets/*
  -> apps/api/src/modules/assets/assets.route.ts
  -> apps/api/src/modules/assets/assets.service.ts
  -> apps/api/src/modules/assets/assets.repository.ts
  -> apps/api/src/modules/assets/assets.schema.ts
  -> D1 + AVATAR_BUCKET
```

route 只处理 HTTP 边界和统一响应；service 负责校验、key 生成、R2 读写及跨资源失败处理；repository 只写头像元数据；schema 描述 `default_avatar_versions`。

## HTTP Contracts

上传入口：

```text
POST /rpc/admin/default-avatars
Authorization: Bearer <admin access token>
Content-Type: multipart/form-data
file: File
```

成功数据：

```ts
{
  key: string;
  updatedAtMs: number;
}
```

读取入口：

```text
GET /rpc/assets/avatar?key=avatars/default/<timestamp>-<uuid>.<ext>
```

读取成功直接返回文件 body，不套 `ApiResponse`；读取前的参数错误和未找到仍由全局 `AppError` 生成统一失败响应。

## Validation And Key

MIME 与扩展名固定映射：

```text
image/jpeg -> jpg
image/png  -> png
image/webp -> webp
```

最大体积为 `2 * 1024 * 1024` 字节。key 必须由 service 生成，客户端读取时只允许 `avatars/default/` 下符合当前格式的 key，不能借读取接口访问 bucket 中其他对象。

## Data Model

`default_avatar_versions` 字段：

```text
id                  text primary key
avatar_key          text not null unique
file_name           text not null
content_type        text not null
size_bytes          integer not null
created_by_user_id  text null -> users.id on delete set null
created_at_ms       integer not null
```

创建时间索引用于后续列表和版本选择。本任务不新增“当前默认头像”字段，上传一条版本不等于把它设置为当前版本。

## Write Flow

```text
Admin access -> multipart File -> validate -> build key
  -> R2 put with immutable metadata
  -> D1 insert metadata
  -> unified JSON success
```

R2 与 D1 没有跨资源事务。写入顺序选择 R2 后 D1，因为数据库记录不能指向尚不存在的对象。D1 写入失败时执行一次 R2 delete；删除失败只记录服务端错误，原始异常继续交给统一错误处理，客户端不看到 bucket 细节。

## Read Flow

```text
query key -> validate default-avatar key -> R2 get
  -> copy HTTP metadata + etag -> Response
```

长期缓存成立的前提是每次上传都生成新 key，已有 key 对应的对象内容不覆盖。

## Configuration

`ApiBindings.AVATAR_BUCKET` 保持可选，因为命名环境尚无真实 bucket。头像 service 在调用时检查 binding，缺失时返回 `SYSTEM.STORAGE_UNAVAILABLE` 和 503。默认开发环境在 `wrangler.jsonc` 配置 `moodmate-local-avatars`，并用 Wrangler 重新生成类型。

## Rollback

代码和 migration 尚未进入共享环境时，可以删除本地 Wrangler state 后从空库重跑。migration 一旦进入共享环境，不修改 `0002`，后续通过新 migration 修正。R2/D1 任一环节验证失败时，不配置远端 bucket，也不执行部署。
