/**
 * SEC-SESSION-02: isolated, testable Auth + live-session boundary.
 * No JWT decoding is trusted until /auth/v1/user has accepted that JWT.
 * The only privileged RPC here is the fixed read-only session validator.
 */
import { sessionIdFromVerifiedUserJwt } from "./session.ts";

export type SessionAuthDependencies = {
  authUrl: string;
  sessionRpcUrl: string;
  publicKey: string;
  privateHeaders: () => Record<string, string>;
  fetcher: (input: string, init: RequestInit) => Promise<Response>;
};

export function createSessionAuthenticator(deps: SessionAuthDependencies) {
  return async function authenticate(jwt: string): Promise<string | null> {
    // The URLs and credentials are server-controlled, never taken from JSON.
    const response = await deps.fetcher(deps.authUrl, {
      method: "GET",
      headers: {
        apikey: deps.publicKey,
        authorization: "Bearer " + jwt,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if ([401, 403, 404].includes(response.status)) return null;
    if (!response.ok) throw new Error("Auth service unavailable");
    const user: unknown = await response.json();
    if (!user || typeof user !== "object" || Array.isArray(user) ||
        !("id" in user) || typeof user.id !== "string" ||
        ("is_anonymous" in user && user.is_anonymous === true)) {
      return null;
    }
    // Only AFTER Supabase Auth verified the user may we decode claim shape.
    const sessionId = sessionIdFromVerifiedUserJwt(jwt, user.id);
    if (!sessionId) return null;

    const sessionResponse = await deps.fetcher(deps.sessionRpcUrl, {
      method: "POST",
      headers: deps.privateHeaders(),
      body: JSON.stringify({ p_user: user.id, p_session: sessionId }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!sessionResponse.ok) throw new Error("Auth session verifier unavailable");
    let active: unknown;
    try { active = await sessionResponse.json(); }
    catch { throw new Error("Auth session verifier unavailable"); }
    return active === true ? user.id : null;
  };
}
