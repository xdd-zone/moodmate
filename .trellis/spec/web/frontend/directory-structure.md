# Web 目录与数据边界

`apps/web` 是用户端 Next.js App Router 应用。当前已经实现公开首页和应用入口，业务请求层尚未建立。

## 页面目录

- `app/(site)/`：公开页面。当前 `/` 在 `app/(site)/page.tsx`。
- `app/(app)/`：登录后的应用页面。当前 `/app` 在 `app/(app)/app/page.tsx`。
- `app/(auth)/`：登录和回调，需要实现鉴权时再创建。
- `app/layout.tsx`：Maple Mono、本地字体、全局 metadata 和 HTML 语言。
- `app/globals.css`：Tailwind 4 入口、设计 token 和基础样式。

路由组只组织页面，不改变 URL。不要把公开首页和应用页面重新合并到根 `app/page.tsx`。

## 业务代码目录

`docs/architecture.md` 规定后续业务代码放在：

```text
apps/web/src/
├── api/          # typed HTTP 请求函数
├── auth/         # 用户端 session 和登录动作
├── components/   # Web 业务组件
├── lib/          # http、日期、格式化和小工具
└── providers/    # 全局 Provider
```

这些目录当前还不存在。第一次增加业务请求时先建立统一 `http` 和 `src/api`，不要让页面各自直接写 `fetch()`。

## 依赖方向

- Web 可以 import `@repo/contracts` 和 `@repo/ui`。
- Web 不能 import `apps/api/src`、Admin 业务组件、数据库代码或 Workers binding。
- 只有 Web 使用的组件留在 `apps/web/src/components`；Web 和 Admin 都使用且不含业务规则的组件才移到 `packages/ui`。
- 刷新后需要恢复的业务数据写入 API；React state、表单草稿和请求缓存只保存 UI 状态。
