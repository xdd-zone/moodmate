# Admin 页面与组件

## 组件边界

页面默认使用服务端组件。只有浏览器事件、React state、表单交互或本地存储需要时才加 `"use client"`，并把客户端范围限制在交互组件。

后台组件按业务职责放置：

- route page 负责读取路由参数和组合页面区域。
- `src/api` 负责 typed HTTP 请求。
- `src/components` 负责后台布局、表格、筛选器和表单。
- `src/auth` 负责管理员 session 和登录动作。

不要在页面组件里同时处理鉴权、请求拼装、表格状态和响应字段转换。

## React 表单事件

不要在函数式状态更新器中直接读取 `event.currentTarget`。React 退出事件回调后会把 `currentTarget` 置空，延后执行的更新器可能因此抛出运行时错误。进入更新器前先保存元素或字段值。

```tsx
// 错误：更新器执行时 event.currentTarget 可能已经是 null
setErrors((current) => ({
  ...current,
  email: validateEmail(event.currentTarget),
}));

// 正确：先保存需要读取的元素
const input = event.currentTarget;
setErrors((current) => ({
  ...current,
  email: validateEmail(input),
}));
```

提交按钮触发校验后，浏览器可能把同步设置的焦点留在按钮上。需要聚焦首个错误字段时，在错误状态写入后用 `requestAnimationFrame()` 聚焦对应输入框，并检查 `document.activeElement`。

## 表单校验复用 contract schema

字段格式规则只写在 contract 的 zod schema 里，页面校验直接调用 schema，不把正则复制到组件。复制出来的正则在 contract 改规则后不会跟着变，前端放行的值会被服务端拒绝。

```ts
// 错误：把 contract 里的正则复制到组件常量
const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_]*$/;
if (!ROLE_CODE_PATTERN.test(trimmedCode)) { ... }

// 正确：单字段校验取 schema 的对应 shape
if (!RoleCreateRequestSchema.shape.code.safeParse(trimmedCode).success) { ... }
```

需要整体校验时对整个 payload 调 `safeParse`，错误文案可以在页面层自定义，规则本身不重复定义。

## 管理端与用户端分离

- Admin 登录和 Web 登录使用不同入口与 session。
- 后台 route、contract 和 presenter 与用户端分开，不能只靠前端隐藏字段。
- 不复用 Web 的 `MoodEntryCard`、Agent 会话面板等业务组件。
- `@repo/ui` 只提供无业务请求、无权限判断的通用组件。

## 当前参考

当前 `apps/admin/app/page.tsx` 只提供管理入口和 API 健康检查，不是 dashboard 结构模板。视觉规则看 `docs/apps/admin-design.md`，目录和数据边界看 `docs/architecture.md`；首次实现 dashboard 时应同时建立真实页面结构和对应 spec 补充。
