import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type { PingRequest } from "@repo/contracts";

import { getHealth, postPing } from "./system.api";

export const systemKeys = {
  all: ["system"] as const,
  health: () => [...systemKeys.all, "health"] as const,
};

export function healthQueryOptions() {
  return queryOptions({
    queryKey: systemKeys.health(),
    queryFn: ({ signal }) => getHealth({ init: { signal } }),
  });
}

export function pingMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (payload: PingRequest) => postPing(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: systemKeys.health() });
    },
  });
}
