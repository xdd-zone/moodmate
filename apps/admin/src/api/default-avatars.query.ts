import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";

import {
  getAdminCurrentDefaultAvatar,
  getAdminDefaultAvatarHistory,
  setAdminCurrentDefaultAvatar,
  uploadAdminDefaultAvatar,
} from "./default-avatars.api";

export const adminDefaultAvatarKeys = {
  all: ["admin-default-avatars"] as const,
  current: () => [...adminDefaultAvatarKeys.all, "current"] as const,
  history: () => [...adminDefaultAvatarKeys.all, "history"] as const,
};

export function adminCurrentDefaultAvatarQueryOptions() {
  return queryOptions({
    queryFn: ({ signal }) => getAdminCurrentDefaultAvatar({ init: { signal } }),
    queryKey: adminDefaultAvatarKeys.current(),
    retry: false,
  });
}

export function adminDefaultAvatarHistoryQueryOptions() {
  return queryOptions({
    queryFn: ({ signal }) => getAdminDefaultAvatarHistory({ init: { signal } }),
    queryKey: adminDefaultAvatarKeys.history(),
    retry: false,
  });
}

function invalidateDefaultAvatars(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: adminDefaultAvatarKeys.all,
  });
}

export function uploadAdminDefaultAvatarMutationOptions(
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: uploadAdminDefaultAvatar,
    onSuccess: () => invalidateDefaultAvatars(queryClient),
  });
}

export function setAdminCurrentDefaultAvatarMutationOptions(
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: setAdminCurrentDefaultAvatar,
    onSuccess: () => invalidateDefaultAvatars(queryClient),
  });
}
