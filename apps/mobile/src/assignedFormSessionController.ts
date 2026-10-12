/**
 * HC-UX-04B2: ephemeral session-scoped, single-coverage form preview.
 *
 * No React, no storage, no session claims decoded in the phone, no PHI.
 * Attach bindCoverageAuthEvents(controller, provider) and a foreground listener
 * in the staging preview. Every Auth event, selection change and unmount must
 * clear this controller; the server ALWAYS rechecks the live session.
 */
import {
  AssignedFormReadError,
  createAuthorizedFormPreviewClient,
  type AttendanceTemplateId,
} from "./authorizedFormPreviewClient";
import type { ReadOnlyCoverageConfig } from "./readonlyCoverageClient";

type Snapshot = Readonly<{
  state: "idle" | "loading" | "ready" | "error";
  templateId: AttendanceTemplateId | null;
  errorCode: string | null;
}>;
const IDLE: Snapshot = Object.freeze({state:"idle",templateId:null,errorCode:null});
const ERRORS = new Set([
  "FORM_PREVIEW_STAGING_CONFIG_REJECTED",
  "FORM_PREVIEW_COVERAGE_INVALID",
  "FORM_PREVIEW_CANCELLED",
  "FORM_PREVIEW_AUTH_UNAVAILABLE",
  "FORM_PREVIEW_USER_SESSION_REQUIRED",
  "FORM_PREVIEW_TRANSPORT_FAILED",
  "FORM_PREVIEW_ACCESS_DENIED",
  "FORM_PREVIEW_OPERATION_REJECTED",
  "FORM_PREVIEW_SERVICE_UNAVAILABLE",
  "FORM_PREVIEW_UNEXPECTED_SHAPE",
]);
type Listener = (snapshot: Snapshot) => void;

export function createAssignedFormSessionController(config: ReadOnlyCoverageConfig) {
  // Lock staging ref, publishable key, token source and transport at creation.
  // Constructor must not fetch a token, use the network or read any patient.
  const locked: ReadOnlyCoverageConfig = Object.freeze({
    ...config,
    forbiddenProjectRefs: Object.freeze([...(config?.forbiddenProjectRefs ?? [])]),
  });
  createAuthorizedFormPreviewClient(locked);
  let epoch = 0;
  let pending: AbortController | null = null;
  let disposed = false;
  let snapshot: Snapshot = IDLE;
  const subscribers = new Set<Listener>();

  const publish = (next: Snapshot) => {
    snapshot = next;
    for(const subscriber of [...subscribers]) {
      try { subscriber(next); } catch { /* isolate UI errors from cleanup */ }
    }
  };
  const reset = () => {
    ++epoch;
    pending?.abort();
    pending = null;
    publish(IDLE);
  };

  return Object.freeze({
    getSnapshot: (): Snapshot => snapshot,
    subscribe(listener: Listener): () => void {
      if (disposed) return () => {};
      subscribers.add(listener);
      listener(snapshot);
      return () => { subscribers.delete(listener); };
    },
    clear(): void { if (!disposed) reset(); },
    dispose(): void {
      if (disposed) return;
      reset();
      disposed = true;
      subscribers.clear();
    },
    async resolve(coverageId: string): Promise<boolean> {
      if (disposed) return false;
      // Drop the old form synchronously BEFORE awaiting Auth or Edge.
      const requestId = ++epoch;
      pending?.abort();
      const active = new AbortController();
      pending = active;
      publish(Object.freeze({state:"loading",templateId:null,errorCode:null}));
      const current = () => !disposed && requestId === epoch &&
        !active.signal.aborted;
      let token: string | null = null;
      try {
        token = await locked.getAccessToken();
        if (!current()) return false;
        const client = createAuthorizedFormPreviewClient({
          ...locked,
          getAccessToken: async () => token,
        });
        const result = await client.read(coverageId,active.signal);
        if (!current()) return false;
        // Auth providers can rotate or switch users while a request is active.
        const latest = await locked.getAccessToken();
        if (!current()) return false;
        if (!token || latest !== token) {
          publish(Object.freeze({
            state:"error",templateId:null,errorCode:"FORM_PREVIEW_SESSION_CHANGED",
          }));
          return false;
        }
        publish(Object.freeze({
          state:"ready",templateId:result.templateId,errorCode:null,
        }));
        return true;
      } catch (error) {
        if (!current()) return false;
        const code = error instanceof AssignedFormReadError && ERRORS.has(error.code)
          ? error.code : "FORM_PREVIEW_AUTH_UNAVAILABLE";
        publish(Object.freeze({state:"error",templateId:null,errorCode:code}));
        return false;
      } finally {
        if (requestId === epoch && pending === active) pending = null;
        token = null;
      }
    },
  });
}
