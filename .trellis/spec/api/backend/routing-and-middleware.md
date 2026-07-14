# API 路由与中间件

## 应用组装顺序

`apps/api/src/bootstrap/create-app.ts` 是唯一的应用组装位置。当前顺序是 request context、安全响应头、CORS、错误处理、not found、业务路由。新增全局中间件时在这里注册，并检查它依赖的上下文字段是否已先写入。

中间件保持为 `registerXxx(app)` 函数，文件名使用 `<name>.middleware.ts`。现有例子：

- `middleware/request-context.middleware.ts`
- `middleware/secure-headers.middleware.ts`
- `middleware/cors.middleware.ts`

## 路由写法

业务路由导出 `create<Module>Route()`，用链式 Hono API 保留路由类型。`apps/api/src/modules/system/system.route.ts` 是当前参考实现。

```ts
return new Hono<ApiHonoEnv>().post(
  "/rpc/system/ping",
  zValidator("json", PingRequestSchema, (result) => {
    if (result.success) return;
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      "请求参数无效",
      400,
      result.error.issues,
    );
  }),
  (c) => {
    const payload = c.req.valid("json");
    return c.json(
      buildSuccess(
        getPingResult(c.env, payload.name),
        createMeta(c.var.requestId),
      ),
    );
  },
);
```

route 只负责 URL、HTTP method、请求校验、读取上下文、调用 service 和生成 Hono response。业务计算放到 service。

## 路由挂载

- 模块的 `index.ts` 只导出路由工厂。
- 一级挂载集中在 `apps/api/src/routes/index.ts`。
- `ApiRoutesType` 使用 `ReturnType<typeof createRoutes>` 推导，不手写路由类型。
- `apps/api/src/app.ts` 把 `ApiRoutesType` 作为 `AppType` 导出。

## CORS 和安全响应头

- CORS 来源从 `getApiEnv()` 的 `CORS_ORIGINS` 读取。
- 允许的 header 和 method 集中在 `cors.middleware.ts`，不要在单个 route 重复设置。
- 安全响应头集中在 `secure-headers.middleware.ts`。
- 修改跨域或响应头行为时手动检查预检请求和错误响应是否仍包含预期 header。
