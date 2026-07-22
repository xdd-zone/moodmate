# Admin 用户管理

## 1. Scope / Trigger

- 修改 `/users`、`src/api/users.*`、`src/server/users` 或 `app/api/users` 时使用。
- 浏览器只访问 Admin 同源 BFF，API 地址和 access token 留在 Next.js server-only 代码。

## 2. Signatures

```ts
getAdminUsers(query): Promise<UserListResponse>;
createAdminUser(input): Promise<UserMutationResponse>;
```

```text
GET  /api/users?page=1&pageSize=10
POST /api/users
```

## 3. Contracts

- BFF 校验分页和创建请求，读取 Admin cookie 后转发统一 API 响应。
- 客户端请求使用 `withAdminSessionRecovery()`，Query key 包含 `page` 和 `pageSize`。
- 创建成功后使 `adminUserKeys.all` 失效，并回到第一页。
- 角色下拉复用真实角色 query，只显示 `status=active` 的角色，提交 `roleId`。
- 页面只展示 Contract 字段，不展示套餐、活跃度、虚构统计或本地演示用户。

## 4. Validation & Error Matrix

| 条件                  | 页面行为                                        |
| --------------------- | ----------------------------------------------- |
| `AUTH.ACCESS_EXPIRED` | 刷新 session 后最多重试一次                     |
| 列表失败              | 显示 API message 和重新加载按钮                 |
| 角色列表为空或失败    | 禁用创建按钮并显示具体原因                      |
| 邮箱已存在            | 抽屉保留输入并显示“该邮箱已存在”                |
| 创建成功              | 关闭抽屉、使用户 query 失效并显示刷新后的第一页 |

## 5. Good / Base / Bad Cases

- Good：表单用 `UserCreateRequestSchema` 校验，错误 message 从 typed HTTP 传到表单。
- Base：表格在窄屏放进自己的横向滚动容器，页面本身不横向溢出。
- Bad：Client Component 读取 cookie、`API_BASE_URL` 或直接调用 Hono。

## 6. Tests Required

- Admin build 生成 `/users` 和 `/api/users`。
- 登录后验证列表加载、空状态、上一页/下一页和创建后刷新。
- 重复邮箱 message 在抽屉内可见；浏览器缓存和响应不含 token 或 password hash。
- 在桌面和 390px 视口检查表格滚动、抽屉宽度、按钮与文字不重叠。

## 7. Wrong vs Correct

```ts
// Wrong: browser calls the external API
http.get("/rpc/admin/users", UserListResponseSchema);

// Correct: browser calls the same-origin BFF
http.get("/api/users", UserListResponseSchema, { query });
```
