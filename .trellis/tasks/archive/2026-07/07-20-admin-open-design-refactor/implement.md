# 执行计划：Admin Open Design 重构

## 修改顺序

1. [x] 重构 `src/components/layout/admin-shell.tsx`，实现居中应用框架、顶部 Header、横向模块导航、待建概览和移动端布局，保留退出与主题功能。
2. [x] 修改 `app/(dashboard)/page.tsx`，让根路由进入 `/moods`。
3. [x] 调整 `src/components/auth/login-form.tsx`，匹配最新登录页应用框架和响应式布局，保留登录校验与提交行为。
4. [x] 调整 `src/components/moods/mood-records-page.tsx` 的标题区、统计区、图表区、筛选表格和详情抽屉样式。
5. [x] 调整 `src/components/users/user-management-page.tsx` 的标题区、统计卡、筛选表格和用户抽屉样式。
6. [x] 调整 `src/components/roles/roles-page.tsx` 的标题区、角色卡、权限矩阵和新建角色抽屉样式。
7. [x] 调整 `src/components/settings/system-settings-page.tsx` 的标题操作、分区导航、表单卡和危险操作区域样式。
8. [x] 按实际复用需要更新 `app/globals.css`，只增加公共框架、响应式和抽屉样式。
9. [x] 依次运行类型、Lint、Format 和 Admin build，修复本次改动引入的问题。
10. [x] 启动 Admin，检查 `/login`、`/moods`、`/users`、`/roles`、`/settings` 的桌面与移动视口、Latte / Mocha、导航、表单和抽屉。

## 验证命令

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter admin build
pnpm dev:admin
```

## 视觉检查

- 桌面：`1440x1000`，确认应用框架边距、Header、横向导航、内容密度和抽屉。
- 移动：`390x844`，确认框架铺满、Header 换行、导航滚动、页面操作换行和表格可滚动。
- 主题：Latte 与 Mocha 分别检查文字、边框、主按钮、标签、输入和遮罩。
- 交互：根路由跳转、模块导航、主题持久化、登录错误、筛选、选择、抽屉关闭、权限保存和设置放弃。

## 回滚点

- 公共壳层、根路由、登录页和四个业务页可按文件独立还原。
- 不改 API 与 contract，因此样式重构失败时不会影响服务端数据结构。
