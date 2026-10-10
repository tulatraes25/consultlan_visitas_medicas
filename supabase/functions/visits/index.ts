// SUPA-03. Supabase Edge entrypoint. No clinical data is logged or cached.
// Deploy only to the new, standalone visits project after staging security review.
import { createVisitHandler, type CommandResult } from "./handler.ts";
import { sessionIdFromVerifiedUserJwt } from "./session.ts";

const url = Deno.env.get("SUPABASE_URL");
const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY");
const serviceKey = Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !publicKey || !serviceKey) {
  throw new Error("Supabase backend environment is not configured");
}

const origin = new URL(url).origin;
// These are backend-controlled URLs; user JSON may never select the endpoint.
const authUrl = new URL("/auth/v1/user", origin).toString();
const rpcBase = new URL("/rest/v1/rpc/", origin).toString();

function serverOnlyHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: serviceKey!,
    "content-type": "application/json",
    accept: "application/json",
  };
  // Secret keys are apikey-only; legacy service_role JWTs are Bearer.
  if (!serviceKey!.startsWith("sb_secret_")) {
    headers.authorization = "Bearer " + serviceKey;
  }
  return headers;
}

const handler = createVisitHandler({
  async authenticate(jwt) {
    // Auth server always verifies the signed JWT and returns the CURRENT user.
    // Never use decode-only JWT claims or mobile-provided actor/role metadata.
    const response = await fetch(authUrl, {
      method: "GET",
      headers: {
        apikey: publicKey,
        authorization: "Bearer " + jwt,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) return null;
    if (!response.ok) throw new Error("Auth service unavailable");
    const user: unknown = await response.json();
    if (!user || typeof user !== "object" || !("id" in user) ||
        typeof user.id !== "string" ||
        ("is_anonymous" in user && user.is_anonymous === true)) {
      return null;
    }
    // Supabase access JWTs may remain valid after signOut until exp.
    // Extract session_id ONLY AFTER Auth has verified the JWT and user ID,
    // then require the signed session to still exist in this project's Auth.
    const sessionId = sessionIdFromVerifiedUserJwt(jwt, user.id);
    if (!sessionId) return null;
    const liveSession = await fetch(rpcBase + "api_is_live_session", {
      method: "POST",
      headers: serverOnlyHeaders(),
      body: JSON.stringify({ p_user: user.id, p_session: sessionId }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!liveSession.ok) throw new Error("Auth session verifier unavailable");
    let active: unknown;
    try { active = await liveSession.json(); }
    catch { throw new Error("Auth session verifier unavailable"); }
    if (active !== true) return null;
    return user.id;
  },

  async command(name, args): Promise<CommandResult> {
    // Never trust a SQL function name from a request; handler uses a fixed allowlist.
    // Supabase secrets are only read in this Edge runtime, never in React Native.
    const response = await fetch(rpcBase + name, {
      method: "POST",
      headers: serverOnlyHeaders(),
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (response.ok) {
      const body = await response.text();
      return { ok: true, data: body ? JSON.parse(body) : null };
    }
    let code = "UPSTREAM_ERROR";
    try {
      const failure: unknown = await response.json();
      if (failure && typeof failure === "object" && "code" in failure &&
          typeof failure.code === "string") {
        code = failure.code;
      }
    } catch {
      // No SQL details or upstream payload leave this server.
    }
    return { ok: false, code };
  },
});

Deno.serve(handler);
