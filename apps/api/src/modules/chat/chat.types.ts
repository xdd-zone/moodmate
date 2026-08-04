import type { CompanionChatLlmConfig, LlmConfigApi } from "@repo/contracts";

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatProviderConfig extends CompanionChatLlmConfig {
  api: LlmConfigApi;
  disableThinking: boolean;
}
