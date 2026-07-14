# Contract 写法

## 文件组织

公共响应结构和业务错误码放在 `src/common/`，接口按模块放在 `src/<module>/`：

```text
packages/contracts/src/
├── common/biz-code.ts
├── common/response.ts
├── system/health.contract.ts
├── system/ping.contract.ts
├── system/root.contract.ts
└── index.ts
```

新接口文件使用 `<action>.contract.ts`。不要按 Web、Admin 或 API 复制三份相同 schema；确实返回不同字段时定义不同的响应 DTO。

## Schema 和类型

运行时会接收或解析的数据先定义 Zod schema，再用 `z.infer` 推导类型。参考 `packages/contracts/src/system/ping.contract.ts`：

```ts
export const PingRequestSchema = z.object({
  name: z.string().trim().min(1),
});

export type PingRequest = z.infer<typeof PingRequestSchema>;
```

固定值使用 `z.literal()`，有限集合使用 `z.enum()`。`HealthResponseSchema` 和 `ApiEnvSchema` 展示了这两种写法。

只在确实没有运行时校验需求的公共结构上直接写 interface，例如 `ApiMeta` 和 `ApiSuccess<TData>`。不要同时手写一个 schema 和一份可能漂移的重复类型。

## 导出

包入口是 `packages/contracts/src/index.ts`。值使用普通 `export`，纯类型使用 `export type`。新增 contract 后必须从入口导出消费者需要的 schema 和类型。

`package.json` 只导出根入口 `".": "./src/index.ts"`，消费者不要深层 import `@repo/contracts/src/...`。
