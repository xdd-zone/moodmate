import type { ApiMeta } from "@repo/contracts";

export function createMeta(requestId: string = crypto.randomUUID()): ApiMeta {
  return {
    requestId,
    timestamp: new Date().toISOString(),
  };
}
