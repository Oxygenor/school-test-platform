import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Короткоживуча серверно перевірювана сесія підготовки.
 * Видається лише після перевірки коду класу та належності учня до класу.
 * Підписується HMAC-SHA256 серверним секретом; у браузері лише зберігається.
 */
export interface PrepClaims {
  v: 1;
  cid: number; // class id
  tid: string; // teacher id
  sid: string; // student id
  exp: number; // unix seconds
}

export const PREP_TOKEN_TTL_SECONDS = 2 * 60 * 60;

function getSecret(): string {
  const explicit = process.env.PREP_SESSION_SECRET;
  if (explicit && explicit.length >= 32) return explicit;
  // Резерв: похідний ключ від серверного ключа Supabase (теж лише серверний).
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error('prep session secret is not configured');
  return createHmac('sha256', base).update('math-helper-prep-session-v1').digest('hex');
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(payload: string): string {
  return b64url(createHmac('sha256', getSecret()).update(payload).digest());
}

export function issuePrepToken(
  input: { classId: number; teacherId: string; studentId: string },
  nowMs = Date.now(),
): { token: string; expiresAt: number } {
  const exp = Math.floor(nowMs / 1000) + PREP_TOKEN_TTL_SECONDS;
  const claims: PrepClaims = { v: 1, cid: input.classId, tid: input.teacherId, sid: input.studentId, exp };
  const payload = b64url(Buffer.from(JSON.stringify(claims), 'utf8'));
  return { token: `${payload}.${sign(payload)}`, expiresAt: exp * 1000 };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function verifyPrepToken(token: string | null | undefined, nowMs = Date.now()): PrepClaims | null {
  if (!token || typeof token !== 'string' || token.length > 1000) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(fromB64url(payload).toString('utf8')) as PrepClaims;
    if (claims.v !== 1) return null;
    if (!Number.isInteger(claims.cid) || claims.cid <= 0) return null;
    if (!isUuid(claims.tid) || !isUuid(claims.sid)) return null;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs) return null;
    return claims;
  } catch {
    return null;
  }
}
