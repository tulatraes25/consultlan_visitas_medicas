import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  SOURCE_REVIEW_MATRIX,
  comparePrivateSourceFieldIds,
  inspectMonthlyDocumentGate,
} from "../src/domain/homecare-source-review.mjs";
import {
  HOMECARE_FORM_CONTRACTS,
  BEDSIDE_PAPER_RECORDS,
  MONTHLY_DOSSIER,
} from "../src/domain/homecare-form-contracts.mjs";

const html=readFileSync(new URL("../apps/form-prototypes/preview.html",import.meta.url),"utf8");
const embedded=html.match(/<script id="hc-review" type="application\/json">([^<]+)<\/script>/);
const review=embedded?JSON.parse(embedded[1]):null;

test("HC-UX-03A: 7+4+1 checklist is sourced only from original-form contracts",()=>{
  assert.equal(SOURCE_REVIEW_MATRIX.version,"HC-UX-03A");
  assert.equal(SOURCE_REVIEW_MATRIX.sourceContract,"HC-03A");
  assert.equal(SOURCE_REVIEW_MATRIX.forms.length,7);
  assert.equal(SOURCE_REVIEW_MATRIX.paper.length,4);
  assert.deepEqual(SOURCE_REVIEW_MATRIX.forms.map(x=>x.templateId),Object.keys(HOMECARE_FORM_CONTRACTS));
  assert.deepEqual(SOURCE_REVIEW_MATRIX.paper.map(x=>x.templateId),Object.keys(BEDSIDE_PAPER_RECORDS));
  for(const row of SOURCE_REVIEW_MATRIX.forms){
    const original=HOMECARE_FORM_CONTRACTS[row.templateId];
    assert.equal(row.source,original.source);
    assert.equal(row.kind,original.kind);
    assert.deepEqual(row.headerIds,original.headerFields.map(f=>f.id));
    assert.deepEqual(row.rowIds,original.rowFields.map(f=>f.id));
    assert.equal(row.reviewedOriginalLayout,false);
    assert.equal(row.medicalApproval,false);
    assert.equal(row.administrativeApproval,false);
    assert.equal(row.canEmit,false);
    assert.ok(row.requiredChecks.includes("PRIVATE_ORIGINAL_VISUAL_COMPARISON"));
    assert.ok(row.requiredChecks.includes("FINANCIER_DOCUMENT_FORMAT"));
  }
  for(const row of SOURCE_REVIEW_MATRIX.paper){
    assert.equal(row.status,"PAPER_ONLY");
    assert.equal(row.canEmit,false);
    assert.equal(row.unknownColumns,!!BEDSIDE_PAPER_RECORDS[row.templateId].unknownColumns);
    assert.ok(row.requiredChecks.includes("NO_AUTOMATIC_DIGITAL_SUBSTITUTION"));
  }
  assert.equal(SOURCE_REVIEW_MATRIX.dossier.templateId,MONTHLY_DOSSIER.id);
  assert.equal(SOURCE_REVIEW_MATRIX.dossier.status,"REFERENCE_ONLY");
  assert.equal(SOURCE_REVIEW_MATRIX.dossier.scannedSamplePageCount,56);
  assert.equal(SOURCE_REVIEW_MATRIX.dossier.requiredPageCount,null);
  assert.equal(SOURCE_REVIEW_MATRIX.dossier.approvedFoliation,false);
  assert.equal(SOURCE_REVIEW_MATRIX.dossier.approvedSectionOrder,false);
  assert.equal(SOURCE_REVIEW_MATRIX.dossier.canEmit,false);
  assert.equal(SOURCE_REVIEW_MATRIX.approvedForClinicalUse,false);
  assert.equal(SOURCE_REVIEW_MATRIX.originalDocsInPublicRepository,false);
  assert.equal(Object.isFrozen(SOURCE_REVIEW_MATRIX),true);
  assert.equal(Object.isFrozen(SOURCE_REVIEW_MATRIX.forms[0].headerIds),true);
  assert.equal(Object.isFrozen(SOURCE_REVIEW_MATRIX.dossier.requiredChecks),true);
});

test("HC-UX-03A: self-reported matching header/row IDs NEVER authorize original layout",()=>{
  for(const f of Object.values(HOMECARE_FORM_CONTRACTS)){
    const request={
      templateId:f.id,
      observedHeaderIds:f.headerFields.map(x=>x.id),
      observedRowIds:f.rowFields.map(x=>x.id),
    };
    const result=comparePrivateSourceFieldIds(request);
    assert.deepEqual(result,{
      code:"DECLARED_FIELDS_AGREE",
      status:"STRUCTURE_ONLY_SELF_CHECK",
      structuralAgreement:true,
      originalLayoutCertified:false,
      approvalGranted:false,
      canEmit:false,
    },f.id);
  }
});

