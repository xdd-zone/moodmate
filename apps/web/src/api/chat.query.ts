import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type { SubmitCompanionMessageFeedbackRequest } from "@repo/contracts";

import {
  getCompanionConversation,
  getCompanionMemories,
  submitCompanionMessageFeedback,
} from "./chat.api";

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

export function submitCompanionMessageFeedbackMutationOptions(
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (input: {
      messageId: string;
      payload: SubmitCompanionMessageFeedbackRequest;
    }) => submitCompanionMessageFeedback(input.messageId, input.payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: companionChatKeys.conversation(),
      }),
  });
}
