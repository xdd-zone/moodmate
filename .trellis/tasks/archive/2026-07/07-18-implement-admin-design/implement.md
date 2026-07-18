# 实现计划

## 步骤

- [x] 在 workspace catalog 和 `apps/admin` 添加 `lucide-react`，更新 lockfile。
- [x] 升级 `AdminShell`，实现分组侧栏、移动端导航、顶栏和现有退出动作。
- [x] 新增 `/moods` 路由与情绪记录交互组件。
- [x] 使用现有语义 token 还原统计、情绪分布、筛选表格、状态和详情抽屉。
- [x] 实现筛选、选择、详情和 Escape 关闭交互。设计交付中的组件规范说明区不进入正式业务页面。
- [x] 确认改动不包含 API、BFF、contract、数据库和鉴权文件。
- [x] 检查现有 `/`、`/roles` 与登录流程没有结构回归。
- [x] 依次运行质量检查和 Admin build。
- [x] 启动 `pnpm dev:admin`，用桌面和移动视口检查 Latte、Mocha、交互与页面像素。

## 验证记录

- `pnpm check-types`：通过。
- `pnpm lint`：通过，零 warning。
- 本次改动文件 Prettier 检查：通过。
- `pnpm --filter admin build`：通过，`/moods` 生成静态路由。
- 浏览器控制台：最终页面零 error、零 warning。
- 完整仓库 `pnpm format:check`：未通过，只包含 3 个未修改的原有 Trellis 文件。

## 验证命令

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter admin build
pnpm dev:admin
```

## 风险与回退点

- `AdminShell` 影响所有已登录页面，完成后优先检查 `/` 和 `/roles`。
- 表格在移动端采用横向滚动，不压缩字段到不可读宽度。
- 抽屉使用固定定位和明确层级，关闭时恢复不可交互状态。
- 本次没有数据迁移；回退只涉及新增路由、业务组件、壳样式和图标依赖。