test("HC-UX-03A: missing, reordered and duplicated source columns are blocked",()=>{
  const f=HOMECARE_FORM_CONTRACTS.NURSING_CAREGIVER_ATTENDANCE;
  const base={
    templateId:f.id,
    observedHeaderIds:f.headerFields.map(x=>x.id),
    observedRowIds:f.rowFields.map(x=>x.id),
  };
  let result=comparePrivateSourceFieldIds({...base,observedRowIds:base.observedRowIds.slice(0,-1)});
  assert.equal(result.code,"DECLARED_FIELDS_MISMATCH");
  assert.equal(result.structuralAgreement,false);
  assert.equal(result.canEmit,false);
  result=comparePrivateSourceFieldIds({...base,observedRowIds:[...base.observedRowIds].reverse()});
  assert.equal(result.code,"DECLARED_FIELDS_MISMATCH");
  result=comparePrivateSourceFieldIds({...base,observedHeaderIds:[
    ...base.observedHeaderIds,base.observedHeaderIds[0]
  ]});
  assert.equal(result.code,"DUPLICATED_OBSERVED_FIELD_ID");
  result=comparePrivateSourceFieldIds({...base,observedRowIds:[...base.observedRowIds,"sheetDate"]});
  assert.equal(result.code,"DECLARED_FIELDS_MISMATCH");
  assert.equal(result.canEmit,false);
});

test("HC-UX-03A: sensitive or foreign payload cannot enter a source comparison",()=>{
  const known={
    templateId:"MEDICAL_ATTENDANCE",
    observedHeaderIds:["homecarePatient","insurer","sheetDate"],
    observedRowIds:["serviceDate","professionalSignature","responsibleSignature"],
  };
  const bad=[
    null,undefined,[],new Date(),
    {},{...known,patientName:"TEST PATIENT"},{...known,clinicalValues:"secret"},
    {...known,sourceFile:"/private/path.docx"},{...known,signatureImage:"base64-secret"},
    {...known,doctorApproved:true},{...known,adminApproved:true},
    {...known,documentIssued:true},{...known,rawInk:"secret"},
  ];
  for(const input of bad){
    const out=comparePrivateSourceFieldIds(input);
    assert.equal(out.canEmit,false);
    assert.equal(out.structuralAgreement,false);
    assert.match(out.code,/^(INVALID_COMPARISON|UNEXPECTED_COMPARISON_PROPERTY)$/);
    assert.doesNotMatch(JSON.stringify(out),/TEST PATIENT|base64|secret|private/);
  }
  const foreign=[
    {...known,observedHeaderIds:[...known.observedHeaderIds,"DNI_REAL"]},
    {...known,observedRowIds:["nombre de paciente"]},
    {...known,observedHeaderIds:["patientId"]},
    {...known,observedRowIds:["unknownField"]},
  ];
  for(const input of foreign){
    const out=comparePrivateSourceFieldIds(input);
    assert.equal(out.canEmit,false);
    assert.equal(out.structuralAgreement,false);
    assert.ok(["FIELD_ID_OUTSIDE_APPROVED_CATALOG","INVALID_FIELD_ID_LIST"].includes(out.code));
    assert.doesNotMatch(JSON.stringify(out),/DNI_REAL|nombre de paciente|patientId|unknownField/);
  }
});

test("HC-UX-03A: paper source and sample monthly dossier reject digital comparisons",()=>{
  const paper=comparePrivateSourceFieldIds({
    templateId:"KARDEX",observedHeaderIds:[],observedRowIds:[],
  });
  assert.equal(paper.code,"PAPER_SOURCE_NOT_DIGITALIZED");
  const month=comparePrivateSourceFieldIds({
    templateId:"MONTHLY_DOSSIER",observedHeaderIds:[],observedRowIds:[],
  });
  assert.equal(month.code,"MONTHLY_DOSSIER_LAYOUT_UNVERIFIED");
  assert.equal(comparePrivateSourceFieldIds({
    templateId:"NO_FORM",observedHeaderIds:[],observedRowIds:[],
  }).code,"UNKNOWN_TEMPLATE");
  for(const x of [paper,month])assert.equal(x.canEmit,false);
});

test("HC-UX-03A: monthly gate never treats the 56-page historical sample as required length",()=>{
  const gate=inspectMonthlyDocumentGate();
  assert.equal(gate.status,"BLOCKED_PRIVATE_SOURCE_REVIEW");
  assert.equal(gate.emittedDocuments,0);
  assert.equal(gate.canEmit,false);
  assert.equal(gate.canPresentToInsurer,false);
  assert.equal(gate.digitallySigned,false);
  assert.equal(gate.formsRequiringPrivateLayoutReview,7);
  assert.equal(gate.paperRecordsRemainingAtHome,4);
  assert.equal(gate.scannedSamplePageCount,56);
  assert.equal(gate.mandatedPageCount,null);
  assert.ok(gate.blockers.includes("SIGNING_REPRESENTATION_AND_LEGAL_METHOD"));
  assert.ok(gate.blockers.includes("FINANCIER_REQUIREMENTS_AND_FOLIATION"));
  assert.equal(Object.isFrozen(gate.blockers),true);
});

test("HC-UX-03A: embedded nonclinical interface review matrix matches source exactly",()=>{
  assert.ok(review,"Expected embedded source-review JSON, no remote files");
  assert.deepEqual(review,SOURCE_REVIEW_MATRIX,"UI review badges must follow same frozen source contract");
  assert.match(html,/data-review-id/);
  assert.match(html,/FALTA COTEJO CON LOS ORIGINALES/);
  assert.match(html,/0 documentos autorizados/);
  assert.match(html,/el expediente de/i);
  assert.match(html,/no una cantidad fija/i);
  assert.doesNotMatch(html,/<(?:form|textarea|input|iframe)\b/i);
  assert.doesNotMatch(html,/https?:\/\/|<script[^>]+src=|<link[^>]+href=/i);
});
