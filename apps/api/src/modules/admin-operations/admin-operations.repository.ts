function requireDatabase(database: D1Database | undefined): D1Database {
  if (!database) throw new Error("D1 binding DB 未配置");
  return database;
}

/**
 * 失败口径按 operation 聚合，不按记录行数。
 *
 * 一次逻辑调用会因 structured output 方法降级产生多条 attempt 记录，中间尝试失败但
 * 最终成功时不该算失败。`aborted` 也不计入：它包括用户取消和运行时中断，不是模型故障。
 * 这段子查询按 `operation_id` 分组，只统计没有任何 completed 记录的 operation。
 */
const FAILED_OPERATION_COUNT_SQL = `SELECT count(*) FROM (SELECT operation_id FROM ai_call_records WHERE user_id = ? AND status IN ('completed', 'failed') GROUP BY operation_id HAVING max(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) = 0)`;

export async function getOverview(
  database: D1Database | undefined,
  startAtMs: number,
  endAtMs: number,
) {
  const db = requireDatabase(database);
  const rows = await db
    .prepare(
      `
    SELECT
      (SELECT count(*) FROM users WHERE status != 'deleted') AS user_total,
      (SELECT count(*) FROM users WHERE status != 'deleted' AND created_at_ms >= ? AND created_at_ms < ?) AS created_today,
      (SELECT count(DISTINCT user_id) FROM (
        SELECT c.user_id AS user_id FROM agent_conversation_messages m INNER JOIN agent_conversations c ON c.id = m.conversation_id WHERE m.role = 'user' AND m.created_at_ms >= ? AND m.created_at_ms < ?
        UNION
        SELECT g.user_id AS user_id FROM agent_group_chat_messages m INNER JOIN agent_group_chats g ON g.id = m.group_chat_id WHERE m.sender_type = 'user' AND m.created_at_ms >= ? AND m.created_at_ms < ?
      )) AS active_today,
      (SELECT count(*) FROM agents WHERE source = 'system' AND status = 'active') AS system_agents,
      (SELECT count(*) FROM agents WHERE source = 'user' AND status != 'archived') AS user_agents,
      (SELECT count(*) FROM agent_conversations) AS direct_chats,
      (SELECT count(*) FROM agent_group_chats) AS group_chats,
      (SELECT count(*) FROM agent_conversation_messages) + (SELECT count(*) FROM agent_group_chat_messages) AS message_total,
      (SELECT count(*) FROM agent_conversation_messages WHERE role = 'user' AND created_at_ms >= ? AND created_at_ms < ?) + (SELECT count(*) FROM agent_group_chat_messages WHERE sender_type = 'user' AND created_at_ms >= ? AND created_at_ms < ?) AS message_today,
      (SELECT count(*) FROM ai_call_records WHERE user_id IS NOT NULL) AS ai_calls_total,
      (SELECT count(*) FROM ai_call_records WHERE user_id IS NOT NULL AND started_at_ms >= ? AND started_at_ms < ?) AS ai_calls_today,
      (SELECT count(*) FROM (SELECT operation_id FROM ai_call_records WHERE user_id IS NOT NULL AND status IN ('completed', 'failed') AND started_at_ms >= ? AND started_at_ms < ? GROUP BY operation_id HAVING max(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) = 0)) AS failed_today,
      (SELECT count(*) FROM (SELECT operation_id FROM ai_call_records WHERE user_id IS NOT NULL AND status IN ('completed', 'failed') AND started_at_ms >= ? AND started_at_ms < ? GROUP BY operation_id)) AS terminal_today,
      coalesce((SELECT sum(total_tokens) FROM ai_call_records WHERE user_id IS NOT NULL AND usage_status = 'reported'), 0) AS tokens_total,
      coalesce((SELECT sum(total_tokens) FROM ai_call_records WHERE user_id IS NOT NULL AND usage_status = 'reported' AND started_at_ms >= ? AND started_at_ms < ?), 0) AS tokens_today
  `,
    )
    .bind(
      startAtMs,
      endAtMs,
      startAtMs,
      endAtMs,
      startAtMs,
      endAtMs,
      startAtMs,
      endAtMs,
      startAtMs,
      endAtMs,
      startAtMs,
      endAtMs,
      startAtMs,
      endAtMs,
      startAtMs,
      endAtMs,
      startAtMs,
      endAtMs,
    )
    .first<Record<string, number>>();
  return rows ?? {};
}

