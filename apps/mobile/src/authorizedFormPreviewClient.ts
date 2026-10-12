/**
 * HC-UX-04B2: STAGING-ONLY, read-only attendance source selector.
 * The standalone Supabase Edge endpoint derives the form from an authorized
 * coverage; the mobile app supplies ONLY a coverage UUID. This client cannot
 * issue a clinical document, fetch a patient or choose the specialty.
 *
 * Dormant: App.tsx does not import this module, no real Supabase connected.
 */
import previewCatalog from "./formPreviewCatalog.json";
import {
  createReadOnlyCoverageClient,
  type ReadOnlyCoverageConfig,
} from "./readonlyCoverageClient";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const FORM_IDS = Object.freeze([
  "MEDICAL_ATTENDANCE",
  "NURSING_CAREGIVER_ATTENDANCE",
  "PHYSIOTHERAPY_ATTENDANCE",
  "SPEECH_ATTENDANCE",
  "OCCUPATIONAL_THERAPY_ATTENDANCE",
  "NUTRITION_ATTENDANCE",
] as const);
export type AttendanceTemplateId = (typeof FORM_IDS)[number];
export type AuthorizedFormPreview = Readonly<{
  templateId: AttendanceTemplateId;
  mode: "READ_ONLY_STRUCTURE_PREVIEW";
}>;

export class AssignedFormReadError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "AssignedFormReadError";
  }
}
const fail = (code: string): never => { throw new AssignedFormReadError(code); };
const ownObject = (input: unknown): input is Record<string, unknown> =>
  input !== null && typeof input === "object" && !Array.isArray(input);
const keysAre = (input: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(input).sort().join(",") === [...expected].sort().join(",");

export function isAuthorizedCoverageId(input: unknown): input is string {
  return typeof input === "string" && UUID.test(input);
}

/**
 * Strict, double-checked source contract. The local JSON was derived from the
 * private original-form inventory but has NOT been compared visually with the
 * original DOCX/PDF. Never display a fallback to MEDICAL_ATTENDANCE.
 */
function sourceId(input: unknown): input is AttendanceTemplateId {
  return typeof input === "string" &&
    FORM_IDS.some(id => id === input) &&
    previewCatalog.templates.some(t => t.id === input && t.kind === "ATTENDANCE");
}
export function parseAuthorizedFormPreview(response: unknown): AuthorizedFormPreview {
  if (!ownObject(response) || !keysAre(response, ["ok", "result"]) ||
      response.ok !== true || !ownObject(response.result) ||
      !keysAre(response.result, ["templateId", "mode"]) ||
      response.result.mode !== "READ_ONLY_STRUCTURE_PREVIEW" ||
      !sourceId(response.result.templateId)) {
    return fail("FORM_PREVIEW_UNEXPECTED_SHAPE");
  }
  return Object.freeze({
    templateId: response.result.templateId,
    mode: "READ_ONLY_STRUCTURE_PREVIEW",
  });
}

/** Reuse existing strict independent-staging origin/key gate; no network. */
export function createAuthorizedFormPreviewClient(config: ReadOnlyCoverageConfig) {
  let locked: ReadOnlyCoverageConfig;
  try {
    locked = Object.freeze({
      ...config,
      forbiddenProjectRefs: Object.freeze([...(config?.forbiddenProjectRefs ?? [])]),
    });
    createReadOnlyCoverageClient(locked);
  } catch {
    return fail("FORM_PREVIEW_STAGING_CONFIG_REJECTED");
  }
  const endpoint = "https://" + locked.projectRef + ".supabase.co/functions/v1/visits";

  return Object.freeze({
    async read(coverageId: string, signal?: AbortSignal): Promise<AuthorizedFormPreview> {
      if (!isAuthorizedCoverageId(coverageId)) {
        return fail("FORM_PREVIEW_COVERAGE_INVALID");
      }
      if (signal?.aborted) return fail("FORM_PREVIEW_CANCELLED");

      let token: string | null;
      try { token = await locked.getAccessToken(); }
      catch { return fail("FORM_PREVIEW_AUTH_UNAVAILABLE"); }
      if (signal?.aborted) return fail("FORM_PREVIEW_CANCELLED");
      if (!token || token.length > 8192 || !JWT.test(token)) {
        return fail("FORM_PREVIEW_USER_SESSION_REQUIRED");
      }

      let result: Awaited<ReturnType<ReadOnlyCoverageConfig["fetcher"]>>;
      try {
        result = await locked.fetcher(endpoint, {
          method: "POST",
          headers: {
            apikey: locked.publishableKey,
            authorization: "Bearer " + token,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "resolveMyHomecareAttendanceTemplate",
            coverageId,
          }),
          redirect: "error",
          cache: "no-store",
          signal,
        });
      } catch { return fail(signal?.aborted ? "FORM_PREVIEW_CANCELLED" : "FORM_PREVIEW_TRANSPORT_FAILED"); }
      finally { token = null; }

      if (signal?.aborted) return fail("FORM_PREVIEW_CANCELLED");
      if (result.status === 401 || result.status === 403) {
        return fail("FORM_PREVIEW_ACCESS_DENIED");
      }
      if (result.status === 422) return fail("FORM_PREVIEW_OPERATION_REJECTED");
      if (result.status !== 200) return fail("FORM_PREVIEW_SERVICE_UNAVAILABLE");

      let envelope: unknown;
      try { envelope = await result.json(); }
      catch { return fail("FORM_PREVIEW_UNEXPECTED_SHAPE"); }
      if (signal?.aborted) return fail("FORM_PREVIEW_CANCELLED");
      // Never trust a 200 response from a misconfigured Edge/SQL endpoint.
      return parseAuthorizedFormPreview(envelope);
    },
  });
}
