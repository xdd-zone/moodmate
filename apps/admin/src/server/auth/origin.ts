import { invalidOriginResponse } from "./bff-response";

export function validateSameOrigin(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");

  if (origin === requestOrigin) {
    return null;
  }

  return invalidOriginResponse();
}
