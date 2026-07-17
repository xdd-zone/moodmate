import { queryOptions } from "@tanstack/react-query";

import { getAdminRoles } from "./roles.api";

export const adminRoleKeys = {
  all: ["admin-roles"] as const,
  list: () => [...adminRoleKeys.all, "list"] as const,
};

export function adminRolesQueryOptions() {
  return queryOptions({
    queryFn: getAdminRoles,
    queryKey: adminRoleKeys.list(),
    retry: false,
  });
}
