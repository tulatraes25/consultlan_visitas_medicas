/**
 * WEB-COORD-07: imaginary tablet-origin visit records in the standalone
 * coordination web demo. NO device upload, database read or clinical event.
 * Only these invented values may be rendered without authenticated RLS.
 */
import {COVERAGES,PERSON_NAME,type Coverage,type Specialty} from "./data";
import {
  SAMPLE_DOCUMENTS,documentFindings,
  type SampleDocument,type Finding,
} from "./documentReadiness";

type SampleField=Readonly<{label:string;value:string}>;
type SampleEvolution=Readonly<{
  documentId:string;
  summary:string;
  observations:readonly SampleField[];
  paperOnly?:boolean;
}>;
export type DemoVisitResult=Readonly<{
  id:string;
  coverageId:string;
  episodeId:string;
  professional:string;
  specialty:Specialty;
  serviceDate:string|null;
  enteredAt:string;
  summary:string;
  observations:readonly SampleField[];
  paperOnly:boolean;
  professionalAttestation:"recibida"|"pendiente";
  caregiverAttestation:"recibida"|"pendiente"|"no_aplica";
  findings:readonly Finding[];
  status:"Con observaciones"|"Sin observaciones";
}>;

/**
 * Fictional sample notes for demonstrating how entries made on a tablet
 * could eventually be viewed in a restricted web portal. A confirmed
 * scheduled visit or a drawn canvas is NEVER evidence of clinical work.
 */
const SAMPLE_EVOLUTIONS:readonly SampleEvolution[]=[
  {documentId:"DOC-001",summary:"Evolución de enfermería de ejemplo: controles simulados.",
    observations:[
      {label:"Temperatura ficticia",value:"36,7 °C · solo ilustrativa"},
      {label:"Pulso ficticio",value:"84 lpm · solo ilustrativo"},
    ]},
  {documentId:"DOC-002",summary:"Evolución de kinesiología de ejemplo: no corresponde a una atención.",
    observations:[{label:"Actividad ficticia",value:"Registro de movilidad de demostración"}]},
  {documentId:"DOC-003",summary:"Guardia de enfermería simulada: una cobertura nocturna.",
    observations:[{label:"Registro de guardia",value:"Una sola cobertura 20:00–08:00, sin duplicación"}]},
  {documentId:"DOC-004",summary:"Evaluación médica de prueba sin información de pacientes.",
    observations:[{label:"Campo de muestra",value:"Pendiente de definir según planilla institucional"}]},
  {documentId:"DOC-005",summary:"Kinesiología: ejemplo estructurado de nota profesional.",
    observations:[{label:"Campo de prueba",value:"Práctica documental ficticia"}]},
  {documentId:"DOC-006",summary:"Ejemplo de evolución durante una guardia; corrección pendiente.",
    observations:[{label:"Observación ficticia",value:"Una adenda debería conservar el registro original"}]},
  {documentId:"DOC-007",
    summary:"Documento de papel pendiente de digitalización: evolución NO disponible.",
    observations:[],paperOnly:true},
  {documentId:"DOC-008",summary:"Evolución de fonoaudiología ficticia, no realizada.",
    observations:[{label:"Actividad ficticia",value:"Ejemplo de registro interdisciplinario"}]},
];

/** Fail closed on unlinked or conflicting document/coverage/sample rows. */
export function getDemoVisitResults(
  docs:readonly SampleDocument[]=SAMPLE_DOCUMENTS,
  coverages:readonly Coverage[]=COVERAGES,
  samples:readonly SampleEvolution[]=SAMPLE_EVOLUTIONS,
):readonly DemoVisitResult[]{
  const seen=new Set<string>();
  const results:DemoVisitResult[]=[];
  for(const doc of docs){
    if(seen.has(doc.id))continue;
    seen.add(doc.id);
    const coverage=coverages.find(c=>c.id===doc.coverageId);
    const examples=samples.filter(example=>example.documentId===doc.id);
    if(!coverage||coverage.professionalId===null||
       coverage.episodeId!==doc.episodeId||
       coverage.specialty!==doc.specialty||examples.length!==1){
      continue;
    }
    const sample=examples[0];
    if(sample.paperOnly&&sample.observations.length)continue;
    const findings=documentFindings(doc,coverages);
    results.push(Object.freeze({
      id:doc.id,coverageId:doc.coverageId,episodeId:doc.episodeId,
      professional:PERSON_NAME(coverage.professionalId),
      specialty:doc.specialty,serviceDate:doc.serviceDate,
      enteredAt:doc.recordedAt,summary:sample.summary,
      observations:sample.paperOnly?[]:sample.observations,
      paperOnly:sample.paperOnly===true,
      professionalAttestation:doc.professionalAttestation,
      caregiverAttestation:doc.caregiverAttestation,
      findings,
      status:findings.length?"Con observaciones":"Sin observaciones",
    }));
  }
  return results.sort((a,b)=>Date.parse(b.enteredAt)-Date.parse(a.enteredAt)||
    a.id.localeCompare(b.id));
}
