# 重构 admin 页面样式以匹配 Open Design

## 目标

把 Open Design 项目 `68eedb2d-69da-46ab-94d4-971a9ba8c6b1` 中最新一轮 Admin 重构稿实现到 `apps/admin`。页面继续使用现有 Next.js 16、React 19、Tailwind CSS 4、`@repo/ui`、Maple Mono 和 Latte / Mocha 主题，不改变已有业务接口和登录机制。

## 已确认事实

- 设计源位于 `/Users/wuwanzhu/Library/Application Support/Open Design/namespaces/release-stable/data/projects/68eedb2d-69da-46ab-94d4-971a9ba8c6b1`。
- 最新 Admin 设计文件为 `admin/admin-login.html`、`admin/admin-console.html`、`admin/user-management.html`、`admin/role-management.html`、`admin/system-settings.html`、`admin/admin-shared.css` 和 `admin/admin-layout.js`。
- 版本记录显示最新重构覆盖上述五个页面，要求统一重写共享布局，并允许重新排列页面内容。
- 新设计把旧侧栏改为居中的应用框架、顶部 Header 和横向模块导航。数据概览标为“待建”，`admin/index.html` 进入情绪记录页。
- 现有 `apps/admin` 已经实现登录、退出、主题切换、情绪记录、用户管理、角色权限和系统设置的主要交互。
- 目标工程栈与用户指定的 Next.js / React 一致，不存在工程栈冲突。

## 需求

1. 把登录后的公共壳层改为设计稿的 `app-frame` 结构：居中画布、顶部品牌与操作区、横向模块导航、受约束的内容区。
2. 导航提供情绪记录、用户管理、角色权限和系统设置入口；数据概览保留“待建”状态，不作为可用入口。
3. 根路由 `/` 按设计稿入口行为进入 `/moods`，不再展示未出现在最新设计稿中的概览页。
4. 登录页改为设计稿的紧凑应用框架：顶部品牌栏、左侧说明、右侧登录面板和底部环境信息；保留真实登录、字段校验、密码显示、错误反馈和主题切换。
5. 情绪记录、用户管理、角色权限和系统设置页按最新 HTML 的页面宽度、标题区、按钮密度、统计卡、筛选区、表格、权限矩阵、设置分栏和抽屉样式调整。
6. 保留现有页面交互：筛选、选择、分页展示、详情抽屉、角色权限编辑、新建角色、设置保存与放弃、登录、退出和主题持久化。
7. 复用 `@repo/ui` 组件、Lucide 图标和共享语义 token。不得复制 Open Design 的脚本运行时或引入第二套主题状态。
8. Latte、Mocha、桌面和移动端都要可用；主要操作可键盘聚焦，抽屉可关闭，减少动态效果设置继续生效。

## 验收标准

- [x] `/login` 的整体构图、应用框架、登录面板、间距和响应式行为与最新 `admin-login.html` 一致，登录表单校验和提交代码保持原有实现。
- [x] `/moods`、`/users`、`/roles`、`/settings` 共用顶部 Header 和横向模块导航，不再显示桌面侧栏或面包屑顶栏。
- [x] `/` 在保留鉴权保护的前提下进入 `/moods`；数据概览在导航中显示“待建”且不可点击。
- [x] 四个业务页与各自最新设计稿的页面标题、统计卡、工具区、主要内容和抽屉结构一致，现有交互可继续操作。
- [x] 桌面视口以带边框和阴影的居中应用框架展示；窄屏移除外框并让 Header、导航、操作区和表格正确换行或横向滚动，不出现重叠。
- [x] Latte 与 Mocha 下文字、边框、按钮、标签、输入框和抽屉均清晰，主题切换与刷新持久化正常。
- [x] 依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter admin build`。
- [x] 本地启动 Admin 后，使用桌面与移动视口完成页面截图和关键交互检查。

## 不在范围内

- 不修改 `apps/api`、`packages/contracts`、数据库和管理员鉴权协议。
- 不新增数据概览业务页面、内容管理页面或真实统计接口。
- 不删除当前页面已有但本次未调用的 API 文件。
- 不修改 `apps/web` 或共享主题色定义。

## 验证记录

- `pnpm check-types`、`pnpm lint`、`pnpm format:check`、`pnpm --filter admin build` 均通过。
- `1440x1000` 和 `390x844` 视口下检查了 `/login`、`/moods`、`/users`、`/roles`、`/settings`。
- 已检查 Latte / Mocha、根路由跳转、主题持久化、情绪详情抽屉、用户筛选、角色抽屉、设置修改与放弃，浏览器控制台零错误。
- 未继续执行真实登录成功联调。登录 API 启动后该检查被中断，用户要求减少测试；本次没有修改登录请求、session 或服务端认证代码。
