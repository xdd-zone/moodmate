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

export const ConversationEmotionSchema = z.object({
  primaryEmotion: z.enum([
    "neutral",
    "happy",
    "tired",
    "lonely",
    "sad",
    "anxious",
    "angry",
    "jealous",
    "embarrassed",
    "affectionate",
    "playful",
    "confused",
    "disappointed",
    "stressed",
    "hurt",
  ]),
  secondaryEmotions: z.array(z.string().trim().min(1).max(40)).max(3),
  intensity: z.number().min(0).max(1),
  valence: z.enum(["positive", "neutral", "negative", "mixed"]),
  arousal: z.enum(["low", "medium", "high"]),
  needsComfort: z.boolean(),
  needsDeescalation: z.boolean(),
  needsClarification: z.boolean(),
  emotionalCue: z.string().trim().max(300),
  replyTone: z.enum([
    "light",
    "warm",
    "soft",
    "playful",
    "calm",
    "serious",
    "reassuring",
    "apologetic",
  ]),
});

export const EmotionRouteSchema = z.object({
  route: z.enum([
    "light_companion",
    "warm_comfort",
    "deep_comfort",
    "playful_flirt",
    "calm_deescalation",
    "relationship_repair",
    "gentle_clarification",
    "practical_support",
    "quiet_presence",
  ]),
  responseLength: z.enum(["very_short", "short", "medium", "long"]),
  shouldAskQuestion: z.boolean(),
  shouldGiveAdvice: z.boolean(),
  shouldUsePetName: z.boolean(),
  shouldMirrorEmotion: z.boolean(),
  routeGuidance: z.string().trim().max(600),
});

export type ConversationSafety = z.infer<typeof ConversationSafetySchema>;
export type CompanionIntentPrimary = z.infer<
  typeof CompanionIntentPrimarySchema
>;
export type ConversationIntent = z.infer<typeof ConversationIntentSchema>;
export type ConversationEmotion = z.infer<typeof ConversationEmotionSchema>;
export type EmotionRoute = z.infer<typeof EmotionRouteSchema>;
