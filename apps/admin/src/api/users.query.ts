import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type { UserCreateRequest, UserListQuery } from "@repo/contracts";

import { createAdminUser, getAdminUsers } from "./users.api";

export const adminUserKeys = {
  all: ["admin-users"] as const,
  list: (query: UserListQuery) =>
    [...adminUserKeys.all, "list", query.page, query.pageSize] as const,
};

export function adminUsersQueryOptions(query: UserListQuery) {
  return queryOptions({
    queryFn: ({ signal }) => getAdminUsers(query, { init: { signal } }),
    queryKey: adminUserKeys.list(query),
    retry: false,
  });
}

export function createAdminUserMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (payload: UserCreateRequest) => createAdminUser(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
    },
  });
}
