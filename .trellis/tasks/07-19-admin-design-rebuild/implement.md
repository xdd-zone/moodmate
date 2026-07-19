# 执行计划 — admin 设计稿全量重构

## 顺序

1. [ ] 侧栏 `admin-shell.tsx`：`/users`、`/settings` 接入 href，标签统一「角色权限」，补 PAGE_META（/users、/settings）。
2. [ ] 新增 `src/components/users/user-management-page.tsx` + `app/(dashboard)/users/page.tsx`。
3. [ ] 新增 `src/components/settings/system-settings-page.tsx` + `app/(dashboard)/settings/page.tsx`。
4. [ ] 改写 `src/components/roles/roles-page.tsx` 为设计稿纯前端演示。
5. [ ] 质量门禁：check-types → lint → format:check，逐项修到零错误。
6. [ ] 浏览器验证（Playwright / 手动）：三页渲染与交互对齐设计稿，latte/mocha 切换正常。

## 验证命令

```bash
pnpm --filter admin check-types
pnpm --filter admin lint
pnpm format:check
pnpm dev:admin   # 本地预览
```

## 复用参照

- 表格/抽屉/统计卡/筛选：`src/components/moods/mood-records-page.tsx` 已有完整样例，用户页与角色页直接沿用其类名与结构。
- select 内联样式：见 mood-records 的 dateRange select。
- dialog 抽屉动画：`app/globals.css` 的 `.mood-detail-dialog` / `.mood-detail-drawer`。

## 审查门

- 每页完成后自查：aria-label / focus-visible / role=status 是否齐全；tabular-nums 是否用在数字列；空状态是否兜底。
- 全部完成后跑一次全量 check，再做浏览器验证。

## 回滚点

- 每个文件独立提交前保持可运行；如角色页重构出问题，可单独还原 `roles-page.tsx`，其余三项不受影响。
