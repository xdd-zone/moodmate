# 技术设计

- 保留 `AgentsGuard` 和现有 user agent query/mutation。
- 通讯录页面复用原型应用外壳的 `no-list` 形态。
- 朋友卡片操作继续使用现有 CRUD 表单；详情链接使用稳定的 `agent.id`。
- 规范页面为 `/friends` 与 `/friends/[id]`；删除旧 `/agents` 路由，不实现重定向。
- 详情页通过客户端 query 查找 `id`，避免新增 API 合同；后续若有单项查询接口再替换。
- 静态档案内容集中在展示数据模块，不混入 contracts 类型或提交 payload。
