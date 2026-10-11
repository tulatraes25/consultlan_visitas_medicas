#!/usr/bin/env node
/**
 * STAGING-01D. Offline-only read of an EXACT, clean Git checkout.
 *
 * --ci               verify source inventory without printing details
 * --emit             print a non-secret source manifest to stdout
 * --verify FILE      compare a saved manifest with the current exact commit
 *
 * No network, Supabase client, SQL execution, migrations or secrets.
 */
import { readFile, readdir, lstat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATTESTED_FILES, buildStagingSourceAttestation,
  verifyMigrationFileInventory, verifyStagingSourceAttestation,
} from "../src/operations/staging-source-attestation.mjs";
import {
  checkStagingSource, REQUIRED_MIGRATIONS,
} from "../src/operations/staging-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const maxManifestBytes = 128 * 1024;

function block(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function git(...args) {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8", timeout: 8000, maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { block("STAGING_SOURCE_GIT_UNAVAILABLE"); }
}

async function sourceState() {
  if (git("status", "--porcelain", "--untracked-files=normal")) {
    block("STAGING_SOURCE_WORKTREE_NOT_CLEAN");
  }
  const commit = git("rev-parse", "HEAD");
  const actualMigrations = (await readdir(resolve(root, "supabase/migrations")))
    .filter(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name));
  verifyMigrationFileInventory(actualMigrations);

  const blobs = new Map();
  for (const relative of ATTESTED_FILES) {
    const path = resolve(root, relative);
    // Do not follow symlinks which may point to an operator's secret files.
    const status = await lstat(path);
    if (!status.isFile() || status.isSymbolicLink() ||
        status.size === 0 || status.size > 1024 * 1024) {
      block("STAGING_SOURCE_FILE_NOT_REGULAR");
    }
    blobs.set(relative, await readFile(path));
  }
  const get = path => blobs.get(path)?.toString("utf8") ?? "";
  const check = checkStagingSource({
    config: get("supabase/config.toml"),
    edgeHandler: get("supabase/functions/visits/handler.ts"),
    revokeMigration: get("supabase/migrations/20261010060000_revoke_legacy_clinical_rpc.sql"),
  });
  if (!check.ok || REQUIRED_MIGRATIONS.length !== 12) {
    block("STAGING_SOURCE_PRECHECK_FAILED");
  }
  return buildStagingSourceAttestation(commit, blobs);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] ?? "--ci";
  if (!["--ci", "--emit", "--verify"].includes(mode) ||
      (mode === "--verify" && args.length !== 2) ||
      (mode !== "--verify" && args.length !== 1)) {
    block("STAGING_SOURCE_INVALID_MODE");
  }
  const manifest = await sourceState();
  if (mode === "--ci") {
    console.log("STAGING01D_OFFLINE_SOURCE_ATTESTATION_PASS");
  } else if (mode === "--emit") {
    process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
  } else {
    const file = resolve(process.cwd(), args[1]);
    const meta = await lstat(file);
    if (!meta.isFile() || meta.isSymbolicLink() ||
        meta.size === 0 || meta.size > maxManifestBytes) {
      block("STAGING_SOURCE_MANIFEST_FILE_INVALID");
    }
    let received;
    try { received = JSON.parse(await readFile(file, "utf8")); }
    catch { block("STAGING_SOURCE_MANIFEST_JSON_INVALID"); }
    verifyStagingSourceAttestation(received, manifest);
    console.log("STAGING01D_EXACT_COMMIT_AND_FILES_MATCH");
  }
}
main().catch(error => {
  // Never dump an upstream exception, path, ref, env var or private content.
  console.error("STAGING01D_BLOCKED:" +
    (typeof error?.code === "string" &&
      error.code.startsWith("STAGING_SOURCE_")
      ? error.code : "STAGING_SOURCE_INTERNAL_FAILURE"));
  process.exitCode = 1;
});
