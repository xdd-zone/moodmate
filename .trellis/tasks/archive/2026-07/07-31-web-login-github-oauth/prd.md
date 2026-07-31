# 复刻 Web 登录页并接入 GitHub 登录

## Goal

让 `apps/web` 的首页登录流程忠实还原 Open Design `login.html`，并恢复 API 已实现的 GitHub OAuth 登录。用户可以继续使用邮箱密码，也可以通过 GitHub 授权后进入 `/chats`。

## Background

- 原型目录是 `/Users/wuwanzhu/Library/Application Support/Open Design/namespaces/release-stable/data/projects/5eacec88-a8bf-47bc-9795-da9afcf96465`，登录页基准文件是 `login.html`。
- 正式实现仓库是 `/Users/wuwanzhu/Code/xdd/moodmate`。Web 应用使用 Next.js 16、React 19、TypeScript、App Router、pnpm workspace 和 Turborepo。
- 当前首页已有欢迎页、邮箱登录和主题切换，但登录面板没有采用原型的“邮箱登录 / GitHub / Google”分段切换，标题、间距、密码显隐和按钮状态也与原型不同。
- API 已实现 `GET /auth/web/github/authorize`、`GET /auth/web/github/callback` 和 `POST /auth/web/github/ticket/login`，共享合同也已经存在。
- API callback 固定把浏览器送回 Web 的 `/login/github/callback`。当前 Web 删除了该路由，只保留不处理参数的 `/auth/callback/github` 静态页，因此 GitHub 登录无法完成。
- 历史提交 `72b3f97` 中存在可复用的 typed API、OAuth state 保存和 ticket 换登录态实现；恢复时需要把成功跳转从旧 `/app` 改为当前 `/chats`。

## Requirements

- 保留首页两阶段流程：首屏只显示欢迎内容，点击“进入 MoodMate”后显示登录面板；Escape 和“返回”恢复欢迎页。
- 登录面板按原型实现标题、说明、分段切换器、邮箱表单、第三方登录列表、条款说明和安全登录页脚。
- 分段切换器默认选中邮箱登录，支持点击和左右方向键切换，使用正确的 tab / tabpanel 语义。
- 邮箱登录继续调用现有 `loginWeb`，保留合同校验、字段错误、请求错误和成功进入 `/chats` 的行为。
- 密码输入增加显示与隐藏按钮，按钮文案、图标、焦点和输入类型随状态变化。
- GitHub 按钮调用 typed API 获取授权 URL，把返回的 state 保存到 `sessionStorage`，再跳转 GitHub。
- GitHub callback 校验 URL state 与 `sessionStorage` 中保存的值，再使用 ticket 调用 API 创建 MoodMate 登录态；成功后进入 `/chats`。
- callback 处理 GitHub 拒绝授权、缺少 ticket、state 不匹配、ticket 无效或已过期、API 请求失败和 React Strict Mode 重复 effect。
- Google 按钮保留原型外观，但不发起接口请求；点击后显示“暂未开放”的可读说明。
- 登录请求执行期间禁用会重复提交或切换状态的控件，按钮显示具体进度，失败后允许重试。
- 继续使用现有 Latte / Mocha 主题、`ThemeToggle`、Maple Mono 和语义 token，不复制原型的主题脚本或固定色值。
- 视觉细节以原型在浏览器中的实际渲染为准，覆盖 1440×900、1280×720 和 390×844，并检查两种主题和减少动态效果模式。
- 只修改 Web 登录流程和相关 Web 规范，不改 API、数据库、contracts、Admin 或其他业务页面。

## Acceptance Criteria

- [x] `/` 欢迎页的导航、装饰线、文案、主按钮和页脚与原型一致，桌面端和移动端无重叠或横向滚动。
- [x] 点击“进入 MoodMate”后出现原型登录面板，焦点进入首个邮箱控件；Escape 和“返回”恢复欢迎页并把焦点还给主按钮。
- [x] 登录面板的分段切换器、标题、邮箱输入、密码显隐、提交按钮、GitHub / Google 按钮、条款和页脚与原型一致。
- [x] 分段切换器支持鼠标、键盘左右方向键和正确的焦点顺序；未选中的面板不能被操作。
- [x] 邮箱登录成功后进入 `/chats`；字段校验和 API 失败显示具体中文错误。
- [x] GitHub 登录从 authorize URL 开始，callback 校验 state，ticket 只兑换一次，成功后保存现有 Web session 并进入 `/chats`。
- [x] GitHub 配置缺失、授权取消、callback 参数缺失、state 不匹配和 ticket 失败均显示可重试状态，不创建错误登录态。
- [x] Google 按钮不发请求，并明确显示尚未开放。
- [x] `/login/github/callback` 处理真实 OAuth 结果；旧静态 `/auth/callback/github` 被移除，避免两个不一致的入口。
- [x] Latte、Mocha、减少动态效果模式以及 1440×900、1280×720、390×844 三个视口通过浏览器检查，控制台没有新增错误或 hydration warning。
- [x] 依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter web build`。

## 验证说明

- 已检查 GitHub authorize 请求会跳转到 GitHub，callback 页面和错误分支可以访问，旧 `/auth/callback/github` 返回 404。
- 未使用真实 GitHub 账号确认授权，因此没有执行“GitHub 授权同意 -> API callback -> ticket 兑换 -> `/chats`”的外部完整流程。该流程仍需要可用的 GitHub OAuth 配置和用户授权。

## Out of Scope

- Google OAuth。
- 修改 GitHub OAuth API、D1 migration、共享合同或环境变量名称。
- 创建真实 GitHub OAuth App、填写本机 secret 或配置生产环境。
- 修改 Web session 的 `localStorage` 保存方式。
- 调整登录之外的聊天、朋友和设置页面。

## Notes

- 本任务沿用 API 当前 callback 地址 `/auth/web/github/callback` 和 Web 返回地址 `/login/github/callback`，不引入第二套 OAuth 流程。
