# 默认头像管理页面设计

## 边界

- `packages/contracts` 定义默认头像版本、当前版本、历史列表和设为当前的请求响应 Schema。
- `apps/api/src/modules/assets` 负责 D1 版本记录、R2 上传和当前版本切换；route 只处理认证、输入校验和统一响应。
- `apps/admin/src/server/default-avatars` 调用 API，`apps/admin/app/api/default-avatars` 作为同源 BFF 管理 access token 和来源校验。
- `apps/admin/src/api` 负责浏览器请求与 TanStack Query 配置，`apps/admin/src/components/default-avatars` 负责页面交互。

## 数据结构

在 `default_avatar_versions` 增加 `is_current` 整数布尔列，默认值为 `0`。迁移把 `created_at_ms` 最新、`id` 最大的一条存量记录标为当前，再建立仅覆盖 `is_current = 1` 的部分唯一索引。

选择该方案的原因：当前版本仍属于版本记录，不需要新增只有一行的指针表；部分唯一索引由数据库保证最多一个当前版本。上传和切换都在一个 D1 batch 中先清除旧标记，再写入新标记，避免请求中间状态落库。

## 接口

API 路径：

- `GET /rpc/admin/default-avatars/current`：返回当前版本，未配置时为 `null`。
- `GET /rpc/admin/default-avatars/history`：返回按 `created_at_ms`、`id` 倒序的全部版本。
- `POST /rpc/admin/default-avatars`：沿用 multipart `file` 上传，成功记录自动成为当前。
- `POST /rpc/admin/default-avatars/:versionId/current`：把指定历史版本设为当前；版本不存在时返回 `COMMON.NOT_FOUND`。
- `GET /rpc/assets/avatar?key=...`：保持现有图片读取接口不变。

Admin BFF 使用相同的资源层级：`/api/default-avatars`、`/api/default-avatars/current`、`/api/default-avatars/history` 和 `/api/default-avatars/[versionId]/current`。

## 数据流

上传：浏览器校验 MIME 与 2 MiB 上限，提交 FormData 到 BFF；BFF 转发 access token 和 FormData；API 再做相同文件校验，写入 R2 后用 D1 batch 清除旧当前版本并插入新当前版本。D1 失败时删除刚写入的 R2 对象。

切换：页面提交版本 id；BFF 校验同源后转发；API 先确认版本存在，再用 D1 batch 更新当前标记。成功后页面同时失效当前版本和历史列表 query。

图片预览继续使用 `/rpc/assets/avatar?key=...`。Admin 页面通过同源 BFF 图片端点读取，避免浏览器依赖 API 服务地址；BFF 只转发允许的图片响应头和 body。

## 兼容和回滚

- 现有上传响应的 `key`、`updatedAtMs` 字段保持不变。
- Web 端读取默认头像的行为不变。
- 回滚代码前先停止使用新端点；迁移新增列和索引保留，不做破坏性降级迁移。

## 验证

- 从空本地 D1 应用全部 migration，检查存量选择规则和部分唯一索引。
- 用 API 请求验证空列表、上传自动设为当前、历史倒序、切换持久化、未知版本和文件限制。
- 依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`、`pnpm --filter admin build`。
- 浏览器只执行一次上传和切换关键路径；不重复跑主题和多视口巡检。
