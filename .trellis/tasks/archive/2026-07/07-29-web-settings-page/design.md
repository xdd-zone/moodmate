# 技术设计

- 新增 settings guard，复用 `readClientSession` 和用户资料读取方式；session 失效时进入 `/`。
- 复用现有 `settings-panels.tsx` 的 Profile、Memory、Care、General 和 Appearance 业务逻辑，调整容器与标题，不复制请求。
- 当前面板状态保存在 React state；不引入 URL query 或全局状态。
- 静态开关只保存组件状态，并在说明中标明功能尚未接入。
- 外观选择调用共享主题 API，不直接读写 localStorage。
