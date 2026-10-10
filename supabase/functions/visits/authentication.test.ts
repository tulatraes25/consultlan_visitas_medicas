import { createVisitHandler, type TrustedServices } from "./handler.ts";
import { createSessionAuthenticator } from "./authentication.ts";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SESSION = "77777777-7777-4777-8777-777777777777";
const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT = "aaaa0000-0000-4000-8000-000000000001";
const REQUEST = "12340000-0000-4000-8000-000000000002";

const base = "https://synthetic-staging.invalid";
const authUrl = base + "/auth/v1/user";
const sessionRpcUrl = base + "/rest/v1/rpc/api_is_live_session";

function encode(value: Record<string, unknown>) {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function token(overrides: Record<string, unknown> = {}) {
  return encode({ alg: "HS256", typ: "JWT" }) + "." +
    encode({ sub: ACTOR, session_id: SESSION,
      exp: Math.floor(Date.now() / 1000) + 3600, ...overrides }) +
    ".syntheticsignature";
}
function equal(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw Error(message);
}
const body = {
  action: "createHomecareEpisodeDraft",
  organizationId: ORG, patientId: PATIENT, requestKey: REQUEST,
};
type StubOptions = {
  authId?: string;
  authStatus?: number;
  sessionStatus?: number;
  sessionActive?: unknown;
  throwAuth?: boolean;
  throwSession?: boolean;
};

function system(settings: StubOptions = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const commands: { name: string; args: Record<string, unknown> }[] = [];
  const fetcher = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    if (url === authUrl) {
      if (settings.throwAuth) throw Error("synthetic Auth unavailable");
      const status = settings.authStatus ?? 200;
      return new Response(JSON.stringify(status === 200 ?
        { id: settings.authId ?? ACTOR, is_anonymous: false } :
        { error: "synthetic-denied" }), { status });
    }
    if (url === sessionRpcUrl) {
      if (settings.throwSession) throw Error("synthetic session unavailable");
      const status = settings.sessionStatus ?? 200;
      return new Response(JSON.stringify(settings.sessionActive ?? true), { status });
    }
    throw Error("unexpected synthetic endpoint");
  };
  const services: TrustedServices = {
    authenticate: createSessionAuthenticator({
      authUrl, sessionRpcUrl, publicKey: "sb_publishable_syntheticpublickey",
      privateHeaders: () => ({
        apikey: "sb_secret_synthetic_server_only",
        "content-type": "application/json", accept: "application/json",
      }),
      fetcher,
    }),
    command: async (name, args) => {
      commands.push({ name, args });
      return { ok: true, data: "synthetic-only" };
    },
  };
  return { handle: createVisitHandler(services), calls, commands };
}

function post(jwt: string, payload: unknown = body) {
  return new Request(base + "/functions/v1/visits", {
    method: "POST",
    headers: { authorization: "Bearer " + jwt, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

Deno.test("SEC-SESSION-02: complete verified Auth + active session permits exact administrative command", async () => {
  const s = system();
  const response = await s.handle(post(token()));
  equal(response.status, 200, "synthetic active session accepted");
  equal(s.calls.length, 2, "must verify Auth and live session separately");
  equal(s.commands.length, 1, "exactly one command after full verification");
  equal(s.commands[0].name, "api_hc_create_episode_draft", "fixed allowlisted RPC");
  equal(s.commands[0].args.p_actor, ACTOR, "actor must be from verified Auth");
  equal(s.calls[0].url, authUrl, "verify Auth first");
  equal(s.calls[1].url, sessionRpcUrl, "verify session second");
  equal(s.calls[0].init.method, "GET", "Auth is read-only");
  equal(s.calls[1].init.method, "POST", "session rpc is fixed");
  const sessionBody = JSON.parse(String(s.calls[1].init.body));
  equal(sessionBody.p_user, ACTOR, "session belongs to verified actor");
  equal(sessionBody.p_session, SESSION, "session from signed JWT");
  const privateHeaders = s.calls[1].init.headers as Record<string, string>;
  equal(privateHeaders.apikey, "sb_secret_synthetic_server_only", "server credential used only for fixed session RPC");
  equal(privateHeaders.authorization, undefined, "modern server key is not Bearer");
});

Deno.test("SEC-SESSION-02: missing live session denies stale JWT before any command", async () => {
  const s = system({ sessionActive: false });
  const response = await s.handle(post(token()));
  equal(response.status, 401, "stale session denied");
  equal(s.calls.length, 2, "consulted Auth and live session");
  equal(s.commands.length, 0, "no command after removed Auth session");
});

Deno.test("SEC-SESSION-02: cross-user JWT, expired token and Auth rejection deny before session RPC", async () => {
  for (const options of [
    { settings: { authId: OTHER }, jwt: token(), status: 401 },
    { settings: {}, jwt: token({ exp: 1 }), status: 401 },
    { settings: { authStatus: 401 }, jwt: token(), status: 401 },
  ]) {
    const s = system(options.settings);
    const response = await s.handle(post(options.jwt));
    equal(response.status, options.status, "invalid claim/session rejected");
    equal(s.calls.length, 1, "session RPC not called on invalid identity");
    equal(s.commands.length, 0, "no operation allowed");
  }
});

Deno.test("SEC-SESSION-02: session gateway and Auth outages are fail-closed", async () => {
  for (const settings of [
    { sessionStatus: 503 }, { throwSession: true }, { throwAuth: true },
  ]) {
    const s = system(settings);
    const response = await s.handle(post(token()));
    equal(response.status, 503, "upstream identity outage denies operations");
    equal(s.commands.length, 0, "no operation after outage");
  }
});

Deno.test("SEC-SESSION-02: session verifier must return exact boolean true", async () => {
  const s = system({ sessionActive: { ok: true } });
  const response = await s.handle(post(token()));
  equal(response.status, 401, "object truthiness must not authorize");
  equal(s.commands.length, 0, "no operation for non-boolean response");
});
