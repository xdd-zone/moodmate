# 执行计划

- [x] 增加 Web 局部主题 token、字体、基础样式和响应式规则。
- [x] 实现应用外壳和导航栏。
- [x] 实现头像、菜单、会话条目、资料栏和弹层基础组件。
- [x] 增加静态展示类型和原型占位数据。
- [x] 运行类型、Lint、任务范围 Format 和 Web build。

## 验证结果

- `pnpm check-types` 通过。
- `pnpm lint` 通过。
- `pnpm --filter web format:check` 通过。
- `pnpm exec prettier --check .trellis/tasks/07-29-web-prototype-foundation` 通过。
- `pnpm --filter web build` 通过。
- `pnpm format:check` 仍报告 69 个本任务开始前已有的 `.pi`、历史任务、spec 和 workspace 文件；本任务没有修改这些文件。
