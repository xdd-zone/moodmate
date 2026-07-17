import type { AdminSession } from "@repo/contracts";
import { errors, jwtVerify, SignJWT } from "jose";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

const JWT_ALGORITHM = "HS256";
const JWT_AUDIENCE = "moodmate-admin";
const JWT_ISSUER = "moodmate-api";
const ACCESS_TTL_MS = 15 * 60 * 1000;
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UuidV7Schema = z.string().regex(UUID_V7_PATTERN);
const BaseTokenClaimsSchema = z
  .object({
    app: z.literal("admin"),
    aud: z.literal(JWT_AUDIENCE),
    exp: z.number().int(),
    iat: z.number().int(),
    iss: z.literal(JWT_ISSUER),
    jti: UuidV7Schema,
    sid: UuidV7Schema,
    sub: UuidV7Schema,
  })
  .strict();
const AccessTokenClaimsSchema = BaseTokenClaimsSchema.extend({
  roles: z.array(z.string().min(1)).min(1),
  token_use: z.literal("access"),
}).strict();
const RefreshTokenClaimsSchema = BaseTokenClaimsSchema.extend({
  token_use: z.literal("refresh"),
}).strict();

export type AccessTokenClaims = z.infer<typeof AccessTokenClaimsSchema>;
export type RefreshTokenClaims = z.infer<typeof RefreshTokenClaimsSchema>;

export interface IssuedToken {
  expiresAtMs: number;
  jti: string;
  token: string;
}

export class TokenVerificationError extends Error {
  constructor(readonly reason: "expired" | "invalid") {
    super(`token ${reason}`);
  }
}

export async function issueAccessToken(
  input: {
    roles: AdminSession["roles"];
    sessionExpiresAtMs: number;
    sessionId: string;
    userId: string;
  },
  secret: string,
  nowMs: number,
): Promise<IssuedToken> {
  const expiresAtMs = toJwtExpiresAtMs(
    Math.min(nowMs + ACCESS_TTL_MS, input.sessionExpiresAtMs),
  );
  const jti = uuidv7();
  const token = await signToken(
    {
      app: "admin",
      roles: input.roles,
      sid: input.sessionId,
      token_use: "access",
    },
    input.userId,
    jti,
    expiresAtMs,
    secret,
    nowMs,
  );

  return { expiresAtMs, jti, token };
}

export async function issueRefreshToken(
  input: {
    sessionExpiresAtMs: number;
    sessionId: string;
    userId: string;
  },
  secret: string,
  nowMs: number,
): Promise<IssuedToken> {
  const expiresAtMs = toJwtExpiresAtMs(input.sessionExpiresAtMs);
  const jti = uuidv7();
  const token = await signToken(
    {
      app: "admin",
      sid: input.sessionId,
      token_use: "refresh",
    },
    input.userId,
    jti,
    expiresAtMs,
    secret,
    nowMs,
  );

  return { expiresAtMs, jti, token };
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenClaims> {
  return verifyToken(token, secret, AccessTokenClaimsSchema);
}

export async function verifyRefreshToken(
  token: string,
  secret: string,
): Promise<RefreshTokenClaims> {
  return verifyToken(token, secret, RefreshTokenClaimsSchema);
}

async function signToken(
  payload: Record<string, unknown>,
  subject: string,
  jti: string,
  expiresAtMs: number,
  secret: string,
  nowMs: number,
): Promise<string> {
  const issuedAtSeconds = Math.floor(nowMs / 1000);
  const expiresAtSeconds = Math.floor(expiresAtMs / 1000);

  if (expiresAtSeconds <= issuedAtSeconds) {
    throw new TokenVerificationError("expired");
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(subject)
    .setJti(jti)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(expiresAtSeconds)
    .sign(toSecretKey(secret));
}

async function verifyToken<TClaims extends { exp: number; iat: number }>(
  token: string,
  secret: string,
  schema: z.ZodType<TClaims>,
): Promise<TClaims> {
  try {
    const { payload, protectedHeader } = await jwtVerify(
      token,
      toSecretKey(secret),
      {
        algorithms: [JWT_ALGORITHM],
        audience: JWT_AUDIENCE,
        issuer: JWT_ISSUER,
        requiredClaims: ["sub", "sid", "app", "jti", "token_use", "iat", "exp"],
      },
    );

    if (protectedHeader.typ !== "JWT") {
      throw new TokenVerificationError("invalid");
    }

    const result = schema.safeParse(payload);

    if (
      !result.success ||
      result.data.exp <= result.data.iat ||
      result.data.iat > Math.floor(Date.now() / 1000) + 5
    ) {
      throw new TokenVerificationError("invalid");
    }

    return result.data;
  } catch (error) {
    if (error instanceof TokenVerificationError) {
      throw error;
    }

    if (error instanceof errors.JWTExpired) {
      throw new TokenVerificationError("expired");
    }

    throw new TokenVerificationError("invalid");
  }
}

function toSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function toJwtExpiresAtMs(value: number): number {
  return Math.floor(value / 1000) * 1000;
}
