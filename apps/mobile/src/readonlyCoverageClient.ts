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
const DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
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
      typeof r.scheduled_start !== "string" || !DATE.test(r.scheduled_start) ||
      typeof r.scheduled_end !== "string" || !DATE.test(r.scheduled_end)) {
    fail("ROSTER_UNEXPECTED_SHAPE");
  }
  const start = Date.parse(r.scheduled_start);
  const end = Date.parse(r.scheduled_end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
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
      return { rows, possiblyTruncated: rows.length === 100 };
    },
  };
}
