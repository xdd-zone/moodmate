# Repository Guidelines

## 项目结构

```
moodmate/
├── apps/
│   ├── web/       # 用户端站点，Next.js，默认端口 6153
│   ├── admin/     # 管理后台，Next.js，默认端口 6154
│   └── api/       # 独立 API 服务，Hono + Cloudflare Workers，端口 6155
├── packages/
│   ├── ui/                 # 前端共享组件
│   ├── eslint-config/      # 共享 ESLint 配置（flat config 格式）
│   └── typescript-config/  # 共享 TypeScript 配置
├── turbo.json              # Turborepo 构建配置
└── pnpm-workspace.yaml     # pnpm 工作空间配置
```

## 环境要求

- **Node.js**: >= 22
- **包管理器**: pnpm（版本 11.5.0）
- 安装依赖：`pnpm install`

## 常用命令

| 命令                | 说明                                              |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | 全量启动所有应用                                  |
| `pnpm dev:web`      | 单独启动用户端（http://localhost:6153）           |
| `pnpm dev:admin`    | 单独启动管理后台（http://localhost:6154）         |
| `pnpm dev:api`      | 单独启动 API 服务（http://localhost:6155/health） |
| `pnpm build`        | 构建所有包和应用                                  |
| `pnpm check`        | 依次运行类型、Lint 和 Format 检查                 |
| `pnpm lint`         | 检查代码规范（使用 ESLint flat config）           |
| `pnpm check-types`  | 运行 TypeScript 类型检查                          |
| `pnpm format`       | 用 Prettier 格式化仓库文件                        |
| `pnpm format:check` | 检查仓库文件是否符合 Prettier 格式                |

## 代码规范

- **TypeScript**: 严格模式，版本 5.9.2
- **ESLint**: flat config 格式，配置位于 `packages/eslint-config/`
  - `@repo/eslint-config/base` — 基础配置
  - `@repo/eslint-config/next-js` — Next.js 应用专用
  - `@repo/eslint-config/react-internal` — React 组件库专用
- **Prettier**: 统一代码格式，`--max-warnings 0`
- **React**: 版本 19，配合 Next.js 16.2.6

## Commit Message

- 默认使用 Conventional Commits 短格式：`<type>(<scope>)!: <subject>`。
- `scope` 可选，只写当前项目 `apps/` 和 `packages/` 下的目录名：`web`、`admin`、`api`、`ui`、`eslint-config`、`typescript-config`。
- `subject` 用英文短句，首字母小写，不加句号，尽量控制在 50 字符以内。
- 常用类型：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`types`、`release`、`revert`。
- 破坏旧用法时加 `!`，并在正文写 `BREAKING CHANGE:`。
- 不添加 `Generated with ...`、`Co-authored-by ...` 等工具署名，除非用户明确要求。

## 测试

项目暂无集成测试配置。开发阶段建议手动验证，或在各自子应用中补充测试框架。

## 环境变量

本地开发环境变量文件命名规则：

```
.env              # 所有环境共有
.env.local        # 本地覆盖（不提交）
.env.development  # 开发环境
.env.production   # 生产环境
```

`.gitignore` 已默认排除 `.env` 和 `.env.local`。

## 依赖版本管理

共享依赖版本统一维护在 `pnpm-workspace.yaml` 的 `catalog` 中，各子包通过 `catalog:` 引用，避免版本漂移。

## 注意事项

- 提交前运行 `pnpm check-types` 确保类型无误
- 新增共享依赖需同步更新 `pnpm-workspace.yaml` 的 catalog
- `.turbo/` 目录为本地缓存，可安全删除重新生成
