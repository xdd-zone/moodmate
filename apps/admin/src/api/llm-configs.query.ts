import { queryOptions } from "@tanstack/react-query";

import { getAdminLlmConfigs } from "./llm-configs.api";

export const adminLlmConfigKeys = {
  all: ["admin-llm-configs"] as const,
  list: () => [...adminLlmConfigKeys.all, "list"] as const,
};

export function adminLlmConfigsQueryOptions() {
  return queryOptions({
    queryFn: getAdminLlmConfigs,
    queryKey: adminLlmConfigKeys.list(),
    retry: false,
  });
}
