import {
  BizCode,
  type CompanionChatLlmConfig,
  type CompanionChatMessage,
} from "@repo/contracts";

import { AppError } from "@/shared/app-error";
import { getApiEnv } from "@/shared/env";
import type { ApiBindings } from "@/shared/hono-env";

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatProviderConfig extends CompanionChatLlmConfig {
  isPlatformDeepSeek: boolean;
}

const COMPANION_SYSTEM_PROMPT = [
  "你是 MoodMate AI 伴侣，也是用户的虚拟朋友。",
  "请使用自然、尊重、不过度依赖的中文交流，认真回应用户此刻表达的内容。",
  "你不是医生、心理咨询师或治疗工具，不提供诊断、疗效承诺，也不把回复描述成医疗建议。",
  "如果用户提到现实危险或紧急情况，鼓励其联系当地紧急服务或可信任的人，不要假装能提供线下救援。",
].join("\n");

export function prepareCompanionChat(input: {
  bindings: ApiBindings;
  llmConfig?: CompanionChatLlmConfig;
  messages: CompanionChatMessage[];
}): {
  messages: ChatCompletionMessage[];
  providerConfig: ChatProviderConfig;
} {
  const messages = input.messages.flatMap((message) => {
    const content = extractMessageText(message);

    return content ? [{ role: message.role, content }] : [];
  });

  if (messages.length === 0 || !messages.some((item) => item.role === "user")) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, "聊天内容不能为空", 400);
  }

  return {
    messages: [
      { role: "system", content: COMPANION_SYSTEM_PROMPT },
      ...messages,
    ],
    providerConfig: resolveProviderConfig(input.bindings, input.llmConfig),
  };
}

function extractMessageText(message: CompanionChatMessage): string {
  return message.parts
    .flatMap((part) => {
      const text = part["text"];
      return part.type === "text" && typeof text === "string" ? [text] : [];
    })
    .join("\n")
    .trim();
}

function resolveProviderConfig(
  bindings: ApiBindings,
  llmConfig?: CompanionChatLlmConfig,
): ChatProviderConfig {
  if (llmConfig) {
    return {
      ...llmConfig,
      baseURL: normalizeBaseURL(llmConfig.baseURL),
      isPlatformDeepSeek: false,
    };
  }

  const env = getApiEnv(bindings);

  if (!env.DEEPSEEK_API_KEY) {
    throw new AppError(
      BizCode.SYSTEM_INTERNAL_ERROR,
      "平台 DeepSeek 尚未配置，请在 LLM 设置中填写本地配置",
      503,
    );
  }

  return {
    providerName: "DeepSeek",
    baseURL: env.DEEPSEEK_BASE_URL,
    model: env.DEEPSEEK_MODEL,
    apiKey: env.DEEPSEEK_API_KEY,
    isPlatformDeepSeek: true,
  };
}

function normalizeBaseURL(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
