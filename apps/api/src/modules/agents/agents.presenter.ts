import type { Agent, AgentMemory, UserAgent } from "@repo/contracts";

import type { AgentMemoryRecord, UserAgentRecord } from "./agents.schema";

export function presentUserAgent(record: UserAgentRecord): UserAgent {
  return {
    createdAtMs: record.createdAtMs,
    defaultPrompt: record.defaultPrompt,
    description: record.description,
    guardrailsPrompt: record.guardrailsPrompt,
    headline: record.headline,
    id: record.id,
    imageKey: record.imageKey,
    name: record.name,
    personaPrompt: record.personaPrompt,
    status: record.status === "archived" ? "archived" : "active",
    storyBackground: record.storyBackground,
    tonePrompt: record.tonePrompt,
    updatedAtMs: record.updatedAtMs,
  };
}

export function presentAgent(record: UserAgentRecord, userId: string): Agent {
  return {
    createdAtMs: record.createdAtMs,
    defaultPrompt: record.defaultPrompt,
    description: record.description,
    editable: record.source === "user" && record.ownerUserId === userId,
    guardrailsPrompt: record.guardrailsPrompt,
    headline: record.headline,
    id: record.id,
    imageKey: record.imageKey,
    name: record.name,
    ownerUserId: record.ownerUserId,
    personaPrompt: record.personaPrompt,
    source: record.source,
    status: record.status,
    storyBackground: record.storyBackground,
    tonePrompt: record.tonePrompt,
    updatedAtMs: record.updatedAtMs,
  };
}

export function presentAgentMemory(input: {
  memory: AgentMemoryRecord;
  sourceMessage: {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAtMs: number;
  } | null;
}): AgentMemory {
  return {
    agentId: input.memory.agentId,
    content: input.memory.content,
    createdAtMs: input.memory.createdAtMs,
    id: input.memory.id,
    importance: input.memory.importance,
    sourceMessage: input.sourceMessage,
    sourceMessageId: input.memory.sourceMessageId,
    status: input.memory.status,
    type: input.memory.type,
    updatedAtMs: input.memory.updatedAtMs,
  };
}
