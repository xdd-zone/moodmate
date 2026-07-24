import { z } from "zod";

export const CompanionCareSceneSchema = z.enum([
  "morning",
  "night",
  "long_absence",
  "stress_support",
  "relationship_warmup",
  "anniversary",
]);

export const CompanionCareFrequencySchema = z.enum([
  "daily",
  "weekly",
  "custom",
]);

export const CompanionCareToneSchema = z.enum(["light", "gentle", "intimate"]);

export const CompanionCareEventStatusSchema = z.enum(["generated", "read"]);

export const CompanionCarePlanSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  frequency: CompanionCareFrequencySchema,
  preferredTime: z.string().max(20).nullable(),
  scenes: z.array(CompanionCareSceneSchema).min(1).max(6),
  tone: CompanionCareToneSchema,
  customPrompt: z.string().max(800).nullable(),
  nextRunAtMs: z.number().int().nonnegative().nullable(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const UpsertCompanionCarePlanRequestSchema = z.object({
  enabled: z.boolean(),
  frequency: CompanionCareFrequencySchema,
  preferredTime: z.string().trim().max(20).optional().nullable(),
  scenes: z.array(CompanionCareSceneSchema).min(1).max(6),
  tone: CompanionCareToneSchema,
  customPrompt: z.string().trim().max(800).optional().nullable(),
});

export const CompanionCareEventSchema = z.object({
  id: z.string().min(1),
  scene: CompanionCareSceneSchema,
  status: CompanionCareEventStatusSchema,
  message: z.string(),
  messageId: z.string().min(1),
  generatedAtMs: z.number().int().nonnegative(),
  readAtMs: z.number().int().nonnegative().nullable(),
});

export const GenerateCompanionCareEventRequestSchema = z.object({
  scene: CompanionCareSceneSchema.optional(),
});

export const CompanionCarePlanResponseSchema = z.object({
  plan: CompanionCarePlanSchema,
});

export const CompanionCareEventsResponseSchema = z.object({
  items: z.array(CompanionCareEventSchema),
});

export const GenerateCompanionCareEventResponseSchema = z.object({
  event: CompanionCareEventSchema,
});

export type CompanionCareScene = z.infer<typeof CompanionCareSceneSchema>;
export type CompanionCareFrequency = z.infer<
  typeof CompanionCareFrequencySchema
>;
export type CompanionCareTone = z.infer<typeof CompanionCareToneSchema>;
export type CompanionCareEventStatus = z.infer<
  typeof CompanionCareEventStatusSchema
>;
export type CompanionCarePlan = z.infer<typeof CompanionCarePlanSchema>;
export type UpsertCompanionCarePlanRequest = z.infer<
  typeof UpsertCompanionCarePlanRequestSchema
>;
export type CompanionCareEvent = z.infer<typeof CompanionCareEventSchema>;
export type GenerateCompanionCareEventRequest = z.infer<
  typeof GenerateCompanionCareEventRequestSchema
>;
export type CompanionCarePlanResponse = z.infer<
  typeof CompanionCarePlanResponseSchema
>;
export type CompanionCareEventsResponse = z.infer<
  typeof CompanionCareEventsResponseSchema
>;
export type GenerateCompanionCareEventResponse = z.infer<
  typeof GenerateCompanionCareEventResponseSchema
>;
