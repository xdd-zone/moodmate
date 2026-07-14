# UI 类型和依赖

`packages/ui/tsconfig.json` 继承 `@repo/typescript-config/react-library.json`，启用 `strictNullChecks`，源码范围只有 `src`。

## 类型规则

- Props 不使用 `any`；可选属性明确写 `?`。
- React 类型使用 type-only import，或使用 `React.ReactNode` 命名空间形式。`Card`、`Code` 已使用 type-only `JSX`，`Button` 的 `ReactNode` 仍是普通 import；新增代码不要复制这个例外。
- 不为简单 props 建立与组件分离的公共类型，除非多个组件或消费者确实复用。
- 当前组件没有透传完整 DOM 原生属性。需要增加时先确认调用方要求，不要无依据手写一套看似完整但实际缺字段的属性列表。

## 依赖规则

UI 包的运行依赖只有 React 和 React DOM。不要增加：

- `@repo/contracts`、Next.js 或 Hono。
- Web/Admin 的路径别名。
- 请求客户端、鉴权 SDK 或服务端专用包。

如果一个组件需要这些依赖，它属于具体应用，不属于 `@repo/ui`。
