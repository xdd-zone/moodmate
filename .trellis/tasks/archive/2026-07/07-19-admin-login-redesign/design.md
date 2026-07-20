# 技术设计

## 实现边界

主要改动放在 `apps/admin/src/components/auth/login-form.tsx`。页面路由仍由 `apps/admin/app/(auth)/login/page.tsx` 渲染 `LoginForm`，根布局继续提供 Maple Mono、`ThemeScript` 和 `QueryProvider`。

设计稿的专用布局优先用 Tailwind 4 和现有语义 token 表达。只有 Tailwind 无法清楚表达的登录页伪元素或响应式细节，才在 `apps/admin/app/globals.css` 增加带 `admin-login-` 前缀的局部样式，避免影响 dashboard。

## 组件与状态

- `LoginForm` 保持客户端组件，因为它需要表单事件、密码可见状态、认证错误状态和 `useTransition`。
- 顶部主题切换复用当前未提交的 `@repo/ui/theme-menu`，不再实现第二套主题存储或键盘菜单逻辑。
- 表单继续复用 `@repo/ui` 的 `Button`、`Input` 和 `Alert`；登录面板可使用共享 `Card`，但通过类名准确设置设计稿尺寸与分区。
- 密码切换使用 `lucide-react` 的 `Eye` / `EyeOff`；提交按钮使用 `ArrowRight` 和加载图标。图标只通过直接 import 引入。

## 数据流

1. 用户提交原生表单。
2. 浏览器约束先校验邮箱格式和密码长度。
3. `startTransition()` 内调用现有 `loginAdmin({ email, password })`。
4. 成功后写入 `adminSessionQueryKey`，执行 `router.replace("/")` 与 `router.refresh()`。
5. 失败后通过 `getErrorMessage()` 生成表单级错误，不改变 BFF contract。

密码可见状态只改变输入框 `type`、图标和可访问属性，不进入请求参数之外的持久化状态。

## 兼容性与风险

- 保留当前工作区对 `ThemeMenu` 的引入，避免覆盖用户已有修改。
- 不改全局主题 token；页面只使用 `background`、`surface`、`foreground`、`muted`、`border`、`primary` 等现有语义类。
- 大背景字母不接受鼠标事件，也不进入可访问树。
- 小屏布局使用固定断点与稳定 grid 轨道，避免表单加载态或错误文本导致横向溢出。
- 若共享组件的默认 padding 与设计稿不一致，仅在调用处覆盖，不修改共享组件默认值。

## 回退方式

实现集中在登录组件及必要的登录页局部样式。若视觉验证失败，只回退本任务新增的登录布局类和 JSX，不回退当前工作区原有的 `ThemeMenu` 修改。
