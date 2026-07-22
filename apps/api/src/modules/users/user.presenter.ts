import type { UserListItem, UserRole } from "@repo/contracts";

import type { UserListRow, UserRoleRow } from "./user.repository";

export function presentUser(
  user: UserListRow,
  roles: readonly UserRole[],
): UserListItem {
  return {
    createdAtMs: user.createdAtMs,
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    lastLoginAtMs: user.lastLoginAtMs,
    roles: [...roles],
    status: user.status,
  };
}

export function presentUserList(
  users: readonly UserListRow[],
  roleRows: readonly UserRoleRow[],
): UserListItem[] {
  const rolesByUserId = new Map<string, UserRole[]>();

  for (const { userId, ...role } of roleRows) {
    const userRoles = rolesByUserId.get(userId) ?? [];
    userRoles.push(role);
    rolesByUserId.set(userId, userRoles);
  }

  return users.map((user) =>
    presentUser(user, rolesByUserId.get(user.id) ?? []),
  );
}
