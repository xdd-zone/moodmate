import { AiError } from "./errors";
import { anthropicMessagesProvider } from "./providers/anthropic-messages";
import { openAiCompatibleProvider } from "./providers/openai-compatible";
import { openAiResponsesProvider } from "./providers/openai-responses";
import type { AiApi, AiProvider } from "./types";

/**
 * 协议实现映射。以 `api` 为 key 选择 Provider 实现，不按 `providerName` 分支。
 *
 * 只读：没有运行时修改方法。扩展协议时在这里静态注册新实现，业务模块不感知。
 *
 * registry 依赖 provider，provider 只依赖 types，不反向依赖 registry，无循环依赖。
 */
type ProviderMap = {
  [K in AiApi]?: AiProvider<K>;
};

const PROVIDERS: ProviderMap = {
  "anthropic-messages": anthropicMessagesProvider,
  "openai-chat-completions": openAiCompatibleProvider,
  "openai-responses": openAiResponsesProvider,
};

/**
 * 按协议标识取实现。未注册时抛 `invalid_config`。
 */
export function getAiProvider<TApi extends AiApi>(api: TApi): AiProvider<TApi> {
  const provider = PROVIDERS[api];

  if (!provider) {
    throw new AiError("invalid_config", `未注册的 AI 协议实现: ${api}`);
  }

  return provider;
}
