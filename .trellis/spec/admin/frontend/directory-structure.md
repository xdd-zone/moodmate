# Admin 目录与边界

`apps/admin` 是管理后台 Next.js App Router 应用，默认端口 `6154`。当前只有 `app/page.tsx` 基础首页，尚未建立鉴权、dashboard 和请求层。

## 目标目录

开始后台业务功能时按 `docs/architecture.md` 建立：

```text
apps/admin/
├── app/
│   ├── (auth)/
│   └── (dashboard)/
└── src/
    ├── api/
    ├── auth/
    ├── components/
    └── lib/
```

`(dashboard)` 下按业务域放页面，例如 `users/`、`agent-templates/`、`moderation/`、`llm-settings/` 和 `system/`。不要把所有后台功能堆到一个 `page.tsx`。

## 依赖边界

- Admin 可以 import `@repo/contracts` 和 `@repo/ui`。
- Admin 不能 import `apps/api/src` 或 `apps/web` 的业务组件。
- 页面不直接写数据库或读取服务端 secret。
- Admin 专用表格、表单和布局留在 `apps/admin/src/components`；两个前端应用都使用且不含权限判断的组件才进入 `packages/ui`。
- 第一次增加 API 请求时建立统一 HTTP helper 和 `src/api`，页面不直接散落 `fetch()`。

## 当前状态

`app/layout.tsx` 已配置 Maple Mono，但 metadata 和 `lang="en"` 仍是 starter 内容；`page.module.css` 也保留大量 starter 选择器。实现第一块后台页面时应在任务范围内替换相关内容，不把 starter 写法当作项目约定继续复制。
