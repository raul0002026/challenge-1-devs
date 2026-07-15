import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const DEV_SECRET = 'dev-insecure-session-secret';

export interface SessionPayload {
  userId: number;
  email: string;
}

/** Hash a plaintext password with scrypt. Returns "salt:derivedKey" (both hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${derived}`;
}

/** Constant-time verification of a plaintext password against a stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, derivedHex] = stored.split('.');
  if (!salt || !derivedHex) return false;
  const expected = Buffer.from(derivedHex, 'hex');
  if (expected.length === 0) return false;
  const candidate = scryptSync(password, salt, expected.length);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function resolveSecret(secret?: string): string {
  return secret ?? process.env.SESSION_SECRET ?? DEV_SECRET;
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

/** Create a signed, stateless session token: base64url(payload).hmac. */
export function createSessionToken(payload: SessionPayload, secret?: string): string {
  const key = resolveSecret(secret);
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, key)}`;
}

/** Verify a session token. Returns the payload when valid, otherwise null. */
export function verifySessionToken(token: string, secret?: string): SessionPayload | null {
  const key = resolveSecret(secret);
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  const expected = sign(body, key);
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as SessionPayload).userId === 'number' &&
      typeof (parsed as SessionPayload).email === 'string'
    ) {
      const { userId, email } = parsed as SessionPayload;
      return { userId, email };
    }
    return null;
  } catch {
    return null;
  }
}
