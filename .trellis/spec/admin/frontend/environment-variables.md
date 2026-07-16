# Admin 环境变量

## 1. 适用范围

修改 Admin 的运行环境、API 地址或浏览器公开配置时使用本约定。目标是让错误配置在构建或页面渲染时停止，不在页面里提供默认地址。

## 2. 函数签名

```ts
getAdminServerEnv(): AdminServerEnv;
getAdminClientEnv(): AdminClientEnv;
```

实现位置是 `apps/admin/src/env/server.ts` 和 `apps/admin/src/env/client.ts`。页面调用 helper，不直接读取 `process.env`。

## 3. 变量合同

| 变量                  | 范围   | 约束                                |
| --------------------- | ------ | ----------------------------------- |
| `APP_ENV`             | 服务端 | `development`、`test`、`production` |
| `API_BASE_URL`        | 服务端 | 合法 URL，返回值不带末尾 `/`        |
| `NEXT_PUBLIC_APP_ENV` | 浏览器 | 与 `APP_ENV` 使用相同枚举           |

本地真实值放在 `apps/admin/.env.local`，仓库只提交 `.env.example`。`NEXT_PUBLIC_*` 不能填写密钥。

## 4. 校验与错误矩阵

| 条件               | 结果                                |
| ------------------ | ----------------------------------- |
| 枚举值非法         | Zod error 的 path 指向对应变量      |
| URL 缺失或格式错误 | Zod error 的 path 指向对应 URL 变量 |
| URL 末尾带 `/`     | 校验后移除末尾 `/`                  |

## 5. 正常、基础、错误案例

- 正常：三项变量完整，Next.js BFF 使用 `API_BASE_URL` 请求 Hono。
- 基础：`APP_ENV=development`，`API_BASE_URL` 指向本地 6155 端口。
- 错误：页面使用 `process.env.KEY ?? "http://localhost:6155"` 绕过校验。

## 6. 必做检查

- `pnpm check-types`：helper 类型和页面 import 通过。
- `pnpm --filter admin build`：合法 `.env.local` 可以完成静态页面生成。
- 浏览器 Network：认证和业务请求只访问 Admin origin。
- 客户端静态产物：不包含 `API_BASE_URL` 的值。

## 7. 错误与正确写法

```ts
// 错误：客户端组件直接读取外部 API 地址
fetch("http://localhost:6155/auth/admin/session");

// 正确：浏览器只请求 Admin 同源 BFF
http.get("/api/auth/session", AdminSessionSchema);
```
