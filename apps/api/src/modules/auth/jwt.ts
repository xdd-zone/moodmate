import { errors, jwtVerify, SignJWT } from "jose";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "moodmate-api";
const ACCESS_TTL_MS = 15 * 60 * 1000;
const JWT_AUDIENCES = {
  admin: "moodmate-admin",
  web: "moodmate-web",
} as const;
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UuidV7Schema = z.string().regex(UUID_V7_PATTERN);
const AuthApplicationSchema = z.enum(["admin", "web"]);
const BaseTokenClaimsSchema = z
  .object({
    app: AuthApplicationSchema,
    aud: z.enum([JWT_AUDIENCES.admin, JWT_AUDIENCES.web]),
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
export type AuthApplication = z.infer<typeof AuthApplicationSchema>;

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
    application?: AuthApplication;
    roles: string[];
    sessionExpiresAtMs: number;
    sessionId: string;
    userId: string;
  },
  secret: string,
  nowMs: number,
): Promise<IssuedToken> {
  const application = input.application ?? "admin";
  const expiresAtMs = toJwtExpiresAtMs(
    Math.min(nowMs + ACCESS_TTL_MS, input.sessionExpiresAtMs),
  );
  const jti = uuidv7();
  const token = await signToken(
    {
      app: application,
      roles: input.roles,
      sid: input.sessionId,
      token_use: "access",
    },
    input.userId,
    jti,
    expiresAtMs,
    application,
    secret,
    nowMs,
  );

  return { expiresAtMs, jti, token };
}

export async function issueRefreshToken(
  input: {
    application?: AuthApplication;
    sessionExpiresAtMs: number;
    sessionId: string;
    userId: string;
  },
  secret: string,
  nowMs: number,
): Promise<IssuedToken> {
  const application = input.application ?? "admin";
  const expiresAtMs = toJwtExpiresAtMs(input.sessionExpiresAtMs);
  const jti = uuidv7();
  const token = await signToken(
    {
      app: application,
      sid: input.sessionId,
      token_use: "refresh",
    },
    input.userId,
    jti,
    expiresAtMs,
    application,
    secret,
    nowMs,
  );

  return { expiresAtMs, jti, token };
}

export async function verifyAccessToken(
  token: string,
  secret: string,
  expectedApplication: AuthApplication = "admin",
): Promise<AccessTokenClaims> {
  return verifyToken(
    token,
    secret,
    AccessTokenClaimsSchema,
    expectedApplication,
  );
}

export async function verifyRefreshToken(
  token: string,
  secret: string,
  expectedApplication: AuthApplication = "admin",
): Promise<RefreshTokenClaims> {
  return verifyToken(
    token,
    secret,
    RefreshTokenClaimsSchema,
    expectedApplication,
  );
}

async function signToken(
  payload: Record<string, unknown>,
  subject: string,
  jti: string,
  expiresAtMs: number,
  application: AuthApplication,
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
    .setAudience(JWT_AUDIENCES[application])
    .setSubject(subject)
    .setJti(jti)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(expiresAtSeconds)
    .sign(toSecretKey(secret));
}

async function verifyToken<
  TClaims extends { app: AuthApplication; exp: number; iat: number },
>(
  token: string,
  secret: string,
  schema: z.ZodType<TClaims>,
  expectedApplication: AuthApplication,
): Promise<TClaims> {
  try {
    const { payload, protectedHeader } = await jwtVerify(
      token,
      toSecretKey(secret),
      {
        algorithms: [JWT_ALGORITHM],
        audience: JWT_AUDIENCES[expectedApplication],
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
      result.data.app !== expectedApplication ||
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
