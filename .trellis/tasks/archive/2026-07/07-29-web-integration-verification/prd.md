# 完成路由集成与视觉验收

## Goal

检查导航、响应式、主题、构建和原型视觉一致性。

## Requirements

- 集成全部子任务路由、导航和共用组件。
- 规范路由为 `/`、`/chats`、`/chats/[kind]/[id]`、`/friends`、`/friends/[id]`、`/settings` 和 `/auth/callback/github`。
- 旧 `/login`、`/app`、`/group-chats`、`/agents` 和 `/login/github/callback` 必须删除，不保留重定向或别名。
- 用原型静态页面作为视觉基准检查桌面首屏。
- 检查 Latte、Mocha、主题刷新持久化和减少动态效果。
- 检查 1440×900、1280×720、820×900、390×844。
- 检查主要交互、键盘焦点、控制台和缺失资源。
- 更新 `docs/apps/web-design.md`，使定位、路由、主题和验证命令与实现一致。

## Acceptance Criteria

- [ ] 所有规范路由可从页面内入口到达，没有原型 HTML 文件名或设计目录链接。
- [ ] 旧业务路径返回 404，源码中没有 redirect、rewrite、alias 页面或兼容组件。
- [ ] 各目标尺寸没有文字、按钮、列表、气泡或弹层重叠。
- [ ] 页面视觉与对应原型一致，差异只来自真实数据长度和明确静态状态。
- [ ] 控制台没有 hydration warning、运行错误和 404 素材请求。
- [ ] 根级类型、Lint、Format 按顺序通过，Web build 通过。
- [ ] `pnpm dev:web` 可在 6153 端口启动并完成浏览器检查。

## Notes

- 依赖其他 5 个子任务完成。
