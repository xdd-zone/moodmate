# UI 包目录与导出

`@repo/ui` 放不包含业务规则的设计令牌、结构与通用展示 React 组件。当前源码在 `packages/ui/src/`，已有主题入口与运行时、`button.tsx`、`card.tsx`、`badge.tsx`、`code.tsx`，以及表单类 `label.tsx`、`input.tsx`、`field.tsx`，表格类 `table.tsx`、`pagination.tsx`，反馈类 `alert.tsx`、`spinner.tsx`、`skeleton.tsx`，布局类 `separator.tsx`、`app-shell.tsx`。

## 文件和导出

- 一个组件一个小写文件，例如 `src/code.tsx`。
- 组件使用命名导出，例如 `export function Code()` 或 `export const Button`。
- `package.json` 通过 `"./*": "./src/*.tsx"` 提供子路径导出；消费者使用 `@repo/ui/button`，不要深层 import `@repo/ui/src/button`。
- `theme.css` 使用精确的 `"./theme.css": "./src/theme.css"` 导出；应用使用 `@import "@repo/ui/theme.css"`。
- `styles/theme/catppuccin.css` 只放 Latte 与 Mocha 官方色板；`styles/theme/variables.css` 只放语义 token 映射。
- `theme.ts` 是共享主题常量和浏览器运行时的内部模块；应用通过 `theme-script.tsx` 和 `theme-toggle.tsx` 使用主题，不直接深层 import。
- 新组件不需要维护根 `index.ts`，但文件名必须与预期 import 子路径一致。

## 进入共享包的条件

结构与通用展示组件在有真实调用方时即可进入 `@repo/ui`，不必等 Web 和 Admin 同时使用。Admin 已经是 `input`、`field`、`table`、`alert`、`app-shell` 等结构类组件的真实调用方，这类无业务、无请求、无权限判断的组件优先共享，避免各应用重复手写布局和输入框样式。仍禁止把业务组件、发请求或判断权限的组件放进来；判断不清时按下面的黑名单和依赖边界执行。

以下内容不能进入 UI 包：

- `MoodEntryCard`、`AgentInboxPanel` 等业务组件。
- 发起 API 请求、读取 session 或判断业务权限的组件。
- 拼 URL、R2 key 或保存业务数据的逻辑。
- 对 `@repo/contracts` 或 `apps/*` 的依赖。

依据：`docs/architecture.md` 的 `packages/ui` 与依赖方向章节。
