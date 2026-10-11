/**
 * SUPA-03 — isolated, fail-closed request policy for the mobile Edge Function.
 * It has no Supabase dependencies and is exercised with synthetic JWT fixtures.
 * Only the runtime adapter is allowed to touch secrets or make network requests.
 */
type FieldKind = "uuid" | "name" | "specialty" | "dateTime" | "coverageKind" | "positiveInt";
type CommandSpec = {
  rpc: string;
  fields: Record<string, { db: string; kind: FieldKind }>;
};
export type CommandResult =
  | { ok: true; data: unknown }
  | { ok: false; code: string };

export type TrustedServices = {
  // MUST be verified against this Supabase project's Auth API, not decoded only.
  authenticate: (jwt: string) => Promise<string | null>;
  // MUST use service_role on the server, never a key supplied in the request.
  command: (rpc: string, args: Record<string, unknown>) => Promise<CommandResult>;
};
const COMMANDS: Record<string, CommandSpec> = {
  // HC-READ-01: metadata-only professional roster. No caller-supplied
  // organization, episode, actor or patient identifiers: SQL derives scope.
  // Access requires the existing Auth + live session gate first.
  listMyHomecareCoverages: {
    rpc: "api_hc_list_my_coverages",
    fields: {},
  },
  createHomecareEpisodeDraft: {
    rpc: "api_hc_create_episode_draft",
    fields: {
      organizationId: { db: "p_org", kind: "uuid" },
      patientId: { db: "p_patient", kind: "uuid" },
      requestKey: { db: "p_request_key", kind: "uuid" },
    },
  },
  assignHomecareCareTeamMember: {
    rpc: "api_hc_assign_team_member",
    fields: {
      organizationId: { db: "p_org", kind: "uuid" },
      episodeId: { db: "p_episode", kind: "uuid" },
      professionalId: { db: "p_professional", kind: "uuid" },
    },
  },
  createHomecarePlanDraft: {
    rpc: "api_hc_create_plan_draft",
    fields: {
      organizationId: { db: "p_org", kind: "uuid" },
      episodeId: { db: "p_episode", kind: "uuid" },
      requestKey: { db: "p_request_key", kind: "uuid" },
    },
  },
  // Administrative review request only: never clinical approval or activation.
  requestHomecarePlanReview: {
    rpc: "api_hc_request_plan_review",
    fields: {
      organizationId: { db: "p_org", kind: "uuid" },
      episodeId: { db: "p_episode", kind: "uuid" },
      carePlanVersion: { db: "p_version", kind: "positiveInt" },
      requestKey: { db: "p_request_key", kind: "uuid" },
    },
  },
  scheduleHomecareCoverage: {
    rpc: "api_hc_schedule_coverage",
    fields: {
      organizationId: { db: "p_org", kind: "uuid" },
      episodeId: { db: "p_episode", kind: "uuid" },
      professionalId: { db: "p_professional", kind: "uuid" },
      carePlanVersion: { db: "p_plan_version", kind: "positiveInt" },
      serviceKind: { db: "p_kind", kind: "coverageKind" },
      scheduledStart: { db: "p_start", kind: "dateTime" },
      scheduledEnd: { db: "p_end", kind: "dateTime" },
      requestKey: { db: "p_request_key", kind: "uuid" },
    },
  },
  requestHomecareHandover: {
    rpc: "api_hc_request_handover",
    fields: {
      organizationId: { db: "p_org", kind: "uuid" },
      outgoingCoverageId: { db: "p_outgoing", kind: "uuid" },
      incomingCoverageId: { db: "p_incoming", kind: "uuid" },
    },
  },
  acknowledgeHomecareHandover: {
    rpc: "api_hc_ack_handover",
    fields: {
      organizationId: { db: "p_org", kind: "uuid" },
      handoverId: { db: "p_handover", kind: "uuid" },
    },
  },
  createPatient: {
    rpc: "api_create_patient",
    fields: {
      organizationId: { db: "p_org", kind: "uuid" },
      displayName: { db: "p_display_name", kind: "name" },
      requestKey: { db: "p_request_key", kind: "uuid" },
    },
  },
  registerProfessional: {
    rpc: "api_register_professional",
    fields: {
      organizationId: { db: "p_org", kind: "uuid" },
      authUserId: { db: "p_auth_user", kind: "uuid" },
      specialty: { db: "p_specialty", kind: "specialty" },
    },
  },
};

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const JWT = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_BODY_BYTES = 32768;
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

