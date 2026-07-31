# Web 页面与组件

## 服务端组件优先

页面默认保持服务端组件。只有需要浏览器事件、React state、本地存储或浏览器 API 时才加 `"use client"`。当前 `app/(site)/page.tsx`、`app/(app)/chats/page.tsx` 和动态聊天页面都是服务端组件，登录恢复和聊天交互留在客户端子组件。

不要因为子组件需要交互就把整页改成 client component；把交互区域拆成较小的客户端组件。

## 页面内容

公开首页按 Open Design `login.html` 实现，当前位于 `apps/web/app/(site)/page.tsx`。首屏只显示欢迎文案和“进入 MoodMate”；登录面板在用户点击后出现，Escape 和“返回”恢复欢迎状态。

邮箱密码调用 `loginWeb`，成功后进入 `/chats`。GitHub 按钮发起真实 OAuth；Google 只显示尚未开放，不发送请求。登录面板使用“邮箱登录 / GitHub / Google”分段切换，支持左右方向键、密码显隐、Escape 和“返回”。

## GitHub OAuth 登录

### 1. 使用范围

- `LoginForm` 只负责按钮状态、错误展示和跳转动作。
- `src/api/github-auth.api.ts` 调用 typed HTTP。
- `src/auth/login-client.ts` 保存 OAuth state、兑换 ticket 并调用 `saveClientSession`。
- `/login/github/callback` 读取查询参数并完成登录，不把 OAuth 逻辑放进服务端页面。

### 2. 函数与接口

```ts
getWebGithubAuthUrl(): Promise<WebGithubAuthUrlResponse>;
loginWithWebGithubTicket(
  payload: WebGithubTicketLoginRequest,
): Promise<WebGithubTicketLoginResponse>;
redirectToGithubLogin(): Promise<void>;
loginWebWithGithubTicket(
  payload: WebGithubTicketLoginRequest,
): Promise<WebSession>;
consumeStoredGithubOauthState(): string | null;
```

对应 API：

- `GET /auth/web/github/authorize`
- `GET /auth/web/github/callback`
- `POST /auth/web/github/ticket/login`

### 3. 浏览器合同

- authorize 响应的 `state` 保存到 `sessionStorage` 的 `web:github-oauth-state`。
- 跳转只使用 API 校验后的 `url`，页面不能自己拼 GitHub authorize 参数。
- API callback 把浏览器送回 `/login/github/callback?ticket=...&state=...`，错误时使用 `?error=...`。
- Web callback 先比较 URL state 和本地 state，再兑换 ticket。本地 state 读取后立即删除。
- ticket 登录与邮箱登录都调用 `saveClientSession`，成功后进入 `/chats`。
- GitHub token、MoodMate access token 和 refresh token 都不能写进 callback URL。

### 4. 校验与错误

| 条件                                    | 页面行为                                   |
| --------------------------------------- | ------------------------------------------ |
| authorize 请求失败                      | 登录面板显示 API 错误，允许重新点击 GitHub |
| callback 包含 `error`                   | 删除本地 state，显示返回首页入口           |
| callback 缺少 ticket                    | 删除本地 state，提示重新登录               |
| URL state 缺失、不匹配或本地 state 缺失 | 不兑换 ticket，提示状态校验失败            |
| ticket 无效、过期或已使用               | 不保存 session，显示 API 错误              |
| React Strict Mode 重复运行 effect       | 同一组件实例只兑换一次 ticket              |
| 兑换报错但本地已有有效 session          | 进入 `/chats`，不显示假失败页              |

### 5. 正常、基础和错误案例

- 正常：获取 authorize URL，保存 state，完成 GitHub callback，兑换 ticket，保存 session 后进入 `/chats`。
- 基础：Google 按钮只显示尚未开放，URL 和网络请求都不变化。
- 错误：页面直接读取 ticket 并保存为登录态，会绕过 API 的一次性消费和 token 签发。

### 6. 必做检查

- GitHub 按钮只能发送一次 authorize 请求，等待期间不能重复提交或切换登录方式。
- callback 覆盖 `error`、缺少 ticket、state 不匹配、ticket 失败和成功进入 `/chats`。
- callback 页面使用 Suspense 包住读取 `useSearchParams` 的客户端组件。
- 依次运行 `pnpm check-types`、`pnpm lint`、`pnpm format:check` 和 `pnpm --filter web build`。

### 7. 错误与正确写法

```ts
// 错误：页面自己拼 authorize URL，state 没有经过 API 签名
window.location.assign(
  `https://github.com/login/oauth/authorize?state=${state}`,
);

// 正确：API 返回经过合同校验的 URL 和 state
const response = await getWebGithubAuthUrl();
window.sessionStorage.setItem("web:github-oauth-state", response.state);
window.location.assign(response.url);
```

## 链接与交互

- 站内导航使用 `next/link` 的 `Link`。
- 指向 API 健康检查的外部地址使用 `<a>`。
- 主要链接和按钮必须有可见的 `focus-visible` 样式。
- 触摸目标尽量达到 `44px`；当前主要 CTA 使用 `min-h-11`。
- 数组渲染使用稳定业务值作为 `key`，参考 `moodOptions` 和 `steps`；序号只用于显示。

## 文案

页面默认使用中文短句。按钮写动作和对象，例如“开始记录”“查看服务状态”；报错写明失败位置和下一步，不写夸张宣传语。
