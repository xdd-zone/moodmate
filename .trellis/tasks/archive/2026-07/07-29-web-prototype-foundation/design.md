# 技术设计

- Web 原型样式放在 `apps/web` 内，通过页面根 class 限定作用域。
- 主题值由根节点 `data-theme="latte|mocha"` 驱动，Web 局部变量保存原型精确色值。
- 共用 React 组件放在 `apps/web/src/components/moodmate/`，静态演示数据和类型放在同一业务目录，不进入 `packages/ui`。
- 交互组件保持小型 client boundary；纯头像、会话条目和布局容器可保持无状态。
