# ESLint 配置结构

包通过 `package.json` 导出三个 flat config：

- `@repo/eslint-config/base` -> `base.js`
- `@repo/eslint-config/next-js` -> `next.js`
- `@repo/eslint-config/react-internal` -> `react-internal.js`

## Base

`base.js` 供 API、contracts 和配置包自身使用。当前组合 JavaScript recommended、Prettier、typescript-eslint recommended、Turbo 插件，并忽略 `dist/**`。`turbo/no-undeclared-env-vars` 当前为 warning，不要在无专项任务时改成 error。

## Next.js

`next.js` 在 base 上增加 Next.js、React、React Hooks 和 `core-web-vitals` 规则，并通过 `globalIgnores()` 忽略 `.next/**`、`out/**`、`build/**`、`next-env.d.ts`。Web 与 Admin 的 `eslint.config.js` 直接默认导出 `nextJsConfig`。

## React 组件库

`react-internal.js` 供 `packages/ui` 使用，增加 React、Hooks、browser 和 service worker globals，不包含 Next.js 插件。

## 修改方式

- 配置保持数组形式并使用命名导出。
- 新规则放到职责最窄的 preset；只有所有消费者都适用才放 base。
- ESLint 规则与格式规则冲突时保留 `eslint-config-prettier`。
- React 新 JSX transform 下保持 `react/react-in-jsx-scope: "off"`。
- 消费者的 `eslint.config.*` 只 import 并默认导出 preset，不复制共享规则。
