import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  ATTESTED_FILES, STAGING_ATTESTATION_FORMAT,
  buildStagingSourceAttestation, verifyStagingSourceAttestation,
  verifyMigrationFileInventory,
} from "../src/operations/staging-source-attestation.mjs";
import { REQUIRED_MIGRATIONS } from "../src/operations/staging-policy.mjs";

const COMMIT = "a".repeat(40);
const blobs = () => new Map(ATTESTED_FILES.map(path => [
  path, Buffer.from("synthetic-only fixture for " + path, "utf8"),
]));

function rejected(run, code) {
  assert.throws(run, err => err?.code === code);
}

test("STAGING-01D creates a deterministic, ordered 13-migration manifest without refs or secrets", () => {
  assert.equal(REQUIRED_MIGRATIONS.length,13);
  assert.equal(ATTESTED_FILES.length,18);
  const manifest=buildStagingSourceAttestation(COMMIT,blobs());
  assert.equal(manifest.format,STAGING_ATTESTATION_FORMAT);
  assert.equal(manifest.sourceCommit,COMMIT);
  assert.equal(manifest.migrationCount,13);
  assert.equal(manifest.fileCount,18);
  assert.deepEqual(manifest.files.map(x=>x.path),ATTESTED_FILES);
  const samplePath=ATTESTED_FILES[0];
  const bytes=blobs().get(samplePath);
  assert.equal(manifest.files[0].sha256,
    createHash("sha256").update(bytes).digest("hex"));
  assert.equal(verifyStagingSourceAttestation(
    structuredClone(manifest),manifest),true);
  const serialized=JSON.stringify(manifest);
  assert.ok(!serialized.includes("sb_secret_"));
  assert.ok(!serialized.includes("https://"));
  assert.ok(!serialized.includes("patient_id"));
});

test("STAGING-01D rejects missing/new/misordered or invalid bytes",()=>{
  rejected(()=>buildStagingSourceAttestation("bad",blobs()),
    "STAGING_SOURCE_COMMIT_INVALID");
  const missing=blobs();
  missing.delete(ATTESTED_FILES[0]);
  rejected(()=>buildStagingSourceAttestation(COMMIT,missing),
    "STAGING_SOURCE_FILE_INVENTORY_INVALID");
  const extra=blobs();
  extra.set("supabase/migrations/20261011111111_unreviewed.sql",Buffer.from("test"));
  rejected(()=>buildStagingSourceAttestation(COMMIT,extra),
    "STAGING_SOURCE_FILE_INVENTORY_INVALID");
  const replaced=blobs();
  replaced.set(ATTESTED_FILES[3],new Uint8Array(0));
  rejected(()=>buildStagingSourceAttestation(COMMIT,replaced),
    "STAGING_SOURCE_BYTES_MISSING_OR_TOO_LARGE");
  assert.equal(verifyMigrationFileInventory([...REQUIRED_MIGRATIONS].reverse()),true);
  rejected(()=>verifyMigrationFileInventory(REQUIRED_MIGRATIONS.slice(1)),
    "STAGING_SOURCE_MIGRATION_SET_CHANGED");
  rejected(()=>verifyMigrationFileInventory([...REQUIRED_MIGRATIONS,"20261011000000_extra.sql"]),
    "STAGING_SOURCE_MIGRATION_SET_CHANGED");
});

test("STAGING-01D refuses tampered SHA, commit, extra fields and file order",()=>{
  const expected=buildStagingSourceAttestation(COMMIT,blobs());
  const alters=[
    x=>{x.sourceCommit="b".repeat(40);},
    x=>{x.files[0].sha256="b".repeat(64);},
    x=>{x.files.reverse();},
    x=>{x.files[0].extra="bad";},
    x=>{x.hiddenCredential="fake";},
    x=>{x.migrationCount=999;},
    x=>{x.files.pop();},
  ];
  for(const alter of alters){
    const changed=structuredClone(expected);
    alter(changed);
    assert.throws(()=>verifyStagingSourceAttestation(changed,expected),
      /STAGING_SOURCE_MANIFEST_(SHAPE_REJECTED|MISMATCH)/);
  }
});

test("STAGING-01D CLI emits/validates only source fingerprints, with zero network",()=>{
  const repo=resolve(import.meta.dirname,"..");
  const script=join(repo,"scripts/staging-source-attestation.mjs");
  const run=(args)=>spawnSync(process.execPath,[script,...args],{
    cwd:repo,encoding:"utf8",timeout:12000,
    env:{PATH:process.env.PATH,HOME:process.env.HOME},
  });
  const ci=run(["--ci"]);
  assert.equal(ci.status,0,ci.stderr);
  assert.equal(ci.stdout.trim(),"STAGING01D_OFFLINE_SOURCE_ATTESTATION_PASS");

  const emitted=run(["--emit"]);
  assert.equal(emitted.status,0,emitted.stderr);
  const manifest=JSON.parse(emitted.stdout);
  assert.equal(manifest.files.length,18);
  assert.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);

  const temp=mkdtempSync(join(tmpdir(),"staging01d-"));
  try{
    const file=join(temp,"manifest.json");
    writeFileSync(file,emitted.stdout);
    const good=run(["--verify",file]);
    assert.equal(good.status,0,good.stderr);
    assert.equal(good.stdout.trim(),"STAGING01D_EXACT_COMMIT_AND_FILES_MATCH");
    manifest.files[4].sha256="0".repeat(64);
    writeFileSync(file,JSON.stringify(manifest));
    const bad=run(["--verify",file]);
    assert.notEqual(bad.status,0);
    assert.match(bad.stderr,/STAGING01D_BLOCKED:STAGING_SOURCE_MANIFEST_MISMATCH/);
    const extra=run(["--emit","--probe"]);
    assert.notEqual(extra.status,0);
    assert.match(extra.stderr,/STAGING01D_BLOCKED:STAGING_SOURCE_INVALID_MODE/);
  }finally{rmSync(temp,{force:true,recursive:true});}
});
