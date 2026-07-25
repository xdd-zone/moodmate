import type { UserAgent } from "@repo/contracts";

import type { UserAgentRecord } from "./agents.schema";

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
    status: record.status,
    storyBackground: record.storyBackground,
    tonePrompt: record.tonePrompt,
    updatedAtMs: record.updatedAtMs,
  };
}