export async function getOverviewDetails(
  database: D1Database | undefined,
  trendStartAtMs: number,
  trendEndAtMs: number,
) {
  const db = requireDatabase(database);
  const messageTrend = await db
    .prepare(
      `SELECT day, sum(message_count) AS message_count FROM (SELECT strftime('%Y-%m-%d', created_at_ms / 1000, 'unixepoch', '+8 hours') AS day, count(*) AS message_count FROM agent_conversation_messages WHERE role = 'user' AND created_at_ms >= ? AND created_at_ms < ? GROUP BY day UNION ALL SELECT strftime('%Y-%m-%d', created_at_ms / 1000, 'unixepoch', '+8 hours') AS day, count(*) AS message_count FROM agent_group_chat_messages WHERE sender_type = 'user' AND created_at_ms >= ? AND created_at_ms < ? GROUP BY day) GROUP BY day ORDER BY day`,
    )
    .bind(trendStartAtMs, trendEndAtMs, trendStartAtMs, trendEndAtMs)
    .all<Record<string, string | number | null>>();
  const aiTrend = await db
    .prepare(
      `SELECT strftime('%Y-%m-%d', started_at_ms / 1000, 'unixepoch', '+8 hours') AS day, count(*) AS ai_call_count, coalesce(sum(CASE WHEN usage_status = 'reported' THEN total_tokens ELSE 0 END), 0) AS total_tokens FROM ai_call_records WHERE user_id IS NOT NULL AND started_at_ms >= ? AND started_at_ms < ? GROUP BY day ORDER BY day`,
    )
    .bind(trendStartAtMs, trendEndAtMs)
    .all<Record<string, string | number | null>>();
  const topUsers = await db
    .prepare(
      `SELECT r.user_id, u.display_name, e.email, coalesce(sum(CASE WHEN r.usage_status = 'reported' THEN r.total_tokens ELSE 0 END), 0) AS total_tokens, count(*) AS call_count FROM ai_call_records r INNER JOIN users u ON u.id = r.user_id INNER JOIN user_emails e ON e.user_id = u.id AND e.is_primary = 1 WHERE r.user_id IS NOT NULL GROUP BY r.user_id, u.display_name, e.email ORDER BY total_tokens DESC, call_count DESC LIMIT 5`,
    )
    .all<Record<string, string | number | null>>();
  const topAgents = await db
    .prepare(
      `SELECT r.agent_id, max(r.agent_name_snapshot) AS name, max(r.agent_source_snapshot) AS source, coalesce(sum(CASE WHEN r.usage_status = 'reported' THEN r.total_tokens ELSE 0 END), 0) AS total_tokens, count(*) AS call_count FROM ai_call_records r WHERE r.subject_type = 'agent' AND r.agent_id IS NOT NULL GROUP BY r.agent_id ORDER BY total_tokens DESC, call_count DESC LIMIT 5`,
    )
    .all<Record<string, string | number | null>>();
  const recentFailures = await db
    .prepare(
      `SELECT id, started_at_ms, scenario, provider_name, model, error_code, error_message, request_id FROM ai_call_records WHERE user_id IS NOT NULL AND status = 'failed' AND operation_id NOT IN (SELECT operation_id FROM ai_call_records WHERE status = 'completed') ORDER BY started_at_ms DESC, id DESC LIMIT 10`,
    )
    .all<Record<string, string | number | null>>();

  return {
    aiTrend: aiTrend.results,
    messageTrend: messageTrend.results,
    recentFailures: recentFailures.results,
    topAgents: topAgents.results,
    topUsers: topUsers.results,
  };
}

