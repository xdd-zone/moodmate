import {
  BizCode,
  type Agent,
  type AgentMemory,
  type CreateUserAgentRequest,
  type UpdateAgentMemoryRequest,
  type UpdateUserAgentRequest,
  type UserAgent,
} from "@repo/contracts";

import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";

import {
  presentAgent,
  presentAgentMemory,
  presentUserAgent,
} from "./agents.presenter";
import {
  archiveUserAgent,
  createUserAgent,
  getUserAgentById,
  listUserAgents,
  listAgentMemories,
  deleteAgentMemory,
  updateAgentMemory,
  updateUserAgent,
  type UpdateUserAgentPatch,
} from "./agents.repository";

function agentNotFound() {
  return new AppError(BizCode.COMMON_NOT_FOUND, "Agent 不存在", 404);
}

function forbidden() {
  return new AppError(BizCode.AUTH_FORBIDDEN, "无权访问该 Agent", 403);
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

export async function listUserAgentsForUser(input: {
  bindings: ApiBindings;
  userId: string;
}): Promise<{ items: Agent[] }> {
  const records = await listUserAgents({
    database: input.bindings.DB,
    userId: input.userId,
  });

  return { items: records.map((record) => presentAgent(record, input.userId)) };
}

export async function getUserAgentDetail(input: {
  agentId: string;
  bindings: ApiBindings;
  userId: string;
}): Promise<{ agent: Agent }> {
  const record = await getUserAgentById({
    agentId: input.agentId,
    database: input.bindings.DB,
    userId: input.userId,
  });

  if (!record) {
    throw forbidden();
  }

  return { agent: presentAgent(record, input.userId) };
}

export async function createUserAgentForUser(input: {
  bindings: ApiBindings;
  payload: CreateUserAgentRequest;
  userId: string;
}): Promise<{ agent: UserAgent }> {
  const nowMs = Date.now();

  const record = await createUserAgent({
    database: input.bindings.DB,
    nowMs,
    userId: input.userId,
    values: {
      defaultPrompt: normalizeOptional(input.payload.defaultPrompt),
      description: normalizeOptional(input.payload.description),
      guardrailsPrompt: normalizeOptional(input.payload.guardrailsPrompt),
      headline: normalizeOptional(input.payload.headline),
      imageKey: normalizeOptional(input.payload.imageKey),
      name: input.payload.name.trim(),
      personaPrompt: normalizeOptional(input.payload.personaPrompt),
      storyBackground: normalizeOptional(input.payload.storyBackground),
      tonePrompt: normalizeOptional(input.payload.tonePrompt),
    },
  });

  return { agent: presentUserAgent(record) };
}

export async function updateUserAgentForUser(input: {
  agentId: string;
  bindings: ApiBindings;
  patch: UpdateUserAgentRequest;
  userId: string;
}): Promise<{ agent: UserAgent }> {
  const existing = await getUserAgentById({
    agentId: input.agentId,
    database: input.bindings.DB,
    userId: input.userId,
  });

  if (!existing) {
    throw forbidden();
  }

  if (existing.status !== "active") {
    throw agentNotFound();
  }

  const patch: UpdateUserAgentPatch = {};

  if (input.patch.name !== undefined) {
    patch.name = input.patch.name.trim();
  }
  if (input.patch.headline !== undefined) {
    patch.headline = normalizeOptional(input.patch.headline);
  }
  if (input.patch.description !== undefined) {
    patch.description = normalizeOptional(input.patch.description);
  }
  if (input.patch.storyBackground !== undefined) {
    patch.storyBackground = normalizeOptional(input.patch.storyBackground);
  }
  if (input.patch.personaPrompt !== undefined) {
    patch.personaPrompt = normalizeOptional(input.patch.personaPrompt);
  }
  if (input.patch.tonePrompt !== undefined) {
    patch.tonePrompt = normalizeOptional(input.patch.tonePrompt);
  }
  if (input.patch.guardrailsPrompt !== undefined) {
    patch.guardrailsPrompt = normalizeOptional(input.patch.guardrailsPrompt);
  }
  if (input.patch.defaultPrompt !== undefined) {
    patch.defaultPrompt = normalizeOptional(input.patch.defaultPrompt);
  }
  if (input.patch.imageKey !== undefined) {
    patch.imageKey = normalizeOptional(input.patch.imageKey);
  }

  const updated = await updateUserAgent({
    agentId: input.agentId,
    database: input.bindings.DB,
    nowMs: Date.now(),
    patch,
    userId: input.userId,
  });

  if (!updated) {
    throw agentNotFound();
  }

  return { agent: presentUserAgent(updated) };
}

export async function archiveUserAgentForUser(input: {
  agentId: string;
  bindings: ApiBindings;
  userId: string;
}): Promise<{ success: true }> {
  const existing = await getUserAgentById({
    agentId: input.agentId,
    database: input.bindings.DB,
    userId: input.userId,
  });

  if (!existing) {
    throw forbidden();
  }

  await archiveUserAgent({
    agentId: input.agentId,
    database: input.bindings.DB,
    nowMs: Date.now(),
    userId: input.userId,
  });

  return { success: true };
}

export async function listAgentMemoriesForUser(input: {
  agentId: string;
  bindings: ApiBindings;
  userId: string;
}): Promise<{ items: AgentMemory[] }> {
  const agent = await getUserAgentById({
    agentId: input.agentId,
    database: input.bindings.DB,
    userId: input.userId,
  });

  if (!agent) {
    throw forbidden();
  }

  const rows = await listAgentMemories({
    agentId: input.agentId,
    database: input.bindings.DB,
    userId: input.userId,
  });

  return {
    items: rows.map(({ memory, sourceMessage }) =>
      presentAgentMemory({ memory, sourceMessage }),
    ),
  };
}

export async function updateAgentMemoryForUser(input: {
  agentId: string;
  bindings: ApiBindings;
  memoryId: string;
  patch: UpdateAgentMemoryRequest;
  userId: string;
}): Promise<{ memory: AgentMemory }> {
  const agent = await getUserAgentById({
    agentId: input.agentId,
    database: input.bindings.DB,
    userId: input.userId,
  });

  if (!agent) {
    throw forbidden();
  }

  const memory = await updateAgentMemory({
    agentId: input.agentId,
    database: input.bindings.DB,
    memoryId: input.memoryId,
    nowMs: Date.now(),
    patch: input.patch,
    userId: input.userId,
  });

  if (!memory) {
    throw new AppError(
      BizCode.COMMON_NOT_FOUND,
      "没有找到这条记忆，刷新列表后重试",
      404,
    );
  }

  const rows = await listAgentMemories({
    agentId: input.agentId,
    database: input.bindings.DB,
    userId: input.userId,
  });
  const updated = rows.find((row) => row.memory.id === memory.id);

  if (!updated) {
    throw new AppError(
      BizCode.COMMON_NOT_FOUND,
      "没有找到这条记忆，刷新列表后重试",
      404,
    );
  }

  return { memory: presentAgentMemory(updated) };
}

export async function deleteAgentMemoryForUser(input: {
  agentId: string;
  bindings: ApiBindings;
  memoryId: string;
  userId: string;
}): Promise<{ success: true }> {
  const agent = await getUserAgentById({
    agentId: input.agentId,
    database: input.bindings.DB,
    userId: input.userId,
  });

  if (!agent) {
    throw forbidden();
  }

  const deleted = await deleteAgentMemory({
    agentId: input.agentId,
    database: input.bindings.DB,
    memoryId: input.memoryId,
    nowMs: Date.now(),
    userId: input.userId,
  });

  if (!deleted) {
    throw new AppError(
      BizCode.COMMON_NOT_FOUND,
      "没有找到这条记忆，刷新列表后重试",
      404,
    );
  }

  return { success: true };
}
