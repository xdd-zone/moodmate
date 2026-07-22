# Admin 头像管理

## 1. 适用范围

修改 Admin `/default-avatar`、`/profile`、同源头像 BFF、Query cache、图片展示或上传文件校验时使用本规范。

## 2. 接口签名

浏览器只调用 Admin 同源路径：

```text
GET  /api/default-avatars/current
GET  /api/default-avatars/history
POST /api/default-avatars
POST /api/default-avatars/:versionId/current
GET  /api/default-avatars/image?key=<default-avatar-key>

GET  /api/profile
POST /api/profile/avatar
GET  /api/profile/avatar/image?key=<resolved-avatar-key>
```

浏览器请求入口：

```ts
getAdminCurrentDefaultAvatar(options?);
getAdminDefaultAvatarHistory(options?);
uploadAdminDefaultAvatar(file: File);
setAdminCurrentDefaultAvatar(versionId: string);
getAdminProfile(options?);
uploadAdminProfileAvatar(file: File);
```

`http.postForm(path, formData, responseSchema, options?)` 负责 FormData 请求；现有 `http.post()` 继续只发送 JSON。

## 3. 合同

- BFF 从 HttpOnly cookie 读取 Admin access token，浏览器不能接触 token 或 `API_BASE_URL`。
- 上传和设为当前是 POST，必须通过 `validateSameOrigin()`。
- FormData 只包含名为 `file` 的一个文件；不要手写 `content-type`，让 `fetch()` 生成 multipart boundary。
- 页面使用 `DefaultAvatarContentTypeSchema` 和 `DEFAULT_AVATAR_MAX_BYTES` 做即时提示，API 继续执行相同约束。
- 当前版本和历史列表使用独立 query key，mutation 成功后失效 `adminDefaultAvatarKeys.all`。
- 图片预览使用 `/api/default-avatars/image?key=...`；BFF 校验 key，只转发图片相关响应头和 body。
- 个人头像页面使用 `PersonalAvatarContentTypeSchema` 和 `PERSONAL_AVATAR_MAX_BYTES` 做即时校验；文件规则仍由 API 再校验一次。
- profile query key 为 `adminProfileKeys.all`。上传成功只失效 profile query，不失效 Admin session query。
- Header 姓名读取 `AdminSession`，头像读取 profile query。显示顺序是个人头像、当前默认头像、姓名首字；图片加载失败也回到姓名首字。
- `/profile` 展示 profile 中的账号字段和 Admin session 中的 `sessionId`、`expiresAtMs`，不能把 session 字段复制进 profile Contract。
- 三个 `/api/profile*` Route Handler 都从 HttpOnly cookie 读取 access token。POST 校验同源 Origin；图片 BFF 只转发图片响应头和 body。
- 个人头像图片响应的 `cache-control` 必须为 private；不能把默认头像的 public 缓存策略用于受保护的个人头像 BFF。

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
| 个人头像 key 无效       | 400、`COMMON.INVALID_REQUEST`                 |
| 个人头像不属于当前用户  | 403、`AUTH.FORBIDDEN`                         |
| profile 没有头像        | 显示姓名首字                                  |

## 5. 正常、基础和错误案例

- 正常：上传一张 PNG 后当前版本与历史列表同时刷新；选择历史版本后两个区域再次同步刷新。
- 基础：空库进入页面时显示上传入口和空历史，不生成虚构头像。
- 错误：浏览器直接请求 Hono 上传接口，或给 FormData 手动设置不含 boundary 的 `content-type`。
- 正常：上传个人头像后失效 `adminProfileKeys.all`，资料页和 Header 使用同一份新 profile 数据。
- 基础：没有个人头像时 profile 返回当前默认头像；两者都没有时 `AdminAvatar` 显示姓名首字。
- 错误：Header 自己请求默认头像、资料页自己请求个人头像，会形成两套回退顺序和不同步的 cache；两处必须共用 profile query。

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
- 登录后从 Header 进入 `/profile`，断言姓名来自 session，账号字段来自 profile，页面不包含 token。
- 上传个人头像后断言资料页和 Header 同步刷新；刷新页面后仍显示同一头像。
- 验证个人头像、默认头像、没有头像和图片加载失败四种显示结果。

## 7. 错误与正确写法

```ts
// 错误：手写 multipart content-type 会漏掉 boundary
http.post("/api/default-avatars", formData, responseSchema, {
  init: { headers: { "content-type": "multipart/form-data" } },
});

// 正确：独立方法保留 FormData body，让 fetch 设置 content-type
http.postForm("/api/default-avatars", formData, responseSchema);
```

```ts
// 错误：个人头像变化后同时失效 session，制造无关认证请求
queryClient.invalidateQueries({ queryKey: adminSessionKeys.all });

// 正确：资料页和 Header 共用 profile query，只失效头像所属缓存
queryClient.invalidateQueries({ queryKey: adminProfileKeys.all });
```
