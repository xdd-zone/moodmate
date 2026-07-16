import { decodeBase64Url, encodeBase64Url } from "./base64-url";

const DEFAULT_ITERATIONS = 600_000;
const DEFAULT_KEY_LENGTH = 32;
const DEFAULT_SALT_LENGTH = 16;
const PASSWORD_HASH_PATTERN =
  /^\$pbkdf2-sha256\$v=1\$i=(\d+),l=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

export const DUMMY_PASSWORD_HASH =
  "$pbkdf2-sha256$v=1$i=600000,l=32$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(DEFAULT_SALT_LENGTH));
  const derivedKey = await derivePassword(
    password,
    salt,
    DEFAULT_ITERATIONS,
    DEFAULT_KEY_LENGTH,
  );

  return `$pbkdf2-sha256$v=1$i=${DEFAULT_ITERATIONS},l=${DEFAULT_KEY_LENGTH}$${encodeBase64Url(salt)}$${encodeBase64Url(derivedKey)}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const parsed = parsePasswordHash(encodedHash);

  if (!parsed) {
    return false;
  }

  const derivedKey = await derivePassword(
    password,
    parsed.salt,
    parsed.iterations,
    parsed.keyLength,
  );

  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(
      left: ArrayBuffer | ArrayBufferView,
      right: ArrayBuffer | ArrayBufferView,
    ): boolean;
  };

  return subtle.timingSafeEqual(derivedKey, parsed.hash);
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLength: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations,
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
    },
    key,
    keyLength * 8,
  );

  return new Uint8Array(bits);
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}

function parsePasswordHash(encodedHash: string) {
  const match = PASSWORD_HASH_PATTERN.exec(encodedHash);

  if (!match) {
    return null;
  }

  const iterations = Number(match[1]);
  const keyLength = Number(match[2]);

  if (
    !Number.isSafeInteger(iterations) ||
    iterations <= 0 ||
    !Number.isSafeInteger(keyLength) ||
    keyLength <= 0 ||
    keyLength > 64
  ) {
    return null;
  }

  try {
    const salt = decodeBase64Url(match[3]);
    const hash = decodeBase64Url(match[4]);

    if (salt.byteLength < 16 || hash.byteLength !== keyLength) {
      return null;
    }

    return { hash, iterations, keyLength, salt };
  } catch {
    return null;
  }
}
