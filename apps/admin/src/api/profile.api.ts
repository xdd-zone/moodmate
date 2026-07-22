import {
  AdminProfileAvatarUploadResponseSchema,
  AdminProfileSchema,
} from "@repo/contracts";

import { withAdminSessionRecovery } from "@/src/auth/api";
import { http } from "@/src/lib/http";
import type { HttpRequestOptions } from "@/src/lib/http";

type ProfileRequestOptions = Pick<HttpRequestOptions, "init">;

export function getAdminProfile(options?: ProfileRequestOptions) {
  return withAdminSessionRecovery(() =>
    http.get("/api/profile", AdminProfileSchema, options),
  );
}

export function uploadAdminProfileAvatar(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return withAdminSessionRecovery(() =>
    http.postForm(
      "/api/profile/avatar",
      formData,
      AdminProfileAvatarUploadResponseSchema,
    ),
  );
}
