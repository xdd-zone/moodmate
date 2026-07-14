# Contracts 边界与检查

## 包职责

`@repo/contracts` 可以包含：

- Zod 请求 schema 和由 schema 推导的类型。
- 响应 DTO、统一响应类型和业务错误码。
- 不依赖运行环境的构造函数，如 `buildSuccess()`。

不能包含：

- D1 record、repository 或 service 内部类型。
- React props、表格选中状态或浏览器缓存结构。
- `fetch()`、Hono app、数据库客户端、DOM 和环境变量读取。
- 只被单个实现文件使用的私有类型。

源码依据是 `docs/architecture.md` 的 `packages/contracts` 和依赖方向章节；当前 `package.json` 的运行依赖只有 Zod。

## 修改顺序

接口变化按这个顺序处理：

```text
contract schema 和 DTO
  -> src/index.ts 导出
  -> API route/service
  -> Web/Admin 请求函数和页面
  -> 相关 API 文档
```

不要先改 route 再补类型，避免前后端各自定义一份临时协议。

## 验证

项目没有测试脚本。至少运行：

```bash
pnpm --filter @repo/contracts check-types
pnpm --filter @repo/contracts lint
pnpm --filter @repo/contracts format:check
```

跨包接口改动完成后仍需运行根目录的 `pnpm check-types`、`pnpm lint` 和 `pnpm format:check`。
