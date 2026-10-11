import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {
  HOMECARE_FORM_CONTRACTS,BEDSIDE_PAPER_RECORDS,MONTHLY_DOSSIER,
  inspectFormPreviewRequest,
} from "../src/domain/homecare-form-contracts.mjs";

const html=readFileSync(new URL("../apps/form-prototypes/preview.html",import.meta.url),"utf8");
const catalog=JSON.parse(readFileSync(
  new URL("../apps/mobile/src/formPreviewCatalog.json",import.meta.url),"utf8",
));
const match=html.match(/<script id="hc-catalog" type="application\/json">([^<]+)<\/script>/);
const embedded=match?JSON.parse(match[1]):null;
const appScript=html.match(/<script>\s*([\s\S]+?)<\/script>/)?.[1]??"";
const scopeKeys=new Set(["id","source","specialty","kind","headerFields","rowFields"]);

test("HC-UX-02: HTML embeds exactly the authoritative offline mobile catalog",()=>{
  assert.ok(embedded,"Embedded catalog must exist");
  assert.deepEqual(embedded,catalog,"static demo cannot drift from GitHub source catalog");
  assert.equal(embedded.sourceContract,"HC-03A");
  assert.equal(embedded.mode,"READ_ONLY_STRUCTURE_PREVIEW");
  assert.equal(embedded.templates.length,7);
  assert.equal(embedded.templates.filter(f=>f.kind==="ATTENDANCE").length,6);
  assert.equal(embedded.templates.filter(f=>f.kind==="CLINICAL_EVOLUTION").length,1);
  assert.equal(embedded.paper.length,4);
  assert.equal(embedded.monthlyDossier.status,"REFERENCE_ONLY");
});

test("HC-UX-02: template IDs, header/row IDs, field KIND and labels match source exactly",()=>{
  const expected=Object.values(HOMECARE_FORM_CONTRACTS);
  assert.deepEqual(embedded.templates.map(f=>f.id),expected.map(f=>f.id));
  for(const received of embedded.templates){
    const source=HOMECARE_FORM_CONTRACTS[received.id];
    assert.ok(source,received.id);
    assert.deepEqual(Object.keys(received).sort(),[...scopeKeys].sort(),
      "no independently invented form properties");
    assert.equal(received.source,source.source);
    assert.equal(received.specialty,source.specialty);
    assert.equal(received.kind,source.kind);
    assert.deepEqual(received.headerFields,source.headerFields);
    assert.deepEqual(received.rowFields,source.rowFields);
    assert.equal(source.patientOrigin,"HOMECARE_EPISODE_ONLY");
    assert.equal(source.status,"SOURCE_VERIFIED_STRUCTURE_PENDING_APPROVAL");
    assert.equal(source.submissionEnabled,false);
    assert.equal(source.professionalSigningEnabled,false);
    assert.equal(source.caregiverSigningEnabled,false);
    assert.equal(source.physicalCopyReplaced,false);
    assert.equal(inspectFormPreviewRequest({templateId:source.id,action:"PREVIEW_STRUCTURE"}).allowed,true);
    assert.equal(inspectFormPreviewRequest({templateId:source.id,action:"SUBMIT"}).allowed,false);
  }
});

test("HC-UX-02: paper references stay NON-DIGITAL and dossier is never emitted",()=>{
  assert.deepEqual(embedded.paper.map(p=>p.id),Object.keys(BEDSIDE_PAPER_RECORDS));
  for(const received of embedded.paper){
    const expected=BEDSIDE_PAPER_RECORDS[received.id];
    assert.equal(expected.status,"PAPER_ONLY");
    assert.equal(received.source,expected.source);
    assert.deepEqual(received.confirmedLabels,expected.confirmedLabels);
    assert.deepEqual(received.restrictions,expected.restrictions);
    assert.equal(received.unknownColumns,Boolean(expected.unknownColumns));
    assert.equal(inspectFormPreviewRequest({templateId:received.id,action:"REFERENCE_PAPER_RECORD"}).allowed,true);
    assert.equal(inspectFormPreviewRequest({templateId:received.id,action:"PREVIEW_STRUCTURE"}).allowed,false);
  }
  assert.equal(embedded.monthlyDossier.source,MONTHLY_DOSSIER.source);
  assert.equal(embedded.monthlyDossier.status,MONTHLY_DOSSIER.status);
  assert.equal(MONTHLY_DOSSIER.extractedFieldMap,false);
  assert.equal(MONTHLY_DOSSIER.reproduceOriginalSignatures,false);
});

test("HC-UX-02: no clinical data capture, write endpoint, signature, or false output",()=>{
  assert.match(html,/DEMO SIN VALIDEZ/);
  assert.match(html,/NO EMITIDO/);
  assert.match(html,/0 documentos emitidos/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.doesNotMatch(html,/<(?:input|textarea|form|iframe)\b/i);
  assert.doesNotMatch(html,/https?:\/\/|<script[^>]+src=|<link[^>]+href=/i);
  assert.doesNotMatch(appScript,
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|navigator\.sendBeacon)\s*(?:\(|\.)/);
  assert.doesNotMatch(appScript,/\b(?:apiKey|service_role|SUPABASE_SERVICE|process\.env)\b/);
  assert.match(html,/La evolución no es una constancia de asistencia/);
  assert.match(html,/no reproduce el formato original DOCX\/PDF completo/);
  assert.doesNotMatch(html,/firma\s+registrada|validaci[oó]n\s+completada|documento\s+emitido\s+correctamente/i);
  new Script(appScript,{filename:"apps/form-prototypes/preview.html"});
});

test("HC-UX-02: prototype is explicitly separate from CONSULTLAN clinic roster",()=>{
  assert.match(html,/Internación domiciliaria/);
  assert.match(html,/EPI-DEMO-01/);
  assert.match(html,/OBRA SOCIAL DEMO/);
  assert.match(appScript,/no se elige una profesión/);
  assert.equal(embedded.templates.find(f=>f.id==="NURSING_CAREGIVER_ATTENDANCE")
    .rowFields.find(f=>f.id==="serviceTime").sourceLabel,"Horario");
  assert.equal(embedded.templates.find(f=>f.id==="NUTRITION_ATTENDANCE")
    .headerFields.some(f=>f.id==="sheetDate"),false);
  assert.equal(embedded.templates.find(f=>f.id==="CLINICAL_EVOLUTION")
    .rowFields[0].kind,"CLINICAL_NARRATIVE");
});
