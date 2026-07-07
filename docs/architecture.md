# moodmate 系统设计

这份文档写 `moodmate` 的项目用途、目录边界、状态保存位置和改代码顺序。后续新建模块、补接口、接数据库和改页面时，先看这里。

`moodmate` 是情绪陪伴 Agent App。用户记录当天情绪、原因和下一步行动，也可以和自己创建或选择的 Agent 对话。Agent 读取用户主动保存的资料、情绪记录、历史对话和记忆后再回复。

项目类型：`agent-site`。

判断依据：

- 仓库已经是 pnpm workspace + Turborepo。
- `apps/web` 是用户端 Next.js 应用。
- `apps/admin` 是管理后台 Next.js 应用。
- `apps/api` 是 Hono + Cloudflare Workers API。
- `packages/contracts` 已经放 API schema、DTO、错误码和统一响应结构。

## 当前源码状态

当前仓库能确认这些事实：

- 根目录 `package.json` 使用 `pnpm@11.9.0`，Node 要求 `>=22`。
- `apps/web` 已经有公开首页 `app/(site)/page.tsx` 和应用入口 `app/(app)/app/page.tsx`。
- `apps/admin` 现在只有基础首页 `app/page.tsx`。
- `apps/api` 已经实现 `/`、`/health`、`/rpc/system/ping`。
- `apps/api` 已经有 requestId、CORS、安全响应头、统一错误返回。
- `packages/contracts` 已经有 `ApiResponse<T>`、`BizCode`、`buildSuccess()`、`buildFailure()` 和 `system` contracts。
- `apps/api/wrangler.jsonc` 还没有启用 D1、R2、KV、AI 或队列绑定。

现在还没有实现这些内容：

- 登录、session、token refresh。
- D1 表、migration、seed。
- R2 文件上传。
- Agent、聊天、记忆、主动关怀。
- LLM provider 配置和调用。
- 订阅、账单、内容审核。
- 自动任务入口。

文档里出现这些能力时，默认表示要做的设计，不表示代码已经写完。

## 目标和非目标

第一阶段目标：

- 用户可以打开首页，进入应用入口。
- API 可以返回服务状态，所有响应都带 `requestId` 和 `timestamp`。
- 新接口先写 `packages/contracts`，再写 API route 和前端请求函数。
- 新业务模块按 route、service、repository、presenter 或 mapper 分开写。

下一阶段目标：

- 用户可以登录，记录情绪、原因和下一步行动。
- 用户可以创建或选择 Agent，并发起私聊。
- API 可以保存用户资料、情绪记录、Agent、消息和记忆。
- Admin 可以管理用户、Agent 模板、默认头像、LLM 配置和服务状态。

本期不做：

- 多租户。
- 复杂后台角色。
- 插件系统。
- 多区域部署。
- 自动群聊。
- 复杂队列。
- 所有表都提前加 `tenantId`、`role`、`permission` 字段。

## 目录和入口

当前目录按下面放：

```text
moodmate/
├── apps/
│   ├── web/       # 用户端站点，Next.js，默认端口 3000
│   ├── admin/     # 管理后台，Next.js，默认端口 3006
│   └── api/       # API 服务，Hono + Cloudflare Workers，默认端口 8787
├── packages/
│   ├── contracts/          # 请求 schema、响应 DTO、错误码和统一响应
│   ├── ui/                 # web 和 admin 共用的通用 React 组件
│   ├── eslint-config/      # ESLint flat config
│   └── typescript-config/  # TypeScript 配置
└── docs/
```

不新增 `apps/worker`。主动关怀需要自动运行时，先在 `apps/api` 里接 Workers Cron；任务变多以后再决定是否拆出独立 worker。

## 应用职责

### `apps/api`

`apps/api` 是服务端入口。业务数据、鉴权、外部服务调用都从这里走。

这里负责：

