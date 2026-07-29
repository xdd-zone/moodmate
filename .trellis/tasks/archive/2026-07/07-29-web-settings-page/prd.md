# 实现设置路由与静态面板

## Goal

按 settings.html 新增独立设置路由并复用已有记忆与配置能力。

## Requirements

- 新增独立 `/settings` 路由，按 `settings.html` 实现导航栏、设置菜单和内容区。
- 保留个人资料、记忆管理和主动关怀的现有 API 能力。
- 通用设置使用静态开关，页面内可切换但不伪造持久化。
- 外观面板使用现有 `ThemeToggle` 契约切换 Latte/Mocha，并显示与原型一致的主题预览卡。
- 用户菜单退出继续清除现有 session 并进入 `/`。
- 从原来的聊天组件 settings mode 移除重复入口，导航统一跳转 `/settings`。

## Acceptance Criteria

- [x] `/settings` 的三列布局和 5 个面板与原型一致。
- [x] 设置菜单切换后内容区回到顶部，当前项状态可被读屏识别。
- [x] 个人资料、记忆和主动关怀现有请求及错误状态没有回归。
- [x] 静态开关明确只影响当前页面，刷新不制造虚假已保存状态。
- [x] 主题切换、刷新持久化和首次绘制可用。
- [x] 类型、Lint、本次文件 Format 和 Web build 通过；全仓 Format 的 73 个既有文件问题经用户确认豁免。

## Notes

- 依赖 `07-29-web-prototype-foundation`；与聊天任务协调拆出原有 settings mode。