function json(status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function checkField(value: unknown, kind: FieldKind): boolean {
  if (kind === "positiveInt") return typeof value === "number" &&
    Number.isSafeInteger(value) && value >= 1 && value <= 1000000;
  if (typeof value !== "string") return false;
  switch (kind) {
    case "uuid": return UUID.test(value);
    case "name": return value === value.trim() && value.length >= 2 && value.length <= 160;
    case "specialty": return value === value.trim() && value.length >= 2 && value.length <= 100;
    case "dateTime": return DATE_TIME.test(value) && Number.isFinite(Date.parse(value));
    case "coverageKind": return value === "VISIT" || value === "SHIFT";
  }
}
function sanitize(
  body: unknown,
): { rpc: string; args: Record<string, unknown> } | null {
  if (!record(body) || typeof body.action !== "string") return null;
  const spec = Object.prototype.hasOwnProperty.call(COMMANDS, body.action)
    ? COMMANDS[body.action]
    : undefined;
  if (!spec) return null;
  const allowed = Object.keys(spec.fields);
  if (Object.keys(body).length !== allowed.length + 1) return null;
  for (const key of Object.keys(body)) {
    if (key !== "action" && !allowed.includes(key)) return null;
  }
  const args: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(spec.fields)) {
    if (!checkField(body[name], field.kind)) return null;
    args[field.db] = body[name];
  }
  return { rpc: spec.rpc, args };
}
function errorStatus(code: string): number {
  switch (code) {
    case "42501": return 403;
    case "22023": return 422;
    case "23505":
    case "23P01": return 409;
    default: return 502;
  }
}

export function createVisitHandler(services: TrustedServices) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return json(405, { error: "METHOD_NOT_ALLOWED" });
    }
    // Supabase client calls a user JWT; an apikey alone is never proof of identity.
    const bearer = request.headers.get("authorization") ?? "";
    if (bearer.length > 8192 || !JWT.test(bearer)) {
      return json(401, { error: "AUTHENTICATION_REQUIRED" });
    }
    const token = JWT.exec(bearer)?.[1];
    if (!token || token.startsWith("sb_")) {
      return json(401, { error: "AUTHENTICATION_REQUIRED" });
    }
    let actor: string | null;
    try {
      actor = await services.authenticate(token);
    } catch {
      return json(503, { error: "AUTH_SERVICE_UNAVAILABLE" });
    }
    if (!actor || !UUID.test(actor)) {
      return json(401, { error: "AUTHENTICATION_FAILED" });
    }
    if (!/^\s*application\/json\b/i.test(request.headers.get("content-type") ?? "")) {
      return json(415, { error: "JSON_REQUIRED" });
    }
    const headerLength = Number(request.headers.get("content-length") || "0");
    if (headerLength > MAX_BODY_BYTES) return json(413, { error: "BODY_TOO_LARGE" });
    let body: unknown;
    try {
      // Limit streaming uploads BEFORE allocating large buffers.
      const reader = request.body?.getReader();
      if (!reader) return json(400, { error: "INVALID_JSON" });
      const buffer = new Uint8Array(MAX_BODY_BYTES);
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (size + value.byteLength > MAX_BODY_BYTES) {
          await reader.cancel();
          return json(413, { error: "BODY_TOO_LARGE" });
        }
        buffer.set(value, size);
        size += value.byteLength;
      }
      body = JSON.parse(new TextDecoder().decode(buffer.subarray(0, size)));
    } catch {
      return json(400, { error: "INVALID_JSON" });
    }
    const sanitized = sanitize(body);
    if (!sanitized) return json(422, { error: "INVALID_OPERATION_OR_FIELDS" });

    // Overwrite identity: NEVER accept actor ID, role or privileged key from JSON.
    const args = { ...sanitized.args, p_actor: actor };
    let result: CommandResult;
    try {
      result = await services.command(sanitized.rpc, args);
    } catch {
      return json(502, { error: "DATA_SERVICE_UNAVAILABLE" });
    }
    if (!result.ok) {
      const status = errorStatus(result.code);
      // Do not leak SQL messages, patient names, provider URLs, JWTs or signing secrets.
      return json(status, { error: status === 502 ? "DATA_OPERATION_FAILED" : "OPERATION_DENIED_OR_CONFLICT" });
    }
    return json(200, { ok: true, result: result.data });
  };
}
