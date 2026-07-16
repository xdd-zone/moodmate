import { hashPassword, verifyPassword } from "../src/modules/auth/password";

export default {
  async fetch(): Promise<Response> {
    const password = `benchmark-${crypto.randomUUID()}`;
    const hashStartedAt = performance.now();
    const passwordHash = await hashPassword(password);
    const hashDurationMs = performance.now() - hashStartedAt;
    const verifyStartedAt = performance.now();
    const verified = await verifyPassword(password, passwordHash);
    const verifyDurationMs = performance.now() - verifyStartedAt;

    return Response.json({
      hashDurationMs: roundDuration(hashDurationMs),
      verified,
      verifyDurationMs: roundDuration(verifyDurationMs),
    });
  },
};

function roundDuration(value: number): number {
  return Math.round(value * 100) / 100;
}
