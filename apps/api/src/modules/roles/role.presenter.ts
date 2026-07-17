import type { Role } from "@repo/contracts";

import { isProtectedRole } from "./role-policy";

type RoleRecord = Omit<Role, "isProtected">;

export function presentRole(role: RoleRecord): Role {
  return {
    ...role,
    isProtected: isProtectedRole(role.code),
  };
}
