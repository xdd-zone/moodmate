# 改造 MoodMate 后台登录页

## 目标

把 Open Design 项目中的后台登录页落实到现有 `apps/admin` Next.js 应用，同时保留已经可用的管理员认证流程、主题切换和跳转行为。

## 已确认事实

- 设计来源是 Open Design 项目 `68eedb2d-69da-46ab-94d4-971a9ba8c6b1` 的 `admin-login.html`、`admin-shared.css` 和 `brand-spec.md`。
- 设计稿是静态 HTML，不包含独立 `package.json`；可运行工程是仓库中的 Next.js 16 / React 19 应用 `apps/admin`。
- 目标用户是反复查看和管理 MoodMate 数据的管理员，页面气质是安静、中性、紧凑。
- 现有 `LoginForm` 已通过 `loginAdmin()` 调用同源认证 BFF，成功后更新 session Query 并跳转 `/`。
- 登录组件和共享 `ThemeMenu` 存在未提交修改，本任务必须保留这些修改并在其基础上实现。

## 需求

1. 登录页复现设计稿的三段式结构：顶部品牌栏、居中的双栏主体、底部状态栏。
2. 桌面端保留左侧说明、三个管理模块索引和右侧登录面板；窄屏改为单列，手机端隐藏模块索引。
3. 保留设计稿中的背景大写字母 `M`、Maple Mono 字体、Latte / Mocha 主题语义色、紧凑圆角和边框层级。
4. 顶部继续使用现有 `ThemeMenu`，主题在 Latte 与 Mocha 间切换并刷新后保留。
5. 表单包含管理员邮箱、密码、密码显示切换、字段说明、提交加载态和认证错误提示。
6. 邮箱使用 `type=email`、`inputMode=email`、`autoComplete=username`；密码使用 `autoComplete=current-password`，长度限制为 8 到 128 个字符。
7. 提交继续调用现有 `loginAdmin()`；成功后写入现有 session Query cache 并跳转 `/`，失败时显示现有错误解析结果。
8. 加载期间禁用输入框、密码切换按钮和提交按钮，避免重复提交。
9. 键盘焦点、错误提示、按钮名称和密码可见状态必须具有可访问语义；主要触控目标在移动端至少 44px。
10. 不修改认证 BFF、cookie、API contract、dashboard 页面或 Open Design 原始文件。

## 验收标准

- [x] `http://localhost:6154/login` 的桌面布局与 `admin-login.html` 的品牌栏、双栏主体、登录面板和底部状态栏一致。
- [x] 860px 以下切换为单列；560px 以下模块索引隐藏，文本、表单和页脚无重叠或横向滚动。
- [x] Latte 和 Mocha 下文字、边框、面板、按钮与背景字母均清晰，刷新后保留主题。
- [x] 密码显示按钮可切换输入类型，同时更新图标、`aria-label` 和 `aria-pressed`。
- [x] 空邮箱、无效邮箱及 8 到 128 字符之外的密码会触发浏览器约束；服务端认证错误在表单中可见。
- [x] 登录请求期间控件禁用，提交按钮显示加载状态；成功后仍跳转到 `/`。
- [x] 只修改本任务直接相关文件，不覆盖当前工作区的其他未提交内容。
- [x] 依次通过 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter admin build`。
- [x] 在桌面与手机视口手动检查 `/login`，并检查键盘焦点、Latte、Mocha 和减少动态效果模式。

## 不在范围内

- 新增第三种主题、忘记密码流程、验证码、注册入口或单点登录。
- 修改邮箱支持地址、后台业务模块、认证接口或登录后的权限逻辑。
- 重构共享 UI 组件或清理与登录页无关的现有代码。
