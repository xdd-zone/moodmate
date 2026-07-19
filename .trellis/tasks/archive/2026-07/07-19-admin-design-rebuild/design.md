# 技术设计 — admin 设计稿全量重构

## 边界与栈

- 全部落在 `apps/admin`。不改 `@repo/ui`、`@repo/contracts` 与 `apps/api`。
- 复用组件：`@repo/ui` 的 Button、Badge、Card、Input、Table\*、Field/FieldLabel、Alert。
- `@repo/ui` 无 Switch/Select/Textarea 组件；按 `mood-records-page.tsx` 既有做法，用原生元素 + Tailwind token 内联实现（select 已有内联样例）。
- 三页均为 `"use client"` 组件，纯前端 state（`useState`/`useMemo`/`useDeferredValue`），演示数据用确定性种子函数生成（对齐设计稿脚本，不用 `Math.random`）。

## 文件计划

新增：

- `src/components/users/user-management-page.tsx` — 用户管理页
- `src/components/settings/system-settings-page.tsx` — 系统设置页
- `app/(dashboard)/users/page.tsx`、`app/(dashboard)/settings/page.tsx` — 路由入口

改写：

- `src/components/roles/roles-page.tsx` — 重构为设计稿的角色卡片 + 权限矩阵 + 新建抽屉纯前端演示
- `src/components/layout/admin-shell.tsx` — 接入 `/users`、`/settings`，标签统一为「角色权限」，补 PAGE_META

保留不删（页面不再引用）：

- `src/api/roles.api.ts`、`src/api/roles.query.ts`、`app/api/roles/*`、`src/server/roles/api.ts`

## 抽屉方案

沿用 mood-records 已验证的 `<dialog>` + `showModal()` 模式（`.mood-detail-dialog` 的 backdrop 与右滑动画已在 `globals.css`）：用户详情抽屉、新建角色抽屉都复用同一套 dialog 结构与类名，避免再写 scrim/transition。

## 各页数据与交互

### 用户管理

- 统计卡：注册总数 861、近 7 日活跃 512/861（带 spark 柱）、付费会员 238、待审核/封禁 7。
- 角色/套餐/状态映射对齐设计稿 ROLES/PLANS/STATUS；角色标签用 `color-mix` 弱底色（内联 style 承载动态色）。
- 筛选：关键词 + 状态分段（全部/活跃/沉睡/已封禁）+ 角色下拉 + 套餐下拉，四者与全选联动。
- 全选/单选维护 `Set<string>`，footer 显示本页数与已选数，「批量封禁」按 `selected.size===0` 禁用。
- 行详情抽屉：账号信息 kv、使用概况 kv、操作记录时间线、底部编辑资料/重置密码/更多。

### 系统设置

- 分区状态 `activePanel: 'basic'|'notify'|'security'|'algorithm'`。
- 表单字段集中在一个受控 model，`saved` 快照做脏检查；`isDirty` 驱动保存/放弃按钮与顶部「有未保存修改/已保存」徽章（`role=status aria-live`）。
- 开关：原生 checkbox + Tailwind 轨道；range：原生 input[type=range] + 数值联动展示。
- 保存写回快照并显示「已保存」1.6s；放弃还原快照；危险操作用 `window.confirm` 二次确认（对齐设计稿占位交互）。

### 角色权限

- `ROLES` 数组（含 admin/ops/review 内置 + counselor 自定义），`MODULES` 分组权限项，`GRANTS[roleKey][permKey] = Set<cap>`，`DEFAULT_GRANTS` 深拷贝快照。
- `activeRole` + 编辑缓冲 `buffer`（选角色时深拷贝，勾选改 buffer，保存写回 GRANTS，放弃重载）。
- 搜索同时过滤角色卡片与矩阵行；卡片权限数实时统计。
- 新建抽屉：角色名称（必填 + 重名校验）、说明（必填）、复制权限来源下拉；提交后追加角色并选中。
- 重置为默认：内置角色 GRANTS 还原 DEFAULT_GRANTS；删除：仅自定义角色，二次确认。
- 内置角色禁删（锁形按钮 disabled）。

## 兼容与回滚

- 只新增路由与组件、改写两个已有组件；不动 API 与共享包，回滚即还原这几个文件。
- 三页不发网络请求，SSR/CSR 均安全（确定性种子，无 hydration 抖动）。

## 权衡

- 保留 roles 后端文件而非删除：降低回滚成本，也不触碰 `app/api` 契约；代价是留下暂时未被页面引用的代码，已在 PRD 记录。
