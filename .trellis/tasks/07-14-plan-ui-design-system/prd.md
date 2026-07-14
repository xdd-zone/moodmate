# 规划项目 UI 设计体系

## Goal

参考课程文章的三层设计方法，为 MoodMate 建立一套由基础令牌、语义令牌和组件约束组成的 UI 设计体系。第一阶段要在 `apps/web`、`apps/admin` 和 `packages/ui` 中完成一个可验证的小范围实现，减少页面内临时决定颜色、间距、圆角、阴影和交互状态的情况。

## Background

- 课程文章只作为架构参考，不采用文章中的深色蓝色方案。
- MoodMate 保留现有暖色、低饱和、浅深色自适应的视觉方向。
- Web 已在 `apps/web/app/globals.css` 使用 Tailwind CSS 4、语义色、圆角、阴影、系统浅深色和减少动态效果规则。
- Admin 尚未接入 Tailwind CSS，页面和 CSS 仍是 Next starter 基础壳。
- `packages/ui` 当前的 `Button` 和 `Card` 仍含 create-turbo 演示行为，不能作为产品组件直接使用。
- `packages/ui` 只接收 Web 与 Admin 都有真实使用位置、且不含业务规则的组件。
- 当前 Web 与 Admin 页面都没有真实表单，因此第一阶段不实现共享 `Input` 和 `Label`。

## Requirements

### R1. 三层设计规则

- 基础令牌记录 MoodMate 的原始色值、字体、圆角和阴影值。
- 语义令牌提供页面和组件直接使用的背景、内容、描边、主操作、聚焦和反馈状态名称。
- 组件只能使用语义令牌，不直接依赖基础色值。
- 页面优先使用共享组件；页面特有布局和业务色保留在对应 app。

### R2. 共享主题

- `packages/ui` 提供 Web 与 Admin 共用的 Tailwind CSS 4 主题入口。
- 两个应用都必须显式导入共享主题，并能扫描 `packages/ui/src` 中的完整 Tailwind 类名。
- 主题继续使用系统 `prefers-color-scheme` 提供浅色和深色模式。
- 两个应用都必须保留 `prefers-reduced-motion` 处理。
- 第一阶段不增加手动主题切换、主题 Provider 或本地存储。

### R3. 第一批共享组件

- 用真实产品 API 替换 starter `Button` 和 `Card`。
- 新增 `Badge`。
- `Button` 覆盖 `default`、`secondary`、`outline`、`ghost` 和 `danger` 语义，以及 `default`、`sm`、`lg`、`icon` 尺寸。
- `Button` 覆盖 `default`、`hover`、`active`、`focus-visible` 和 `disabled` 状态，并允许 Link 或 anchor 保留正确的 HTML 语义。
- `Card` 提供容器、标题、说明、内容和底部操作区域，不包含链接跳转或业务字段。
- `Badge` 只提供第一阶段真实页面会使用的变体；反馈状态变体等到出现真实状态后再增加。
- `Input` 和 `Label` 推迟到 Web 与 Admin 都出现真实表单时实现。

### R4. 真实页面验证

- Web 首页和 `/app` 入口改用共享主题与共享组件，保留现有页面职责和产品气质。
- Admin 接入 Tailwind CSS 4，用共享主题与共享组件替换 starter 页面和 `page.module.css`。
- Web 与 Admin 的页面密度可以不同，但使用同一组语义令牌和组件状态规则。
- 页面迁移不增加尚未实现的业务表单、虚构数据或无效操作入口。

### R5. 文档与边界

- `docs/architecture.md` 补充共享主题、组件和依赖方向。
- `docs/apps/web-design.md` 更新 token 来源与应用专用样式边界。
- 新增 Admin 设计规则，写清管理端密度、页面结构和共享组件使用方式。
- 不把 Web 业务组件、Admin 业务组件、请求、session、权限或环境变量读取放进 `packages/ui`。

## Acceptance Criteria

- [x] AC1：两个应用都通过 `@repo/ui` 的 CSS 子路径导入同一套共享主题，构建产物包含共享组件使用的 Tailwind 类。
- [x] AC2：共享主题使用现有 MoodMate 色值，支持系统浅色、深色和减少动态效果，不包含课程示例的蓝色色阶。
- [x] AC3：页面与共享组件不直接写产品色值；Web 专用情绪色留在 Web，通用组件只使用语义令牌。
- [x] AC4：`Button`、`Card`、`Badge` 在 Web 和 Admin 都有真实使用位置，且不再包含 starter 属性、链接或 `alert()`。
- [x] AC5：Admin 已接入 Tailwind CSS 4，删除未使用的 starter `page.module.css`，页面没有虚构业务能力。
- [x] AC6：键盘焦点、禁用状态、系统浅深色、移动端与桌面布局均可手动验证，页面没有文字或控件重叠。
- [x] AC7：架构、Web 设计和 Admin 设计文档写明文件位置、使用边界和检查命令。
- [x] AC8：依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check`、Web build 和 Admin build。

## Out Of Scope

- 不采用课程文章的色彩值、品牌风格或深色优先方案。
- 不建立完整组件库，不新增 `Dialog`、`Table`、`Sidebar`、`Input`、`Label` 等没有两个真实使用位置的组件。
- 不增加 Storybook、独立组件站点或公开设计系统页面。
- 不增加手动主题切换、主题 Provider 或主题持久化。
- 不重做 Web 首页内容结构、插画、Logo 和营销素材。
- 不修改 API、contracts、登录、session 或业务数据流程。
