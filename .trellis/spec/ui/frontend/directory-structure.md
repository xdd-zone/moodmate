# UI 包目录与导出

`@repo/ui` 只放 Web 和 Admin 都会使用、且不包含业务规则的设计令牌和 React 组件。当前源码在 `packages/ui/src/`，已有 `theme.css`、`button.tsx`、`card.tsx`、`badge.tsx` 和 `code.tsx`。

## 文件和导出

- 一个组件一个小写文件，例如 `src/code.tsx`。
- 组件使用命名导出，例如 `export function Code()` 或 `export const Button`。
- `package.json` 通过 `"./*": "./src/*.tsx"` 提供子路径导出；消费者使用 `@repo/ui/button`，不要深层 import `@repo/ui/src/button`。
- `theme.css` 使用精确的 `"./theme.css": "./src/theme.css"` 导出；应用使用 `@import "@repo/ui/theme.css"`。
- 新组件不需要维护根 `index.ts`，但文件名必须与预期 import 子路径一致。

## 进入共享包的条件

只有 Web 和 Admin 都会用的通用组件才放这里。当前确认共享的是 button、card 和 badge；dialog、input、sidebar 等组件要等两个应用都出现真实调用方后再增加。只有一个应用使用的组件先留在该应用。

以下内容不能进入 UI 包：

- `MoodEntryCard`、`AgentInboxPanel` 等业务组件。
- 发起 API 请求、读取 session 或判断业务权限的组件。
- 拼 URL、R2 key 或保存业务数据的逻辑。
- 对 `@repo/contracts` 或 `apps/*` 的依赖。

依据：`docs/architecture.md` 的 `packages/ui` 与依赖方向章节。
