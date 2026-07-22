# Implement：Admin UI 改造

执行顺序：先改 packages/ui 底层组件（尺寸+去阴影），再改布局壳（侧边栏+顶栏），再逐页清理，最后质量门禁 + 双端目视。

## 阶段 1：packages/ui 组件降档

- [x] 1.1 `button.tsx`：default `h-9 px-4`、sm `h-8 px-3`、lg `h-10 px-5`、icon `size-9`；base 从 `min-h-11` 改 `min-h-9`。
- [x] 1.2 `input.tsx`：`min-h-11`→`min-h-9 h-9`。
- [x] 1.3 `card.tsx`：移除 `shadow-card`（默认无阴影）。
- [x] 1.4 `badge.tsx`、`table.tsx`、`field.tsx`、`pagination.tsx`、`alert.tsx`：行高 / padding / 字号各收一档，保持与 36px 体系协调（逐个读后微调，不过度）。
- [x] 1.5 `theme-menu.tsx`：加可选 `variant` prop 透传给触发 Button，默认 `secondary`；触发按钮尺寸随 Button 降档同步（当前写死 `size-9 min-h-9`，确认与新 icon 尺寸一致）。

## 阶段 2：布局壳（侧边栏 + 顶栏）

- [x] 2.1 `admin-shell.tsx` 重构：
  - 结构改为 `侧边栏(brand + 竖向 nav + 折叠按钮) + 右侧(顶栏 + 内容)`。
  - 折叠状态 `useState` + `localStorage`（key `admin-sidebar-collapsed`），初值在 effect 里读，避免 hydration mismatch。
  - 顶栏移除 brand 与 `admin` Badge；保留 搜索/通知/主题/用户 chip/退出。
  - 主题按钮传 `variant="ghost"`；通知按钮已 ghost。
- [x] 2.2 `globals.css` 重写 admin-\* 样式：
  - 删除 `admin-frame` 卡片外框（border/radius/shadow/max-width 居中）；改 `admin-shell` grid 布局 `grid-template-columns: var(--sidebar-w) 1fr`。
  - 新增 `.admin-sidebar`（sticky, 100svh, border-r）、`.admin-sidebar-nav-item`（竖向、active 态、折叠只剩图标）、`.admin-sidebar-toggle`。
  - `--sidebar-w` 展开 15rem / 折叠 4rem。
  - `admin-search` 圆角 → `999px`。
  - 主题/通知按钮无边框（ghost 已无边框，确认 CSS 不再加 border）。
  - 移动端（<760px）：侧边栏改 overlay 或收顶部；沿用现有 760 断点，取最简可用方案。
  - 删除废弃的 `admin-nav` / `admin-nav-tab*` / `admin-brand*` 顶部横向 tab 相关样式。

## 阶段 3：逐页去卡片 + 清理冗余 override

对每个页面：Card 若是「表格/内容容器」保留 border 容器但确认无阴影；若是纯分区改 hairline（`border-t` / 无边框）。清理纯为缩小加的 `h-9 min-h-9`/`text-xs`（降档后默认已小）。

- [x] 3.1 `users/user-management-page.tsx`（2 Card）
- [x] 3.2 `moods/mood-records-page.tsx`（4 Card）
- [x] 3.3 `roles/roles-page.tsx`（3 Card）
- [x] 3.4 `dashboard/admin-dashboard.tsx`（5 Card）
- [x] 3.5 `default-avatars/default-avatar-page.tsx`（13 Card，量最大）
- [x] 3.6 `profile/profile-page.tsx`（5 Card）
- [x] 3.7 `settings/system-settings-page.tsx`（2 Card）
- [x] 3.8 `auth/login-form.tsx`（5 Card）：去卡片，登录框改无卡片风格；删除 `admin-login-frame` 卡片外框（globals.css 里）与 `admin` Badge 标记。

## 阶段 4：质量门禁 + 双端目视

- [x] 4.1 `pnpm --filter admin type-check` / 根 type-check（先确认脚本名）。
- [x] 4.2 lint。
- [x] 4.3 format（prettier --check）。
- [x] 4.4 Web 与 Admin 构建通过；Web `/` 在 390px 下完成目视，`/lab` 正常加载。Admin 登录页在 1440px 与 390px 下完成 Latte/Mocha 目视；登录后的业务页因缺少已授权会话，未提交浏览器自动填充凭据。

## 验证命令（阶段 4 前先确认实际脚本名）

```bash
cat package.json | grep -A20 '"scripts"'
# 预期：turbo type-check / lint / format 或 pnpm -w run ...
```

## 风险点 / 回滚

- `admin-shell.tsx` 是核心，改动大 → 单独提交，便于回滚。
- localStorage 折叠状态注意 SSR hydration。
- Card 默认去阴影影响 web → 阶段 4.4 必须目视确认。
- 逐页清理只删「为缩小而加」的 override，不动业务逻辑与数据流。
