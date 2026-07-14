# UI 组件写法

## Props 和渲染

- Props 必须有明确 TypeScript 类型；可选样式入口使用 `className?: string`，参考 `Button`、`Card` 和 `Code`。
- 内容使用 `ReactNode` 或 `React.ReactNode`，返回类型可由 TypeScript 推导；现有 `Card` 和 `Code` 显式返回 `JSX.Element`。
- 组件只渲染传入内容和通用交互，不读取应用级环境变量或请求数据。
- 语义元素按用途选择，不能为了样式把按钮改成链接或把标题改成普通 `div`。

## 客户端边界

只有使用事件、state 或浏览器 API 的组件才加 `"use client"`。当前 `Button` 因为有 `onClick` 使用客户端组件；`Card` 和 `Code` 保持服务端可用。

新增交互组件时，把客户端边界留在最小文件，不让纯展示组件继承不必要的 client 限制。

## 当前代码限制

现有 `Button` 的 `alert()` 和 `appName`、`Card` 的 create-turbo URL 都来自 starter，只能作为当前源码事实，不能复制成新组件模式。修改或首次使用这些组件时，应在对应任务中去掉 starter 行为并补充真实 API；本次 bootstrap 不顺手改产品代码。

## 样式归属

UI 组件可以接受 `className`，当前包没有独立 token 或 CSS 基础设施。不要在共享组件里复制 Web 的 moodmate 页面 token，也不要假设 Admin 已采用 Web 的 Tailwind 配置。
