import React,{useEffect,useRef,useState} from "react";
import {
  DAYS,EPISODES,PROFESSIONALS,COVERAGES,HANDOVERS,SPECIALTIES,
  SERVICE_TIME_ZONE,PERSON_NAME,clock,filterCoverages,overlapsDay,
  coverageDaySlice,overnight,summary,type Coverage,type Specialty,
} from "./data";
import {deriveCoordinationAlerts} from "./coordinationAlerts";

type Section="resumen"|"agenda"|"episodios"|"profesionales"|"relevos"|"reportes";
type Mode="semana"|"dia";
const SECTIONS:readonly {id:Section;label:string;symbol:string}[]=[
  {id:"resumen",label:"Resumen",symbol:"◫"},
  {id:"agenda",label:"Agenda 24/7",symbol:"▦"},
  {id:"episodios",label:"Episodios",symbol:"▤"},
  {id:"profesionales",label:"Profesionales",symbol:"♧"},
  {id:"relevos",label:"Relevos",symbol:"↔"},
  {id:"reportes",label:"Reportes",symbol:"▥"},
];
const PAGE:Record<Section,{title:string;description:string}>={
  resumen:{title:"Panorama operativo",description:"Coberturas y pendientes de coordinación de muestra"},
  agenda:{title:"Agenda domiciliaria",description:"Visitas, guardias y continuidad durante las 24 horas"},
  episodios:{title:"Episodios en seguimiento",description:"Vista operativa por caso, sin historia clínica"},
  profesionales:{title:"Equipo interdisciplinario",description:"Disponibilidad y asignaciones exclusivamente ficticias"},
  relevos:{title:"Relevos pendientes",description:"Decisiones humanas todavía no acreditadas"},
  reportes:{title:"Resumen de gestión",description:"Indicadores de demostración, no aptos para rendición"},
};

