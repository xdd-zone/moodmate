import {
  RoleCreateRequestSchema,
  RoleListResponseSchema,
  RoleMutationResponseSchema,
  type RoleCreateRequest,
} from "@repo/contracts";

import { withAdminSessionRecovery } from "@/src/auth/api";
import { http } from "@/src/lib/http";

export function getAdminRoles() {
  return withAdminSessionRecovery(() =>
    http.get("/api/roles", RoleListResponseSchema),
  );
}

export function createAdminRole(payload: RoleCreateRequest) {
  return withAdminSessionRecovery(() =>
    http.post(
      "/api/roles",
      RoleCreateRequestSchema.parse(payload),
      RoleMutationResponseSchema,
    ),
  );
}

export function disableAdminRole(roleId: string) {
  return withAdminSessionRecovery(() =>
    http.post(`/api/roles/${roleId}/disable`, {}, RoleMutationResponseSchema),
  );
}

export function deleteAdminRole(roleId: string) {
  return withAdminSessionRecovery(() =>
    http.post(`/api/roles/${roleId}/delete`, {}, RoleMutationResponseSchema),
  );
}
