# api

独立 API 服务。

## 运行

在项目根目录执行：

```bash
pnpm dev:api
```

健康检查：

```bash
curl http://localhost:8787/health
```

正常返回：

```json
{
  "data": {
    "env": "development",
    "service": "api",
    "status": "ok"
  },
  "meta": {
    "requestId": "<request-id>",
    "timestamp": "<iso-time>"
  },
  "ok": true
}
```
