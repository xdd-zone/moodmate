# Web 页面与组件

## 服务端组件优先

页面默认保持服务端组件。只有需要浏览器事件、React state、本地存储或浏览器 API 时才加 `"use client"`。当前 `app/(site)/page.tsx`、`app/(app)/chats/page.tsx` 和动态聊天页面都是服务端组件，登录恢复和聊天交互留在客户端子组件。

不要因为子组件需要交互就把整页改成 client component；把交互区域拆成较小的客户端组件。

## 页面内容

公开首页按 Open Design `login.html` 实现，当前位于 `apps/web/app/(site)/page.tsx`。首屏只显示欢迎文案和“进入 MoodMate”；登录面板在用户点击后出现，Escape 和“返回”恢复欢迎状态。

邮箱密码继续调用 `loginWeb`，成功后进入 `/chats`。GitHub 和 Google 按钮只显示“暂未开放”，不能发起 OAuth 请求。`/auth/callback/github` 是静态说明页，不读取 ticket、state 或其他查询参数。

## 链接与交互

- 站内导航使用 `next/link` 的 `Link`。
- 指向 API 健康检查的外部地址使用 `<a>`。
- 主要链接和按钮必须有可见的 `focus-visible` 样式。
- 触摸目标尽量达到 `44px`；当前主要 CTA 使用 `min-h-11`。
- 数组渲染使用稳定业务值作为 `key`，参考 `moodOptions` 和 `steps`；序号只用于显示。

## 文案

页面默认使用中文短句。按钮写动作和对象，例如“开始记录”“查看服务状态”；报错写明失败位置和下一步，不写夸张宣传语。
