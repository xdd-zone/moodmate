import { BizCode, DEFAULT_LLM_CONFIG_API } from "@repo/contracts";
import type { BaseMessage } from "@langchain/core/messages";

import { isAiError, type AiMessage, type AiModel } from "@/infra/ai";
import { AppError } from "@/shared/app-error";

import type { ChatCompletionMessage, ChatProviderConfig } from "./chat.service";

/**
 * 把业务侧的 ChatProviderConfig 转成 AI runtime 的 AiModel。
 * ChatProviderConfig 无 api 字段，统一用 DEFAULT_LLM_CONFIG_API；
 * disableThinking 映射到 openai-chat-completions 的受控 Provider 选项。
 */
export function toAiModel(config: ChatProviderConfig): AiModel {
  return {
    api: DEFAULT_LLM_CONFIG_API,
    providerName: config.providerName,
    model: config.model,
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    providerOptions: {
      "openai-chat-completions": {
        disableThinking: config.disableThinking,
      },
    },
  };
}

/** ChatCompletionMessage 与 AiMessage 结构一致，按 role 显式收敛到联合类型。 */
export function toAiMessages(messages: ChatCompletionMessage[]): AiMessage[] {
  return messages.map((message): AiMessage => {
    switch (message.role) {
      case "system":
        return { role: "system", content: message.content };
      case "user":
        return { role: "user", content: message.content };
      case "assistant":
        return { role: "assistant", content: message.content };
    }
  });
}

/** 取 LangChain message 的文本内容：content 是字符串直接用，是数组时拼接 text 块。 */
function extractMessageText(content: BaseMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
      return "";
    })
    .join("");
}

/**
 * 把 ChatPromptTemplate.formatMessages() 产出的 LangChain 消息转成 AiMessage[]。
 * 用于 structured output 迁移：system/ai 之外的角色（human 等）统一映射为 user。
 */
export function fromLangChainMessages(messages: BaseMessage[]): AiMessage[] {
  return messages.map((message): AiMessage => {
    const text = extractMessageText(message.content);
    const type = message.getType();

    if (type === "system") {
      return { role: "system", content: text };
    }
    if (type === "ai") {
      return { role: "assistant", content: text };
    }
    return { role: "user", content: text };
  });
}

/**
 * 把 AI runtime 的 AiError 转成聊天业务边界的 AppError。
 * 对齐迁移前 chat.provider.ts / group-chat.provider.ts 的错误映射：
 * - timeout → 504 SYSTEM_UPSTREAM_TIMEOUT
 * - network → 503 SYSTEM_INTERNAL_ERROR「无法连接模型服务」
 * - 其余上游错误 → 503 SYSTEM_INTERNAL_ERROR「模型请求失败」
 * aborted 保持取消语义向上抛，不转成 AppError；非 AiError 原样抛出。
 */
export function toChatAppError(error: unknown): unknown {
  if (!isAiError(error)) {
    return error;
  }

  switch (error.code) {
    case "aborted":
      return error;
    case "timeout":
      return new AppError(
        BizCode.SYSTEM_UPSTREAM_TIMEOUT,
        "模型服务响应超时，请稍后重试",
        504,
      );
    case "network":
      return new AppError(
        BizCode.SYSTEM_INTERNAL_ERROR,
        "无法连接模型服务，请稍后重试",
        503,
      );
    default:
      return new AppError(
        BizCode.SYSTEM_INTERNAL_ERROR,
        "模型请求失败，请检查配置后重试",
        503,
      );
  }
}
