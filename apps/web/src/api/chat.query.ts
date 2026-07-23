import { queryOptions } from "@tanstack/react-query";

import { getCompanionConversation, getCompanionMemories } from "./chat.api";

export const companionChatKeys = {
  all: ["companion-chat"] as const,
  conversation: () => [...companionChatKeys.all, "conversation"] as const,
  memories: () => [...companionChatKeys.all, "memories"] as const,
};

export function companionConversationQueryOptions() {
  return queryOptions({
    queryFn: ({ signal }) => getCompanionConversation({ init: { signal } }),
    queryKey: companionChatKeys.conversation(),
  });
}

export function companionMemoriesQueryOptions() {
  return queryOptions({
    queryFn: ({ signal }) => getCompanionMemories({ init: { signal } }),
    queryKey: companionChatKeys.memories(),
  });
}
