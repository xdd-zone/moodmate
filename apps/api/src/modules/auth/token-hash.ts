import { encodeBase64Url } from "./base64-url";

export async function hashTokenId(tokenId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(tokenId),
  );
  return encodeBase64Url(new Uint8Array(digest));
}
