# Admin BFF 与登录态实施

1. 使用 `trellis-before-dev` 读取 Admin、contracts 和跨层规范。
2. 将浏览器 HTTP 基地址改为同源相对路径，保留 server-only `API_BASE_URL`。
3. 实现 server-only Hono client、cookie helper 和 Origin 校验。
4. 实现 login、session、refresh 和 logout Route Handler。
5. 实现 safe session query/state，不保存 token。
6. 实现只针对 `AUTH.ACCESS_EXPIRED` 的 single-flight refresh 和单次重试。
7. 实现 `/login` 页面和登录表单。
8. 保护 Admin 根页面并加入 logout 命令。
9. 新增无网络调用的 `proxy.ts` 和精确 matcher。
10. 启动 6154/6155，验证登录、页面刷新、并发 401、refresh 失败和 logout。
11. 检查浏览器 Network、Cookies、React Query state 和页面源码中没有 token 泄漏。
12. 运行 `trellis-check`，再依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check`。
13. 通过 `trellis-update-spec` 记录 Admin BFF、cookie 和 refresh helper 规则。

关键回滚点：未通过 token 泄漏检查前，不执行父任务最终验收。
