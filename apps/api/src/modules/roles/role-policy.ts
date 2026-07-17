const protectedRoleCodes = new Set(["admin_owner", "web_user"]);

export function isProtectedRole(code: string): boolean {
  return protectedRoleCodes.has(code);
}

export function canManageRoles(roles: readonly string[]): boolean {
  return roles.includes("admin_owner");
}
