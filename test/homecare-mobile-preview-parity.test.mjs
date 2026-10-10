import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HOMECARE_FORM_CONTRACTS, BEDSIDE_PAPER_RECORDS, MONTHLY_DOSSIER,
} from "../src/domain/homecare-form-contracts.mjs";

// Compare the actual Expo-readable JSON against the immutable source catalog.
// A new or changed clinical field may never silently appear on the mobile UI.
const mobile = JSON.parse(readFileSync(
  new URL("../apps/mobile/src/formPreviewCatalog.json", import.meta.url), "utf8",
));

test("HC-03B mobile catalog preserves every verified HC-03A form exactly", () => {
  assert.equal(mobile.sourceContract, "HC-03A");
  assert.equal(mobile.mode, "READ_ONLY_STRUCTURE_PREVIEW");
  assert.equal(mobile.templates.length, 7);
  const sourceIds = Object.keys(HOMECARE_FORM_CONTRACTS).sort();
  assert.deepEqual(mobile.templates.map(x => x.id).sort(), sourceIds);
  for (const form of mobile.templates) {
    const source = HOMECARE_FORM_CONTRACTS[form.id];
    assert(source, "No UI template without a verified source contract");
    for (const key of ["id", "source", "specialty", "kind", "headerFields", "rowFields"]) {
      assert.deepEqual(form[key], source[key], `${form.id} mismatch: ${key}`);
    }
    assert.deepEqual(Object.keys(form).sort(),
      ["id", "source", "specialty", "kind", "headerFields", "rowFields"].sort(),
      "Presentation must not claim clinical authority or add free-text values");
    assert.equal(source.submissionEnabled, false);
    assert.equal(source.caregiverSigningEnabled, false);
    assert.equal(source.professionalSigningEnabled, false);
  }
});

test("HC-03B mobile paper references match source exactly and remain paper only", () => {
  assert.equal(mobile.paper.length, 4);
  assert.deepEqual(mobile.paper.map(x=>x.id).sort(),
    Object.keys(BEDSIDE_PAPER_RECORDS).sort());
  for (const paper of mobile.paper) {
    const source = BEDSIDE_PAPER_RECORDS[paper.id];
    assert.equal(source.status, "PAPER_ONLY");
    for (const key of ["id", "source", "confirmedLabels", "restrictions"]) {
      assert.deepEqual(paper[key], source[key], `${paper.id}: ${key}`);
    }
    assert.equal(paper.unknownColumns, Boolean(source.unknownColumns));
    assert.deepEqual(Object.keys(paper).sort(),
      ["id", "source", "confirmedLabels", "restrictions", "unknownColumns"].sort());
  }
});

test("monthly 56-page reference remains an inventory marker, not a patient import", () => {
  assert.deepEqual(mobile.monthlyDossier, {
    source: MONTHLY_DOSSIER.source,
    status: MONTHLY_DOSSIER.status,
  });
  assert.equal(MONTHLY_DOSSIER.extractedFieldMap, false);
  assert.equal(MONTHLY_DOSSIER.importPatientData, false);
  assert.equal(MONTHLY_DOSSIER.reproduceOriginalSignatures, false);
});

test("mobile preview schema never contains sample personal data or filled signatures", () => {
  const dump=JSON.stringify(mobile);
  assert(!/PACIENTE FICTICIO [A-F]|DEMO-PAT-|clinicPatientId|signatureImage|rawInk|\bservice_role\b/i.test(dump));
  assert(!/CLOSED_VERIFIED|APPROVED|ACTIVE_CLINICAL/i.test(dump));
  for(const form of mobile.templates) {
    assert(form.headerFields.concat(form.rowFields).every(x=>
      typeof x.id==="string" && typeof x.sourceLabel==="string" && typeof x.kind==="string"));
    assert(form.rowFields.every(x=>Object.keys(x).sort().join(",")==="id,kind,sourceLabel"));
  }
});

test("nursing preview distinguishes time, provider signature and family attestation", () => {
  const n=mobile.templates.find(x=>x.id==="NURSING_CAREGIVER_ATTENDANCE");
  assert(n);
  assert.deepEqual(n.rowFields.map(x=>x.id),
    ["serviceDate","serviceTime","professionalSignature","responsibleSignature"]);
  assert.equal(n.rowFields[2].kind,"PROFESSIONAL_SIGNATURE_REQUEST");
  assert.equal(n.rowFields[3].kind,"RESPONSIBLE_ATTESTATION_REQUEST");
});

test("clinical evolution preview has no editable medication or diagnostic fields", () => {
  const e=mobile.templates.find(x=>x.id==="CLINICAL_EVOLUTION");
  assert(e);
  assert.equal(e.kind,"CLINICAL_EVOLUTION");
  assert.deepEqual(e.rowFields.map(x=>x.id),["evolution"]);
  assert.equal(e.rowFields[0].kind,"CLINICAL_NARRATIVE");
  assert(!e.rowFields.some(x=>/medication|dose|diagnosis|crisis_automatic/i.test(x.id)));
});
