# Admin 质量检查

## 类型与数据

- API 请求和响应使用 `@repo/contracts`，不在页面重复定义 DTO。
- 后台可见字段由后台 contract 决定，不能复用用户端 DTO 后再靠 CSS 隐藏。
- 刷新后需要恢复的业务数据写入 API；筛选、展开、当前表单输入等 UI 状态留在前端。
- 不使用类型断言绕过未校验响应。

## 禁止写法

- 不 import `apps/api/src` 或 `apps/web`。
- 不在浏览器读取 LLM key、R2 key、数据库 ID 或 Workers binding。
- 不把仅 Admin 使用的业务组件提前移到 `packages/ui`。
- 不复制当前 `page.module.css` 中未使用的 starter selector。
- 不提前增加复杂角色系统；当前设计只区分普通用户和管理员。

## 验证

项目没有自动化测试脚本。修改 Admin 后依次运行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter admin build
```

页面改动还要手动检查 `http://localhost:6154` 的移动端和桌面布局、键盘焦点、浅色和深色模式。涉及登录或权限时分别验证未登录、普通用户和管理员路径。