- 登录、登出、session、token refresh。
- 用户资料、头像和状态。
- 情绪记录、Agent、聊天、记忆、主动关怀。
- 后台管理接口。
- D1、R2、LLM、Workers Cron 这类服务端资源。
- 统一响应、错误码、requestId、CORS 和安全响应头。

这里不负责：

- 渲染 Web 页面。
- 保存前端表单临时状态。
- 把 LLM key、R2 key 拼接规则或数据库字段直接返回给浏览器。

`apps/api/src` 固定这样放：

```text
apps/api/src/
├── index.ts              # Wrangler 入口，只导出 app
├── app.ts                # 创建 app，并导出 AppType
├── bootstrap/            # 注册中间件、错误处理和路由
├── middleware/           # requestId、CORS、安全响应头
├── modules/<module>/     # 业务模块
├── routes/index.ts       # 一级路由挂载
└── shared/               # env、meta、AppError、Hono 类型
```

新增业务模块时按下面建：

```text
apps/api/src/modules/mood/
├── index.ts
├── mood.route.ts
├── mood.service.ts
├── mood.repository.ts
└── mood.presenter.ts
```

如果模块需要把数据库 record 转成响应 DTO，就写 `presenter`。如果模块主要处理输入输出格式，也可以叫 `mapper`。同一个模块里二选一，不要两个都建。

### `apps/web`

`apps/web` 是用户端。

这里负责：

- 公开首页。
- 登录后的应用页面。
- 情绪记录、历史、详情和统计视图。
- Agent 创建、选择、编辑和私聊页面。
- 记忆查看、编辑和删除页面。
- 用户资料、头像、账号设置和订阅状态展示。

这里不负责：

- 直接写数据库。
- 直接调用 LLM。
- 直接拼 R2 key。
- 保存业务数据副本。

下一阶段补业务代码时使用这个目录：

```text
apps/web/
├── app/
│   ├── (site)/            # 公开页面
│   ├── (auth)/            # 登录和回调
│   └── (app)/             # 登录后页面
└── src/
    ├── api/               # 用户端请求函数
    ├── auth/              # 用户端 session 和登录动作
    ├── components/        # 用户端业务组件
    ├── lib/               # http、日期、格式化、小工具
    └── providers/         # 全局 Provider
```

页面不要直接写 `fetch()`。固定调用方式：

```text
page.tsx -> useMoodEntries() -> src/api/mood.api.ts -> http -> apps/api
```

### `apps/admin`

`apps/admin` 是后台。

这里负责：

- 管理员登录。
- 用户列表、用户状态和用户资料查看。
- Agent 模板、默认头像、默认 prompt 和安全提示配置。
- LLM provider、模型名、Base URL 和参数配置。
- 情绪记录和聊天内容的必要审核入口。
- 服务状态和排查页面。

这里不负责：

- 直接写数据库。
- 直接 import `apps/api/src`。
- 复用 `apps/web` 的业务组件。
- 决定用户端页面怎么放。

下一阶段补业务代码时使用这个目录：

```text
apps/admin/
├── app/
│   ├── (auth)/            # 管理员登录
│   └── (dashboard)/       # 后台页面
└── src/
    ├── api/               # 后台请求函数
    ├── auth/              # 管理员 session
    ├── components/        # 后台布局、表格、表单组件
    └── lib/               # http、日期、格式化、小工具
```

后台页面按业务目录放：

```text
apps/admin/app/(dashboard)/
├── users/
├── agent-templates/
├── default-avatars/
├── moderation/
├── llm-settings/
└── system/
```

### `packages/contracts`

`packages/contracts` 是跨入口的接口约定包。

这里放：

- Zod 请求 schema。
- 从 schema 推出来的请求类型。
- 响应 DTO。
- `BizCode` 错误码。
- `ApiResponse<T>`、`buildSuccess()`、`buildFailure()`。

这里不放：

- 数据库 record。
- service 内部类型。
- 页面 props。
- 表格选中状态。
- 环境变量读取。
- fetch、数据库、DOM 或 Hono app。

