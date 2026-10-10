import test from "node:test";
import assert from "node:assert/strict";
import {
  HOMECARE_FORM_CONTRACTS,
  BEDSIDE_PAPER_RECORDS,
  MONTHLY_DOSSIER,
  inspectFormPreviewRequest,
} from "../src/domain/homecare-form-contracts.mjs";

test("original medical, nursing and other clinical attendance sheet structures are represented", () => {
  const expected = new Map([
    ["MEDICAL_ATTENDANCE", "Planilla médica"],
    ["NURSING_CAREGIVER_ATTENDANCE", "Enfermería/cuidadoras"],
    ["PHYSIOTHERAPY_ATTENDANCE", "Kinesiología"],
    ["SPEECH_ATTENDANCE", "Fonoaudiología"],
    ["OCCUPATIONAL_THERAPY_ATTENDANCE", "Terapia ocupacional"],
    ["NUTRITION_ATTENDANCE", "Nutrición"],
    ["CLINICAL_EVOLUTION", "Hoja evolución"],
  ]);
  assert.equal(Object.keys(HOMECARE_FORM_CONTRACTS).length, expected.size);
  for (const [id,source] of expected) {
    const value = HOMECARE_FORM_CONTRACTS[id];
    assert.equal(value?.source, source, id);
    assert.equal(value.patientOrigin, "HOMECARE_EPISODE_ONLY");
    assert.equal(value.status, "SOURCE_VERIFIED_STRUCTURE_PENDING_APPROVAL");
    assert.equal(value.submissionEnabled, false);
    assert.equal(value.caregiverSigningEnabled, false);
    assert.equal(value.professionalSigningEnabled, false);
  }
});

test("all attendance sources preserve original family and professional signature separation", () => {
  const forms=Object.values(HOMECARE_FORM_CONTRACTS)
    .filter(x=>x.kind==="ATTENDANCE");
  assert.equal(forms.length,6);
  for(const form of forms){
    assert(form.rowFields.some(x=>x.kind==="PROFESSIONAL_SIGNATURE_REQUEST"),form.id);
    assert(form.rowFields.some(x=>x.kind==="RESPONSIBLE_ATTESTATION_REQUEST"),form.id);
    assert(form.rowFields.some(x=>x.kind==="DATE_ONLY"),form.id);
    assert(form.headerFields.some(x=>x.id==="homecarePatient"),form.id);
    assert(form.headerFields.some(x=>x.id==="insurer"),form.id);
    assert(!form.rowFields.some(x=>/DIGITAL_CERTIFICATE|RAW_INK|AUTOMATIC_SIGNATURE/.test(x.kind)));
  }
});

test("nursing and caregiver attendance preserves explicit Horario, firma/sello and a separate responsible", () => {
  const nursing=HOMECARE_FORM_CONTRACTS.NURSING_CAREGIVER_ATTENDANCE;
  assert.equal(nursing.rowFields.find(x=>x.id==="serviceTime")?.sourceLabel,"Horario");
  assert.equal(nursing.rowFields.find(x=>x.id==="professionalSignature")?.sourceLabel,
    "Firma y sello profesional");
  assert.equal(nursing.rowFields.find(x=>x.id==="responsibleSignature")?.sourceLabel,
    "Firma familiar");
  assert(nursing.limitations.some(x=>/SHIFT/.test(x)));
});

test("clinical evolution is separate from attendance and does not invent treatment details", () => {
  const evolution=HOMECARE_FORM_CONTRACTS.CLINICAL_EVOLUTION;
  assert.equal(evolution.kind,"CLINICAL_EVOLUTION");
  assert.deepEqual(evolution.rowFields.map(x=>x.id),["evolution"]);
  assert.equal(evolution.rowFields[0].kind,"CLINICAL_NARRATIVE");
  assert(!evolution.rowFields.some(x=>/dose|prescription|medication/i.test(x.id)));
  assert.equal(evolution.submissionEnabled,false);
});

