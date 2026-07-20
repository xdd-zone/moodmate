# 实施计划

## 实现

- [x] 读取 `trellis-before-dev`，确认 Admin 前端与登录认证规范。
- [x] 在 `LoginForm` 中迁移设计稿的顶部品牌栏、双栏主体、模块索引、登录面板和底部状态栏。
- [x] 复用现有 `ThemeMenu`、认证请求、Query cache 更新和成功跳转。
- [x] 增加密码显示切换、设计稿字段属性、加载图标和可访问状态。
- [x] 仅在确有需要时为登录页增加局部全局样式，不修改主题 token。
- [x] 检查改动范围，确认没有覆盖其他未提交内容。

## 验证

- [x] 运行 `pnpm check-types`。
- [x] 运行 `pnpm lint`。
- [x] 运行 `pnpm format:check`；只格式化本任务改动文件。
- [x] 运行 `pnpm --filter admin build`。
- [x] 启动 `pnpm dev:admin`，检查 `http://localhost:6154/login`。
- [x] 在桌面和手机视口检查布局、文字溢出和控件尺寸。
- [x] 检查 Latte、Mocha、主题持久化、键盘焦点和减少动态效果模式。
- [x] 检查密码可见切换、字段约束、加载禁用态和认证错误提示。

## 检查与完成

- [x] 运行 `trellis-check`，核对任务需求、规范和质量检查结果。
- [x] 判断是否需要用 `trellis-update-spec` 记录新约定；已记录 React 表单事件的 `currentTarget` 生命周期和错误字段聚焦规则。
- [ ] 提交本任务改动，记录会话进度并归档任务。