export async function getUserDetail(
  database: D1Database | undefined,
  userId: string,
) {
  const db = requireDatabase(database);
  const user = await db
    .prepare(
      `SELECT u.id, u.display_name, e.email, u.status, u.created_at_ms, u.last_login_at_ms, max(coalesce((SELECT max(m.created_at_ms) FROM agent_conversation_messages m INNER JOIN agent_conversations c ON c.id = m.conversation_id WHERE c.user_id = u.id AND m.role = 'user'), 0), coalesce((SELECT max(m.created_at_ms) FROM agent_group_chat_messages m INNER JOIN agent_group_chats g ON g.id = m.group_chat_id WHERE g.user_id = u.id AND m.sender_type = 'user'), 0)) AS last_active_at_ms, (SELECT count(*) FROM agents a WHERE a.source = 'user' AND a.owner_user_id = u.id AND a.status != 'archived') AS friend_count, (SELECT count(*) FROM agent_conversations c WHERE c.user_id = u.id) AS direct_conversation_count, (SELECT count(*) FROM agent_conversation_messages m INNER JOIN agent_conversations c ON c.id = m.conversation_id WHERE c.user_id = u.id) AS direct_message_count, (SELECT count(*) FROM agent_group_chats g WHERE g.user_id = u.id) AS group_conversation_count, (SELECT count(*) FROM agent_group_chat_messages m INNER JOIN agent_group_chats g ON g.id = m.group_chat_id WHERE g.user_id = u.id) AS group_message_count, (SELECT count(*) FROM ai_call_records r WHERE r.user_id = u.id) AS ai_call_count, (SELECT count(*) FROM (SELECT operation_id FROM ai_call_records r WHERE r.user_id = u.id AND r.status IN ('completed', 'failed') GROUP BY operation_id HAVING max(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) = 0)) AS failed_ai_call_count, coalesce((SELECT sum(r.total_tokens) FROM ai_call_records r WHERE r.user_id = u.id AND r.usage_status = 'reported'), 0) AS total_tokens FROM users u INNER JOIN user_emails e ON e.user_id = u.id AND e.is_primary = 1 WHERE u.id = ? AND u.status != 'deleted'`,
    )
    .bind(userId)
    .first<Record<string, string | number | null>>();
  if (!user) return null;

  const roles = await db
    .prepare(
      `SELECT r.id, r.name, r.code, a.code AS application_code FROM user_role_bindings b INNER JOIN roles r ON r.id = b.role_id INNER JOIN applications a ON a.id = r.application_id WHERE b.user_id = ? AND b.status = 'active' AND r.status = 'active' AND a.status = 'active' ORDER BY a.code, r.code`,
    )
    .bind(userId)
    .all<Record<string, string | number | null>>();
  const friends = await db
    .prepare(
      `SELECT a.id, a.name, a.source, a.status, c.id AS conversation_id, coalesce(c.message_count, 0) AS message_count, c.last_message_at_ms AS last_active_at_ms FROM agents a LEFT JOIN agent_conversations c ON c.agent_id = a.id AND c.user_id = ? WHERE (a.source = 'system' AND c.id IS NOT NULL) OR (a.source = 'user' AND a.owner_user_id = ?) ORDER BY coalesce(c.last_message_at_ms, a.updated_at_ms) DESC, a.id DESC`,
    )
    .bind(userId, userId)
    .all<Record<string, string | number | null>>();
  const groupChats = await db
    .prepare(
      `SELECT id, title, message_count, last_message_at_ms AS last_active_at_ms FROM agent_group_chats WHERE user_id = ? ORDER BY coalesce(last_message_at_ms, updated_at_ms) DESC, id DESC`,
    )
    .bind(userId)
    .all<Record<string, string | number | null>>();

  return {
    friends: friends.results,
    groupChats: groupChats.results,
    roles: roles.results,
    user,
  };
}