test("four household paper records cannot be converted into active digital forms", () => {
  assert.deepEqual(Object.keys(BEDSIDE_PAPER_RECORDS).sort(),
    ["CRISIS_SHEET","KARDEX","PROCEDURE_SHEET","VITAL_SIGNS"].sort());
  for (const id of Object.keys(BEDSIDE_PAPER_RECORDS)){
    assert.equal(BEDSIDE_PAPER_RECORDS[id].status,"PAPER_ONLY");
    assert.deepEqual(inspectFormPreviewRequest({
      templateId:id,action:"RECORD_CLINICAL_VALUES"
    }),{allowed:false,code:"PAPER_RECORD_NOT_DIGITALIZED"});
    assert.deepEqual(inspectFormPreviewRequest({
      templateId:id,action:"REFERENCE_PAPER_RECORD"
    }),{allowed:true,code:"PAPER_REFERENCE_ONLY"});
  }
  assert.equal(BEDSIDE_PAPER_RECORDS.KARDEX.unknownColumns,true);
  assert.equal(BEDSIDE_PAPER_RECORDS.CRISIS_SHEET.confirmedLabels.length,3);
  assert(!JSON.stringify(BEDSIDE_PAPER_RECORDS).includes("dosis"));
});

test("monthly 56-page file is a documentary source, not imported patient data", () => {
  assert.equal(MONTHLY_DOSSIER.extractedFieldMap,false);
  assert.equal(MONTHLY_DOSSIER.importPatientData,false);
  assert.equal(MONTHLY_DOSSIER.reproduceOriginalSignatures,false);
  assert.equal(MONTHLY_DOSSIER.status,"REFERENCE_ONLY");
});

test("preview-only action is permitted but recording, signing or clinical closure is refused", () => {
  for(const id of Object.keys(HOMECARE_FORM_CONTRACTS)){
    assert.deepEqual(inspectFormPreviewRequest({templateId:id,action:"PREVIEW_STRUCTURE"}),
      {allowed:true,code:"PREVIEW_ONLY"});
    for(const action of [
      "SUBMIT_TO_CLINICAL_RECORD","CAPTURE_SIGNATURE",
      "REUSE_PROFESSIONAL_SIGNATURE","DIGITALLY_SIGN_DOCUMENT",
      "CLOSE_SIGNED_DOCUMENT","INFER_TREATMENT",
    ]){
      assert.equal(inspectFormPreviewRequest({templateId:id,action}).allowed,false);
    }
  }
});

test("preview refuses patient IDs, raw pen strokes, private keys, clinical data and arbitrary templates", () => {
  const base={templateId:"MEDICAL_ATTENDANCE",action:"PREVIEW_STRUCTURE"};
  for(const [key,value] of Object.entries({
    clinicPatientId:"clinic-test-id",
    patientId:"synthetic-person",
    patient:{name:"not-in-preview"},
    clinicalValues:{spO2:98},
    signatureImage:"data:image/png;base64,not-allowed",
    privateKey:"not-a-real-secret",
    rawInk:[{x:1,y:2}],
  })){
    assert.deepEqual(inspectFormPreviewRequest({...base,[key]:value}),
      {allowed:false,code:"IDENTIFIABLE_OR_SIGNATURE_DATA_NOT_ACCEPTED"},key);
  }
  assert.equal(inspectFormPreviewRequest({templateId:"UNKNOWN",action:"PREVIEW_STRUCTURE"}).allowed,false);
  assert.equal(inspectFormPreviewRequest(null).allowed,false);
});

test("contracts and source field labels remain immutable", () => {
  assert(Object.isFrozen(HOMECARE_FORM_CONTRACTS));
  assert(Object.isFrozen(HOMECARE_FORM_CONTRACTS.MEDICAL_ATTENDANCE.rowFields));
  assert(Object.isFrozen(HOMECARE_FORM_CONTRACTS.MEDICAL_ATTENDANCE.rowFields[0]));
  assert(Object.isFrozen(BEDSIDE_PAPER_RECORDS.KARDEX));
  assert.throws(()=>{
    HOMECARE_FORM_CONTRACTS.MEDICAL_ATTENDANCE.rowFields[0].sourceLabel="Firma inventada";
  },TypeError);
});

test("no source template introduces unverified prescriptions, diagnoses or digital signature credentials", () => {
  const serialized=JSON.stringify(HOMECARE_FORM_CONTRACTS);
  assert(!/diagnosis|prescription|dosage|medicationOrder|certificatePrivateKey/i.test(serialized));
  assert(!serialized.includes("clinicPatientId"));
  assert(!serialized.includes("CLOSED_VERIFIED"));
  assert(!serialized.includes("service_role"));
});