新增接口先改 contracts：

```text
packages/contracts/src/<module>/<action>.contract.ts
  -> packages/contracts/src/index.ts
  -> apps/api/src/modules/<module>
  -> apps/api/src/routes/index.ts
  -> apps/web/src/api 或 apps/admin/src/api
```

### `packages/ui`

`packages/ui` 只放 `web` 和 `admin` 都会用的通用 React 组件。

可以放：

- button。
- card。
- dialog。
- input。
- sidebar。

不要放：

- `MoodEntryCard`。
- `AgentInboxPanel`。
- 会调用接口的组件。
- 带业务权限判断的组件。

只有一个 app 用的组件，先留在这个 app 里。

## 依赖方向

依赖只能这样走：

```text
apps/web
  -> packages/contracts
  -> packages/ui
  -> packages/typescript-config
  -> packages/eslint-config

apps/admin
  -> packages/contracts
  -> packages/ui
  -> packages/typescript-config
  -> packages/eslint-config

apps/api
  -> packages/contracts

packages/contracts
  -> 不依赖 apps/*

packages/ui
  -> 不依赖 apps/*
  -> 不依赖 packages/contracts
```

规则：

- app 可以 import package。
- package 不 import app。
- API 不 import Web 或 Admin 代码。
- Web 和 Admin 不 import `apps/api/src`。
- contracts 不 import UI、Hono、数据库或环境变量。
- UI 不读 session、不拼 URL、不写业务数据。

## API 分层规则

业务接口使用这条线：

```text
route -> service -> repository -> presenter
```

route 只做这些事：

- 定义 URL 和 HTTP method。
- 调 `zValidator` 校验请求。
- 从 `c.req.valid()` 取已校验数据。
- 读取当前请求上下文。
- 调 service。
- 用 `buildSuccess()` 返回 JSON。

service 只做这些事：

- 检查当前用户能不能做这件事。
- 组织一次业务动作。
- 调 repository、LLM client、storage client。
- 把服务端错误转成 `AppError`。

repository 只做这些事：

- 读写 D1。
- 隐藏表名、join 和 where 条件。
- 返回 service 能处理的 record。

presenter 只做这些事：

- 把内部 record 转成 contracts 里的 DTO。
- 去掉用户端不能看到的字段。
- 把时间字段按接口约定转成数字或 ISO 字符串。

不要这样写：

- route 里直接写 SQL。
- route 里拼 LLM prompt。
- repository 里拼 API 响应。
- 一个 route 文件同时写鉴权、查询、外部服务调用和响应转换。

## 领域模块

### `system`

`system` 负责服务状态。

已实现：

- `/`
- `/health`
- `/rpc/system/ping`
- `RootResponse`
- `HealthResponse`
- `PingRequest`
- `PingResponse`

后续健康检查分两层：

- 一期只返回 API 版本、环境和基础状态。
- 接 D1、R2、LLM 后，Admin 再查看这些外部资源的检查结果。

健康检查不能返回 secret、数据库 ID、上游 key 和用户数据。

### `auth`

`auth` 负责登录和会话。

这里放：

- Web 登录。
- Admin 登录。
- GitHub OAuth。
- access token。
- refresh token hash。
- session 撤销。

接口分开：

```text
/auth/web/*
/auth/admin/*
```

不要用一个登录接口同时服务 Web 和 Admin。后台入口必须检查管理员身份。

### `user`

`user` 负责用户主体资料。

这里放：

- `users`。
- `user_emails`。
- 用户头像 key。
- 用户状态。
- Web 用户资料。
- Admin 用户列表和详情。

头像文件本体放 R2。数据库只存 key、文件名、content type、大小、创建时间和归属。

### `mood`

`mood` 负责情绪记录。

情绪记录不是聊天消息。它有自己的表和接口。

这里放：

