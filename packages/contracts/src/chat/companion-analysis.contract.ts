import { z } from "zod";

export const ConversationSafetySchema = z.object({
  safetyLevel: z.enum(["safe", "caution", "redirect", "block", "crisis"]),
  category: z.enum([
    "normal",
    "emotional_dependency",
    "manipulation",
    "self_harm",
    "sexual_boundary",
    "privacy",
    "illegal",
    "medical_legal_financial",
    "other",
  ]),
  boundaryAction: z.enum([
    "continue",
    "soft_boundary",
    "redirect",
    "refuse",
    "crisis_support",
  ]),
  reason: z.string().trim().max(300),
  responseGuidance: z.string().trim().max(600),
  allowMemoryExtraction: z.boolean(),
});

export const CompanionIntentPrimarySchema = z.enum([
  "casual_chat",
  "emotional_support",
  "relationship_advice",
  "romantic_flirt",
  "companionship_presence",
  "roleplay",
  "life_sharing",
  "memory_update",
  "preference_setting",
  "agent_feedback",
  "conversation_repair",
  "date_or_activity_planning",
  "creative_request",
  "meta_question",
  "unclear",
]);

export const ConversationIntentSchema = z.object({
  primary: CompanionIntentPrimarySchema,
  secondary: z.array(CompanionIntentPrimarySchema).max(3),
  confidence: z.number().min(0).max(1),
  userNeed: z.enum([
    "be_heard",
    "be_comforted",
    "get_advice",
    "get_reply_draft",
    "play_along",
    "feel_connected",
    "set_boundary",
    "update_memory",
    "adjust_agent",
    "unknown",
  ]),
  requestedAgentAction: z.enum([
    "answer_directly",
    "comfort_first",
    "ask_follow_up",
    "draft_message",
    "analyze_situation",
    "roleplay_response",
    "remember_fact",
    "adjust_style",
    "repair_misunderstanding",
    "continue_topic",
  ]),
  relationshipSignal: z.enum([
    "neutral",
    "warming_up",
    "seeking_closeness",
    "testing_boundary",
    "feeling_hurt",
    "pulling_away",
    "dependency_risk",
    "conflict",
  ]),
  replyExpectation: z.object({
    depth: z.enum(["short", "medium", "deep"]),
    warmth: z.enum(["low", "medium", "high"]),
    directness: z.enum(["gentle", "balanced", "direct"]),
    shouldAskQuestion: z.boolean(),
  }),
  shouldClarify: z.boolean(),
  clarifyingQuestion: z.string().trim().max(200).nullable(),
  promptGuidance: z.string().trim().max(600),
});

export type ConversationSafety = z.infer<typeof ConversationSafetySchema>;
export type CompanionIntentPrimary = z.infer<
  typeof CompanionIntentPrimarySchema
>;
export type ConversationIntent = z.infer<typeof ConversationIntentSchema>;
