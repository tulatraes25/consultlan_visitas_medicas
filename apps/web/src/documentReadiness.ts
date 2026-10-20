/**
 * WEB-COORD-05: documentary-readiness DEMO with invented records only.
 * These are NOT visits performed, patients, clinical notes or legal signatures.
 * Never derive completion from a scheduled or confirmed coverage.
 */
import {COVERAGES,type Coverage,type Specialty} from "./data";

export type SampleDocument=Readonly<{
  id:string;
  coverageId:string;
  episodeId:string;
  specialty:Specialty;
  serviceDate:string|null;
  recordedAt:string;
  professionalAttestation:"recibida"|"pendiente";
  caregiverAttestationRequired:boolean;
  caregiverAttestation:"recibida"|"pendiente"|"no_aplica";
  correctionRequested:boolean;
  origin:"digital"|"escaneo_pendiente";
}>;
export type FindingKind=
  "cobertura"|"fecha"|"firma_profesional"|"conformidad"|"correccion"|"digitalizacion";
export type Finding=Readonly<{kind:FindingKind;description:string}>;

/** Independent synthetic paperwork fixtures; deliberately not inferred from
 * COVERAGES.status, which does not prove any care actually took place. */
export const SAMPLE_DOCUMENTS:readonly SampleDocument[]=Object.freeze([
  {id:"DOC-001",coverageId:"COB-001",episodeId:"EPI-101",specialty:"Enfermería",
    serviceDate:"2026-10-12",recordedAt:"2026-10-12T10:00:00-03:00",
    professionalAttestation:"recibida",caregiverAttestationRequired:false,
    caregiverAttestation:"no_aplica",correctionRequested:false,origin:"digital"},
  {id:"DOC-002",coverageId:"COB-002",episodeId:"EPI-102",specialty:"Kinesiología",
    serviceDate:"2026-10-12",recordedAt:"2026-10-12T13:00:00-03:00",
    professionalAttestation:"pendiente",caregiverAttestationRequired:false,
    caregiverAttestation:"no_aplica",correctionRequested:false,origin:"digital"},
  {id:"DOC-003",coverageId:"COB-003",episodeId:"EPI-101",specialty:"Enfermería",
    serviceDate:"2026-10-13",recordedAt:"2026-10-13T09:00:00-03:00",
    professionalAttestation:"recibida",caregiverAttestationRequired:true,
    caregiverAttestation:"pendiente",correctionRequested:false,origin:"digital"},
  {id:"DOC-004",coverageId:"COB-004",episodeId:"EPI-104",specialty:"Medicina",
    serviceDate:null,recordedAt:"2026-10-13T12:00:00-03:00",
    professionalAttestation:"recibida",caregiverAttestationRequired:false,
    caregiverAttestation:"no_aplica",correctionRequested:false,origin:"digital"},
  {id:"DOC-005",coverageId:"COB-006",episodeId:"EPI-102",specialty:"Kinesiología",
    serviceDate:"2026-10-14",recordedAt:"2026-10-14T11:00:00-03:00",
    professionalAttestation:"recibida",caregiverAttestationRequired:false,
    caregiverAttestation:"no_aplica",correctionRequested:false,origin:"digital"},
  {id:"DOC-006",coverageId:"COB-008",episodeId:"EPI-103",specialty:"Enfermería",
    serviceDate:"2026-10-14",recordedAt:"2026-10-15T08:00:00-03:00",
    professionalAttestation:"recibida",caregiverAttestationRequired:false,
    caregiverAttestation:"no_aplica",correctionRequested:true,origin:"digital"},
  {id:"DOC-007",coverageId:"COB-009",episodeId:"EPI-101",specialty:"Medicina",
    serviceDate:"2026-10-15",recordedAt:"2026-10-15T12:00:00-03:00",
    professionalAttestation:"recibida",caregiverAttestationRequired:false,
    caregiverAttestation:"no_aplica",correctionRequested:false,origin:"escaneo_pendiente"},
  {id:"DOC-008",coverageId:"COB-010",episodeId:"EPI-103",specialty:"Fonoaudiología",
    serviceDate:"2026-10-16",recordedAt:"2026-10-16T11:00:00-03:00",
    professionalAttestation:"recibida",caregiverAttestationRequired:false,
    caregiverAttestation:"no_aplica",correctionRequested:false,origin:"digital"},
]);

export function documentFindings(
  doc:SampleDocument,coverages:readonly Coverage[]=COVERAGES,
):readonly Finding[]{
  const coverage=coverages.find(c=>c.id===doc.coverageId);
  // No client-confirmed coverage, no documentary eligibility. In particular,
  // repeated overnight calendar cards must never create duplicate documents.
  if(!coverage||coverage.episodeId!==doc.episodeId||
      coverage.specialty!==doc.specialty||coverage.professionalId===null){
    return [{kind:"cobertura",description:"Vínculo de cobertura sin verificar"}];
  }
  const findings:Finding[]=[];
  const validServiceDays=[coverage.start.slice(0,10),coverage.end.slice(0,10)];
  if(!doc.serviceDate||!validServiceDays.includes(doc.serviceDate)){
    findings.push({kind:"fecha",description:"Fecha de prestación ausente o inconsistente"});
  }
  if(doc.professionalAttestation!=="recibida"){
    findings.push({kind:"firma_profesional",
      description:"Constancia de firma profesional pendiente (ejemplo)"});
  }
  if(doc.caregiverAttestationRequired&&doc.caregiverAttestation!=="recibida"){
    findings.push({kind:"conformidad",
      description:"Conformidad del cuidador pendiente (criterio ilustrativo)"});
  }
  if(doc.correctionRequested){
    findings.push({kind:"correccion",
      description:"Corrección documental solicitada: mantener el original"});
  }
  if(doc.origin!=="digital"){
    findings.push({kind:"digitalizacion",
      description:"Digitalización de documentación en papel pendiente"});
  }
  return findings;
}

export function monthlyDocumentSummary(
  documents:readonly SampleDocument[]=SAMPLE_DOCUMENTS,
  coverages:readonly Coverage[]=COVERAGES,
){
  const findings=documents.map(d=>documentFindings(d,coverages));
  const issues=documents.filter((_,i)=>findings[i].length>0).length;
  return Object.freeze({
    total:documents.length,
    noObservations:documents.length-issues,
    withObservations:issues,
    missingDates:findings.filter(f=>f.some(i=>i.kind==="fecha")).length,
    missingProfessional:findings.filter(f=>f.some(i=>i.kind==="firma_profesional")).length,
    missingCaregiver:findings.filter(f=>f.some(i=>i.kind==="conformidad")).length,
    corrections:findings.filter(f=>f.some(i=>i.kind==="correccion")).length,
    pendingScans:findings.filter(f=>f.some(i=>i.kind==="digitalizacion")).length,
  });
}
