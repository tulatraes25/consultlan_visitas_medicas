/** WEB-COORD-02: synthetic case-first fixture. Never replace with production data. */
export const SERVICE_TIME_ZONE="America/Argentina/Buenos_Aires";
export type Specialty="Enfermería"|"Kinesiología"|"Medicina"|"Fonoaudiología";
export type Coverage=Readonly<{
  id:string;episodeId:string;professionalId:string|null;
  specialty:Specialty;type:"VISIT"|"SHIFT";start:string;end:string;
  status:"Confirmada"|"Asignada"|"Sin asignar"|"Relevo pendiente";
}>;
export const DAYS=[
  {date:"2026-10-12",name:"Lunes",short:"Lun"},
  {date:"2026-10-13",name:"Martes",short:"Mar"},
  {date:"2026-10-14",name:"Miércoles",short:"Mié"},
  {date:"2026-10-15",name:"Jueves",short:"Jue"},
  {date:"2026-10-16",name:"Viernes",short:"Vie"},
  {date:"2026-10-17",name:"Sábado",short:"Sáb"},
  {date:"2026-10-18",name:"Domingo",short:"Dom"},
] as const;
export const EPISODES=[
  {id:"EPI-101",area:"Zona Norte",services:["Enfermería","Medicina"]},
  {id:"EPI-102",area:"Zona Centro",services:["Kinesiología","Enfermería"]},
  {id:"EPI-103",area:"Zona Sur",services:["Fonoaudiología","Enfermería"]},
  {id:"EPI-104",area:"Zona Oeste",services:["Medicina","Kinesiología"]},
] as const;
export const PROFESSIONALS=[
  {id:"PRO-01",label:"Profesional A",specialty:"Enfermería",availability:"12 h · a verificar"},
  {id:"PRO-02",label:"Profesional B",specialty:"Kinesiología",availability:"Visitas programadas"},
  {id:"PRO-03",label:"Profesional C",specialty:"Medicina",availability:"Visitas programadas"},
  {id:"PRO-04",label:"Profesional D",specialty:"Fonoaudiología",availability:"Visitas programadas"},
  {id:"PRO-05",label:"Profesional E",specialty:"Enfermería",availability:"Sin confirmar"},
] as const;
export const COVERAGES:readonly Coverage[]=[
  {id:"COB-001",episodeId:"EPI-101",professionalId:"PRO-01",specialty:"Enfermería",type:"VISIT",start:"2026-10-12T08:30:00-03:00",end:"2026-10-12T09:30:00-03:00",status:"Confirmada"},
  {id:"COB-002",episodeId:"EPI-102",professionalId:"PRO-02",specialty:"Kinesiología",type:"VISIT",start:"2026-10-12T11:00:00-03:00",end:"2026-10-12T12:00:00-03:00",status:"Asignada"},
  {id:"COB-003",episodeId:"EPI-101",professionalId:"PRO-01",specialty:"Enfermería",type:"SHIFT",start:"2026-10-12T20:00:00-03:00",end:"2026-10-13T08:00:00-03:00",status:"Relevo pendiente"},
  {id:"COB-004",episodeId:"EPI-104",professionalId:"PRO-03",specialty:"Medicina",type:"VISIT",start:"2026-10-13T10:00:00-03:00",end:"2026-10-13T11:00:00-03:00",status:"Confirmada"},
  {id:"COB-005",episodeId:"EPI-102",professionalId:null,specialty:"Enfermería",type:"SHIFT",start:"2026-10-13T20:00:00-03:00",end:"2026-10-14T08:00:00-03:00",status:"Sin asignar"},
  {id:"COB-006",episodeId:"EPI-102",professionalId:"PRO-02",specialty:"Kinesiología",type:"VISIT",start:"2026-10-14T09:00:00-03:00",end:"2026-10-14T10:00:00-03:00",status:"Asignada"},
  {id:"COB-007",episodeId:"EPI-104",professionalId:null,specialty:"Kinesiología",type:"VISIT",start:"2026-10-14T16:00:00-03:00",end:"2026-10-14T17:00:00-03:00",status:"Sin asignar"},
  {id:"COB-008",episodeId:"EPI-103",professionalId:"PRO-01",specialty:"Enfermería",type:"SHIFT",start:"2026-10-14T19:00:00-03:00",end:"2026-10-15T07:00:00-03:00",status:"Confirmada"},
  {id:"COB-009",episodeId:"EPI-101",professionalId:"PRO-03",specialty:"Medicina",type:"VISIT",start:"2026-10-15T10:30:00-03:00",end:"2026-10-15T11:30:00-03:00",status:"Asignada"},
  {id:"COB-010",episodeId:"EPI-103",professionalId:"PRO-04",specialty:"Fonoaudiología",type:"VISIT",start:"2026-10-16T09:00:00-03:00",end:"2026-10-16T10:00:00-03:00",status:"Confirmada"},
  {id:"COB-011",episodeId:"EPI-103",professionalId:"PRO-01",specialty:"Enfermería",type:"SHIFT",start:"2026-10-16T20:00:00-03:00",end:"2026-10-17T08:00:00-03:00",status:"Asignada"},
  {id:"COB-012",episodeId:"EPI-104",professionalId:"PRO-02",specialty:"Kinesiología",type:"VISIT",start:"2026-10-17T10:00:00-03:00",end:"2026-10-17T11:00:00-03:00",status:"Asignada"},
  {id:"COB-013",episodeId:"EPI-104",professionalId:"PRO-03",specialty:"Medicina",type:"VISIT",start:"2026-10-18T09:30:00-03:00",end:"2026-10-18T10:30:00-03:00",status:"Asignada"},
];
export const HANDOVERS=[
  {id:"REL-001",coverageId:"COB-003",stage:"Pendiente de confirmación",message:"Requiere autorización humana y comprobación del relevo."},
  {id:"REL-002",coverageId:"COB-005",stage:"Sin reemplazo",message:"Guardia todavía sin profesional confirmado."},
] as const;

