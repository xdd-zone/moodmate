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

`APP_ENV`、`API_BASE_URL` 只给服务端使用。`NEXT_PUBLIC_APP_ENV`、`NEXT_PUBLIC_API_BASE_URL` 会进入浏览器代码，不能填写密钥。四项变量都会在页面构建时校验，缺失或格式错误会直接报错。

`APP_ENV` 的可选值是 `development`、`test`、`production`。test 和 production 的真实值由部署平台配置，不提交到仓库。

## 检查

在项目根目录依次执行：

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter admin build
```
