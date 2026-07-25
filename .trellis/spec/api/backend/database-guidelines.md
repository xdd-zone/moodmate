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
if (activeCount + newlyActivated.length > MAX_MEMBERS) throw memberLimitExceeded(); // 422

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

<!-- Database-related mistakes your team has made -->

(To be filled by the team)
