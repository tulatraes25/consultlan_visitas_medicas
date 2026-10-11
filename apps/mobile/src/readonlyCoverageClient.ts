/**
 * MOB-DATA-01 — staging-only, read-only Supabase coverage metadata adapter.
 *
 * Not wired to the app. No patient, clinical notes, medical orders, signatures,
 * caregiver identity or service-role secrets. Any eventual read MUST travel
 * through the Edge Auth + LIVE SESSION gate before its future scoped RPC.
 * The backend HC-READ-01 route is authored but not deployed to any Supabase;
 * the adapter remains dormant until staging + institutional approval.
 */

export type PublicCoverage = Readonly<{
  id: string;
  episodeId: string;
  serviceKind: "VISIT" | "SHIFT";
  coverageState: "PLANNED" | "ASSIGNED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "NOT_PERFORMED";
  scheduledStart: string;
  scheduledEnd: string;
}>;

type Transport = (url: string, options: RequestInit) => Promise<Pick<Response, "status" | "json">>;

export type ReadOnlyCoverageConfig = Readonly<{
  projectRef: string;
  forbiddenProjectRefs: readonly string[];
  publishableKey: string;
  // Source is the connected Supabase Auth provider; never a client-provided actor UUID.
  getAccessToken: () => Promise<string | null>;
  fetcher: Transport;
  stagingReadAuthorized: true;
}>;

export class CoverageReadError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "CoverageReadError";
  }
}

const PROJECT_REF = /^[a-z0-9]{20}$/;
const PUBLISHABLE = /^sb_publishable_[A-Za-z0-9_-]{16,}$/;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DATE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/;

/**
 * Reject impossible calendar dates BEFORE Date.parse. Some JS engines
 * normalize February 30 to March 2 rather than rejecting it. Also reject
 * 24:00, invalid seconds and timezone offsets outside ISO's +/-14 hours.
 */
function strictInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parts = DATE.exec(value);
  if (!parts) return null;
  const [year, month, day, hour, minute, second] =
    [parts[1],parts[2],parts[3],parts[4],parts[5],parts[6]].map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  if (year === 0 || month < 1 || month > 12 ||
    day < 1 || day > days[month - 1] ||
    hour > 23 || minute > 59 || second > 59) return null;
  if (parts[8] !== "Z") {
    const tzHour = Number(parts[10]);
    const tzMinute = Number(parts[11]);
    if (tzHour > 14 || tzMinute > 59 ||
      (tzHour === 14 && tzMinute !== 0)) return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
const STATES = new Set(["PLANNED", "ASSIGNED", "ACTIVE", "COMPLETED", "CANCELLED", "NOT_PERFORMED"]);
const FIELDS = ["id", "episode_id", "service_kind", "coverage_state", "scheduled_start", "scheduled_end"];
const FIXED_ACTION = '{"action":"listMyHomecareCoverages"}';

function fail(code: string): never { throw new CoverageReadError(code); }

function parseCoverage(row: unknown): PublicCoverage {
  if (!row || typeof row !== "object" || Array.isArray(row)) fail("ROSTER_UNEXPECTED_SHAPE");
  const fields = Object.keys(row as object).sort().join(",");
  if (fields !== [...FIELDS].sort().join(",")) fail("ROSTER_UNEXPECTED_SHAPE");
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || !UUID.test(r.id) ||
      typeof r.episode_id !== "string" || !UUID.test(r.episode_id) ||
      (r.service_kind !== "VISIT" && r.service_kind !== "SHIFT") ||
      typeof r.coverage_state !== "string" || !STATES.has(r.coverage_state) ||
      typeof r.scheduled_start !== "string" ||
      typeof r.scheduled_end !== "string") {
    fail("ROSTER_UNEXPECTED_SHAPE");
  }
  const start = strictInstant(r.scheduled_start);
  const end = strictInstant(r.scheduled_end);
  if (start === null || end === null || end <= start) {
    fail("ROSTER_INVALID_WINDOW");
  }
  return {
    id: r.id,
    episodeId: r.episode_id,
    serviceKind: r.service_kind as PublicCoverage["serviceKind"],
    coverageState: r.coverage_state as PublicCoverage["coverageState"],
    scheduledStart: r.scheduled_start,
    scheduledEnd: r.scheduled_end,
  };
}

/**
 * The service RPC orders by PostgreSQL timestamptz then UUID. Validate that
 * contract instead of silently sorting server data in the client.
 * JavaScript Date drops microseconds, so compare the whole 6-digit fraction
 * separately to avoid rejecting correctly ordered PostgreSQL timestamps.
 */
