# 实施计划

## 开始前

- [ ] 读取 `trellis-before-dev` 注入的 Web、Admin、API 规范。
- [ ] 复查当前工作区改动，保留 `plan-ui-design-system` 任务已经修改的依赖文件内容。
- [ ] 按已确认范围只写本地开发值和远端变量名示例，不在仓库中填写 test、production 真实值或占位域名。

## 实施顺序

1. [ ] 在 Web、Admin 的 `package.json` 中加入 `zod: catalog:`，更新 lockfile，不改 catalog 版本。
2. [ ] 为 Web 新建 server/client env 入口和 `.env.example`，调整 `.gitignore` 允许提交示例文件。
3. [ ] 把 Web 首页的 API 地址读取迁移到已校验入口，删除硬编码回退，不新增环境展示 UI。
4. [ ] 为 Admin 新建 server/client env 入口和 `.env.example`，调整 `.gitignore`；只接入当前页面或后续请求真正需要的变量，不添加演示组件。
5. [ ] 更新 API 的 `ApiBindings`、`getApiEnv()`、`.dev.vars.example` 和 `wrangler.jsonc`，保留 `c.env` 读取边界并改为严格校验。
6. [ ] 检查 CORS 中间件在 development、test、production 下的来源行为；production 不允许因空配置而接受任意来源。
7. [ ] 在 `turbo.json` 的 `build`、`dev`、`lint`、`check-types` 中声明环境变量，保留现有任务和缓存配置。
8. [ ] 更新 Web、Admin、API 的说明文件，写明本地文件、公开边界和环境切换方式。
9. [ ] 搜索旧变量读取、硬编码回退和过时文档，确认没有遗漏。

## 验证顺序

1. [ ] 使用合法 development 配置运行 `pnpm check-types`。
2. [ ] 类型检查通过后运行 `pnpm lint`。
3. [ ] Lint 通过后运行 `pnpm format:check`。
4. [ ] 运行 `pnpm --filter web build`。
5. [ ] 运行 `pnpm --filter admin build`。
6. [ ] 启动 API，访问 `http://localhost:6155/health`，确认返回 `development`。
7. [ ] 分别把 `APP_ENV` 改为非法值、移除必填 URL，确认对应应用给出包含变量名的错误。
8. [ ] 启动 Web 和 Admin，确认页面可访问，Web 的服务状态链接使用配置地址。
9. [ ] 运行 `git status --short`，确认 `.env.local`、`.dev.vars` 未被跟踪，三个 example 文件可被跟踪。

## 重点检查文件

- `apps/web/app/(site)/page.tsx`
- `apps/web/src/env/server.ts`
- `apps/web/src/env/client.ts`
- `apps/admin/src/env/server.ts`
- `apps/admin/src/env/client.ts`
- `apps/api/src/shared/env.ts`
- `apps/api/src/shared/hono-env.ts`
- `apps/api/src/middleware/cors.middleware.ts`
- `apps/api/wrangler.jsonc`
- `turbo.json`

## 停止条件

- 不知道 test、production 域名时，不写占位域名并部署。
- 课程方案与当前源码冲突时，以 PRD 中记录的当前事实和现有项目规范为准。
- 检查发现与本任务无关的既有错误时，记录错误并停止对应检查，不顺手修改。
