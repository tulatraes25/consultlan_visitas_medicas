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
  commandData?: unknown;
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
      return { ok: true, data: settings.commandData ?? "synthetic-only" };
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

Deno.test("HC-READ-01: real Edge orchestration dispatches the fixed scoped roster RPC only after Auth and live session", async () => {
  const onlyMetadata = [{
    id: "d1000000-0000-4000-8000-000000000001",
    episode_id: "e1000000-0000-4000-8000-000000000001",
    service_kind: "VISIT", coverage_state: "ASSIGNED",
    scheduled_start: "2026-10-19T11:00:00Z",
    scheduled_end: "2026-10-19T12:00:00Z",
  }];
  const s = system({ commandData: onlyMetadata });
  const response = await s.handle(post(token(), { action: "listMyHomecareCoverages" }));
  equal(response.status, 200, "authenticated active user can request own roster");
  equal(s.calls.length, 2, "Auth and live-session checks precede roster");
  equal(s.calls[0].url, authUrl, "Auth verified first");
  equal(s.calls[1].url, sessionRpcUrl, "live session verified second");
  equal(s.commands.length, 1, "exactly one server-only read dispatched");
  equal(s.commands[0].name, "api_hc_list_my_coverages", "SQL function is fixed");
  equal(JSON.stringify(s.commands[0].args), JSON.stringify({ p_actor: ACTOR }),
    "only actor from Auth is forwarded, never a mobile scope");
  const body = await response.json();
  equal(body.ok, true, "Edge success envelope");
  equal(JSON.stringify(body.result), JSON.stringify(onlyMetadata),
    "payload is returned only after SQL's own authorization checks");
  equal(response.headers.get("cache-control"), "no-store",
    "roster responses must not be cached");
});

Deno.test("HC-READ-01: mobile cannot choose another tenant, patient, scope or acting user", async () => {
  const s = system();
  for (const added of [
    { p_actor: OTHER },
    { actorId: OTHER },
    { organizationId: ORG },
    { patientId: PATIENT },
    { episodeId: "e1000000-0000-4000-8000-000000000001" },
    { includeClinical: true },
    { appRole: "ADMIN" },
    { service_role: "fake" },
    { limit: 10000 },
  ]) {
    const result = await s.handle(post(token(), {
      action: "listMyHomecareCoverages", ...added,
    }));
    equal(result.status, 422, "unexpected client scope must be rejected");
  }
  equal(s.commands.length, 0, "none of the forged scope requests reaches SQL");
});

Deno.test("HC-READ-01: revoked, stale and unavailable session cannot execute roster reads", async () => {
  for (const [settings, jwt, expected] of [
    [{ sessionActive: false }, token(), 401],
    [{ sessionActive: { active: true } }, token(), 401],
    [{ sessionStatus: 503 }, token(), 503],
    [{ authStatus: 403 }, token(), 401],
    [{}, token({ exp: 1 }), 401],
  ] as const) {
    const s = system(settings);
    const result = await s.handle(post(jwt, { action: "listMyHomecareCoverages" }));
    equal(result.status, expected, "reject unavailable or stale user session");
    equal(s.commands.length, 0, "no roster RPC on failed authentication");
  }
});

const EPISODE_SCOPE_FIXTURE = "e1000000-0000-4000-8000-000000000001";

Deno.test("SEC-READ-02B: verified live session can inspect a known episode via exact service-only RPC", async () => {
  const data = [{ id: EPISODE_SCOPE_FIXTURE, organization_id: ORG }];
  const s = system({ commandData: data });
  const response = await s.handle(post(token(), {
    action: "inspectMyHomecareEpisodeScope", episodeId: EPISODE_SCOPE_FIXTURE,
  }));
  equal(response.status, 200, "a valid synthetic user can reach the scope RPC");
  equal(s.calls.length, 2, "Auth and active-session verification both executed");
  equal(s.calls[0].url, authUrl, "JWT identity verified first");
  equal(s.calls[1].url, sessionRpcUrl, "JWT session checked second");
  equal(s.commands.length, 1, "one fixed, read-only RPC");
  equal(s.commands[0].name, "api_hc_episode_scope", "fixed SQL RPC name");
  equal(JSON.stringify(s.commands[0].args),
    JSON.stringify({ p_episode: EPISODE_SCOPE_FIXTURE, p_actor: ACTOR }),
    "mobile controls episode UUID only, actor always supplied by Auth");
  const payload = await response.json();
  equal(JSON.stringify(payload),JSON.stringify({ok:true,result:data}),
    "response contains exactly the synthetic two-field array");
  equal(response.headers.get("cache-control"),"no-store","never cache access result");
});

Deno.test("SEC-READ-02B: forged organization, role, actor and patient cannot reach episode scope SQL", async () => {
  const s=system();
  for (const malicious of [
    { actorId: OTHER }, { p_actor: OTHER }, { organizationId: ORG },
    { patientId: PATIENT }, { role: "ADMIN" }, { service_role: "secret" },
    { includePatient: true }, { episodeId: "not-a-uuid" },
    { episodeId: null },
  ]) {
    const response = await s.handle(post(token(),{
      action:"inspectMyHomecareEpisodeScope",
      episodeId:EPISODE_SCOPE_FIXTURE,
      ...malicious,
    }));
    equal(response.status,422,"scope spoofing and malformed UUID must be rejected");
  }
  const withoutId = await s.handle(post(token(),{action:"inspectMyHomecareEpisodeScope"}));
  equal(withoutId.status,422,"episode ID is required");
  equal(s.commands.length,0,"invalid requests never dispatch SQL");
});

Deno.test("SEC-READ-02B: invalid or revoked session cannot inspect any episode", async () => {
  for (const [settings, jwt, expected] of [
    [{sessionActive:false},token(),401],
    [{sessionStatus:503},token(),503],
    [{authId:OTHER},token(),401],
    [{authStatus:401},token(),401],
    [{},token({exp:1}),401],
  ] as const) {
    const s=system(settings);
    const response=await s.handle(post(jwt,{
      action:"inspectMyHomecareEpisodeScope",episodeId:EPISODE_SCOPE_FIXTURE,
    }));
    equal(response.status,expected,"closed or wrong-actor JWT cannot inspect");
    equal(s.commands.length,0,"must not touch scoped RPC after auth denial");
  }
});
