# 技术设计：Admin Open Design 重构

## 边界

改动集中在 `apps/admin`。页面继续使用 App Router、Tailwind CSS 4、`@repo/ui` 和 Lucide，不把 Open Design 的 HTML、CSS 或 JavaScript 直接作为运行时代码引入。

共享主题和字体已经满足设计稿：`app/layout.tsx` 注册 Maple Mono，`@repo/ui/theme.css` 提供 Latte / Mocha 语义 token，`ThemeMenu` 使用 `moodmate-theme:v1`。本次只补充 Admin 专用布局样式和组件 class。

## 公共布局

`src/components/layout/admin-shell.tsx` 负责以下结构：

```text
页面画布
└── 居中应用框架
    ├── 顶部 Header：品牌、全局搜索、通知、主题、管理员、退出
    ├── 横向模块导航：待建概览、情绪、用户、角色、设置
    └── 页面内容
```

- 桌面框架最大宽度约 `1440px`，保留设计稿的外边距、细边框、小圆角和克制阴影。
- 小于 `760px` 时框架铺满视口，Header 允许换行，搜索移到下一行，导航按可用宽度换行。
- 现有 `AdminShell` 的登出 mutation 和 React Query session 清理保持原样。
- 不再使用 `@repo/ui/app-shell` 的侧栏结构，避免保留无用的双层布局。

## 路由

- `app/(dashboard)/page.tsx` 使用 Next.js `redirect("/moods")`，与 Open Design 的 `admin/index.html` 一致。
- `/moods`、`/users`、`/roles`、`/settings` 继续由现有页面组件提供。
- 认证 proxy 和 dashboard route group 不变，因此根路由仍受现有登录态保护。

## 页面调整

### 登录页

保留 `LoginForm` 的提交、校验和错误状态，只调整外层结构为最大宽度 `1080px` 的应用框架。设计稿中的说明模块、登录卡和底部信息继续由 React 渲染；现有可访问性逻辑不变。

### 业务页

四个页面保留现有 state 和事件处理，只改 JSX 结构与 class：

- 统一标题区为左侧标题说明、右侧页面操作。
- 统计卡使用 `4 / 2 / 1` 列响应式网格和设计稿的紧凑尺寸。
- 表格、权限矩阵和设置面板使用现有 `Card`、`Table`、`Button`、`Badge`、`Input`。
- 抽屉继续使用现有 `<dialog>` 方案和 `mood-detail-dialog` 动画，视觉尺寸改为设计稿的 `440px` 右侧面板。
- 页面容器不再单独设置旧侧栏布局下的最大宽度，宽度由公共应用框架控制。

## 兼容策略

- 保留真实登录、退出和 session 行为。
- 保留所有已有纯前端演示交互，不用 Open Design 的 `admin-layout.js` 替代 React state。
- 保留 `@repo/ui` 语义 token，不复制设计稿中的固定 Catppuccin 色值。
- 图标继续使用 Lucide，不复制 HTML 内联 SVG。
- 只在 `apps/admin/app/globals.css` 增加复用价值明确的应用框架和抽屉样式；页面细节优先用 Tailwind class。

## 风险与回滚

- `AdminShell` 影响所有登录后页面，修改后先检查导航、登出和移动端布局。
- 根路由从概览改为跳转，回滚只需恢复 `app/(dashboard)/page.tsx`。
- 页面组件体积较大，修改时保留事件和数据代码，只替换渲染结构与样式，避免业务逻辑回归。
- 每完成一个公共区域先运行 Admin 类型检查；最终再执行仓库级质量门禁和 Admin build。
