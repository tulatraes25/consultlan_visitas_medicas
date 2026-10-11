// SUPA-03. Supabase Edge entrypoint. No clinical data is logged or cached.
// Deploy only to the new, standalone visits project after staging security review.
import { createVisitHandler, type CommandResult } from "./handler.ts";
import { createSessionAuthenticator } from "./authentication.ts";

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
  authenticate: createSessionAuthenticator({
    authUrl,
    sessionRpcUrl: rpcBase + "api_is_live_session",
    publicKey,
    privateHeaders: serverOnlyHeaders,
    fetcher: fetch,
  }),

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