export async function getUserUsage(
  database: D1Database | undefined,
  userId: string,
  startAtMs: number,
  endAtMs: number,
) {
  const db = requireDatabase(database);
  const rows = await db
    .prepare(
      `SELECT subject_type, agent_id, max(agent_name_snapshot) AS agent_name, max(agent_source_snapshot) AS agent_source, sum(CASE WHEN usage_status = 'reported' THEN prompt_tokens ELSE 0 END) AS prompt_tokens, sum(CASE WHEN usage_status = 'reported' THEN completion_tokens ELSE 0 END) AS completion_tokens, sum(CASE WHEN usage_status = 'reported' THEN total_tokens ELSE 0 END) AS total_tokens, count(*) AS call_count, sum(CASE WHEN started_at_ms >= ? AND started_at_ms < ? AND usage_status = 'reported' THEN prompt_tokens ELSE 0 END) AS today_prompt_tokens, sum(CASE WHEN started_at_ms >= ? AND started_at_ms < ? AND usage_status = 'reported' THEN completion_tokens ELSE 0 END) AS today_completion_tokens, sum(CASE WHEN started_at_ms >= ? AND started_at_ms < ? AND usage_status = 'reported' THEN total_tokens ELSE 0 END) AS today_total_tokens, sum(CASE WHEN started_at_ms >= ? AND started_at_ms < ? THEN 1 ELSE 0 END) AS today_call_count, max(started_at_ms) AS last_called_at_ms FROM ai_call_records WHERE user_id = ? GROUP BY subject_type, agent_id`,
    )
    .bind(
      startAtMs,
      endAtMs,
      startAtMs,
      endAtMs,
      startAtMs,
      endAtMs,
      startAtMs,
      endAtMs,
      userId,
    )
    .all<Record<string, string | number | null>>();
  const today = await db
    .prepare(
      `SELECT sum(CASE WHEN usage_status = 'reported' THEN prompt_tokens ELSE 0 END) AS prompt_tokens, sum(CASE WHEN usage_status = 'reported' THEN completion_tokens ELSE 0 END) AS completion_tokens, sum(CASE WHEN usage_status = 'reported' THEN total_tokens ELSE 0 END) AS total_tokens, count(*) AS call_count FROM ai_call_records WHERE user_id = ? AND started_at_ms >= ? AND started_at_ms < ?`,
    )
    .bind(userId, startAtMs, endAtMs)
    .first<Record<string, number | null>>();
  const total = await db
    .prepare(
      `SELECT sum(CASE WHEN usage_status = 'reported' THEN prompt_tokens ELSE 0 END) AS prompt_tokens, sum(CASE WHEN usage_status = 'reported' THEN completion_tokens ELSE 0 END) AS completion_tokens, sum(CASE WHEN usage_status = 'reported' THEN total_tokens ELSE 0 END) AS total_tokens, count(*) AS call_count, (${FAILED_OPERATION_COUNT_SQL}) AS failed_call_count, max(started_at_ms) AS last_called_at_ms FROM ai_call_records WHERE user_id = ?`,
    )
    .bind(userId, userId)
    .first<Record<string, number | null>>();
  return { subjects: rows.results, today: today ?? {}, total: total ?? {} };
}

export async function getAgentDetail(
  database: D1Database | undefined,
  agentId: string,
) {
  const db = requireDatabase(database);
  return db
    .prepare(
      `SELECT a.*, (SELECT count(DISTINCT c.user_id) FROM agent_conversations c WHERE c.agent_id = a.id) AS user_count, (SELECT count(*) FROM agent_conversations c WHERE c.agent_id = a.id) AS conversation_count, (SELECT count(*) FROM agent_conversation_messages m INNER JOIN agent_conversations c ON c.id = m.conversation_id WHERE c.agent_id = a.id) AS message_count, (SELECT count(*) FROM agent_memories m WHERE m.agent_id = a.id AND m.status != 'deleted') AS memory_count, (SELECT count(*) FROM agent_group_chat_members gm WHERE gm.agent_id = a.id AND gm.status = 'active') AS group_count, (SELECT count(*) FROM ai_call_records r WHERE r.agent_id = a.id) AS ai_call_count, (SELECT max(started_at_ms) FROM ai_call_records r WHERE r.agent_id = a.id) AS last_used_at_ms FROM agents a WHERE a.id = ?`,
    )
    .bind(agentId)
    .first<Record<string, string | number | null>>();
}

