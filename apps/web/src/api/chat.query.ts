import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  GenerateCompanionCareEventRequest,
  SubmitCompanionMessageFeedbackRequest,
  UpsertCompanionCarePlanRequest,
} from "@repo/contracts";

import {
  generateCompanionCareEvent,
  getCompanionCareEvents,
  getCompanionCarePlan,
  getCompanionConversation,
  getCompanionMemories,
  submitCompanionMessageFeedback,
  updateCompanionCarePlan,
} from "./chat.api";

export const companionChatKeys = {
  all: ["companion-chat"] as const,
  careEvents: () => [...companionChatKeys.all, "care-events"] as const,
  carePlan: () => [...companionChatKeys.all, "care-plan"] as const,
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

export function companionCarePlanQueryOptions() {
  return queryOptions({
    queryFn: ({ signal }) => getCompanionCarePlan({ init: { signal } }),
    queryKey: companionChatKeys.carePlan(),
  });
}

export function companionCareEventsQueryOptions() {
  return queryOptions({
    queryFn: ({ signal }) => getCompanionCareEvents({ init: { signal } }),
    queryKey: companionChatKeys.careEvents(),
  });
}

export function updateCompanionCarePlanMutationOptions(
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (input: UpsertCompanionCarePlanRequest) =>
      updateCompanionCarePlan(input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: companionChatKeys.carePlan(),
      }),
  });
}

export function generateCompanionCareEventMutationOptions(
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (input: GenerateCompanionCareEventRequest) =>
      generateCompanionCareEvent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: companionChatKeys.careEvents(),
      });
      void queryClient.invalidateQueries({
        queryKey: companionChatKeys.conversation(),
      });
    },
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
