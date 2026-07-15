# Latte 与 Mocha 主题技术设计

## 结论

主题基础继续放在 `packages/ui`，Web 与 Admin 共享同一套 Catppuccin 色值、语义 token、主题运行时和切换组件。两个应用只负责在根布局执行首次主题脚本，并把切换入口放进现有页面工具区。

参考目录 `/Users/wuwanzhu/Code/xdd/core/packages/catppuccin-theme` 只用于核对官方色板和 `data-theme` 协议。moodmate 不增加跨仓库依赖，也不复制参考包中 Frappe、Macchiato、Ant Design 或颜色转换能力。

## 文件与职责

```text
packages/ui/src/
├── theme.css                         # 共享主题公开 CSS 入口
├── styles/theme/
│   ├── catppuccin.css                # Latte、Mocha 官方色板和运行时变量
│   └── variables.css                 # Tailwind 4 语义 token、圆角和阴影
├── theme.ts                          # 主题类型、校验、读取、写入和事件
├── theme-script.tsx                  # 首次渲染前写入 data-theme 的内联脚本
└── theme-toggle.tsx                  # Web 与 Admin 共用的两段式切换组件

apps/web/app/
├── layout.tsx                        # 默认 Latte、首次主题脚本、hydration 处理
├── globals.css                       # Web 情绪色与环境背景引用主题变量
├── (site)/page.tsx                   # 页头主题入口
└── (app)/app/page.tsx                # 应用入口页主题入口

apps/admin/app/
├── layout.tsx                        # 默认 Latte、首次主题脚本、hydration 处理
├── globals.css                       # 移除系统深色媒体查询
└── page.tsx                          # 页头主题入口
```

`theme.css` 保持 `@repo/ui/theme.css` 公开路径不变，只负责按顺序导入两层 CSS，并保留 `@source "./"` 让 Tailwind 扫描共享组件。

## CSS 分层

### Catppuccin 运行时变量

`catppuccin.css` 只包含两个主题块：

- `:root, [data-theme="latte"]`：`color-scheme: light`。
- `[data-theme="mocha"]`：`color-scheme: dark`。

两个主题都定义 Base、Mantle、Crust、Surface、Overlay、Text 和全部 Accent 变量。直接色值必须来自参考包的官方 Latte 与 Mocha 色板，不写自定义十六进制或 OKLCH 色值。

固定语义如下：

| 语义       | Catppuccin 颜色 |
| ---------- | --------------- |
| 主色       | Blue            |
| 主色文字   | Base            |
| 高亮与焦点 | Lavender        |
| 危险       | Red             |
| 成功       | Green           |
| 警告       | Yellow          |
| 信息       | Teal            |

### Tailwind 语义 token

`variables.css` 保留现有页面和组件使用的 token 名称，包括 `background`、`surface`、`muted`、`border`、`focus`、`primary`、反馈色、圆角和阴影。颜色 token 只引用 `--theme-*`，交互状态与弱背景使用 `color-mix()` 从官方颜色推导，不再维护一套 `--mood-cream-*`、`--mood-ink-*` 或固定 OKLCH 色板。

Tailwind 的 `dark` variant 只匹配 `[data-theme="mocha"]`。删除 `prefers-color-scheme: dark` 对主题色的控制，避免系统偏好覆盖用户的显式选择。

### Web 专用颜色

`apps/web/app/globals.css` 继续拥有 `warm`、`calm`、`rose` 和环境背景变量，但改为引用当前主题的 Peach、Teal、Maroon、Green 等变量。这样 Web 保留温和背景和情绪提示，Admin 仍使用纯背景，不把 Web 构图写进共享 UI 包。

## 运行时协议

```ts
const THEMES = ["latte", "mocha"] as const;
const DEFAULT_THEME = "latte";
const THEME_STORAGE_KEY = "moodmate-theme:v1";
```

`resolveTheme()` 只接受 `latte` 与 `mocha`，其他值回退到 `latte`。`applyTheme()` 同时更新 `document.documentElement.dataset.theme` 和 `localStorage`，再发出同源页面内的主题变化事件。切换组件监听该事件与浏览器 `storage` 事件，使同源标签页保持一致。

主题选择保存在 localStorage，因此持久化范围是浏览器 origin。Web 与 Admin 在不同域名或不同开发端口下各自保存选择；本任务不增加账号级主题设置或跨域同步。

## 首次渲染

两个根布局都在 `<html>` 写入默认 `data-theme="latte"`，并在 `<head>` 渲染共享 `ThemeScript`。脚本在 body 绘制前读取 `moodmate-theme:v1`，只接受 `latte` 或 `mocha`，读取失败或值无效时写入 `latte`。

`<html>` 使用 `suppressHydrationWarning`，避免脚本在 hydration 前把 Latte 改为 Mocha 时产生属性不一致警告。脚本不依赖 Next.js API，因此 `packages/ui` 不增加 Next.js 依赖。

## 切换组件

`ThemeToggle` 是带可见分组标签的两段式控件：

- 两个选项固定为 `Latte` 与 `Mocha`。
- 使用原生 `button`、`aria-pressed` 和分组名称表达当前状态。
- 使用 `useSyncExternalStore` 从根节点读取当前主题，服务端快照固定为 `latte`，避免 hydration 内容不一致。
- 控件使用稳定高度和两列布局，选中状态使用现有语义 token，不新增图标依赖。
- Web 首页、Web 应用入口和 Admin 首页都直接复用该组件，不复制 localStorage 或事件逻辑。

## 兼容与迁移

- 保留 `@repo/ui/theme.css` 导入路径和已有 Tailwind 语义类名，现有 Button、Card、Badge 不改公开 API。
- 旧的 `prefers-color-scheme` 行为被显式 Latte / Mocha 选择替代；首次访问默认 Latte，不再自动跟随系统。
- 现有页面路由、文案、服务状态 URL、字体和响应式结构保持不变。
- 不增加 `next-themes`、图标库或其他运行时依赖。

## 风险与处理

### 首次加载闪烁

风险：客户端组件挂载后才读取 localStorage，Mocha 用户会先看到 Latte。

处理：共享内联脚本放在根布局 `<head>`，在 body 绘制前写入 `data-theme`；浏览器检查刷新后的首屏和控制台。

### 语义 token 对比不足

风险：直接替换底层色板后，Button、Card、Badge 或辅助文字在某一主题下不清楚。

处理：保留组件语义类名，分别检查两个主题的正文、弱文字、描边、主按钮、危险按钮和焦点环；需要调整时只改 `variables.css` 的映射比例。

### 切换入口挤压页头

风险：两段式控件加入移动端页头后，与导航链接、Badge 或返回按钮重叠。

处理：现有工具区允许换行，切换组件使用固定内部尺寸但不固定外部位置；在 390 x 844 与 1440 x 900 视口检查三个页面。

### 跨域选择不同步

风险：Web 与 Admin 使用不同 origin 时，localStorage 天然隔离。

处理：把它作为明确的运行边界；本任务只保证每个应用内持久化，不引入服务端用户设置或跨域消息通道。

## 回滚方式

- `catppuccin.css`、`variables.css` 与 `theme.css` 作为一个主题样式单元回滚。
- `theme.ts`、`theme-script.tsx`、`theme-toggle.tsx` 与两个根布局作为一个运行时单元回滚。
- 三个页面中的切换入口可以分别回滚，不影响路由和业务数据。
- Web 专用颜色映射与共享色板一起回滚，避免引用不存在的 `--theme-*` 变量。
- 本任务没有数据库、API 或账号数据迁移。
