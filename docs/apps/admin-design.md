# admin 设计规则

这份文档写 `apps/admin` 的页面设计规则。改管理端入口、全局样式、后台布局和文案时先看这里。

## 设计上下文

- 目标用户：需要重复查看和管理 MoodMate 数据的管理员。
- 主要场景：进入管理端，定位业务区域，检查服务状态，处理具体记录。
- 界面气质：安静、中性、紧凑。信息要容易扫描，不复制 Web 的展示页构图。

## 页面规则

- 当前管理入口在 `apps/admin/app/page.tsx`。
- 后续登录页面放在 `app/(auth)`，后台业务页面放在 `app/(dashboard)`。
- 页面默认写服务端组件。需要事件、状态或浏览器 API 时，再把对应交互区域拆成客户端组件。
- 没有接入真实接口前，不展示虚构表格、统计值、筛选器和表单。

## 样式规则

- Tailwind CSS 4 从 `apps/admin/app/globals.css` 进入。
- PostCSS 配置在 `apps/admin/postcss.config.mjs`。
- 通用颜色、圆角和阴影从 `@repo/ui/theme.css` 导入。
- 主题只支持 Latte 和 Mocha；`app/layout.tsx` 在首次绘制前读取 `moodmate-theme:v1`，页面使用 `@repo/ui/theme-toggle` 切换。
- 页面使用 `background`、`surface`、`foreground`、`border`、`primary`、`focus` 等语义 token。
- 色值只写在 token 定义里，不在页面和组件中直接写颜色。
- 字体使用 `apps/admin/app/layout.tsx` 注册的 Maple Mono。
- 通用按钮、卡片和标签分别使用 `@repo/ui/button`、`@repo/ui/card` 和 `@repo/ui/badge`。
- Admin 专用表格、筛选器、表单和布局放在 `apps/admin/src/components`，不放进共享包。

## 布局与密度

- 登录后的页面使用左侧模块导航和右侧通栏内容区。桌面侧栏可以在 `15rem` 与 `4rem` 之间切换，760px 以下改为覆盖内容的抽屉。
- 顶栏只保留搜索、通知、主题、管理员资料和退出操作；品牌与模块入口放在侧栏。
- 应用外层不加最大宽度、圆角、边框或阴影。页面层级依靠 surface 和 1px 分隔线表达。
- 共享 Button 和 Input 默认高 `36px`，紧凑 Button 高 `32px`；移动端主要操作仍保持至少 `44px` 触控区域。
- Card 默认没有阴影。表格和独立操作区可以保留边框，普通 section 不要为了分区再包 Card。
- 页面使用清楚的标题、工具区和内容区，不把每个 section 都包成卡片。
- 表格和重复操作区域可以使用紧凑尺寸；移动端主要操作仍要保持足够的触摸区域。
- 卡片只包独立内容或操作区域，不嵌套卡片。
- 长标题、状态和按钮必须允许换行，不能互相覆盖。

## 交互与文案

- 主操作、次操作和危险操作使用共享 Button 变体。
- 链接和按钮必须有可见的 `focus-visible` 状态。
- 按钮写动作和对象，例如“查看服务状态”“保存模型配置”。
- 空状态写当前没有什么，并只提供已经可用的下一步操作。
- 报错写明失败位置和下一步，不使用笼统提示。

## 检查

改 Admin 页面或样式后检查：

- `http://localhost:6154` 在移动端和桌面没有文字、按钮或卡片重叠。
- Latte 和 Mocha 都能看清文字、描边和操作，刷新后保留当前主题。
- 键盘可以依次聚焦主要操作。
- 减少动态效果模式没有多余动画。
- 页面没有 Next starter 文案、图片和样式。

依次运行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter admin build
```
