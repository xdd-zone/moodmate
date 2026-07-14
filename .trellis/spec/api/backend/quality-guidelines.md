# API 质量检查

## 类型和边界

- Hono 实例使用 `Hono<ApiHonoEnv>`，参考 `apps/api/src/bootstrap/create-app.ts` 和 `apps/api/src/routes/index.ts`。
- service 返回 contracts 中的响应类型，参考 `getRootInfo()`、`getHealthStatus()` 和 `getPingResult()`。
- route 从 `c.req.valid()` 读取经过 Zod 校验的数据，不对原始 JSON 使用类型断言。
- `AppType` 继续从 `apps/api/src/app.ts` 导出；普通业务调用默认采用 contracts + typed HTTP。

## 禁止写法

- 不在 route 里写 SQL、拼 LLM prompt 或读取 secret。
- 不在 repository 中拼 API 响应。
- 不在浏览器应用里 import `apps/api/src`。
- 不把数据库 record、Workers binding 或 Hono context 放进 `@repo/contracts`。
- 当前没有数据库和日志基础设施，不新增空的 database、logging 指南或占位实现。

## 修改顺序

接口路径、请求或响应发生变化时，按下面顺序检查：

```text
packages/contracts/src/<module>
  -> packages/contracts/src/index.ts
  -> apps/api/src/modules/<module>
  -> apps/api/src/routes/index.ts
  -> apps/web/src/api 或 apps/admin/src/api
```

相关事实来源：`docs/apps/api.md`、`docs/architecture.md`、`apps/api/src/modules/system/system.route.ts`。

## 验证

项目目前没有测试脚本。修改 API 或 contracts 后按顺序运行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
```

需要手动检查服务时运行 `pnpm dev:api`，访问 `http://localhost:6155/health`。