- 情绪状态。
- 情绪强度。
- 原因文本。
- 下一步行动。
- 标签。
- 记录时间。
- 可选的 Agent 或会话 ID。

状态先支持：

```text
draft
saved
archived
```

Agent 可以读取最近的情绪记录，但不能把聊天消息直接写成情绪记录。

### `agent`

`agent` 负责用户的 AI 陪伴对象。

这里放：

- 名称。
- 头像。
- 简介。
- 人设。
- 语气。
- 边界说明。
- 开场白。
- 默认 prompt。
- 状态。
- 可见范围。

状态先支持：

```text
draft
published
archived
```

后台 Agent 模板和用户自己的 Agent 分开存。用户从模板创建 Agent 时，API 复制一份给当前用户。

### `chat`

`chat` 负责私聊。

这里放：

- 会话。
- 消息。
- 用户消息。
- assistant 消息。
- 最近消息。
- 消息反馈。

消息状态先支持：

```text
completed
failed
```

发送消息流程：

```text
Web 请求函数提交用户消息
  -> API 校验用户和 Agent 归属
  -> 写入 user message
  -> 读取 Agent prompt、最近消息、可用记忆、最近情绪记录
  -> 调 LLM
  -> 写入 assistant message
  -> 更新会话时间
  -> 返回 assistant message DTO
```

一期使用非流式返回。做流式前，先把返回协议写进 contracts。

### `memory`

`memory` 负责 Agent 记忆。

记忆不是聊天记录。聊天记录按时间保存，记忆是用户手动保存或系统从聊天里整理出来的短文本。

这里放：

- 记忆类型。
- 内容。
- 重要程度。
- 状态。
- 来源消息 ID。
- 创建时间和更新时间。

状态先支持：

```text
active
disabled
deleted
```

用户必须能看见、编辑和删除记忆。自动整理出来的记忆要保存来源，方便用户知道它从哪来。

### `care`

`care` 负责主动关怀。

一期只做手动触发。用户点按钮后，API 读取用户、Agent、记忆和最近情绪记录，再调 LLM 生成关怀消息。

这里放：

- 是否启用。
- 频率。
- 偏好时间。
- 场景。
- 语气。
- 自定义提示。
- 下次运行时间。
- 关怀消息。
- 已读时间。
- 最近失败原因。

自动触发放到二期。二期优先用 Workers Cron，不急着拆 `apps/worker`。

### `assets`

`assets` 负责文件元数据和 R2 key。

这里放：

- 用户头像。
- Agent 头像。
- 默认头像。
- 业务图片素材。

Web 和 Admin 上传文件时，API 检查文件类型、大小和归属。前端不能自己拼 R2 key。

### `llm`

`llm` 负责调用上游模型。

这里放：

- provider 配置。
- Base URL。
- 模型名。
- Wire API 类型。
- reasoning 参数。
- 超时。
- 重试次数。
- 上游错误转换。

API 是唯一能读取模型 key 的地方。Web 和 Admin 只传业务参数，不传 key。

LLM 返回空文本、HTML 页面或协议不匹配时，API 返回明确错误码。不要把失败消息伪装成正常回复。

### 后续模块

这些模块不放进第一阶段：

- `group-chat`：多个 Agent 一起聊天。
- `subscription`：订阅计划和用户绑定。
- `billing`：账单记录。
- 更细后台角色。

需要做这些模块时，先补 contracts 和数据表，再补 API 和页面。

## 状态保存位置

### 业务数据

保存位置：Cloudflare D1。

写入入口：`apps/api/src/modules/<module>/*.repository.ts`。

读取入口：service 调 repository，presenter 转 DTO。

说明：目前 D1 未接入。接入时再新增 `apps/api/src/db`、`apps/api/migrations` 和 `apps/api/dev/seed.sql`。

### 文件

保存位置：Cloudflare R2。

写入入口：`assets` 模块。

读取入口：API 返回可访问 URL 或签名 URL，前端不拼 key。

