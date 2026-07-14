# UI 设计体系实施计划

## 1. 准备依赖与导出

- [x] 在 `pnpm-workspace.yaml` catalog 增加 `class-variance-authority` 和 `@radix-ui/react-slot`。
- [x] 在 `packages/ui/package.json` 引用两个 catalog 依赖，并增加 `./theme.css` 精确导出。
- [x] 在 `apps/admin/package.json` 增加与 Web 相同的 `tailwindcss`、`@tailwindcss/postcss` 和 `postcss` 开发依赖。
- [x] 运行 `pnpm install` 更新 lockfile。

验证点：只增加当前 Button 语义和 Admin Tailwind 接入需要的依赖，不增加完整 Radix、图标库、主题库或 Storybook。

## 2. 建立共享主题

- [x] 新建 `packages/ui/src/theme.css`。
- [x] 用现有 Web OKLCH 值整理基础值，不复制课程文章 palette。
- [x] 用 `@theme inline` 定义背景、内容、描边、操作、聚焦和反馈语义 utility。
- [x] 保留 4px spacing 基线和现有圆角等级，不重复定义 Tailwind 已有的整套 spacing。
- [x] 添加 `@source "./"` 扫描共享 TSX 组件。
- [x] 在 Web `globals.css` 导入共享主题，保留 Web 页面背景和情绪专用色。
- [x] 在 Admin 新建 `postcss.config.mjs`，并在 `globals.css` 导入 Tailwind 与共享主题。

验证点：Web 与 Admin build 后都生成共享组件使用的 utility；页面文件不出现新的产品色值。

## 3. 重写第一批共享组件

- [x] 新建内部 `packages/ui/src/lib/utils.ts`，只处理 className 合并。
- [x] 重写 `packages/ui/src/button.tsx`，移除 `appName`、`alert()` 和强制 client boundary。
- [x] 使用 CVA 定义 Button 的语义、尺寸与完整静态 class 映射。
- [x] 使用 Radix Slot 支持 `asChild`，保持 button、Link 和 anchor 的 HTML 语义。
- [x] 重写 `packages/ui/src/card.tsx`，移除 create-turbo URL，提供容器与组合子组件。
- [x] 新建 `packages/ui/src/badge.tsx`，只实现现有页面需要的变体。
- [x] 不修改 `Code`，不新增 `Input`、`Label` 或其他组件。

验证点：组件 props 无 `any`；不读取 API、session、权限、环境变量或业务字段；纯展示组件不写 `"use client"`。

## 4. 迁移 Web 现有页面

- [x] 在 `apps/web/app/(site)/page.tsx` 使用共享 Button、Card 和 Badge。
- [x] 在 `apps/web/app/(app)/app/page.tsx` 使用共享 Button、Card 和 Badge。
- [x] 保留服务状态 URL、站内 Link、路由组和页面现有职责。
- [x] 保留首页布局与暖色背景，不复制课程文章的深色蓝色视觉。
- [x] 情绪选项和步骤列表保留在 Web，不移入共享包。

验证点：首页与 `/app` 在浅色、深色、移动端和桌面仍可读；CTA 可以用键盘聚焦；减少动态效果模式仍有效。

## 5. 迁移 Admin 基础页

- [x] 用 Tailwind utility 重写 `apps/admin/app/page.tsx`。
- [x] 使用共享 Button、Card 和 Badge 展示真实的管理端入口与服务状态。
- [x] 修正 `apps/admin/app/layout.tsx` 的中文 metadata 和 `lang="zh-CN"`。
- [x] 删除 `apps/admin/app/page.module.css`。
- [x] 不增加尚未实现的表格、筛选器、表单或管理操作。

验证点：Admin 使用与 Web 相同的语义 token，背景和密度保持管理端特征；移动端、桌面、浅色、深色和键盘焦点可用。

## 6. 更新项目文档

- [x] 只修改 `docs/architecture.md` 中与 `packages/ui`、前端依赖方向和样式职责有关的段落。
- [x] 更新 `docs/apps/web-design.md`，说明共享 token 来源和 Web 专用样式位置。
- [x] 新建 `docs/apps/admin-design.md`，写清 Admin 的密度、页面结构、主题接入和共享边界。
- [x] 完成代码后使用 `trellis-update-spec` 更新受影响的 Web、Admin、UI 规范。

验证点：文档里的路径、依赖和命令与最终源码一致，不描述未实现能力。

## 7. 质量检查

按项目规则依次运行，前一步通过后再执行下一步：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter web build
pnpm --filter admin build
```

项目没有自动化测试脚本。不能用 build 代替浏览器检查。

## 8. 浏览器检查

- [x] 确认 Web `http://localhost:6153` 和 Admin `http://localhost:6154` 已运行。
- [x] 检查 Web `/`、Web `/app`、Admin `/`。
- [x] 检查约 `390 x 844` 移动端和 `1440 x 900` 桌面视口。
- [x] 分别检查系统浅色和深色。
- [x] 用键盘焦点检查主要链接、按钮和聚焦环。
- [x] 检查减少动态效果时没有多余动画。
- [x] 检查长中文、按钮、Badge 和 Card 没有重叠或引起布局跳动。

## 回滚点

- [x] 依赖、`theme.css`、CSS exports 和应用 import 作为一个回滚单元。
- [x] Admin Tailwind 配置、页面迁移和 CSS Module 删除作为一个回滚单元。
- [x] Web 首页、Web `/app`、Admin 首页分别保持可独立回滚。
- [x] 共享组件在两个应用都有真实使用，没有增加演示页制造调用方。

## 实施结果

- `pnpm check-types`、`pnpm lint`、`pnpm format:check` 通过。
- `pnpm --filter web build`、`pnpm --filter admin build` 通过。
- 浏览器检查覆盖 Web `/`、Web `/app`、Admin `/` 的移动端、桌面、浅色、深色、减少动态效果和键盘焦点。
- 浏览器控制台没有 warning 或 error。
