import {
  AdminDefaultAvatarCurrentResponseSchema,
  AdminDefaultAvatarHistoryResponseSchema,
  AdminDefaultAvatarSetCurrentRequestSchema,
  AdminDefaultAvatarSetCurrentResponseSchema,
  AdminDefaultAvatarUploadResponseSchema,
} from "@repo/contracts";

import { withAdminSessionRecovery } from "@/src/auth/api";
import { http } from "@/src/lib/http";
import type { HttpRequestOptions } from "@/src/lib/http";

type DefaultAvatarRequestOptions = Pick<HttpRequestOptions, "init">;

export function getAdminCurrentDefaultAvatar(
  options?: DefaultAvatarRequestOptions,
) {
  return withAdminSessionRecovery(() =>
    http.get(
      "/api/default-avatars/current",
      AdminDefaultAvatarCurrentResponseSchema,
      options,
    ),
  );
}

export function getAdminDefaultAvatarHistory(
  options?: DefaultAvatarRequestOptions,
) {
  return withAdminSessionRecovery(() =>
    http.get(
      "/api/default-avatars/history",
      AdminDefaultAvatarHistoryResponseSchema,
      options,
    ),
  );
}

export function uploadAdminDefaultAvatar(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return withAdminSessionRecovery(() =>
    http.postForm(
      "/api/default-avatars",
      formData,
      AdminDefaultAvatarUploadResponseSchema,
    ),
  );
}

export function setAdminCurrentDefaultAvatar(versionId: string) {
  const input = AdminDefaultAvatarSetCurrentRequestSchema.parse({ versionId });

  return withAdminSessionRecovery(() =>
    http.post(
      `/api/default-avatars/${input.versionId}/current`,
      {},
      AdminDefaultAvatarSetCurrentResponseSchema,
    ),
  );
}