export const SPECIALTIES:readonly ("Todas"|Specialty)[]=[
  "Todas","Enfermería","Kinesiología","Medicina","Fonoaudiología",
];
export function nextDate(date:string):string{
  const ms=Date.parse(date+"T00:00:00Z");
  return new Date(ms+86400000).toISOString().slice(0,10);
}
export function overlapsDay(item:Coverage,date:string):boolean{
  if(!DAYS.some(d=>d.date===date))return false;
  const begin=Date.parse(date+"T00:00:00-03:00");
  const end=Date.parse(nextDate(date)+"T00:00:00-03:00");
  return Date.parse(item.start)<end&&Date.parse(item.end)>begin;
}
/** The portion of a visit/shift that actually intersects the service day. */
export function coverageDaySlice(item:Coverage,date:string){
  if(!overlapsDay(item,date))return null;
  const dayStart=Date.parse(date+"T00:00:00-03:00");
  const dayEnd=Date.parse(nextDate(date)+"T00:00:00-03:00");
  const start=Date.parse(item.start),end=Date.parse(item.end);
  return Object.freeze({
    fromMs:Math.max(start,dayStart),
    toMs:Math.min(end,dayEnd),
    continuesFromPreviousDay:start<dayStart,
    continuesToNextDay:end>dayEnd,
  });
}
export function filterCoverages(specialty:"Todas"|Specialty,day?:string):readonly Coverage[]{
  return COVERAGES.filter(c=>(specialty==="Todas"||c.specialty===specialty)&&
    (!day||overlapsDay(c,day))).sort((a,b)=>
    Date.parse(a.start)-Date.parse(b.start)||a.id.localeCompare(b.id));
}
export const PERSON_NAME=(id:string|null):string=>
  PROFESSIONALS.find(p=>p.id===id)?.label??"Sin asignar";
export function clock(instant:string):string{
  return new Intl.DateTimeFormat("es-AR",{timeZone:SERVICE_TIME_ZONE,
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(instant));
}
export function overnight(c:Coverage):boolean{
  return c.start.slice(0,10)!==c.end.slice(0,10);
}
export function summary(){
  return {
    total:COVERAGES.length,visits:COVERAGES.filter(c=>c.type==="VISIT").length,
    shifts:COVERAGES.filter(c=>c.type==="SHIFT").length,
    unassigned:COVERAGES.filter(c=>c.professionalId===null).length,
    pending:COVERAGES.filter(c=>c.status==="Relevo pendiente").length,
    episodes:EPISODES.length,
  };
}
