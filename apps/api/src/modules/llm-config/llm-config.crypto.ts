const AES_IV_BYTES = 12;

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function importAesKey(masterKey: string): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(masterKey);

  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface EncryptedApiKey {
  ciphertext: string;
  iv: string;
}

export async function encryptApiKey(
  masterKey: string,
  plaintext: string,
): Promise<EncryptedApiKey> {
  const key = await importAesKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptApiKey(
  masterKey: string,
  encrypted: EncryptedApiKey,
): Promise<string> {
  const key = await importAesKey(masterKey);
  const iv = base64ToBytes(encrypted.iv);
  const ciphertext = base64ToBytes(encrypted.ciphertext);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

export function apiKeyLast4(plaintext: string): string {
  return plaintext.slice(-4);
}
