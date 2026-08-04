import { and, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { createD1Client } from "@/infra/db/d1";
import {
  applications,
  passwordCredentials,
  roles,
  userEmails,
  userRoleBindings,
  users,
} from "@/modules/auth/auth.schema";
import {
  agents,
  agentConversationMessages,
  agentConversations,
} from "@/modules/agents/agents.schema";
import {
  agentGroupChatMessages,
  agentGroupChats,
} from "@/modules/group-chat/group-chat.schema";

/**
 * 用户消息数的两个关联子查询。
 *
 * 关联条件必须用 `eq()` / `and()` 生成，不能在 sql 模板里手写 `${table.column} = ...`：
 * 那样只会渲染成裸列名，多表查询时报 ambiguous column，单表查询时更糟——静默匹配错表。
 * 外层 select 也必须给每个表达式 `as()` 别名，否则结果集列名是整段子查询文本，取不到值。
 */
const USER_DIRECT_MESSAGE_COUNT = sql`(select count(*) from ${agentConversationMessages} inner join ${agentConversations} on ${eq(agentConversations.id, agentConversationMessages.conversationId)} where ${eq(agentConversations.userId, users.id)})`;

const USER_GROUP_MESSAGE_COUNT = sql`(select count(*) from ${agentGroupChatMessages} inner join ${agentGroupChats} on ${eq(agentGroupChats.id, agentGroupChatMessages.groupChatId)} where ${eq(agentGroupChats.userId, users.id)})`;

export async function findUserList(
  database: D1Database | undefined,
  input: {
    keyword?: string;
    limit: number;
    offset: number;
    status?: "active" | "suspended";
  },
) {
  const db = createD1Client(database);
  const conditions = [ne(users.status, "deleted")];
  if (input.status) conditions.push(eq(users.status, input.status));
  if (input.keyword) {
    const pattern = `%${input.keyword}%`;
    const keywordCondition = or(
      like(users.displayName, pattern),
      like(userEmails.email, pattern),
    );
    if (keywordCondition) conditions.push(keywordCondition);
  }
  const where = and(...conditions);
  const totalRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(users)
    .innerJoin(
      userEmails,
      and(eq(userEmails.userId, users.id), eq(userEmails.isPrimary, true)),
    )
    .where(where);
  const total = Number(totalRows[0]?.total ?? 0);
  const items = await db
    .select({
      createdAtMs: users.createdAtMs,
      displayName: users.displayName,
      email: userEmails.email,
      id: users.id,
      lastLoginAtMs: users.lastLoginAtMs,
      status: users.status,
      lastActiveAtMs: sql<number | null>`max(
        coalesce((select max(${agentConversationMessages.createdAtMs}) from ${agentConversationMessages} inner join ${agentConversations} on ${eq(agentConversations.id, agentConversationMessages.conversationId)} where ${and(eq(agentConversations.userId, users.id), eq(agentConversationMessages.role, "user"))}), 0),
        coalesce((select max(${agentGroupChatMessages.createdAtMs}) from ${agentGroupChatMessages} inner join ${agentGroupChats} on ${eq(agentGroupChats.id, agentGroupChatMessages.groupChatId)} where ${and(eq(agentGroupChats.userId, users.id), eq(agentGroupChatMessages.senderType, "user"))}), 0)
      )`.as("last_active_at_ms"),
      messageCount:
        sql<number>`${USER_DIRECT_MESSAGE_COUNT} + ${USER_GROUP_MESSAGE_COUNT}`.as(
          "message_count",
        ),
      directMessageCount: sql<number>`${USER_DIRECT_MESSAGE_COUNT}`.as(
        "direct_message_count",
      ),
      groupMessageCount: sql<number>`${USER_GROUP_MESSAGE_COUNT}`.as(
        "group_message_count",
      ),
      friendCount:
        sql<number>`(select count(*) from ${agents} where ${and(eq(agents.source, "user"), eq(agents.ownerUserId, users.id), ne(agents.status, "archived"))})`.as(
          "friend_count",
        ),
      groupChatCount:
        sql<number>`(select count(*) from ${agentGroupChats} where ${eq(agentGroupChats.userId, users.id)})`.as(
          "group_chat_count",
        ),
    })
    .from(users)
    .innerJoin(
      userEmails,
      and(eq(userEmails.userId, users.id), eq(userEmails.isPrimary, true)),
    )
    .where(where)
    .orderBy(desc(users.createdAtMs), desc(users.id))
    .limit(input.limit)
    .offset(input.offset);

  if (items.length === 0) {
    return { items, roleRows: [], total };
  }

  const roleRows = await db
    .select({
      applicationCode: applications.code,
      code: roles.code,
      id: roles.id,
      name: roles.name,
      userId: userRoleBindings.userId,
    })
    .from(userRoleBindings)
    .innerJoin(roles, eq(roles.id, userRoleBindings.roleId))
    .innerJoin(applications, eq(applications.id, roles.applicationId))
    .where(
      and(
        inArray(
          userRoleBindings.userId,
          items.map((item) => item.id),
        ),
        eq(userRoleBindings.status, "active"),
        eq(roles.status, "active"),
        eq(applications.status, "active"),
      ),
    );

  return { items, roleRows, total };
}

export type UserListRow = Awaited<
  ReturnType<typeof findUserList>
>["items"][number];
export type UserRoleRow = Awaited<
  ReturnType<typeof findUserList>
>["roleRows"][number];

export async function findUserByNormalizedEmail(
  database: D1Database | undefined,
  normalizedEmail: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({ id: userEmails.id })
    .from(userEmails)
    .where(eq(userEmails.normalizedEmail, normalizedEmail))
    .limit(1);

  return rows[0] ?? null;
}

export async function findAssignableRoleById(
  database: D1Database | undefined,
  roleId: string,
) {
  const db = createD1Client(database);
  const rows = await db
    .select({
      applicationCode: applications.code,
      code: roles.code,
      id: roles.id,
      name: roles.name,
    })
    .from(roles)
    .innerJoin(applications, eq(applications.id, roles.applicationId))
    .where(
      and(
        eq(roles.id, roleId),
        eq(roles.status, "active"),
        eq(applications.status, "active"),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function insertUserWithPassword(input: {
  database: D1Database | undefined;
  displayName: string;
  email: string;
  normalizedEmail: string;
  nowMs: number;
  passwordHash: string;
  roleId: string;
}) {
  const db = createD1Client(input.database);
  const credentialId = uuidv7();
  const emailId = uuidv7();
  const roleBindingId = uuidv7();
  const userId = uuidv7();

  await db.batch([
    db.insert(users).values({
      createdAtMs: input.nowMs,
      displayName: input.displayName,
      id: userId,
      lastLoginAtMs: null,
      status: "active",
      updatedAtMs: input.nowMs,
    }),
    db.insert(userEmails).values({
      createdAtMs: input.nowMs,
      email: input.email,
      id: emailId,
      isPrimary: true,
      isVerified: true,
      normalizedEmail: input.normalizedEmail,
      source: "password",
      updatedAtMs: input.nowMs,
      userId,
      verifiedAtMs: input.nowMs,
    }),
    db.insert(passwordCredentials).values({
      createdAtMs: input.nowMs,
      emailId,
      failedAttempts: 0,
      id: credentialId,
      lockedUntilMs: null,
      mustResetPassword: false,
      passwordAlgo: "pbkdf2-sha256",
      passwordHash: input.passwordHash,
      passwordUpdatedAtMs: input.nowMs,
      updatedAtMs: input.nowMs,
      userId,
    }),
    db.insert(userRoleBindings).values({
      createdAtMs: input.nowMs,
      grantedAtMs: input.nowMs,
      id: roleBindingId,
      revokedAtMs: null,
      roleId: input.roleId,
      status: "active",
      updatedAtMs: input.nowMs,
      userId,
    }),
  ]);

  return userId;
}
