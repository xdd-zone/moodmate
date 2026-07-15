# 环境变量设计

## 设计原则

1. 变量名表达业务语义，加载方式服从各运行时：Next.js 读 `process.env`，Cloudflare Worker 读 `c.env`。
2. 服务端变量和浏览器公开变量分开校验。`NEXT_PUBLIC_*` 会在构建时写入客户端代码，只能保存可公开值。
3. 必填配置缺失或格式错误时直接报错，不使用本地地址或 `development` 静默替代。
4. 统一的是键名和取值，不强行共享读取代码，也不让每个应用读取全部变量。

## 变量矩阵

| 变量                       | Web              | Admin  | API     | 公开性     | 说明                                              |
| -------------------------- | ---------------- | ------ | ------- | ---------- | ------------------------------------------------- |
| `APP_ENV`                  | 服务端           | 服务端 | `c.env` | 私有       | 业务环境：`development`、`test`、`production`     |
| `API_BASE_URL`             | 服务端           | 服务端 | 不使用  | 私有       | Next.js 服务端访问 API 的基础地址，可使用内部地址 |
| `NEXT_PUBLIC_APP_ENV`      | 客户端           | 客户端 | 不使用  | 公开       | 客户端确实需要按业务环境分支时读取                |
| `NEXT_PUBLIC_API_BASE_URL` | 客户端和公开链接 | 客户端 | 不使用  | 公开       | 浏览器可访问的 API 地址                           |
| `CORS_ORIGINS`             | 不使用           | 不使用 | `c.env` | 服务端配置 | 逗号分隔的允许来源列表                            |

`NODE_ENV` 由 Next.js 和工具链管理，不作为业务环境变量。`next dev` 仍使用 `NODE_ENV=development`；部署到联调环境时通过 `APP_ENV=test` 表达业务语义。

## 代码边界

```text
apps/web/.env*                 -> apps/web/src/env/server.ts -> Server Component / server request
                              -> apps/web/src/env/client.ts -> Client Component / browser URL

apps/admin/.env*               -> apps/admin/src/env/server.ts -> Server Component / server request
                                -> apps/admin/src/env/client.ts -> Client Component

wrangler vars / .dev.vars      -> Hono c.env -> apps/api/src/shared/env.ts -> middleware / service
```

Web 与 Admin 各自维护 server/client schema。server 文件可以读取 `APP_ENV`、`API_BASE_URL`；client 文件只能静态读取两个 `NEXT_PUBLIC_*` 键。两个文件都用 Zod `parse()` 返回已校验对象，调用方不能直接读取原始环境变量。

API 保留现有 `ApiBindings` 和 `getApiEnv()`。`ApiBindings` 描述 Worker binding，`getApiEnv()` 负责校验 `APP_ENV` 和解析 `CORS_ORIGINS`。Hono 官方约定通过 `new Hono<{ Bindings: ... }>()` 或项目现有 `ApiHonoEnv` 为 `c.env` 提供类型。

不创建共享 env package。一个共享读取函数无法同时处理 Next.js 编译期公开变量、Node.js 服务端变量和每次请求传入的 Worker bindings，反而会模糊 secret 边界。

## 校验策略

- `APP_ENV`、`NEXT_PUBLIC_APP_ENV`：只接受 `development`、`test`、`production`。
- URL：使用 Zod URL 校验，并在 schema 中统一去掉末尾 `/`，避免调用方重复处理。
- `CORS_ORIGINS`：按逗号拆分、去空格、过滤空项，再逐项校验 origin。production 不允许用“空列表代表任意来源”的隐式行为。
- 报错保留具体变量名，使本地启动和 CI 构建能直接定位缺失配置。

`APP_ENV` 的值集合在三个应用中会重复出现，但读取方式和错误处理不同。这里只统一约定，不把环境配置并入 API 响应 contract，也不为了三个短 schema 新建 package。

## 文件与加载规则

### Next.js

- 提交：`apps/web/.env.example`、`apps/admin/.env.example`。
- 本地真实配置：各应用的 `.env.local`。
- CI 和部署：由运行环境直接注入变量。
- `.gitignore` 保持 `.env*` 默认忽略，但显式允许 `.env.example`。

不把业务联调环境等同于 Next.js 的 `.env.test` 加载规则。Next.js 在 `NODE_ENV=test` 时才读取 `.env.test`，而正常 `next dev` 不进入这个模式。

### Cloudflare Workers

- 提交：`apps/api/.dev.vars.example` 和不含 secret 的 `wrangler.jsonc` 环境结构。
- 本地真实配置：`apps/api/.dev.vars`。
- 远端真实配置：Cloudflare 环境变量或 secret。
- development、test、production 用 Wrangler 默认环境和具名环境表达；具名环境的非继承变量要逐环境确认。

## Turborepo

在 `build`、`dev`、`lint`、`check-types` 的 `env` 中声明五个变量。`build.inputs` 已包含 `.env*`，继续保留。采用任务级 `env`，不使用 `globalEnv`，避免无关包的所有任务都因变量变化而失效。

## 兼容与迁移

- Web 首页改用校验后的公开 API URL，删除 `http://localhost:6155` 回退；本地未创建 `.env.local` 时应明确失败。
- API 从宽松回退改为严格校验前，先补齐 `.dev.vars.example` 和 Wrangler 环境结构，避免迁移后无法启动。
- `CORS_ORIGINS` 现有空值行为需要随远端来源配置一起调整，不能在不知道域名时写入占位域名。
- `zod` catalog 已存在，只给 Web、Admin 增加 `catalog:` 依赖。

## 回退方式

实施按应用分步完成。某一步验证失败时，只回退该应用的 env 入口、调用点和示例文件；不要恢复页面硬编码地址。若远端域名仍未知，保留示例和部署说明，推迟具名环境的真实 URL/CORS 值。
