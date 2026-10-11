/**
 * MOB-AUTH-01 — Supabase Auth event binding for dormant staging roster view.
 *
 * This is NOT an Auth client, login implementation, or permission engine.
 * The caller must supply an Auth provider from the NEW independent Supabase
 * project. No keys, user identities or Auth session payloads are handled here.
 */
import type { createCoverageSessionController } from "./coverageSessionController";

type CoverageController = ReturnType<typeof createCoverageSessionController>;

export type SupabaseLikeAuthEvents = Readonly<{
  onAuthStateChange: (listener: (
    event: string, session: unknown,
  ) => void) => {
    data: {subscription:{unsubscribe:()=>void}};
  };
}>;

export class CoverageAuthBindingError extends Error {
  constructor() {
    super("ROSTER_AUTH_EVENTS_UNAVAILABLE");
    this.name="CoverageAuthBindingError";
  }
}

/**
 * Clear on EVERY event, not only SIGNED_OUT. A session refresh, account switch,
 * INITIAL_SESSION or an unexpected event must never retain old roster data.
 * The Auth provider still controls identity/JWT; Edge + SQL control access.
 */
export function bindCoverageAuthEvents(
  controller: CoverageController,
  auth: SupabaseLikeAuthEvents,
): () => void {
  // Existing roster must not survive attaching a different Auth provider.
  controller.clear();
  if (!auth || typeof auth.onAuthStateChange !== "function") {
    throw new CoverageAuthBindingError();
  }

  let closed=false;
  let subscription: {unsubscribe:()=>void} | undefined;
  try {
    const response=auth.onAuthStateChange((_event,_session)=>{
      if (!closed) controller.clear();
    });
    subscription=response?.data?.subscription;
  } catch {
    controller.clear();
    throw new CoverageAuthBindingError();
  }
  if (!subscription || typeof subscription.unsubscribe !== "function") {
    controller.clear();
    throw new CoverageAuthBindingError();
  }
  return () => {
    if (closed) return;
    closed=true;
    controller.clear();
    // Never log upstream SDK errors, auth tokens or session payloads.
    try { subscription?.unsubscribe(); } catch { /* fail closed */ }
  };
}
