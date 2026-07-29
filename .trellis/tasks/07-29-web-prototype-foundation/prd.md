# 搭建 Web 原型视觉基础与应用外壳

## Goal

建立主题映射、全局样式、静态模型和可复用 IM 外壳组件。

## Requirements

- 以 `assets/moodmate.css` 和原型设计文档为样式依据，建立 Web 本地视觉 token。
- 复用 `ThemeScript`、`ThemeToggle`、`latte` / `mocha` 和 `moodmate-theme:v1`，不建立第二套主题状态。
- 建立可复用的应用外壳、72px 导航栏、头像、用户菜单、会话列表条目、资料栏和弹层基础组件。
- 共用组件只处理展示和 UI 状态，不读取业务 API。
- 保持 1100px、820px、640px 的原型响应式规则和 `prefers-reduced-motion`。
- Web 局部样式不能改变 Admin 或共享 UI 组件的主题表现。

## Acceptance Criteria

- [x] 原型暗色和亮色 token 分别映射到 Mocha 和 Latte。
- [x] 应用外壳支持 `default`、`has-info`、`no-list` 三种列布局。
- [x] 导航栏、头像、菜单、会话条目和弹层可供后续路由直接复用。
- [x] 390px 到 1440px 不出现固定列宽导致的横向溢出。
- [x] 类型、Lint、任务范围 Format 和 Web build 通过；全仓库 Format 的既有失败记录在 `implement.md`。

## Notes

- 本任务不接业务 API，不实现具体路由内容。
