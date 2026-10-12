/**
 * SUPA-03 — isolated, fail-closed request policy for the mobile Edge Function.
 * It has no Supabase dependencies and is exercised with synthetic JWT fixtures.
 * Only the runtime adapter is allowed to touch secrets or make network requests.
 */
type FieldKind = "uuid" | "name" | "specialty" | "dateTime" | "utcInstant" | "cursorInstant" | "coverageKind" | "positiveInt";
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
  // SEC-READ-02B: two-field metadata probe for a known episode UUID.
  // No client-supplied organization, actor, role or patient data.
  // The server validates Auth + live session before calling this RPC.
  inspectMyHomecareEpisodeScope: {
    rpc: "api_hc_episode_scope",
    fields: {
      episodeId: { db: "p_episode", kind: "uuid" },
    },
  },
  // HC-READ-03: RETIRED the unwindowed, earliest-100 roster action.
  // Only the bounded keyset page actions below may be dispatched by Edge.
  // The historical service-only SQL function remains for migration lineage,
  // but has no accessible Edge command and must not drive clinical agendas.
  // HC-READ-02: keyset pages never accept actor, organization, episode or
  // professional from mobile. Two action names avoid optional-parameter
  // ambiguity: first and subsequent page both use the SAME backend RPC.
  listMyHomecareCoveragesPage: {
    rpc: "api_hc_list_my_coverages_page",
    fields: {
      windowStart: {db:"p_window_start",kind:"utcInstant"},
      windowEnd: {db:"p_window_end",kind:"utcInstant"},
    },
  },
  listMyHomecareCoveragesNextPage: {
    rpc: "api_hc_list_my_coverages_page",
    fields: {
      windowStart: {db:"p_window_start",kind:"utcInstant"},
      windowEnd: {db:"p_window_end",kind:"utcInstant"},
      cursorStart: {db:"p_after_start",kind:"cursorInstant"},
      cursorId: {db:"p_after_id",kind:"uuid"},
    },
  },
  // HC-UX-04B1: Only the coverage UUID is supplied by mobile. Auth, episode,
  // professional, organization, care team, care plan and specialty are all
  // revalidated by server-only SQL. Never accept a templateId from the phone.
  resolveMyHomecareAttendanceTemplate: {
    rpc: "api_hc_resolve_my_attendance_template",
    fields: {
      coverageId: { db: "p_coverage", kind: "uuid" },
    },
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
const UTC_MICROS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;
/** Reject Date.parse normalization (e.g. 2026-02-30) and local offsets. */
function strictUtcInstant(value:string):boolean {
  if (!UTC_MICROS.test(value)) return false;
  const millis=Date.parse(value);
  return Number.isFinite(millis) &&
    new Date(millis).toISOString().slice(0,19) === value.slice(0,19);
}
const CURSOR_ISO=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/;
/** PostgreSQL jsonb timestamptz serializes with a numeric UTC offset,
 * commonly +00:00, not necessarily literal Z. Preserve six digits and
 * reject normalized calendar dates or offsets beyond ISO +14:00.
 */
function strictCursorInstant(value:string):boolean {
  const p=CURSOR_ISO.exec(value);
  if(!p)return false;
  const year=Number(p[1]),month=Number(p[2]),day=Number(p[3]);
  const hour=Number(p[4]),minute=Number(p[5]),second=Number(p[6]);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year===0||month<1||month>12||day<1||day>days[month-1]||
    hour>23||minute>59||second>59)return false;
  const tzH=p[9]?Number(p[10]):0,tzM=p[9]?Number(p[11]):0;
  if(tzH>14||tzM>59||(tzH===14&&tzM!==0))return false;
  const offset=(p[9]==="-"?-1:1)*(tzH*60+tzM)*60000;
  const instant=Date.parse(value);
  return Number.isFinite(instant)&&
    new Date(instant+offset).toISOString().slice(0,19)===value.slice(0,19);
}
const PREVIEW_ONLY_TEMPLATES = new Set([
  "MEDICAL_ATTENDANCE",
  "NURSING_CAREGIVER_ATTENDANCE",
  "PHYSIOTHERAPY_ATTENDANCE",
  "SPEECH_ATTENDANCE",
  "OCCUPATIONAL_THERAPY_ATTENDANCE",
  "NUTRITION_ATTENDANCE",
]);
// Guard the SQL result as well as the inbound request: a DB projection
// regression cannot accidentally send patient, organization, role, or clinical
// fields to the mobile device through this endpoint.
function isPreviewOnlyTemplate(value: unknown): boolean {
  if (!record(value) || Object.keys(value).length !== 2) return false;
  return value.mode === "READ_ONLY_STRUCTURE_PREVIEW" &&
    typeof value.templateId === "string" &&
    PREVIEW_ONLY_TEMPLATES.has(value.templateId);
}
// HC-READ-04: the Edge response is a separate security boundary. A
// service-only SQL projection change must never send arbitrary data to a
// phone, even if a current mobile client would eventually reject it.
const ROSTER_PAGE_FIELDS = [
  "id","episode_id","service_kind","coverage_state",
  "scheduled_start","scheduled_end",
] as const;
const ROSTER_STATES = new Set([
  "PLANNED","ASSIGNED","ACTIVE","COMPLETED","CANCELLED","NOT_PERFORMED",
]);
function exactKeys(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
  return record(value) && Object.keys(value).length===keys.length &&
    keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
}
/** UTC microsecond key is safe in the approved 2000–2100 service window. */
function rosterMicros(iso:unknown):number|null{
  if(typeof iso!=="string"||!strictCursorInstant(iso))return null;
  const parts=CURSOR_ISO.exec(iso);
  const millis=Date.parse(iso);
  if(!parts||!Number.isFinite(millis))return null;
  const micros=Math.floor(millis/1000)*1000000+
    Number((parts[7]??"").padEnd(6,"0"));
  return Number.isSafeInteger(micros)?micros:null;
}
function safeRosterPage(data:unknown,args:Record<string,unknown>):boolean{
  if(!exactKeys(data,["rows","hasMore","nextCursor"])||
     !Array.isArray(data.rows)||data.rows.length>100||
     typeof data.hasMore!=="boolean")return false;
  const wStart=rosterMicros(args.p_window_start);
  const wEnd=rosterMicros(args.p_window_end);
  if(wStart===null||wEnd===null||wEnd<=wStart)return false;
  const requestedCursor=args.p_after_start===undefined?null:
    rosterMicros(args.p_after_start);
  const requestedId=args.p_after_id;
  if(args.p_after_start!==undefined&&
    (requestedCursor===null||typeof requestedId!=="string"||
     !UUID.test(requestedId)))return false;
  const seen=new Set<string>();
  let lastStart:number|null=null,lastId:string|null=null;
  for(const row of data.rows){
    if(!exactKeys(row,ROSTER_PAGE_FIELDS)||
      typeof row.id!=="string"||!UUID.test(row.id)||
      typeof row.episode_id!=="string"||!UUID.test(row.episode_id)||
      (row.service_kind!=="VISIT"&&row.service_kind!=="SHIFT")||
      typeof row.coverage_state!=="string"||
      !ROSTER_STATES.has(row.coverage_state))return false;
    const start=rosterMicros(row.scheduled_start);
    const end=rosterMicros(row.scheduled_end);
    if(start===null||end===null||end<=start||
      end<=wStart||start>=wEnd)return false;
    const id=row.id.toLowerCase();
    if(seen.has(id))return false;
    seen.add(id);
    if(lastStart!==null&&
      (start<lastStart||(start===lastStart&&lastId!==null&&id<=lastId)))
      return false;
    if(requestedCursor!==null&&
      (start<requestedCursor||
       (start===requestedCursor&&id<=(requestedId as string).toLowerCase())))
      return false;
    lastStart=start;lastId=id;
  }
  if(data.hasMore){
    if(data.rows.length!==100||
      !exactKeys(data.nextCursor,["id","scheduled_start"])||
      typeof data.nextCursor.id!=="string"||
      typeof data.nextCursor.scheduled_start!=="string"||
      lastId!==data.nextCursor.id.toLowerCase()||
      data.nextCursor.scheduled_start!==
        (data.rows[data.rows.length-1] as Record<string,unknown>).scheduled_start)
      return false;
  }else if(data.nextCursor!==null)return false;
  return true;
}
// SEC-READ-03: a service_role SQL regression must not project patient
// identifiers or clinical fields to the device via the episode scope probe.
// The only admissible response is [] or [{id,organization_id}], and its
// episode ID must be the exact UUID the authenticated caller requested.
function safeEpisodeScope(data:unknown,requestedEpisode:unknown):boolean{
  if(typeof requestedEpisode!=="string"||!UUID.test(requestedEpisode)||
     !Array.isArray(data)||data.length>1)return false;
  if(data.length===0)return true;
  const row:unknown=data[0];
  return exactKeys(row,["id","organization_id"])&&
    typeof row.id==="string"&&UUID.test(row.id)&&
    row.id.toLowerCase()===requestedEpisode.toLowerCase()&&
    typeof row.organization_id==="string"&&UUID.test(row.organization_id);
}
// SEC-EGRESS-01: service_role can return arbitrary JSON from every RPC.
// Prevent accidental egress of patient/clinical fields on administrative
// operations too. Contract comes from the SQL RETURNS type, never mobile input.
// Unrecognized future RPCs fail closed until their output is explicitly reviewed.
const RESULT_KINDS:Readonly<Record<string,"uuid"|"version"|"void">>=Object.freeze({
  api_create_patient:"uuid",
  api_register_professional:"uuid",
  api_hc_create_episode_draft:"uuid",
  api_hc_assign_team_member:"void",
  api_hc_create_plan_draft:"version",
  api_hc_request_plan_review:"uuid",
  api_hc_schedule_coverage:"uuid",
  api_hc_request_handover:"uuid",
  api_hc_ack_handover:"void",
});
function safeRpcOutput(rpc:string,data:unknown,args:Record<string,unknown>):boolean{
  if(rpc==="api_hc_episode_scope")
    return safeEpisodeScope(data,args.p_episode);
  if(rpc==="api_hc_resolve_my_attendance_template")
    return isPreviewOnlyTemplate(data);
  if(rpc==="api_hc_list_my_coverages_page")
    return safeRosterPage(data,args);
  if(!Object.prototype.hasOwnProperty.call(RESULT_KINDS,rpc))return false;
  switch(RESULT_KINDS[rpc]){
    case "uuid":return typeof data==="string"&&UUID.test(data);
    case "version":return typeof data==="number"&&
      Number.isSafeInteger(data)&&data>=1&&data<=1000000;
    case "void":return data===null;
  }
  return false;
}
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
    case "utcInstant": return strictUtcInstant(value);
    case "cursorInstant": return strictCursorInstant(value);
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
    if (!safeRpcOutput(sanitized.rpc,result.data,sanitized.args)) {
      // No successful service-role projection crosses Edge until its exact
      // output contract is accepted, including all administrative RPCs.
      return json(502, { error: "DATA_OPERATION_FAILED" });
    }
    return json(200, { ok: true, result: result.data });
  };
}