export async function insertSystemAgent(
  database: D1Database | undefined,
  values: Record<string, string | number | null>,
) {
  const db = requireDatabase(database);
  await db
    .prepare(
      `INSERT INTO agents (id, source, owner_user_id, name, headline, description, story_background, persona_prompt, tone_prompt, guardrails_prompt, default_prompt, image_key, status, created_at_ms, updated_at_ms) VALUES (?, 'system', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    )
    .bind(
      values.id,
      values.name,
      values.headline,
      values.description,
      values.storyBackground,
      values.personaPrompt,
      values.tonePrompt,
      values.guardrailsPrompt,
      values.defaultPrompt,
      values.imageKey,
      values.nowMs,
      values.nowMs,
    )
    .run();
}

export async function updateSystemAgent(
  database: D1Database | undefined,
  agentId: string,
  patch: Record<string, string | number | null>,
) {
  const db = requireDatabase(database);
  const columns: Record<string, string> = {
    name: "name",
    headline: "headline",
    description: "description",
    storyBackground: "story_background",
    personaPrompt: "persona_prompt",
    tonePrompt: "tone_prompt",
    guardrailsPrompt: "guardrails_prompt",
    defaultPrompt: "default_prompt",
    imageKey: "image_key",
  };
  const entries = Object.entries(patch).filter(([key]) => key in columns);
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `${columns[key]} = ?`).join(", ");
  await db
    .prepare(
      `UPDATE agents SET ${assignments}, updated_at_ms = ? WHERE id = ? AND source = 'system'`,
    )
    .bind(...entries.map(([, value]) => value), Date.now(), agentId)
    .run();
}

export async function setSystemAgentStatus(
  database: D1Database | undefined,
  agentId: string,
  status: "active" | "disabled",
) {
  const db = requireDatabase(database);
  const result = await db
    .prepare(
      "UPDATE agents SET status = ?, updated_at_ms = ? WHERE id = ? AND source = 'system'",
    )
    .bind(status, Date.now(), agentId)
    .run();
  return Number(result.meta.changes ?? 0);
}

export async function deleteUnusedSystemAgent(
  database: D1Database | undefined,
  agentId: string,
) {
  const db = requireDatabase(database);
  const used = await db
    .prepare(
      `SELECT (SELECT count(*) FROM agent_conversations WHERE agent_id = ?) + (SELECT count(*) FROM agent_memories WHERE agent_id = ?) + (SELECT count(*) FROM agent_group_chat_members WHERE agent_id = ?) + (SELECT count(*) FROM ai_call_records WHERE agent_id = ?) AS count`,
    )
    .bind(agentId, agentId, agentId, agentId)
    .first<{ count: number }>();
  if (Number(used?.count ?? 0) > 0) return "used" as const;
  const result = await db
    .prepare("DELETE FROM agents WHERE id = ? AND source = 'system'")
    .bind(agentId)
    .run();
  return Number(result.meta.changes ?? 0) > 0
    ? ("deleted" as const)
    : ("missing" as const);
}

export async function listAiCalls(
  database: D1Database | undefined,
  input: {
    userId: string;
    limit: number;
    offset: number;
    startAtMs?: number;
    endAtMs?: number;
    agentId?: string;
    scenario?: string;
    model?: string;
    status?: string;
  },
) {
  const db = requireDatabase(database);
  const conditions = ["user_id = ?"];
  const values: (string | number)[] = [input.userId];
  if (input.startAtMs !== undefined) {
    conditions.push("started_at_ms >= ?");
    values.push(input.startAtMs);
  }
  if (input.endAtMs !== undefined) {
    conditions.push("started_at_ms < ?");
    values.push(input.endAtMs);
  }
  if (input.agentId) {
    conditions.push("agent_id = ?");
    values.push(input.agentId);
  }
  if (input.scenario) {
    conditions.push("scenario = ?");
    values.push(input.scenario);
  }
  if (input.model) {
    conditions.push("model = ?");
    values.push(input.model);
  }
  if (input.status) {
    conditions.push("status = ?");
    values.push(input.status);
  }
  const where = conditions.join(" AND ");
  const count = await db
    .prepare(`SELECT count(*) AS total FROM ai_call_records WHERE ${where}`)
    .bind(...values)
    .first<{ total: number }>();
  const items = await db
    .prepare(
      `SELECT id, request_id, started_at_ms, scenario, subject_type, agent_id, agent_name_snapshot, conversation_type, conversation_id, api, provider_name, model, prompt_tokens, completion_tokens, total_tokens, usage_status, duration_ms, status, error_code, error_message FROM ai_call_records WHERE ${where} ORDER BY started_at_ms DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...values, input.limit, input.offset)
    .all<Record<string, string | number | null>>();
  return { items: items.results, total: Number(count?.total ?? 0) };
}

