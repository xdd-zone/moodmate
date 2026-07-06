import { z } from "zod";

export const RootResponseSchema = z.object({
  name: z.literal("api"),
  status: z.literal("ok"),
});

export type RootResponse = z.infer<typeof RootResponseSchema>;
