import { queryOptions } from "@tanstack/react-query";

import { getAdminSession } from "./api";

export const adminSessionKeys = {
  all: ["admin-session"] as const,
  current: () => [...adminSessionKeys.all, "current"] as const,
};

export function adminSessionQueryOptions() {
  return queryOptions({
    queryFn: getAdminSession,
    queryKey: adminSessionKeys.current(),
    retry: false,
    staleTime: 60_000,
  });
}
