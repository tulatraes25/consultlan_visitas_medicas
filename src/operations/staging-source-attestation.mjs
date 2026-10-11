/**
 * STAGING-01D — deterministic, offline-only source attestation for an
 * independent Supabase project. This is NOT a deployment certificate.
 * Never accepts an environment secret or a destination project ref.
 */
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { REQUIRED_MIGRATIONS } from "./staging-policy.mjs";

export const STAGING_ATTESTATION_FORMAT = "consultlan-visitas-staging-source/v1";
export const ATTESTED_FILES = Object.freeze([
  ...REQUIRED_MIGRATIONS.map(name => "supabase/migrations/" + name),
  "supabase/config.toml",
  "supabase/functions/visits/index.ts",
  "supabase/functions/visits/handler.ts",
  "supabase/functions/visits/authentication.ts",
  "supabase/functions/visits/session.ts",
]);

const SHA = /^[a-f0-9]{40}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;

function deny(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

/** No filesystem or network dependency; all inputs must be pre-verified bytes. */
export function buildStagingSourceAttestation(commit, blobs) {
  if (typeof commit !== "string" || !SHA.test(commit)) {
    deny("STAGING_SOURCE_COMMIT_INVALID");
  }
  if (!(blobs instanceof Map) ||
      !isDeepStrictEqual([...blobs.keys()].sort(), [...ATTESTED_FILES].sort())) {
    deny("STAGING_SOURCE_FILE_INVENTORY_INVALID");
  }
  const files = ATTESTED_FILES.map(path => {
    const bytes = blobs.get(path);
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 ||
        bytes.length > 1024 * 1024) {
      deny("STAGING_SOURCE_BYTES_MISSING_OR_TOO_LARGE");
    }
    return {
      path,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
  return {
    format: STAGING_ATTESTATION_FORMAT,
    sourceCommit: commit,
    migrationCount: REQUIRED_MIGRATIONS.length,
    fileCount: files.length,
    files,
  };
}

/** Strict structural comparison; ignores JSON key order but never file order. */
export function verifyStagingSourceAttestation(received, canonical) {
  if (!received || typeof received !== "object" ||
      Array.isArray(received) ||
      !Object.hasOwn(received, "files") ||
      !Array.isArray(received.files) ||
      received.files.length !== ATTESTED_FILES.length ||
      received.files.some((item, index) =>
        !item || typeof item !== "object" || Array.isArray(item) ||
        !isDeepStrictEqual(Object.keys(item).sort(), ["path", "sha256"]) ||
        item.path !== ATTESTED_FILES[index] ||
        typeof item.sha256 !== "string" ||
        !FINGERPRINT.test(item.sha256)) ||
      !isDeepStrictEqual(Object.keys(received).sort(),
        ["fileCount", "files", "format", "migrationCount", "sourceCommit"])) {
    deny("STAGING_SOURCE_MANIFEST_SHAPE_REJECTED");
  }
  if (!isDeepStrictEqual(received, canonical)) {
    deny("STAGING_SOURCE_MANIFEST_MISMATCH");
  }
  return true;
}

/** Enforce an exact ordered set of migrations, not just their presence. */
export function verifyMigrationFileInventory(found) {
  if (!Array.isArray(found) ||
      found.some(x => typeof x !== "string") ||
      !isDeepStrictEqual([...found].sort(), [...REQUIRED_MIGRATIONS].sort())) {
    deny("STAGING_SOURCE_MIGRATION_SET_CHANGED");
  }
  return true;
}
