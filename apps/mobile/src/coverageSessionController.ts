/**
 * MOB-DATA-02 — staging-only, memory-only session-bound own-roster controller.
 *
 * Not connected to App.tsx, not an authorization boundary, no Supabase
 * project configured. Server-side Auth + live-session gate + RPC remain
 * mandatory. Consumer MUST call clear() synchronously on signout, identity
 * switch or app background, and dispose() when tearing down the screen.
 */
import {
  CoverageReadError, createReadOnlyCoverageClient,
  type PublicCoverage, type ReadOnlyCoverageConfig,
} from "./readonlyCoverageClient";

export type CoverageSessionSnapshot = Readonly<{
  state: "idle" | "loading" | "ready" | "error";
  rows: readonly PublicCoverage[];
  possiblyTruncated: boolean;
  errorCode: string | null;
}>;

const EMPTY_ROWS: readonly PublicCoverage[] = Object.freeze([]);
const IDLE: CoverageSessionSnapshot = Object.freeze({
  state: "idle", rows: EMPTY_ROWS, possiblyTruncated: false, errorCode: null,
});
const ALLOWED_ERRORS = Object.freeze(new Set([
  "ROSTER_AUTH_UNAVAILABLE", "ROSTER_USER_SESSION_REQUIRED",
  "ROSTER_ACCESS_DENIED", "ROSTER_OPERATION_REJECTED",
  "ROSTER_SERVICE_UNAVAILABLE", "ROSTER_TRANSPORT_FAILED",
  "ROSTER_UNEXPECTED_SHAPE", "ROSTER_INVALID_WINDOW",
  "ROSTER_DUPLICATE_COVERAGE_ID", "ROSTER_NOT_CHRONOLOGICAL",
]));

type Subscriber = (snapshot: CoverageSessionSnapshot) => void;

export function createCoverageSessionController(config: ReadOnlyCoverageConfig) {
  // Validate before constructing any live work. Snapshot the connection and
  // forbidden refs; caller cannot subsequently switch the origin/key/fetcher.
  const locked: ReadOnlyCoverageConfig = Object.freeze({
    ...config,
    forbiddenProjectRefs: Object.freeze([...(config?.forbiddenProjectRefs ?? [])]),
  });
  createReadOnlyCoverageClient(locked); // offline validation only

  let epoch = 0;
  let disposed = false;
  let pending: AbortController | null = null;
  let snapshot: CoverageSessionSnapshot = IDLE;
  const subscribers = new Set<Subscriber>();

  const publish = (next: CoverageSessionSnapshot) => {
    snapshot = next;
    for (const subscriber of [...subscribers]) {
      // UI callbacks are not allowed to affect cleanup/security state.
      try { subscriber(next); } catch { /* isolated UI listener */ }
    }
  };
  const invalidate = () => {
    epoch += 1;
    pending?.abort();
    pending = null;
    publish(IDLE); // remove all medical-service metadata immediately
  };

  return Object.freeze({
    getSnapshot: (): CoverageSessionSnapshot => snapshot,
    subscribe(listener: Subscriber): () => void {
      if (disposed) return () => {};
      subscribers.add(listener);
      listener(snapshot);
      return () => { subscribers.delete(listener); };
    },
    clear(): void {
      if (!disposed) invalidate();
    },
    dispose(): void {
      if (disposed) return;
      invalidate();
      disposed = true;
      subscribers.clear();
    },
    async refresh(): Promise<boolean> {
      if (disposed) return false;
      // Any reload erases the previous roster before awaiting Auth/network.
      const requestId = ++epoch;
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      publish(Object.freeze({
        state: "loading", rows: EMPTY_ROWS,
        possiblyTruncated: false, errorCode: null,
      }));

      const current = () => !disposed && epoch === requestId &&
        !controller.signal.aborted;
      let token: string | null = null;
      try {
        // Read token from the independently connected Auth provider. It is
        // transient, NEVER stored in a snapshot/UI/log/AsyncStorage.
        token = await locked.getAccessToken();
        if (!current()) return false;
        // ReadOnlyCoverageClient always calls Edge with a fixed action; it
        // never accepts a client-supplied actor or organization.
        const reader = createReadOnlyCoverageClient({
          ...locked, getAccessToken: async () => token,
        });
        const result = await reader.list(controller.signal);
        if (!current()) return false;

        // Auth can refresh/switch between the network request and rendering.
        // Do not publish rows if the underlying session token changed.
        const latestToken = await locked.getAccessToken();
        if (!current()) return false;
        if (!token || token !== latestToken) {
          publish(Object.freeze({
            state: "error", rows: EMPTY_ROWS,
            possiblyTruncated: false, errorCode: "ROSTER_SESSION_CHANGED",
          }));
          return false;
        }
        publish(Object.freeze({
          state: "ready",
          rows: Object.freeze(result.rows.map(row => Object.freeze({...row}))),
          possiblyTruncated: result.possiblyTruncated,
          errorCode: null,
        }));
        return true;
      } catch (error) {
        if (!current()) return false;
        const code = error instanceof CoverageReadError &&
          ALLOWED_ERRORS.has(error.code) ? error.code : "ROSTER_AUTH_UNAVAILABLE";
        publish(Object.freeze({
          state: "error", rows: EMPTY_ROWS,
          possiblyTruncated: false, errorCode: code,
        }));
        return false;
      } finally {
        if (epoch === requestId && pending === controller) pending = null;
        token = null;
      }
    },
  });
}
