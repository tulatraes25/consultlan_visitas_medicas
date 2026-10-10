/**
 * SEC-SESSION-01: pure claim extraction AFTER Supabase Auth has verified JWT.
 * This function alone must never be used as authentication or authorization.
 */
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SEGMENT = /^[A-Za-z0-9_-]+$/;

export function sessionIdFromVerifiedUserJwt(
  jwt: string,
  verifiedUserId: string,
): string | null {
  if (!UUID.test(verifiedUserId)) return null;
  const parts = jwt.split(".");
  if (parts.length !== 3 || parts.some(p => !SEGMENT.test(p))) return null;
  let decoded: unknown;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    decoded = JSON.parse(atob(padded));
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null;
  const claims = decoded as Record<string, unknown>;
  if (claims.sub !== verifiedUserId ||
      typeof claims.session_id !== "string" ||
      !UUID.test(claims.session_id) ||
      typeof claims.exp !== "number" ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000) + 5) {
    return null;
  }
  return claims.session_id;
}
