# UI 设计体系技术设计

## 结论

课程文章的三层方法适合当前项目，但示例色值、深色优先假设和一次性补齐组件的做法不适合直接复制。

当前项目应把共享主题和无业务组件放在 `packages/ui`，两个 Next.js 应用负责导入主题、注册 Maple Mono、定义页面布局和保留各自的业务样式。Web 保持温和、低饱和的产品界面；Admin 使用相同语义令牌，但页面间距更紧凑、信息组织更适合扫描和重复操作。

## 课程方案映射

| 课程内容                                   | 当前项目处理                                                    |
| ------------------------------------------ | --------------------------------------------------------------- |
| 基础令牌、语义令牌、组件约束三层           | 采用                                                            |
| 4px 间距基线                               | 使用 Tailwind 现有 spacing，不重复定义一套数字                  |
| 深色蓝色 palette                           | 不采用，保留 MoodMate 现有 OKLCH 色值                           |
| 只考虑深色界面                             | 调整为系统浅色和深色两套语义值                                  |
| `theme.css` 放在 `packages/ui`             | 采用，并增加 CSS 子路径导出                                     |
| Button、Card、Input、Label、Badge 一次实现 | 调整为 Button、Card、Badge；表单组件等真实页面出现后再做        |
| 公开设计系统演示页                         | 不采用，直接在 Web 与 Admin 现有页面验证                        |
| CVA 与 Radix Slot                          | 仅用于 Button 变体和 `asChild` 语义，依赖写入 workspace catalog |

## 分层模型

### 基础令牌

基础令牌只记录原始视觉值，不允许页面直接使用：

- MoodMate 中性色、绿色和反馈色色阶。
- Maple Mono 字体入口和中文 fallback。
- `sm`、`md`、`lg`、`xl` 四档圆角。
- 常规控件、卡片和浮层需要的阴影值。

现有 Web 的 OKLCH 值是迁移来源。实施时只补交互状态确实需要的相邻值，不重新设计 palette。

### 语义令牌

共享组件和页面使用这些职责名称：

- 背景：`background`、`surface`、`surface-muted`、`overlay`。
- 内容：`foreground`、`muted`、`disabled`、`inverse`。
- 描边：`border`、`border-strong`、`focus`。
- 操作：`primary`、`primary-foreground`、`primary-hover`、`primary-active`。
- 反馈：`success`、`warning`、`danger`、`info` 及对应弱背景。

`packages/ui/src/theme.css` 在 `:root` 与 `prefers-color-scheme: dark` 中定义 MoodMate 值，再通过 `@theme inline` 生成 Tailwind utility。课程示例中的 `brand-*` 蓝色色阶不进入仓库。

Web 当前的 `warm`、`calm`、`rose` 属于情绪展示，不是通用组件状态，继续留在 `apps/web/app/globals.css`。

### 组件约束

- `Button` 负责动作层级、尺寸和完整交互状态。Link 和 anchor 通过 `asChild` 保留语义元素。
- `Card` 负责独立内容块的表面、描边和组合结构，不负责跳转。
- `Badge` 负责简短分类或轻量状态，不代替主操作。
- 页面不重新实现按钮状态和卡片外观，只负责布局、内容和业务组合。
- `className` 用于布局适配；新增稳定视觉差异时优先增加有真实调用方的组件变体。

## 文件与职责

```text
packages/ui/
├── package.json
└── src/
    ├── theme.css            # source 注册、基础值、语义映射、浅深色
    ├── button.tsx           # Button 与 buttonVariants
    ├── card.tsx             # Card 组合组件
    ├── badge.tsx            # Badge 与 badgeVariants
    └── lib/
        └── utils.ts         # 内部 className 合并，不作为公开子路径

apps/web/
└── app/
    ├── globals.css          # 导入 Tailwind 与共享主题，保留 Web 业务色和页面背景
    ├── (site)/page.tsx      # 真实使用 Button、Card、Badge
    └── (app)/app/page.tsx   # 真实使用 Button、Card、Badge

apps/admin/
├── postcss.config.mjs       # Tailwind PostCSS
└── app/
    ├── globals.css          # 导入 Tailwind 与共享主题，定义 Admin 页面背景
    ├── layout.tsx           # 中文 metadata、lang 和 Maple Mono
    └── page.tsx             # 真实使用 Button、Card、Badge
```

