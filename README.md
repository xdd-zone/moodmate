# moodmate

情绪伴侣项目的 Monorepo 基础框架。

## 目录

- `apps/web`：用户端站点，Next.js，默认端口 `6153`
- `apps/admin`：管理后台，Next.js，默认端口 `6154`
- `apps/api`：独立 API 服务，Hono + Cloudflare Workers，默认端口 `6155`
- `packages/ui`：前端共享组件
- `packages/eslint-config`：共享 ESLint 配置
- `packages/typescript-config`：共享 TypeScript 配置

## 安装

```bash
pnpm install
```

## 运行

```bash
pnpm dev
```

单独启动某个应用：

```bash
pnpm dev:web
pnpm dev:admin
pnpm dev:api
```

访问地址：

```text
http://localhost:6153
http://localhost:6154
http://localhost:6155/health
```

## 检查

```bash
pnpm check
pnpm build
```

## 依赖版本

多个子应用共用的 Next.js、React、TypeScript、ESLint 和类型包版本放在 `pnpm-workspace.yaml` 的 `catalog` 里。