function compareChronology(a: PublicCoverage, b: PublicCoverage): number {
  const key = (iso: string): readonly [number, number] => {
    const p = DATE.exec(iso);
    if (!p) return fail("ROSTER_INVALID_WINDOW"); // already validated above
    const seconds = `${p[1]}-${p[2]}-${p[3]}T${p[4]}:${p[5]}:${p[6]}${p[8]}`;
    const epochMillis = Date.parse(seconds);
    if (!Number.isFinite(epochMillis)) return fail("ROSTER_INVALID_WINDOW");
    return [epochMillis, Number((p[7] ?? "").padEnd(6, "0"))];
  };
  const l = key(a.scheduledStart), r = key(b.scheduledStart);
  if (l[0] !== r[0]) return l[0] < r[0] ? -1 : 1;
  if (l[1] !== r[1]) return l[1] < r[1] ? -1 : 1;
  const leftId = a.id.toLowerCase(), rightId = b.id.toLowerCase();
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

export function createReadOnlyCoverageClient(config: ReadOnlyCoverageConfig) {
  // No network is possible until the caller supplies an explicit staging gate,
  // a project NOT in the real-project exclusion list and an Auth token source.
  if (!config || config.stagingReadAuthorized !== true ||
      !PROJECT_REF.test(config.projectRef) ||
      !Array.isArray(config.forbiddenProjectRefs) ||
      config.forbiddenProjectRefs.length < 1 ||
      config.forbiddenProjectRefs.some(ref => !PROJECT_REF.test(ref)) ||
      config.forbiddenProjectRefs.includes(config.projectRef) ||
      !PUBLISHABLE.test(config.publishableKey) ||
      typeof config.getAccessToken !== "function" ||
      typeof config.fetcher !== "function") fail("ROSTER_STAGING_CONFIG_REJECTED");

  // Never GET the table directly through PostgREST: its RLS does not yet
  // enforce the additional auth.sessions check performed by this Edge handler.
  const endpoint = "https://" + config.projectRef + ".supabase.co/functions/v1/visits";

  return {
    async list(signal?: AbortSignal): Promise<{
      rows: readonly PublicCoverage[];
      possiblyTruncated: boolean;
    }> {
      let token: string | null;
      try { token = await config.getAccessToken(); }
      catch { return fail("ROSTER_AUTH_UNAVAILABLE"); }
      if (!token || token.length > 8192 || !JWT.test(token)) {
        return fail("ROSTER_USER_SESSION_REQUIRED");
      }

      let response: Pick<Response, "status" | "json">;
      try {
        response = await config.fetcher(endpoint, {
          method: "POST",
          headers: {
            apikey: config.publishableKey,
            authorization: "Bearer " + token,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: FIXED_ACTION,
          redirect: "error",
          cache: "no-store",
          signal,
        });
      } catch { return fail("ROSTER_TRANSPORT_FAILED"); }

      if (response.status === 401 || response.status === 403) {
        return fail("ROSTER_ACCESS_DENIED");
      }
      // A malformed/unacceptable request must never be disguised as an
      // empty roster; staging alone is not clinical authorization.
      if (response.status === 422) return fail("ROSTER_OPERATION_REJECTED");
      if (response.status !== 200) return fail("ROSTER_SERVICE_UNAVAILABLE");
      let envelope: unknown;
      try { envelope = await response.json(); }
      catch { return fail("ROSTER_UNEXPECTED_SHAPE"); }
      if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) ||
          Object.keys(envelope).sort().join(",") !== "ok,result") {
        return fail("ROSTER_UNEXPECTED_SHAPE");
      }
      const body = envelope as Record<string, unknown>;
      if (body.ok !== true || !Array.isArray(body.result) || body.result.length > 100) {
        return fail("ROSTER_UNEXPECTED_SHAPE");
      }
      const rows = body.result.map(parseCoverage);
      // Duplicate IDs must not masquerade as multiple visits or UI cards.
      if (new Set(rows.map(row => row.id.toLowerCase())).size !== rows.length) {
        return fail("ROSTER_DUPLICATE_COVERAGE_ID");
      }
      // Never claim the cards follow the service timeline when the Edge
      // response violates SQL's (scheduled_start, id) ascending contract.
      for (let i = 1; i < rows.length; i++) {
        if (compareChronology(rows[i - 1], rows[i]) >= 0) {
          return fail("ROSTER_NOT_CHRONOLOGICAL");
        }
      }
      return { rows, possiblyTruncated: rows.length === 100 };
    },
  };
}