`apps/admin/app/page.module.css` 在页面迁移完成后删除。不要保留没有调用方的 starter selector。

## CSS 接入

`packages/ui/package.json` 增加精确导出：

```json
{
  "exports": {
    "./theme.css": "./src/theme.css",
    "./*": "./src/*.tsx"
  }
}
```

两个应用的 `globals.css` 以相同顺序导入：

```css
@import "tailwindcss";
@import "@repo/ui/theme.css";
```

`theme.css` 使用 `@source "./"` 扫描同目录共享组件。所有变体 class 必须是源码里的完整字符串，不能动态拼接 utility 名称。

应用仍负责 `body` 背景和页面专用 token，避免共享主题控制具体页面构图。Maple Mono 继续由各自 `app/layout.tsx` 通过 `next/font/local` 注册，`packages/ui` 不依赖 Next.js。

## 依赖方向

```text
apps/web   -> @repo/ui  -> React、CVA、Radix Slot
apps/admin -> @repo/ui  -> React、CVA、Radix Slot

@repo/ui -X-> apps/web
@repo/ui -X-> apps/admin
@repo/ui -X-> @repo/contracts
@repo/ui -X-> Next.js、Hono、session、API
```

`class-variance-authority` 和 `@radix-ui/react-slot` 加入 `pnpm-workspace.yaml` 的 catalog，再由 `packages/ui` 使用 `catalog:`。不增加完整 Radix 组件集、图标库、Storybook 或主题运行时。

## 页面迁移

### Web

- 保留首页和 `/app` 的路由、文案职责、服务状态链接和现有暖色背景。
- CTA 使用共享 Button；独立预览容器和入口容器使用共享 Card；短标签使用共享 Badge。
- 页面布局仍留在 app 内，不把首页预览、情绪选项和步骤列表移入 `packages/ui`。
- 迁移只替换样式职责，不重做页面结构、插画、Logo 或营销素材。

### Admin

- 使用 Tailwind CSS 4 替换 CSS Module starter 样式。
- 页面保持安静、紧凑、适合后台操作，不复制 Web 的径向渐变背景。
- 第一页只展示真实存在的管理入口信息和服务状态，不渲染尚未实现的表格、筛选器或表单。
- 使用共享组件验证相同 token 与组件在较紧凑页面中的表现。

## 主题与状态

- 第一阶段继续跟随系统浅深色，不增加手动切换。
- `focus-visible` 由 Button 统一提供，页面链接也使用同一个 focus token。
- `disabled` 同时禁止指针操作并降低视觉强度。
- `danger` 只用于危险动作，不拿反馈色做普通强调。
- `prefers-reduced-motion` 继续由两个应用的全局样式处理；共享组件不加入不可关闭的动画。

## 兼容与迁移

- 保留现有语义 utility 名称，减少 Web 页面改动；只补缺少的交互和反馈 token。
- Admin 是 starter 页面，可以一次替换，不需要兼容旧 CSS selector。
- `Button` 和 `Card` 当前没有真实调用方，替换 starter API 不构成产品行为兼容问题。
- `Code` 与本任务无关，保留原文件，不顺手重写。

## 风险与处理

### 共享 class 未生成

风险：应用构建时没有扫描 `packages/ui/src`，页面只出现无样式 HTML。

处理：`theme.css` 使用相对 `@source`，Web 和 Admin 分别 build，并在浏览器检查 Button、Card、Badge 的 computed style。

### 浅深色对比不足

风险：迁移变量层级后，文字、描边或聚焦环在某一模式下不清楚。

处理：保留现有 Web 色值作为基线，在两个应用分别检查浅色、深色和键盘焦点；只调整对应语义值。

### 共享组件包含应用规则

风险：为了迁移页面把情绪选项、服务 URL 或 Admin 文案放进 `packages/ui`。

处理：共享组件只接收 children、DOM props、variant、size 和 className；所有内容与数据留在 app。

## 回滚方式

- 共享主题、package exports 和两个应用的 CSS 导入作为一组回滚，不能只撤掉其中一个文件。
- Admin 的 Tailwind 配置与 `page.module.css` 删除作为一组回滚。
- 页面迁移可以按 Web 首页、Web `/app`、Admin 首页分别回滚，不影响 API 和业务数据。
- 本任务没有数据库、接口或持久状态迁移。
