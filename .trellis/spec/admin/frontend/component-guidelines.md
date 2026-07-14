# Admin 页面与组件

## 组件边界

页面默认使用服务端组件。只有浏览器事件、React state、表单交互或本地存储需要时才加 `"use client"`，并把客户端范围限制在交互组件。

后台组件按业务职责放置：

- route page 负责读取路由参数和组合页面区域。
- `src/api` 负责 typed HTTP 请求。
- `src/components` 负责后台布局、表格、筛选器和表单。
- `src/auth` 负责管理员 session 和登录动作。

不要在页面组件里同时处理鉴权、请求拼装、表格状态和响应字段转换。

## 管理端与用户端分离

- Admin 登录和 Web 登录使用不同入口与 session。
- 后台 route、contract 和 presenter 与用户端分开，不能只靠前端隐藏字段。
- 不复用 Web 的 `MoodEntryCard`、Agent 会话面板等业务组件。
- `@repo/ui` 只提供无业务请求、无权限判断的通用组件。

## 当前参考

当前 `apps/admin/app/page.tsx` 只提供管理入口和 API 健康检查，不是 dashboard 结构模板。视觉规则看 `docs/apps/admin-design.md`，目录和数据边界看 `docs/architecture.md`；首次实现 dashboard 时应同时建立真实页面结构和对应 spec 补充。