说明：目前 R2 未接入。接入前不要在 Web 或 Admin 写文件 key 规则。

### 请求上下文

保存位置：Hono `c.var`。

写入入口：`registerRequestContext()`。

当前字段：

- `requestId`
- `startedAt`

这些字段只属于当前请求，不写数据库。

### 配置

保存位置：Cloudflare Workers bindings 和环境变量。

读取入口：`apps/api/src/shared/env.ts`。

当前字段：

- `APP_ENV`
- `CORS_ORIGINS`

后续新增 LLM、D1、R2 配置时，也从 API 读取。不要让浏览器读取 secret。

### 前端 UI 状态

保存位置：React state、表单状态、请求缓存或浏览器临时存储。

写入入口：Web/Admin 页面或组件。

说明：UI 状态不是业务数据。刷新后需要恢复的内容，必须写到 API。

## 接口和 contracts

API 统一返回 `ApiResponse<T>`。

成功返回：

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "<request-id>",
    "timestamp": "<iso-time>"
  }
}
```

失败返回：

```json
{
  "ok": false,
  "error": {
    "code": "COMMON.INVALID_REQUEST",
    "message": "请求参数无效",
    "details": []
  },
  "meta": {
    "requestId": "<request-id>",
    "timestamp": "<iso-time>"
  }
}
```

用户端接口：

```text
/auth/web/password/login
/auth/web/github/authorize
/auth/web/github/callback
/auth/web/token/refresh
/auth/web/logout

/rpc/user/profile
/rpc/mood/entries
/rpc/agent/my
/rpc/chat/conversations
/rpc/memory
/rpc/care
```

后台接口：

```text
/auth/admin/password/login
/auth/admin/token/refresh
/auth/admin/logout

/rpc/admin/users
/rpc/admin/agent-templates
/rpc/admin/default-avatars
/rpc/admin/moderation
/rpc/admin/llm-settings
/rpc/admin/system
```

规则：

- 用户端接口只返回当前用户能看到的数据。
- 后台接口可以返回后台页面需要的字段。
- 两边不要共用同一个响应 DTO。
- 两边可以共用 service 和 repository，但 route、contracts、presenter 要分开。

## 数据和迁移

接 D1 时补这些文件：

```text
apps/api/
├── migrations/
├── dev/
│   └── seed.sql
└── src/
    ├── db/
    │   ├── client.ts
    │   └── schema.ts
    └── modules/
```

规则：

- 表按业务模块建。
- 不做一张万能内容表。
- 常查字段放独立列。
- JSON 字段必须写 schema 和版本字段。
- 时间字段统一存毫秒时间戳，例如 `createdAtMs`、`updatedAtMs`。
- 响应 DTO 明确返回 ISO 字符串还是数字，不在页面里临时猜。
- 主动作先写业务数据，派生动作失败时记录失败原因，不默认撤销已经保存的数据。

## 鉴权和权限

登录分 Web 和 Admin。

Web 登录后拿 Web session，只能调用用户端接口。

Admin 登录后拿 Admin session，必须是管理员才能调用后台接口。

受保护接口按这个顺序检查：

```text
读 Authorization header
  -> 验证 access token
  -> 读取 session
  -> 检查 session 是否过期或撤销
  -> 检查用户状态
  -> 检查角色或资源归属
```

Web 资源按 `userId` 检查。用户只能看自己的 Agent、情绪记录、聊天记录和记忆。

第一版 Admin 只区分普通用户和管理员。不要提前拆复杂角色。

## LLM 调用

聊天和主动关怀都由 API 调 LLM。

私聊 prompt 读取顺序：

```text
系统安全说明
  -> Agent 默认 prompt
  -> 用户可用记忆
  -> 最近情绪记录
  -> 最近对话消息
  -> 当前用户消息
