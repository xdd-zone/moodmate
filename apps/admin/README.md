# admin

管理后台。

## 运行

在项目根目录执行：

```bash
pnpm dev:admin
```

访问：

```text
http://localhost:6154
```

## 环境变量

从示例文件创建本地配置：

```bash
cp apps/admin/.env.example apps/admin/.env.local
```

`APP_ENV`、`API_BASE_URL` 只给 Next.js 服务端使用。浏览器通过 Admin 同源 BFF 请求 API，不需要配置公开 API 地址。`NEXT_PUBLIC_APP_ENV` 会进入浏览器代码，不能填写密钥。三项变量都会在读取时校验，缺失或格式错误会直接报错。

`APP_ENV` 的可选值是 `development`、`test`、`production`。test 和 production 的真实值由部署平台配置，不提交到仓库。

## 检查

在项目根目录依次执行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter admin build
```
