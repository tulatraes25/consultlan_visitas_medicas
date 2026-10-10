import { sessionIdFromVerifiedUserJwt } from "./session.ts";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const SESSION = "77777777-7777-4777-8777-777777777777";
const OTHER = "22222222-2222-4222-8222-222222222222";

function token(claims: Record<string, unknown>) {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return encode({ alg: "HS256", typ: "JWT" }) + "." + encode(claims) + ".fakesignature";
}

function assert(actual: unknown, expected: unknown, reason: string) {
  if (actual !== expected) throw Error(reason + " (synthetic test)");
}

Deno.test("SEC-SESSION-01: after Auth verification valid session_id and sub are accepted", () => {
  const jwt = token({
    sub: ACTOR, session_id: SESSION,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  assert(sessionIdFromVerifiedUserJwt(jwt, ACTOR), SESSION, "matching synthetic claims");
});

Deno.test("SEC-SESSION-01: rejects cross-user, revoked/missing and malformed token claims", () => {
  const valid = { sub: ACTOR, session_id: SESSION, exp: Math.floor(Date.now() / 1000) + 3600 };
  const invalid = [
    [token(valid), OTHER],
    [token({ ...valid, sub: OTHER }), ACTOR],
    [token({ ...valid, session_id: null }), ACTOR],
    [token({ ...valid, session_id: "not-a-uuid" }), ACTOR],
    [token({ ...valid, session_id: undefined }), ACTOR],
    [token({ ...valid, exp: 1 }), ACTOR],
    [token({ ...valid, exp: "2099" }), ACTOR],
    [token({ ...valid, exp: Math.floor(Date.now() / 1000) }), ACTOR],
    ["not.jwt", ACTOR],
    ["not-a-token", ACTOR],
    ["aaa.%%%25.bbb", ACTOR],
    [token(valid), "malformed-user-id"],
  ] as const;
  for (const [jwt, actor] of invalid) {
    assert(sessionIdFromVerifiedUserJwt(jwt, actor), null, "invalid claims rejected");
  }
});

Deno.test("SEC-SESSION-01: extraction is not signature verification", () => {
  // This helper intentionally accepts a synthetic token with well-shaped
  // claims. The real adapter must call Supabase Auth FIRST and then verify
  // the session row. Never call the helper alone to grant permissions.
  const jwt = token({ sub: ACTOR, session_id: SESSION,
    exp: Math.floor(Date.now() / 1000) + 3600 });
  assert(sessionIdFromVerifiedUserJwt(jwt, ACTOR), SESSION, "shape-only after Auth");
});
