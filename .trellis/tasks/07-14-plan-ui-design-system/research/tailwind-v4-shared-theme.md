# Tailwind CSS 4 共享主题研究

## 本地事实

- 仓库使用 Tailwind CSS `4.3.2`。
- Web 已使用 `@tailwindcss/postcss`、`postcss` 和 `tailwindcss`，入口是 `apps/web/app/globals.css`。
- Admin 尚未安装上述三个开发依赖，也没有 `postcss.config.mjs`。
- `packages/ui/package.json` 当前只导出 `./* -> ./src/*.tsx`，没有 CSS 子路径导出。

## 官方规则

### 主题变量

Tailwind 的 `@theme` 变量会生成对应 utility。普通 `:root` 变量不会自动生成 utility，适合保存不直接给类名使用的基础值。

当 `@theme` 变量引用另一个 CSS 变量时，官方要求使用 `@theme inline`，避免 CSS 变量在定义位置提前解析而得到错误值。

官方也明确支持把主题变量放在 monorepo 的独立 CSS 文件中，再由多个项目通过 `@import` 引入。

来源：[Theme variables](https://tailwindcss.com/docs/theme)

### 共享组件扫描

Tailwind 默认忽略 `node_modules`、`.gitignore` 命中的目录和 CSS 文件。共享组件包含 Tailwind 类名时，应使用 `@source` 显式注册扫描目录。

`@source` 路径相对当前样式表解析。把 `@source "./"` 放在 `packages/ui/src/theme.css`，可以让导入该主题的应用扫描同目录下的共享 TSX 组件。

变体必须映射到源码中完整出现的类名，不能使用 `bg-${color}` 这类动态拼接。

来源：[Detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files)

### PostCSS 接入

Next.js 使用 PostCSS 时，需要安装 `tailwindcss`、`@tailwindcss/postcss` 和 `postcss`，在 `postcss.config.mjs` 注册 `@tailwindcss/postcss`，并在全局 CSS 中导入 `tailwindcss`。

来源：[Installing Tailwind CSS with PostCSS](https://tailwindcss.com/docs/installation/using-postcss)

## 对当前方案的影响

- 共享主题使用 `packages/ui/src/theme.css`，通过 `@repo/ui/theme.css` 导入。
- `packages/ui/package.json` 增加精确的 `./theme.css` 导出，保留现有组件子路径导出。
- `theme.css` 使用 `@theme inline` 把语义 utility 映射到 MoodMate CSS 变量。
- `theme.css` 使用相对路径 `@source "./"` 扫描共享组件。
- Admin 使用与 Web 相同版本的 Tailwind/PostCSS catalog 依赖和配置。
- 组件变体使用静态 class 映射，不拼接 Tailwind 类名。
