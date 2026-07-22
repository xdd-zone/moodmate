# Admin 默认头像管理

## 1. 适用范围

修改 Admin `/default-avatar` 页面、同源 BFF、默认头像请求、Query cache、图片预览或上传文件校验时使用本规范。

## 2. 接口签名

浏览器只调用 Admin 同源路径：

```text
GET  /api/default-avatars/current
GET  /api/default-avatars/history
POST /api/default-avatars
POST /api/default-avatars/:versionId/current
GET  /api/default-avatars/image?key=<default-avatar-key>
```

浏览器请求入口：

```ts
getAdminCurrentDefaultAvatar(options?);
getAdminDefaultAvatarHistory(options?);
uploadAdminDefaultAvatar(file: File);
setAdminCurrentDefaultAvatar(versionId: string);
```

`http.postForm(path, formData, responseSchema, options?)` 负责 FormData 请求；现有 `http.post()` 继续只发送 JSON。

## 3. 合同

- BFF 从 HttpOnly cookie 读取 Admin access token，浏览器不能接触 token 或 `API_BASE_URL`。
- 上传和设为当前是 POST，必须通过 `validateSameOrigin()`。
- FormData 只包含名为 `file` 的一个文件；不要手写 `content-type`，让 `fetch()` 生成 multipart boundary。
- 页面使用 `DefaultAvatarContentTypeSchema` 和 `DEFAULT_AVATAR_MAX_BYTES` 做即时提示，API 继续执行相同约束。
- 当前版本和历史列表使用独立 query key，mutation 成功后失效 `adminDefaultAvatarKeys.all`。
- 图片预览使用 `/api/default-avatars/image?key=...`；BFF 校验 key，只转发图片相关响应头和 body。

## 4. 校验与错误矩阵

| 条件                    | 页面或 BFF 结果                               |
| ----------------------- | --------------------------------------------- |
| MIME 不是 jpeg/png/webp | 页面提示“头像只支持 JPG、PNG 或 WebP 文件”    |
| 文件为空                | 页面提示“头像文件不能为空”                    |
| 文件超过 2 MiB          | 页面提示“头像文件不能超过 2 MiB”              |
| POST Origin 无效        | 403、`COMMON.INVALID_REQUEST`                 |
| access cookie 缺失      | 401、`AUTH.ACCESS_MISSING`，并清理认证 cookie |
| access 已过期           | `withAdminSessionRecovery()` 续期后重试一次   |
| 上游响应不符合 Contract | 502、`SYSTEM.INTERNAL_ERROR`                  |
| 当前版本未配置          | 展示“尚未上传默认头像”，历史列表可以为空      |

## 5. 正常、基础和错误案例

- 正常：上传一张 PNG 后当前版本与历史列表同时刷新；选择历史版本后两个区域再次同步刷新。
- 基础：空库进入页面时显示上传入口和空历史，不生成虚构头像。
- 错误：浏览器直接请求 Hono 上传接口，或给 FormData 手动设置不含 boundary 的 `content-type`。

## 6. 必做检查

```bash
pnpm check-types
pnpm lint
pnpm format:check
pnpm --filter admin build
```

- 上传允许文件后，断言当前版本文件名变化、历史数量增加、成功提示出现。
- 切换历史版本后刷新页面，断言当前版本保持。
- 选择错误 MIME、空文件和超限文件，断言请求发出前出现具体提示。
- 检查浏览器 Network，业务请求只访问 Admin origin，静态产物不含私有 `API_BASE_URL`。

## 7. 错误与正确写法

```ts
// 错误：手写 multipart content-type 会漏掉 boundary
http.post("/api/default-avatars", formData, responseSchema, {
  init: { headers: { "content-type": "multipart/form-data" } },
});

// 正确：独立方法保留 FormData body，让 fetch 设置 content-type
http.postForm("/api/default-avatars", formData, responseSchema);
```
