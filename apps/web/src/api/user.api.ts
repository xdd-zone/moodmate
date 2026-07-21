import { WebUserProfileSchema } from "@repo/contracts";

import { http } from "@/src/lib/http";
import type { HttpRequestOptions } from "@/src/lib/http";

type UserRequestOptions = Pick<HttpRequestOptions, "init">;

export function getWebUserProfile(options?: UserRequestOptions) {
  return http.get("/rpc/user/profile", WebUserProfileSchema, options);
}