export async function listAgents(
  database: D1Database | undefined,
  input: {
    limit: number;
    offset: number;
    source?: string;
    status?: string;
    keyword?: string;
  },
) {
  const db = requireDatabase(database);
  const conditions = ["1 = 1"];
  const values: (string | number)[] = [];
  if (input.source) {
    conditions.push("a.source = ?");
    values.push(input.source);
  }
  if (input.status) {
    conditions.push("a.status = ?");
    values.push(input.status);
  }
  if (input.keyword) {
    conditions.push(
      "(a.name LIKE ? OR u.display_name LIKE ? OR e.email LIKE ?)",
    );
    const pattern = `%${input.keyword}%`;
    values.push(pattern, pattern, pattern);
  }
  const where = conditions.join(" AND ");
  const count = await db
    .prepare(
      `SELECT count(*) AS total FROM agents a LEFT JOIN users u ON u.id = a.owner_user_id LEFT JOIN user_emails e ON e.user_id = u.id AND e.is_primary = 1 WHERE ${where}`,
    )
    .bind(...values)
    .first<{ total: number }>();
  const items = await db
    .prepare(
      `SELECT a.id, a.name, a.source, a.owner_user_id, u.display_name AS owner_display_name, e.email AS owner_email, a.status, (SELECT count(DISTINCT c.user_id) FROM agent_conversations c WHERE c.agent_id = a.id) AS user_count, (SELECT count(*) FROM agent_conversations c WHERE c.agent_id = a.id) AS conversation_count, (SELECT count(*) FROM agent_conversation_messages m INNER JOIN agent_conversations c ON c.id = m.conversation_id WHERE c.agent_id = a.id) AS message_count, (SELECT count(*) FROM agent_memories m WHERE m.agent_id = a.id AND m.status != 'deleted') AS memory_count, (SELECT count(*) FROM agent_group_chat_members gm WHERE gm.agent_id = a.id AND gm.status = 'active') AS group_count, (SELECT max(c.last_message_at_ms) FROM agent_conversations c WHERE c.agent_id = a.id) AS last_used_at_ms, a.created_at_ms, a.updated_at_ms FROM agents a LEFT JOIN users u ON u.id = a.owner_user_id LEFT JOIN user_emails e ON e.user_id = u.id AND e.is_primary = 1 WHERE ${where} ORDER BY a.updated_at_ms DESC, a.id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...values, input.limit, input.offset)
    .all<Record<string, string | number | null>>();
  return { items: items.results, total: Number(count?.total ?? 0) };
}

export async function listFeedbacks(
  database: D1Database | undefined,
  input: { limit: number; offset: number; rating?: string; status?: string },
) {
  const db = requireDatabase(database);
  const conditions = ["1 = 1"];
  const values: string[] = [];
  if (input.rating) {
    conditions.push("f.rating = ?");
    values.push(input.rating);
  }
  if (input.status) {
    conditions.push("f.status = ?");
    values.push(input.status);
  }
  const where = conditions.join(" AND ");
  const count = await db
    .prepare(
      `SELECT count(*) AS total FROM agent_message_feedbacks f WHERE ${where}`,
    )
    .bind(...values)
    .first<{ total: number }>();
  const items = await db
    .prepare(
      `SELECT f.id, f.created_at_ms AS submitted_at_ms, f.user_id, u.display_name AS user_display_name, c.agent_id, a.name AS agent_name, f.rating, f.reason, f.note, f.status, f.processed_at_ms, admin.display_name AS processed_by_display_name FROM agent_message_feedbacks f INNER JOIN users u ON u.id = f.user_id INNER JOIN agent_conversations c ON c.id = f.conversation_id INNER JOIN agents a ON a.id = c.agent_id LEFT JOIN users admin ON admin.id = f.processed_by_admin_user_id WHERE ${where} ORDER BY f.updated_at_ms DESC, f.id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...values, input.limit, input.offset)
    .all<Record<string, string | number | null>>();
  return { items: items.results, total: Number(count?.total ?? 0) };
}