```

assistant 回复成功后，再处理记忆整理。一期可以同步执行。消息量变大后，再改成任务。

LLM 出错时：

- 用户消息保留。
- assistant 消息写 `failed`。
- API 返回错误码。
- Web 显示重试入口。

## 主动关怀和任务

一期主动关怀手动触发：

```text
Web 点击生成关怀
  -> API 检查用户、Agent 和关怀设置
  -> 读取记忆和最近情绪记录
  -> 调 LLM
  -> 写入 care event
  -> 返回关怀消息 DTO
```

二期自动触发使用 Workers Cron：

```text
Cron 找到到期 care plan
  -> 读取用户、Agent、记忆、最近情绪记录
  -> 调 LLM
  -> 写入 conversation message
  -> 写入 care event
  -> 更新 nextRunAtMs
```

生成失败时记录失败原因，不撤销用户设置。Admin 要能看到最近一次失败。

## 失败处理

请求参数错误：

- route 的 `zValidator` 抛 `AppError`。
- 返回 `COMMON.INVALID_REQUEST`。

接口不存在：

- `app.notFound()` 返回 `COMMON.NOT_FOUND`。

服务内部错误：

- `app.onError()` 打印错误。
- 返回 `SYSTEM.INTERNAL_ERROR`。

外部服务超时：

- service 转成 `AppError`。
- 优先使用 `SYSTEM.UPSTREAM_TIMEOUT`。

权限失败：

- auth 或 service 返回权限错误码。
- 不返回资源是否存在的多余细节。

任务失败：

- 记录失败原因、任务 ID、重试次数和时间。
- 用户或 Admin 从对应页面点重试。

## 开发维护规则

改 API：

```text
packages/contracts/src/<module>
  -> packages/contracts/src/index.ts
  -> apps/api/src/modules/<module>
  -> apps/api/src/routes/index.ts
  -> apps/web/src/api 或 apps/admin/src/api
```

改 Web：

```text
apps/web/app
  -> apps/web/src/api
  -> apps/web/src/components
  -> apps/web/src/lib
```

改 Admin：

```text
apps/admin/app
  -> apps/admin/src/api
  -> apps/admin/src/components
  -> apps/admin/src/lib
```

改 UI 包：

```text
packages/ui/src
  -> apps/web 或 apps/admin import
```

只有两个入口都用的组件才移动到 `packages/ui`。

## 文档冲突和源码差异

- `package.json` 写的是 `pnpm@11.9.0`，项目说明里写过 `pnpm 11.5.0`。以 `package.json` 为准。
- `AGENTS.md` 的目录树漏了 `packages/contracts`，源码里已经存在。以源码为准。
- `wrangler.jsonc` 目前没有启用 D1、R2、KV、AI 或队列绑定。本文里的 D1、R2、LLM 是下一阶段设计。
- `docs/apps/api.md` 还写着参考老师项目和 momo 写法。后续改 API 文档时，按本文的目录和分层规则写。
- `docs/architecture.md` 当前是未跟踪文件，提交前要确认它确实要加入 git。

## 当前维护风险

- `packages/ui` 已经被 `web` 和 `admin` 声明依赖，但当前 app 里还没有实际 import。后续如果长期只有一个入口使用某个组件，不要放进 `packages/ui`。
- `apps/admin` 还停在 starter 页面，下一阶段做后台时要先建 `(auth)` 和 `(dashboard)` 目录。
- `apps/web` 现在还没有 `src/api` 和统一 `http`。新增业务页面前先补请求函数目录。
- D1 和 R2 还没接入。不要提前在前端写数据库字段、文件 key 或上传路径规则。

## 检查命令

只改这份文档时跑：

```bash
pnpm prettier --check docs/architecture.md
```

改 TS 或 TSX 后按顺序跑：

```bash
pnpm check-types
pnpm lint
pnpm prettier --check "**/*.{ts,tsx,md}"
```

当前项目没有测试脚本。需要测试时，先在对应 app 或 package 里补脚本，再把命令写回这里。
