# 课程方案与当前仓库差异

## 课程中的可用原则

- `APP_ENV` 表示业务环境，不能与 `NODE_ENV` 混用。
- Next.js 服务端读取普通变量，浏览器只能读取 `NEXT_PUBLIC_*`。
- Cloudflare Worker 通过 Hono `c.env` 读取 binding。
- 环境变量应在固定入口校验，不在页面和业务模块中散落读取。
- Turbo 任务需要声明会影响执行结果的环境变量。
- 仓库只提交不含 secret 的示例文件，真实值留在本地文件或部署平台。

## 已经完成的内容

- `pnpm-workspace.yaml` 已声明 `zod: ^4.1.13`，`packages/contracts` 已使用 `zod: catalog:`。
- `apps/api/src/shared/env.ts` 已集中解析 `APP_ENV`、`CORS_ORIGINS`。
- `apps/api/src/shared/hono-env.ts` 已定义 Hono `Bindings` 和 `Variables`。
- API route 和 middleware 已通过 `getApiEnv(c.env)` 读取环境配置。

这些内容不能按课程重复实现。任务只补缺失能力，并在现有入口上收紧校验。

## 仍需处理的内容

- `apps/web/app/(site)/page.tsx` 仍直接读取 `process.env.NEXT_PUBLIC_API_BASE_URL`，并带本地地址回退。
- Admin 没有环境变量入口。
- API 的非法 `APP_ENV` 会静默回退到 `development`，`wrangler.jsonc` 没有实际环境配置。
- `turbo.json` 没有 `env` 声明。
- Web、Admin 忽略所有 `.env*`，没有允许提交的 `.env.example`。
- 三个应用没有成套的示例配置和一致说明。

## 与课程不同的设计决定

- 不新增共享 env package。Next.js 和 Worker 的读取时机、数据来源、公开边界不同。
- API 不定义 `API_BASE_URL` 或 `NEXT_PUBLIC_*`，因为 API 不访问自己，也没有浏览器 bundle。
- 保留现有 `CORS_ORIGINS`，把它纳入环境设计，而不是只实现课程列出的四个变量。
- 不新增课程示例里的环境徽标。环境变量只服务现有页面链接、请求和运行配置。
- 不新增仓库当前没有的 `build:test`、`dev:test`、`start:test` 脚本。
- 不把 `.env.test` 当成 Next.js 联调启动文件。联调环境仍用 `APP_ENV=test`，真实值由部署环境注入。

## 项目依据

- `.trellis/spec/api/backend/error-handling.md`：Worker 原始 binding 只在 `apps/api/src/shared/env.ts` 解析。
- `.trellis/spec/web/frontend/quality-guidelines.md`：环境变量只在明确边界读取。
- `.trellis/spec/admin/frontend/quality-guidelines.md`：浏览器不能读取服务端 secret 或 Worker binding。
- `docs/architecture.md`：API 当前配置字段是 `APP_ENV`、`CORS_ORIGINS`。
- Hono 本地官方参考：Cloudflare bindings 通过 `c.env.BINDING_KEY` 读取，并用 `Hono<{ Bindings: ... }>` 提供类型。

## 历史记录

过去的 API 架构讨论已经决定 Worker 环境变量从 `c.env` 读取，不使用 `process.env`。当前源码和 Trellis spec 已落实该决定，本任务继续沿用。
