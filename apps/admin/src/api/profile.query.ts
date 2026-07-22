import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";

import { getAdminProfile, uploadAdminProfileAvatar } from "./profile.api";

export const adminProfileKeys = {
  all: ["admin-profile"] as const,
  current: () => [...adminProfileKeys.all, "current"] as const,
};

export function adminProfileQueryOptions() {
  return queryOptions({
    queryFn: ({ signal }) => getAdminProfile({ init: { signal } }),
    queryKey: adminProfileKeys.current(),
    retry: false,
    staleTime: 60_000,
  });
}

export function uploadAdminProfileAvatarMutationOptions(
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: uploadAdminProfileAvatar,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminProfileKeys.all }),
  });
}
