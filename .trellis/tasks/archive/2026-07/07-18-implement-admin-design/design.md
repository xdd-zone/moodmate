# 技术设计

## 接入边界

继续使用现有 Next.js 16 + React 19 工程。新增 `app/(dashboard)/moods/page.tsx` 作为服务端路由入口，由 `src/components/moods/mood-records-page.tsx` 承担浏览器交互。公共导航和顶栏在 `src/components/layout/admin-shell.tsx` 中实现，不新建第二套壳。

## 组件结构

- `AdminShell`：品牌、分组导航、当前路径状态、主题切换、顶栏搜索外观、管理员入口和退出动作。
- `MoodRecordsPage`：页面标题、统计、情绪分布、筛选状态、选中状态和详情状态。
- 页面内小组件：统计项、筛选分段、记录行、状态标签、详情抽屉和组件规范区域。只在重复结构能降低主组件复杂度时拆分。

## 数据与状态

演示数据定义在 Mood 业务组件附近并使用明确的 TypeScript 类型。筛选条件、已选 ID、当前详情和规范区展开状态保存在客户端。筛选结果由原始数组和筛选状态派生，不复制到额外 state。页面不发起情绪记录请求，也不新增请求函数或服务端路由。

数据流：

```text
本地演示记录 -> 关键词和情绪筛选 -> 表格渲染
                              -> 当前页全选集合
记录点击 -> 当前记录 -> 详情抽屉
```

## 样式与依赖

使用 Tailwind CSS 4 和 `@repo/ui/theme.css` 的语义 token。需要的业务布局样式放在组件 `className` 中；只把无法清楚表达的全局行为放进 `apps/admin/app/globals.css`。图标使用 `lucide-react`，版本由 workspace catalog 统一管理。

共享 Button、Badge、Card、Input 优先复用 `@repo/ui`。情绪分布、状态色和头像色只引用现有 `primary`、`success`、`warning`、`danger`、`info`、`mauve` 等主题 token，不在组件中写十六进制色值。

## 兼容与回退

- 不修改现有认证、BFF、roles query 和 contracts。
- 不修改任何 API、数据库和接口响应类型；所有新增交互都是本地 UI 状态。
- 新页面出错时可删除 `/moods` 路由和对应业务组件，公共壳改动可单独恢复，不涉及数据迁移。
- 设计稿中的未接入动作保持禁用或只提供视觉状态，避免把演示操作表达为已完成的服务端能力。
