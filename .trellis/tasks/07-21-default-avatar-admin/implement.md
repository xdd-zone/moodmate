# 默认头像管理页面执行清单

- [x] 扩展默认头像 Contract 和包入口导出，覆盖版本 DTO、当前版本、历史列表和设为当前请求响应。
- [x] 新增 `0005` migration，并同步 Drizzle schema；用部分唯一索引保证最多一个当前版本。
- [x] 扩展 assets repository、service 和 route，实现查询当前、历史列表、上传自动设为当前和按版本 id 切换。
- [x] 新增 Admin 服务端 API 与 Route Handler，包括图片 body 的同源转发。
- [x] 扩展浏览器 HTTP 请求层支持 FormData，新增默认头像请求和 Query 配置。
- [x] 新增 `/default-avatar` 页面、交互组件和导航入口；客户端先检查 MIME、空文件和 2 MiB 上限，服务端继续执行同样校验。
- [ ] 按顺序运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter admin build`。
- [x] 应用本地 D1 migration，通过 API/D1 命令检查唯一当前版本、历史倒序和错误分支；浏览器只冒烟上传与切换一次。

## 风险和回滚点

- D1 batch 与部分唯一索引共同承担当前版本一致性；若 migration 或 batch 检查失败，停止在 API 层，不继续接页面。
- 上传跨 R2 与 D1，D1 失败后必须保留现有 R2 清理逻辑。
- `apps/admin/src/lib/http/index.ts` 的 FormData 支持会影响共享请求入口，只新增独立方法，不改变现有 JSON `post` 行为。
