# 默认头像管理页面

## Goal

对标课程参考项目 `/default-avatar` 页面，补齐默认头像的"当前版本、历史列表、上传、设为当前"能力，并新建 Admin 页面。前置任务：07-21-roles-wire-api（复用其验证过的请求链路模式）。

## Background

- 已有能力：`apps/api/src/modules/assets` 提供 `POST /rpc/admin/default-avatars` 上传和 `GET /rpc/assets/avatar` 按 key 读取（schema 在 `packages/contracts/src/assets/default-avatar.contract.ts`）；文件存 R2 `AVATAR_BUCKET`，版本记录写 `default_avatar_versions` 表（`apps/api/migrations/0002_create_default_avatar_versions.sql`）。
- 缺口：表没有"当前版本"标记；没有当前版本、历史列表、设为当前三个端点；Admin 没有 `/default-avatar` 页面和导航入口；BFF 没有对应 Route Handler。
- 课程参考项目 `/default-avatar` 功能：展示当前默认头像、按时间倒序的历史版本列表、上传新头像（上传即成为当前）、把任一历史版本重新设为当前。

## 课程参考源码

参考项目根目录：`/Users/wuwanzhu/Code/bobo/ai-agent`

- 页面：`/Users/wuwanzhu/Code/bobo/ai-agent/apps/admin/app/(dashboard)/default-avatar`（页面请求函数在该目录下的 `api.ts`）
- API：`/Users/wuwanzhu/Code/bobo/ai-agent/apps/api/src/routes/user/profile.route.ts`（default-avatar 的 latest、history、upload、set-current 端点）

## Requirements

1. 新增迁移：给 `default_avatar_versions` 增加当前版本标记（布尔列或单行指针表，设计时选更简单的一种并记录理由），保证任一时刻最多一个当前版本；存量数据以最新一条为当前。
2. 扩展 Contract `default-avatar.contract.ts`：当前版本、历史列表、设为当前的请求响应 Schema。
3. 扩展 `assets` 模块，端点挂 `requireAdminAccess`：
   - 查询当前版本（含 avatar key、文件信息、上传时间）。
   - 历史版本列表，按 `created_at_ms` 倒序。
   - 设为当前：传版本 id，切换当前标记；id 不存在返回业务错误。
   - 上传行为调整：上传成功后该版本自动成为当前。
4. 新增 BFF Route Handler 和 `apps/admin/src/api` 下的请求、query 封装，模式对齐 roles。
5. 新增 `/default-avatar` 页面（`app/(dashboard)/default-avatar` 路由加 `src/components` 组件），并在 `admin-shell.tsx` 导航中加入口：
   - 展示当前头像图片。
   - 历史版本列表，每项可"设为当前"。
   - 上传入口，沿用现有 2MB、jpeg/png/webp 限制，超限在页面提示。
6. 操作成功后用 query 缓存失效刷新当前版本和历史列表。
7. 为加快交付，验证以自动化质量检查、Admin build 和 API/D1 命令为主；浏览器只执行一次上传与设为当前的关键路径冒烟，不重复检查多主题、多视口和非关键交互。

## Acceptance Criteria

- [x] 上传新头像后页面立即显示其为当前版本，历史列表新增一条。
- [x] 把历史版本设为当前后，当前版本切换，刷新页面后保持。
- [x] 任一时刻数据库中只有一个当前版本。
- [x] 超过 2MB 或非 jpeg/png/webp 文件被拒绝并有页面提示。
- [ ] type-check、lint、format 检查全部通过。
- [x] Admin build 通过；浏览器关键路径冒烟通过，或记录本地服务、认证、R2 binding 等明确阻塞。

## Out of Scope

- 删除历史版本（课程参考项目没有该功能）。
- 用户个人头像上传和管理员资料页（地图中的 `/profile` 卡）。
- Web 端读取默认头像的行为变更。
