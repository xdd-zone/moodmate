import type { AdminProfile, AdminProfileAvatar } from "@repo/contracts";

export function presentAdminProfile(
  profile: Omit<AdminProfile, "avatar">,
  avatar: AdminProfileAvatar | null,
): AdminProfile {
  return { ...profile, avatar };
}
