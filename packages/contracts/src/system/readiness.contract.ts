import { z } from "zod";

export const ReadinessResponseSchema = z.object({
  status: z.literal("ready"),
});

export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
