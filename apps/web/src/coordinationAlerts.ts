import {
  COVERAGES,clock,overnight,type Coverage,
} from "./data";

/**
 * WEB-COORD-03: only descriptive, read-only coordination alerts.
 * Never infer approval, clinical continuity, coverage acceptance or a new
 * assignment from adjacent clock times. All inputs are synthetic fixtures.
 */
export type CoordinationAlert=Readonly<{
  coverageId:string;
  start:string;
  kind:"UNASSIGNED"|"HANDOVER_REVIEW";
  title:string;
  detail:string;
}>;

export function deriveCoordinationAlerts(
  coverages:readonly Coverage[]=COVERAGES,
):readonly CoordinationAlert[]{
  const alerts:CoordinationAlert[]=[];
  for(const c of coverages){
    const label=c.type==="SHIFT"?"Guardia":"Visita";
    const schedule=clock(c.start)+" a "+clock(c.end)+
      (overnight(c)?" (finaliza al día siguiente)":"");
    if(c.professionalId===null){
      alerts.push({
        coverageId:c.id,start:c.start,kind:"UNASSIGNED",
        title:label+" "+c.id+" sin asignar",
        detail:schedule+". Requiere asignación y confirmación humana; no es cobertura acreditada.",
      });
    }else if(c.status==="Relevo pendiente"){
      alerts.push({
        coverageId:c.id,start:c.start,kind:"HANDOVER_REVIEW",
        title:"Relevo "+c.id+" pendiente",
        detail:schedule+". No equivale a un pase de guardia confirmado.",
      });
    }
  }
  return alerts.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||
    a.coverageId.localeCompare(b.coverageId));
}
