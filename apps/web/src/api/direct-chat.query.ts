import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import {
  createDirectChat,
  getDirectChat,
  getDirectChatMessages,
  getDirectChats,
  submitDirectChatFeedback,
} from "./direct-chat.api";
export const directChatKeys = {
  all: ["direct-chats"] as const,
  list: () => ["direct-chats", "list"] as const,
  detail: (id: string) => ["direct-chats", "detail", id] as const,
  messages: (id: string) => ["direct-chats", "messages", id] as const,
};
export const directChatsQueryOptions = () =>
  queryOptions({
    queryKey: directChatKeys.list(),
    queryFn: ({ signal }) => getDirectChats({ init: { signal } }),
  });
export const directChatDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: directChatKeys.detail(id),
    queryFn: ({ signal }) => getDirectChat(id, { init: { signal } }),
    enabled: Boolean(id),
  });
export const directChatMessagesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: directChatKeys.messages(id),
    queryFn: ({ signal }) =>
      getDirectChatMessages(id, undefined, { init: { signal } }),
    enabled: Boolean(id),
  });
export const createDirectChatMutationOptions = (client: QueryClient) =>
  mutationOptions({
    mutationFn: (agentId: string) => createDirectChat(agentId),
    onSuccess: (data) => {
      client.setQueryData(directChatKeys.detail(data.conversation.id), {
        conversation: data.conversation,
      });
      return client.invalidateQueries({ queryKey: directChatKeys.list() });
    },
  });
export const submitDirectChatFeedbackMutationOptions = (client: QueryClient) =>
  mutationOptions({
    mutationFn: (input: {
      conversationId: string;
      messageId: string;
      payload: Parameters<typeof submitDirectChatFeedback>[2];
    }) =>
      submitDirectChatFeedback(
        input.conversationId,
        input.messageId,
        input.payload,
      ),
    onSuccess: (_data, input) =>
      client.invalidateQueries({
        queryKey: directChatKeys.messages(input.conversationId),
      }),
  });
