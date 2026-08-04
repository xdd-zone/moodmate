# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

<!--
Document your project's database conventions here.

Questions to answer:
- What ORM/query library do you use?
- How are migrations managed?
- What are the naming conventions for tables/columns?
- How do you handle transactions?
-->

(To be filled by the team)

---

## Query Patterns

### Pattern: 关系表软移除复活（membership soft-remove + revive）

**Problem**: 多实体关系表（如群聊成员 `agent_group_chat_members`）里，同一对 `(parent, child)` 会反复加入、移除、再加入。用 delete/insert 处理移除会丢历史、并让 `(parent, child)` 唯一约束失去意义。

**Solution**:

- 表上建 `UNIQUE(parent_id, child_id)`，一对关系永远只有一行。
- 移除走软移除：`status='removed'` + 写 `removed_at_ms`，不删行。
- 重新加入时先查这一行：存在则 `update` 复活（`status='active'`、`removed_at_ms=null`、`display_order` 续接），不存在才 `insert`。
- 上限校验只数 `status='active'` 的行，`removed` 行不计入。

**Example**:

```typescript
// service 层：加成员前算需要写入的行（复活 or 新插）
const existingByChild = new Map(existing.map((m) => [m.agentId, m]));
const activeCount = existing.filter((m) => m.status === "active").length;
const newlyActivated = childIds.filter((id) => {
  const row = existingByChild.get(id);
  return !row || row.status !== "active";
});
if (activeCount + newlyActivated.length > MAX_MEMBERS)
  throw memberLimitExceeded(); // 422

// repository 层：existingMemberId 有值走 update 复活，否则 insert
for (const m of members) {
  if (m.existingMemberId) {
    // UPDATE ... SET status='active', removed_at_ms=NULL, display_order=? WHERE id=?
  } else {
    // INSERT 新行
  }
}
```

**Why**: 保留成员进出历史；`UNIQUE(parent, child)` 不被重复行破坏；上限兜底只认 active，避免历史 removed 行占额度。

**Related**: 上限还需在 contract 层用 `.max(N)` 卡一次（见 `packages/contracts`），后端做最终兜底。

---

## Migrations

<!-- How to create and run migrations -->

(To be filled by the team)

---

## Naming Conventions

<!-- Table names, column names, index names -->

(To be filled by the team)

---

## Common Mistakes

### 在 `sql` 模板里手写关联条件，Drizzle 会渲染成裸列名

**Problem**: Drizzle 对单表查询会省略列的表前缀。`sql` 模板里的 `${table.column}` 只输出 `"column"`，不输出 `"table"."column"`。相关子查询因此关联不到外层表：

```typescript
// 错误：条件在 sql 模板里手写
const memberCountExpr = sql<number>`(
  SELECT COUNT(*) FROM ${agentGroupChatMembers}
  WHERE ${agentGroupChatMembers.groupChatId} = ${agentGroupChats.id}
    AND ${agentGroupChatMembers.status} = 'active'
)`;
```

`toSQL()` 打出来是 `WHERE "group_chat_id" = "id"`。子查询的 FROM 是成员表，而成员表同时有 `group_chat_id` 和 `id` 两列，SQLite 把两边都解析到内层表，条件变成成员表自身两列相比，`COUNT` 恒为 0。多表查询（带 `innerJoin`）反而不会踩到——Drizzle 那时不做单表优化，列都带表前缀。所以同一种写法在一处正常、换个查询就静默出错。

还有第二个坑：select 列表里的 `sql` 表达式没有 `as()` 时，结果集列名是整段子查询文本，`row.memberCount` 读到 `undefined`，`Number(undefined ?? 0)` 又兜成 0。两个缺陷都指向同一个数字，只修一个仍然是 0。

**Solution**: 关联条件用 `eq()` / `and()` 生成，末尾补 `as()` 别名。`eq()` 返回 SQL 对象，渲染时不受单表优化影响：

```typescript
const activeMemberCountExpr = sql<number>`(
  SELECT COUNT(*) FROM ${agentGroupChatMembers}
  WHERE ${eq(agentGroupChatMembers.groupChatId, agentGroupChats.id)}
    AND ${eq(agentGroupChatMembers.status, "active")}
)`.as("member_count");
```

生成 `WHERE "agent_group_chat_members"."group_chat_id" = "agent_group_chats"."id" AND "agent_group_chat_members"."status" = ?`，条件正确、值也参数化了。

**Verify**: 改完别只看接口返回。用 `query.toSQL()` 打出真实语句，确认每个列引用都带表前缀、子查询有别名；再把同一段 SQL 在 D1 上直接跑一遍对数：

```bash
pnpm exec wrangler d1 execute moodmate-local --local --command "SELECT ..." --yes
```

计数类字段返回 0 或恒等值时，先怀疑这一条，别先怀疑数据。
