# 设计项目环境变量

## 目标

参考课程材料，为 `apps/web`、`apps/admin` 和 `apps/api` 建立一致的环境语义、运行时读取边界、校验方式与配置文件约定。缺失或错误配置应在应用启动或构建阶段直接报错，页面和业务代码不再提供硬编码回退值。

## 当前事实

- Web 首页直接读取 `NEXT_PUBLIC_API_BASE_URL`，未配置时回退到 `http://localhost:6155`。
- Admin 尚未读取环境变量。
- API 通过 `c.env` 读取 `APP_ENV` 和 `CORS_ORIGINS`，并集中在 `apps/api/src/shared/env.ts` 解析；缺失或非法的 `APP_ENV` 当前会回退到 `development`。
- `zod` 已由 `pnpm-workspace.yaml` 的 catalog 管理，`packages/contracts` 已使用它，不能重复做课程里的依赖版本整理。
- `turbo.json` 尚未声明任务使用的环境变量。
- Web 和 Admin 的 `.gitignore` 会忽略全部 `.env*`，当前没有可提交的 `.env.example`。
- 仓库没有 test、production 环境的真实域名和 CORS 来源配置。

## 需求

### R1. 环境语义

- 业务环境统一使用 `APP_ENV=development | test | production`。
- `APP_ENV` 与 Next.js 的 `NODE_ENV` 分开；`test` 表示项目的联调环境，不要求把 `next dev` 的 `NODE_ENV` 改成 `test`。
- Next.js 公开变量使用 `NEXT_PUBLIC_` 前缀，secret 和仅服务端使用的值不能进入客户端 bundle。

### R2. 变量范围

- Web 和 Admin 服务端使用 `APP_ENV`、`API_BASE_URL`。
- Web 和 Admin 客户端只使用 `NEXT_PUBLIC_APP_ENV`、`NEXT_PUBLIC_API_BASE_URL`。
- API 使用 Worker bindings 中的 `APP_ENV`、`CORS_ORIGINS`，不读取 `process.env`，也不定义无用途的 `API_BASE_URL` 或 `NEXT_PUBLIC_*`。
- 三端统一变量语义，但只读取各自运行时真正需要的键。

### R3. 集中校验

- Web 和 Admin 分别提供 server/client 环境变量入口，使用 Zod 校验并导出推导类型。
- API 保留现有 `apps/api/src/shared/env.ts` 边界，把 `APP_ENV` 改为严格校验，同时保留 `CORS_ORIGINS` 的集中解析。
- 环境变量使用 `process.env.KEY` 或 `c.env.KEY` 直接读取，不解构整个 `process.env`，不在页面、组件、route 或 service 中散落解析逻辑。
- 不新建共享 env package。三个应用的运行时和公开边界不同，共享键名约定，不共享读取函数。

### R4. 配置文件

- Web、Admin 提交不含 secret 的 `.env.example`，API 提交 `.dev.vars.example`。
- 本地真实值分别放在 Next.js 的 `.env.local` 和 Wrangler 的 `.dev.vars`，继续保持 Git 忽略。
- `wrangler.jsonc` 明确区分 development、test、production 的 `APP_ENV`；远端 URL 和 CORS 来源不得使用虚构域名。
- 本次只提交本地开发值和远端变量名示例；test、production 的真实 URL 和 CORS 来源由部署平台配置。
- 示例文件说明哪些值会进入浏览器，不能把 token、数据库凭据或第三方密钥写入 `NEXT_PUBLIC_*`。

### R5. Turborepo 与依赖

- `turbo.json` 为实际读取环境变量的 `build`、`dev`、`lint`、`check-types` 任务声明相关键，使缓存和 `turbo/no-undeclared-env-vars` 能感知配置变化。
- Web 和 Admin 通过 `zod: catalog:` 使用现有 catalog 版本；不新增版本号，不重复修改 `packages/contracts` 已完成的 catalog 配置。
- 不新增仓库当前不存在的 `build:test`、`dev:test` 或 `start:test` 脚本。

### R6. 文档

- 更新 Web、Admin、API 的现有说明，写清本地文件、变量用途、启动命令和环境切换边界。
- 文档不再说明存在硬编码回退地址。

## 验收条件

- [ ] Web 和 Admin 的 server/client 环境入口能分别接受合法配置，并对缺失、非法枚举和非法 URL 给出明确错误。
- [ ] Web 首页不再包含 `NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:6155"` 这类回退逻辑。
- [ ] API 继续只从 `c.env` 读取 binding，非法 `APP_ENV` 不再静默变成 `development`。
- [ ] `APP_ENV`、`API_BASE_URL`、`NEXT_PUBLIC_APP_ENV`、`NEXT_PUBLIC_API_BASE_URL` 和 `CORS_ORIGINS` 在 `turbo.json` 中按任务声明。
- [ ] 三个应用都提供可提交的示例文件，真实本地文件仍被 Git 忽略，示例中没有 secret。
- [ ] `wrangler.jsonc` 能表达 development、test、production 三种业务环境，且没有编造远端域名。
- [ ] Web、Admin 复用 catalog 中的 Zod 版本，没有新增共享 env package。
- [ ] `pnpm check-types`、`pnpm lint`、`pnpm format:check` 依次通过。
- [ ] `pnpm --filter web build`、`pnpm --filter admin build` 通过；API 在提供本地变量后可启动，`GET /health` 返回对应 `APP_ENV`。
- [ ] Web、Admin、API 的说明与最终变量名和本地配置方式一致。

## 不在本次范围

- 配置 D1、R2、KV、AI、认证密钥或其他尚未接入的外部服务。
- 新建共享配置包或把运行时环境变量写入 `packages/contracts`。
- 为展示环境变量而新增页面徽标、调试面板或其他产品 UI。
- 安装测试框架，或新增仓库当前没有的多环境启动脚本。
