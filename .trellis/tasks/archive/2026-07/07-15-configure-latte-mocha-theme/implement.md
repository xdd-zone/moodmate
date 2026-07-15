# Latte 与 Mocha 主题实施计划

## 1. 重建共享主题样式

- [x] 新建 `packages/ui/src/styles/theme/catppuccin.css`，只写 Latte 与 Mocha 官方色板和 `--theme-*` 运行时变量。
- [x] 新建 `packages/ui/src/styles/theme/variables.css`，把现有 Tailwind 语义 token 映射到 `--theme-*`。
- [x] 把 `packages/ui/src/theme.css` 改为稳定公开入口，按顺序导入两层 CSS，并保留 `@source "./"`。
- [x] 配置只匹配 Mocha 的 Tailwind `dark` variant。
- [x] 删除旧 `--mood-cream-*`、`--mood-ink-*`、固定反馈色和系统深色媒体查询。

验证点：直接色值只出现在 `catppuccin.css`，只来自 Latte 与 Mocha 官方色板；现有共享组件使用的语义 utility 名称全部保留。

## 2. 建立共享主题运行时

- [x] 新建 `packages/ui/src/theme.ts`，定义主题联合类型、默认值、storage key、校验、读取、应用和订阅函数。
- [x] 新建 `packages/ui/src/theme-script.tsx`，在首次绘制前读取有效的持久化主题并写入根节点。
- [x] 新建 `packages/ui/src/theme-toggle.tsx`，实现 Latte / Mocha 两段式切换、`aria-pressed`、键盘操作和同源状态同步。
- [x] 不增加 `next-themes`、图标库或其他依赖。

验证点：无效 storage 值回退到 Latte；切换后根节点与 localStorage 同时更新；共享包不依赖 Next.js 或应用业务代码。

## 3. 接入 Web 与 Admin 根布局

- [x] 在 `apps/web/app/layout.tsx` 和 `apps/admin/app/layout.tsx` 设置默认 `data-theme="latte"`。
- [x] 在两个布局的 `<head>` 使用共享 `ThemeScript`，并处理脚本改写根属性产生的 hydration 差异。
- [x] 保留现有 metadata、Maple Mono、中文 fallback、`lang="zh-CN"` 和 body 结构。

验证点：禁用或清空 localStorage 时默认 Latte；保存 Mocha 后刷新不先绘制 Latte；控制台没有 hydration warning。

## 4. 放置主题切换入口

- [x] Web 首页页头加入共享 `ThemeToggle`，调整导航换行和间距以适配移动端。
- [x] Web `/app` 入口页把返回操作与 `ThemeToggle` 放进同一工具区。
- [x] Admin 首页页头加入共享 `ThemeToggle`，保持管理端中性、紧凑。
- [x] 不改页面业务文案、路由、服务状态 URL 或 Card 内容。

验证点：三个页面都能切换主题；当前状态可被辅助技术读取；Tab、Enter 与 Space 可以操作；390px 宽度没有重叠。

## 5. 迁移应用专用样式

- [x] 把 `apps/web/app/globals.css` 的 `warm`、`calm`、`rose` 和环境背景改为引用 Catppuccin 主题变量。
- [x] 删除 Web 中只服务旧色板的固定 OKLCH 值与 `prefers-color-scheme: dark` 分支。
- [x] 删除 Admin 中设置系统深色 `color-scheme` 的媒体查询。
- [x] 保留两个应用的基础 reset、字体、减少动态效果处理和各自页面背景职责。

验证点：Web 仍有温和环境背景，Admin 仍为纯背景；两个主题下情绪点、正文和边框可读。

## 6. 静态质量检查

按仓库规则依次执行，前一项通过后再执行下一项：

```bash
pnpm check-types
pnpm lint
pnpm format:check
```

若检查发现与本任务无关的既有错误，只记录，不修改无关文件。

## 7. 构建检查

```bash
pnpm --filter web build
pnpm --filter admin build
```

验证点：Tailwind 能扫描共享切换组件并生成完整样式；两个 Next.js 应用没有 server/client boundary 或 hydration 构建错误。

## 8. 浏览器检查

- [x] 启动 Web `http://localhost:6153` 与 Admin `http://localhost:6154`。
- [x] 检查 Web `/`、Web `/app`、Admin `/` 的 Latte 与 Mocha。
- [x] 检查约 390 x 844 移动端和 1440 x 900 桌面视口。
- [x] 通过切换、刷新、清空 storage 和写入无效 storage 值验证默认值与持久化。
- [x] 用键盘检查主题选项、主要链接和按钮的焦点顺序与焦点环。
- [x] 检查背景、正文、辅助文字、边框、Button、Card、Badge 和情绪色。
- [x] 检查控制台没有 hydration、React、CSS 或资源加载 warning/error。
- [x] 检查减少动态效果模式仍生效。

## 9. 任务完成处理

- [x] 使用 `trellis-update-spec` 更新 Web、Admin 与 UI 样式规范，把系统明暗媒体查询改为 Latte / Mocha 显式主题事实。
- [x] 按 Trellis 流程记录检查结果、提交代码并归档任务。

## 回滚点

- [x] 共享 CSS 三个文件作为一个回滚单元。
- [x] 主题运行时、首次脚本与两个布局作为一个回滚单元。
- [x] Web 首页、Web `/app` 与 Admin 首页的入口分别保持可独立回滚。
- [x] Web 专用颜色映射不得脱离共享 `--theme-*` 变量单独保留。

## 实施结果

- `pnpm check-types`、`pnpm lint`、`pnpm format:check` 通过。
- `pnpm --filter web build`、`pnpm --filter admin build` 通过。
- 浏览器检查覆盖 Web `/`、Web `/app`、Admin `/` 的 Latte、Mocha、移动端、桌面、刷新持久化、无效 storage、键盘焦点和减少动态效果。
- Web 与 Admin 控制台没有 hydration、React、CSS 或资源加载 warning/error。
- 修复应用全局 `a { color: inherit }` 覆盖 Tailwind utility 的问题；Latte 主按钮最终为 Blue 背景与 Base 文字。
