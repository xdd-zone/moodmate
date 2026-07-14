# TypeScript 配置结构

## `base.json`

基础配置面向共享 TypeScript 包，当前关键项：

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `isolatedModules: true`
- `module` 和 `moduleResolution` 使用 `NodeNext`
- `target: ES2022`
- 生成 declaration 和 declaration map

会改变所有继承包类型行为的选项才放 base。不要为了单个应用方便关闭严格选项。

## `nextjs.json`

Next.js 配置继承 base，改用 `module: ESNext`、`moduleResolution: Bundler`、`jsx: preserve`、`noEmit: true`，并注册 Next 插件。Web 和 Admin 从各自 `tsconfig.json` 继承它。

## `react-library.json`

React library 配置继承 base，只增加 `jsx: react-jsx`。`packages/ui/tsconfig.json` 在包内设置 `outDir`、`strictNullChecks` 和 include/exclude。

## 消费者覆盖

- Web/Admin 的 `.next/types/**/*.ts` 和 `next-env.d.ts` 留在应用 tsconfig。
- API 使用 WebWorker runtime 和 Hono JSX，不继承共享 base；它的 `apps/api/tsconfig.json` 以实际 Workers 环境为准。
- contracts 覆盖为 Bundler resolution，因为源码由 workspace 直接引用。
- 包级 `include`、`exclude`、`outDir` 不写进共享配置。
