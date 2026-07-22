import {
  UserCreateRequestSchema,
  UserListQuerySchema,
  UserListResponseSchema,
  UserMutationResponseSchema,
  type UserCreateRequest,
  type UserListQuery,
} from "@repo/contracts";

import { withAdminSessionRecovery } from "@/src/auth/api";
import { http } from "@/src/lib/http";
import type { HttpRequestOptions } from "@/src/lib/http";

type UsersRequestOptions = Pick<HttpRequestOptions, "init">;

export function getAdminUsers(
  query: UserListQuery,
  options?: UsersRequestOptions,
) {
  const data = UserListQuerySchema.parse(query);

  return withAdminSessionRecovery(() =>
    http.get("/api/users", UserListResponseSchema, {
      init: options?.init,
      query: data,
    }),
  );
}

export function createAdminUser(payload: UserCreateRequest) {
  return withAdminSessionRecovery(() =>
    http.post(
      "/api/users",
      UserCreateRequestSchema.parse(payload),
      UserMutationResponseSchema,
    ),
  );
}