function Tag({children,tone="neutral"}:{
  children:React.ReactNode;tone?:"neutral"|"warning"|"danger"|"success";
}){
  return <span className={"tag tag--"+tone}>{children}</span>;
}
function statusTone(c:Coverage):"neutral"|"warning"|"danger"|"success"{
  return !c.professionalId?"danger":c.status==="Relevo pendiente"?"warning":
    c.status==="Confirmada"?"success":"neutral";
}
function CoverageCard({coverage,onEpisode,serviceDay}:{
  coverage:Coverage;onEpisode:(id:string)=>void;serviceDay?:string;
}){
  const kind=coverage.type==="SHIFT"?"Guardia":"Visita";
  const slice=serviceDay?coverageDaySlice(coverage,serviceDay):null;
  const from=slice?clock(new Date(slice.fromMs).toISOString()):clock(coverage.start);
  const to=slice?clock(new Date(slice.toMs).toISOString()):clock(coverage.end);
  const continuation=slice?.continuesFromPreviousDay?" · Continúa desde ayer":
    slice?.continuesToNextDay?" · Sigue mañana":
    !slice&&overnight(coverage)?" · +1 día":"";
  return <button type="button" className={"coverage-card coverage-card--"+statusTone(coverage)}
    aria-label={kind+" de prueba "+coverage.episodeId+" "+from+" a "+to+continuation}
    onClick={()=>onEpisode(coverage.episodeId)}>
    <span className="card-line"><Tag>{kind}</Tag><span>{coverage.episodeId}</span></span>
    <strong>{coverage.specialty}</strong>
    <span className="card-times">{from} — {to}{continuation}</span>
    <span className="card-professional">{PERSON_NAME(coverage.professionalId)}</span>
    <span className="card-state">{coverage.status}</span>
  </button>;
}
function Metrics(){
  const x=summary();
  return <div className="metrics" aria-label="Indicadores ficticios">
    {[
      {value:x.total,label:"Coberturas",note:"Semana de muestra"},
      {value:x.unassigned,label:"Sin profesional",note:"Asignación pendiente"},
      {value:x.pending,label:"Relevos pendientes",note:"Validación humana"},
      {value:x.episodes,label:"Episodios",note:"Códigos inventados"},
    ].map((m,i)=><div key={m.label} className={"metric metric--"+i}>
      <span>{m.label}</span><strong>{m.value.toString().padStart(2,"0")}</strong>
      <small>{m.note}</small>
    </div>)}
  </div>;
}
function Agenda({onEpisode}: {onEpisode:(id:string)=>void}){
  const [mode,setMode]=useState<Mode>("semana");
  const [day,setDay]=useState<string>(DAYS[0].date);
  const [specialty,setSpecialty]=useState<"Todas"|Specialty>("Todas");
  const all=filterCoverages(specialty);
  const today=filterCoverages(specialty,day);
  return <div className="stack">
    <div className="panel filters" aria-label="Opciones de agenda">
      <div className="segment" role="group" aria-label="Visualizar agenda">
        <button type="button" aria-pressed={mode==="semana"}
          className={mode==="semana"?"selected":""} onClick={()=>setMode("semana")}>Semana</button>
        <button type="button" aria-pressed={mode==="dia"}
          className={mode==="dia"?"selected":""} onClick={()=>setMode("dia")}>24 horas</button>
      </div>
      <label>Especialidad
        <select aria-label="Filtrar especialidad" value={specialty}
          onChange={e=>setSpecialty(e.target.value as "Todas"|Specialty)}>
          {SPECIALTIES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label>Jornada
        <select aria-label="Elegir día" value={day} onChange={e=>{
          setDay(e.target.value);setMode("dia");
        }}>
          {DAYS.map(d=><option key={d.date} value={d.date}>
            {d.name} {d.date.slice(-2)}</option>)}
        </select>
      </label>
      <span className="hint">12–18 OCT 2026 · EJEMPLO</span>
    </div>
    <section className="panel calendar" aria-label="Calendario domiciliario de muestra">
      <header className="panel-heading">
        <div><h2>{mode==="semana"?"Semana de coberturas":
          "Jornada del "+DAYS.find(d=>d.date===day)?.name+" "+day.slice(-2)}</h2>
          <p>{mode==="semana"?all.length:today.length} prestaciones diferentes · datos inventados</p>
        </div>
        <Tag tone="warning">Solo lectura</Tag>
      </header>
      {mode==="semana"?
        <div className="week-scroll" role="region" aria-label="Siete días, desplazamiento horizontal" tabIndex={0}>
          <div className="week-grid">
            {DAYS.map(d=><div className="day-column" key={d.date} data-day={d.date}>
              <div className="day-heading"><strong>{d.short}</strong><small>{d.date.slice(-2)}</small></div>
              {all.filter(c=>overlapsDay(c,d.date)).map(c=>
                <CoverageCard key={c.id} coverage={c} serviceDay={d.date} onEpisode={onEpisode}/>)}
              {!all.some(c=>overlapsDay(c,d.date))?<p className="empty">Sin asignaciones en este día</p>:null}
            </div>)}
          </div>
        </div>
        :<div className="day-list" aria-live="polite">
          {today.length?today.map(c=><div key={c.id} className="day-event">
            <div className="day-time">{clock(new Date(coverageDaySlice(c,day)?.fromMs??Date.parse(c.start)).toISOString())}
              <small>{c.start.slice(0,10)<day?"Desde ayer":
                c.end.slice(0,10)>day?"Hasta mañana":"Jornada actual"}</small>
            </div>
            <CoverageCard coverage={c} serviceDay={day} onEpisode={onEpisode}/>
          </div>):<p className="empty">Sin coberturas para este filtro y fecha.</p>}
        </div>}
    </section>
    <p className="notice">
      Las guardias nocturnas aparecen en ambos días, pero son una sola cobertura.
      Ningún estado de esta simulación acredita atención realizada ni garantiza continuidad clínica.
    </p>
  </div>;
}
function EpisodeList({onEpisode}:{onEpisode:(id:string)=>void}){
  return <div className="tile-grid" aria-label="Episodios ficticios">
    {EPISODES.map(x=><button className="episode-tile" key={x.id} type="button"
      aria-label={"Ver episodio ficticio "+x.id} onClick={()=>onEpisode(x.id)}>
      <span className="overline">EPISODIO DOMICILIARIO</span>
      <strong>{x.id}</strong><span>{x.area}</span>
      <p>{x.services.join(" · ")}</p>
      <small>Ver detalle solo informativo →</small>
    </button>)}
  </div>;
}
function Professionals(){
  return <div className="panel responsive-table">
    <table>
      <caption>Profesionales de demostración. No acredita matrícula ni habilitación.</caption>
      <thead><tr><th scope="col">Profesional</th><th scope="col">Especialidad</th>
        <th scope="col">Disponibilidad</th><th scope="col">Coberturas</th></tr></thead>
      <tbody>{PROFESSIONALS.map(p=><tr key={p.id}>
        <td><strong>{p.label}</strong></td><td>{p.specialty}</td>
        <td>{p.availability}</td>
        <td>{COVERAGES.filter(c=>c.professionalId===p.id).length}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
function Handovers(){
  return <div className="stack">
    <p className="notice">La app no sustituye el pase de guardia ni la coordinación telefónica.
      La aprobación requiere procedimiento humano y permisos todavía no implementados.</p>
    <div className="tile-grid">
      {HANDOVERS.map(h=><article className="panel handover-card" key={h.id}>
        <span className="overline">RELEVO · {h.id}</span>
        <h2>{h.stage}</h2><p>{h.message}</p>
        <p className="muted">Cobertura {h.coverageId} · Caso ficticio</p>
        <button type="button" disabled className="disabled-action">Aprobar cambio · deshabilitado</button>
      </article>)}
    </div>
  </div>;
}
function Reports(){
  const s=summary();
  return <div className="stack">
    <div className="panel report">
      <h2>Actividad de la semana ficticia</h2>
      <p>Visitas: {s.visits} · Guardias: {s.shifts} · Sin profesional: {s.unassigned}</p>
      <p className="muted">No representa prestaciones realizadas, documentación completa ni facturación.</p>
      <button type="button" disabled className="disabled-action">Exportar rendición · deshabilitado</button>
    </div>
  </div>;
}
function EpisodeDialog({id,onClose}:{
  id:string|null;onClose:()=>void;
}){
  const element=useRef<HTMLDialogElement>(null);
  const info=EPISODES.find(e=>e.id===id);
  useEffect(()=>{
    const dialog=element.current;
    if(!dialog)return;
    if(id&&!dialog.open){dialog.showModal();}
    if(!id&&dialog.open){dialog.close();}
  },[id]);
  return <dialog ref={element} aria-labelledby="episode-dialog-title"
    onClose={onClose} className="episode-dialog">
    <button type="button" className="dialog-close" aria-label="Cerrar detalle"
      onClick={onClose}>×</button>
    <span className="overline">RESUMEN ADMINISTRATIVO · SOLO DEMO</span>
    <h2 id="episode-dialog-title">Episodio {info?.id??"no disponible"}</h2>
    <p>{info?.area??"Sin ubicación de muestra"}</p>
    <p>Servicios ilustrativos: {info?.services.join(", ")??"ninguno"}</p>
    <p className="notice">
      Sin identidad de paciente, historia clínica, diagnósticos, órdenes ni firmas.
      No se habilitan acciones sobre el episodio.
    </p>
  </dialog>;
}

export function App(){
  const [section,setSection]=useState<Section>("agenda");
  const [selected,setSelected]=useState<string|null>(null);
  return <div className="app-root">
    <div className="demo-strip">
      <strong>PROTOTIPO FUNCIONAL · NO CLÍNICO</strong>
      <span>Datos ficticios · sin red, sin cuentas y sin pacientes reales</span>
    </div>
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">✚</span>
          <div><strong>Pediatrics</strong><small>ATENCIÓN DOMICILIARIA</small></div>
        </div>
        <p className="sidebar-heading">COORDINACIÓN</p>
        <nav aria-label="Módulos de coordinación" className="navigation">
          {SECTIONS.map(s=><button type="button" key={s.id}
            aria-current={section===s.id?"page":undefined}
            className={section===s.id?"nav-current":""}
            onClick={()=>setSection(s.id)}>
            <span className="nav-symbol" aria-hidden="true">{s.symbol}</span>{s.label}
          </button>)}
        </nav>
        <p className="sidebar-footer">Accesos simulados<br/>Sin documentos clínicos</p>
      </aside>
      <main className="content" id="main">
        <header className="page-heading">
          <div><p className="overline">CONSULTLAN · INTERNACIÓN DOMICILIARIA</p>
            <h1>{PAGE[section].title}</h1><p>{PAGE[section].description}</p>
          </div>
          <div className="timezone">⏱ {SERVICE_TIME_ZONE} · UTC−03</div>
        </header>
        {section==="resumen"?<div className="stack">
          <Metrics/>
          <section className="panel">
            <header className="panel-heading"><h2>Atención de coordinación</h2><Tag tone="danger">Requiere revisión humana</Tag></header>
            <div className="alerts" aria-label="Alertas de coberturas ficticias">
              {deriveCoordinationAlerts().map(alert=>
                <p key={alert.coverageId}>
                  <strong>{alert.title}.</strong> {alert.detail}
                </p>)}
            </div>
            <button className="text-action" type="button" onClick={()=>setSection("agenda")}>
              Abrir agenda de muestra →
            </button>
          </section>
        </div>:null}
        {section==="agenda"?<><Metrics/><Agenda onEpisode={setSelected}/></>:null}
        {section==="episodios"?<EpisodeList onEpisode={setSelected}/>:null}
        {section==="profesionales"?<Professionals/>:null}
        {section==="relevos"?<Handovers/>:null}
        {section==="reportes"?<Reports/>:null}
        <footer className="main-footer">
          Candidato C · diseño híbrido de CONSULTLAN · pendiente de aprobación institucional.
          No es un panel operativo, no conecta Supabase ni genera documentación.
        </footer>
      </main>
    </div>
    <EpisodeDialog id={selected} onClose={()=>setSelected(null)}/>
  </div>;
}
