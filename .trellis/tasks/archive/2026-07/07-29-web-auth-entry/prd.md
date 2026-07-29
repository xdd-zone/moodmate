# 实现首页与登录欢迎流程

## Goal

按 `login.html` 实现规范首页 `/` 和静态 GitHub 回调页，保留可直接接入新页面的邮箱登录能力。

## Requirements

- `/` 使用原型 `login.html` 的欢迎体验。
- 删除 `/login` 路由，不实现重定向或别名页面。
- 默认只显示欢迎文案和“进入 MoodMate”，点击后显示登录面板，Escape 和返回按钮回到欢迎页。
- 已登录用户访问 `/` 时跳转 `/chats`。
- 保留现有邮箱密码登录。
- GitHub 和 Google 登录保留原型按钮外观，但显示暂未开放，不发起请求。
- 使用现有主题切换，不复制原型 localStorage 脚本。
- `/auth/callback/github` 先实现静态说明页；删除旧 `/login/github/callback`，不修改 API 回调地址。

## Acceptance Criteria

- [x] `/` 首屏和 `login.html` 的布局、排版、颜色及装饰线一致。
- [x] `/login` 和 `/login/github/callback` 路由目录不存在，访问时返回 404。
- [x] 首屏没有直接显示邮箱、密码或 OAuth 按钮。
- [x] 点击主按钮后登录面板可见且焦点进入面板；返回和 Escape 恢复欢迎页。
- [x] 邮箱密码登录仍调用现有实现，错误信息可读，成功后进入 `/chats`。
- [x] GitHub 和 Google 登录明确显示暂未开放，不跳转。
- [x] `/auth/callback/github` 显示等待后续 API 接入的静态状态，不处理旧 ticket。
- [x] 桌面和移动端没有文本、按钮或页脚重叠。
- [x] 类型、Lint、本任务 Format 检查和 Web build 通过。

## Notes

- 依赖 `07-29-web-prototype-foundation`。
- 仓库级 `pnpm format:check` 仍被 70 个任务外既有文件阻塞。2026-07-29 经用户确认，本子任务按范围内 Prettier 检查通过提交和归档，不修改这些无关文件。
