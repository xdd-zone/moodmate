# 管理员资料与个人头像实施清单

## 实施

- [x] 新增 Admin profile、个人头像 key、头像来源和上传响应 Contract，并从 `@repo/contracts` 根入口导出。
- [x] 新增 `user_avatar_assets` migration、Drizzle schema 和 repository 查询/upsert。
- [x] 在 API 中实现当前 Admin profile 查询、个人头像上传、头像归属校验和 R2 读取。
- [x] 注册 API 路由，并覆盖文件校验、存储失败、个人头像优先和默认头像回退。
- [x] 新增 Admin server API、BFF Route Handler、浏览器 API 和 TanStack Query 配置。
- [x] 新增 `/profile` 页面和 Admin 专用头像组件。
- [x] 把顶部硬编码账号区域改为真实 session/profile 数据，并链接 `/profile`。
- [x] 检查默认头像页面、登录续期、用户管理和角色管理没有行为变化。

## 验证

按顺序执行：

```bash
pnpm --filter api cf-typegen
pnpm --filter api exec wrangler types --env-interface CloudflareBindings --check
pnpm --filter api exec wrangler d1 migrations apply moodmate-local --local
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter admin build
```

手动验证：

- [x] 允许的三种 MIME 均可上传，页面和顶部头像同步刷新，刷新后保持。
- [x] 空文件、错误 MIME 和超限文件不会写入 D1 或 R2。
- [ ] 没有个人头像时使用当前默认头像；没有任何头像时显示姓名首字。
- [x] 使用另一个用户的个人头像 key 读取时返回 403。
- [ ] access 过期时 BFF 只续期一次并重放 profile 请求。
- [ ] 浏览器 Network 只出现 Admin 同源业务请求，响应与缓存不含 token。
- [ ] Latte、Mocha、桌面和移动端没有文字、头像或按钮重叠，键盘可访问上传入口和资料页链接。

## 本次验证结果

- `cf-typegen`、Worker types check、本地 `0006` migration、`pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 Admin build 通过。
- jpeg、png、webp 上传均返回 201；错误 MIME、空文件和超限文件分别返回 400、400 和 413。
- 初始 profile 使用当前默认头像；上传后返回个人头像，BFF 图片读取返回 200，伪造其他用户 key 返回 403。
- 本地 D1 查询确认当前管理员只有一条 `user_avatar_assets` 记录。
- 验证结束后已删除本次生成的个人头像 D1 记录和本地 R2 对象，seed 管理员恢复为默认头像回退状态。
- 浏览器只检查一个桌面视口和当前 Mocha 主题。`/profile` 无页面级横向溢出，Header 资料入口和上传按钮可见。
- 经用户授权格式化 8 个任务外的既有 Trellis 文件后，根目录 `pnpm format:check` 通过。

## 风险与回滚点

- R2 写入和 D1 更新不是同一事务。D1 失败时必须删除新对象，替换成功后再删除旧对象。
- 扩展头像 key 校验时不能放宽默认头像管理接口；个人头像读取使用独立的 Admin profile Contract。
- 不修改 `AdminSession` 字段，避免影响登录、refresh 和现有 Query cache。
- 出现回归时先撤回顶部账号区域的 profile query，再回滚 profile BFF/API；新增表不阻塞现有认证。