export async function getFeedbackDetail(
  database: D1Database | undefined,
  feedbackId: string,
) {
  const db = requireDatabase(database);
  return db
    .prepare(
      `SELECT f.id, f.created_at_ms AS submitted_at_ms, f.user_id, u.display_name AS user_display_name, c.agent_id, a.name AS agent_name, f.rating, f.reason, f.note, f.status, f.processed_at_ms, admin.display_name AS processed_by_display_name, m.id AS assistant_id, m.content AS assistant_content, m.created_at_ms AS assistant_created_at_ms, (SELECT pm.id FROM agent_conversation_messages pm WHERE pm.conversation_id = m.conversation_id AND pm.turn_id = m.turn_id AND pm.role = 'user' ORDER BY pm.created_at_ms DESC LIMIT 1) AS user_message_id, (SELECT pm.content FROM agent_conversation_messages pm WHERE pm.conversation_id = m.conversation_id AND pm.turn_id = m.turn_id AND pm.role = 'user' ORDER BY pm.created_at_ms DESC LIMIT 1) AS user_content, (SELECT pm.created_at_ms FROM agent_conversation_messages pm WHERE pm.conversation_id = m.conversation_id AND pm.turn_id = m.turn_id AND pm.role = 'user' ORDER BY pm.created_at_ms DESC LIMIT 1) AS user_created_at_ms FROM agent_message_feedbacks f INNER JOIN users u ON u.id = f.user_id INNER JOIN agent_conversations c ON c.id = f.conversation_id INNER JOIN agents a ON a.id = c.agent_id INNER JOIN agent_conversation_messages m ON m.id = f.message_id LEFT JOIN users admin ON admin.id = f.processed_by_admin_user_id WHERE f.id = ?`,
    )
    .bind(feedbackId)
    .first<Record<string, string | number | null>>();
}

export async function updateFeedbackStatus(
  database: D1Database | undefined,
  input: {
    adminUserId: string;
    feedbackId: string;
    status: "pending" | "processed";
  },
) {
  const db = requireDatabase(database);
  const nowMs = Date.now();
  const result = await db
    .prepare(
      `UPDATE agent_message_feedbacks SET status = ?, processed_by_admin_user_id = ?, processed_at_ms = ?, updated_at_ms = ? WHERE id = ?`,
    )
    .bind(
      input.status,
      input.status === "processed" ? input.adminUserId : null,
      input.status === "processed" ? nowMs : null,
      nowMs,
      input.feedbackId,
    )
    .run();
  return Number(result.meta.changes ?? 0);
}

export async function writeFeedbackAudit(
  database: D1Database | undefined,
  input: { adminUserId: string; feedbackId: string; requestId: string },
) {
  const db = requireDatabase(database);
  await db
    .prepare(
      "INSERT INTO admin_sensitive_access_audits (id, admin_user_id, action, resource_type, resource_id, request_id, created_at_ms) VALUES (?, ?, ?, 'message_feedback', ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      input.adminUserId,
      "view",
      input.feedbackId,
      input.requestId,
      Date.now(),
    )
    .run();
}
