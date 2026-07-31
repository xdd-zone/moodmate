# Web 质量检查

## 禁止写法

- 页面不直接写业务 `fetch()`；建立 `src/lib/http` 和 `src/api/<module>.api.ts` 后调用 typed HTTP。
- 不直接写数据库、调用 LLM、拼 R2 key 或读取 secret。
- 不 import `apps/api/src` 或 `apps/admin`。
- 不为纯服务端页面添加 `"use client"`。
- 不恢复 Next starter 文案、图片或样式。

## 类型

- metadata 使用 Next.js 的 `Metadata` 类型，参考 `app/layout.tsx` 和应用入口页。
- API 请求和响应类型从 `@repo/contracts` import，不在页面重复定义。
- 环境变量通过 `src/env/server.ts`、`src/env/client.ts` 读取；页面和组件不直接访问 `process.env`。
- 不用类型断言绕过未校验的接口响应。

## 手动检查

- `/` 在手机宽度可读，欢迎页和登录面板没有横向溢出或页脚重叠。
- “进入 MoodMate”打开登录面板并移动焦点，Escape 和“返回”恢复欢迎页。
- 登录方式支持点击和左右方向键切换，未选中的面板不能进入焦点顺序。
- 密码显隐按钮会同步输入类型、图标、可访问名称和焦点。
- GitHub 按钮调用 authorize API 并跳转 GitHub；Google 按钮不发送请求。
- `/login` 和 `/auth/callback/github` 返回 404。
- `/login/github/callback` 校验 state、兑换 ticket，并覆盖 callback 错误和参数缺失状态。
- Latte、Mocha 都能看清文字、边框和按钮，切换后刷新仍保留当前主题。
- 键盘可以聚焦主要链接。
- 减少动态效果时页面没有多余动画。

## 命令

修改 Web 后依次运行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter web build
```

项目目前没有自动化测试脚本，不能用“测试已通过”代替上述手动检查。
