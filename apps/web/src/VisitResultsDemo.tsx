import React,{useState} from "react";
import {
  EPISODES,SPECIALTIES,SERVICE_TIME_ZONE,type Specialty,
} from "./data";
import {getDemoVisitResults} from "./visitResultsDemoData";
import "./visitResultsDemo.css";

type StatusFilter="Todos"|"Con observaciones"|"Sin observaciones";
type EpisodeFilter="Todos"|string;
const fmtTime=new Intl.DateTimeFormat("es-AR",{
  timeZone:SERVICE_TIME_ZONE,
  day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",
});

export function VisitResultsDemo({onOpenDocumentControl}:{
  onOpenDocumentControl:()=>void;
}){
  const [episode,setEpisode]=useState<EpisodeFilter>("Todos");
  const [specialty,setSpecialty]=useState<"Todas"|Specialty>("Todas");
  const [status,setStatus]=useState<StatusFilter>("Todos");
  const results=getDemoVisitResults();
  const observed=results.filter(x=>x.findings.length>0).length;
  const visible=results.filter(x=>
    (episode==="Todos"||x.episodeId===episode)&&
    (specialty==="Todas"||x.specialty===specialty)&&
    (status==="Todos"||x.status===status));
  return <div className="stack results-demo" data-testid="visit-results-demo">
    <p className="notice">
      <strong>SIMULACIÓN WEB, SIN SINCRONIZACIÓN.</strong> Estos son registros
      inventados de cómo se verían las evoluciones cargadas en una tablet.
      Nadie realizó estas visitas, no hay pacientes ni documentos firmados y
      esta página no recibe ni almacena información de dispositivos.
    </p>
    <section className="panel" aria-label="Circuito de tablet a web de demostración">
      <header className="panel-heading">
        <div>
          <h2>De la tablet a la revisión web</h2>
          <p>Flujo previsto para el sistema de internación domiciliaria.</p>
        </div>
        <span className="tag tag--warning">Conexión pendiente</span>
      </header>
      <ol className="result-workflow">
        <li><strong>Tablet</strong><span>El profesional documenta su visita.</span></li>
        <li><strong>Servidor seguro</strong><span>Verifica identidad, permisos, integridad y firma.</span></li>
        <li><strong>Web de Coordinación</strong><span>Consulta resultados y requisitos pendientes.</span></li>
      </ol>
      <p className="muted result-explain">
        Por ahora los tres pasos son ilustrativos. La transferencia automática se habilitará
        solamente al integrar el Supabase autónomo y certificar el acceso por organización.
      </p>
    </section>
    <section className="panel" aria-label="Resultados ficticios de visitas">
      <header className="panel-heading">
        <div>
          <h2>Resultados de visitas recibidas · ejemplo</h2>
          <p>Octubre 2026 · listado de evoluciones ficticias, ordenadas por fecha de carga.</p>
        </div>
        <button type="button" className="doc-shortcut"
          onClick={onOpenDocumentControl}>
          Abrir control documental
        </button>
      </header>
      <div className="result-stats" aria-label="Contadores de resultados ficticios">
        <div><span>Registros de ejemplo</span>
          <strong data-testid="results-total">{results.length}</strong></div>
        <div><span>Con observaciones</span>
          <strong data-testid="results-observed">{observed}</strong></div>
        <div><span>Sin observaciones de demo</span>
          <strong data-testid="results-unobserved">{results.length-observed}</strong></div>
      </div>
      <div className="result-filters">
        <label>Episodio
          <select aria-label="Filtrar resultados por episodio"
            value={episode} onChange={e=>setEpisode(e.target.value)}>
            <option value="Todos">Todos los episodios</option>
            {EPISODES.map(e=><option value={e.id} key={e.id}>{e.id}</option>)}
          </select>
        </label>
        <label>Especialidad
          <select aria-label="Filtrar resultados por especialidad"
            value={specialty} onChange={e=>setSpecialty(e.target.value as "Todas"|Specialty)}>
            {SPECIALTIES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Estado documental
          <select aria-label="Filtrar resultados por estado documental"
            value={status} onChange={e=>setStatus(e.target.value as StatusFilter)}>
            <option value="Todos">Todos</option>
            <option value="Con observaciones">Con observaciones</option>
            <option value="Sin observaciones">Sin observaciones</option>
          </select>
        </label>
        <span aria-live="polite" className="result-count">
          {visible.length} resultados de prueba
        </span>
      </div>
      <div className="result-list">
        {visible.length?visible.map(result=>
          <article className="result-item" key={result.id}
            data-result-id={result.id}>
            <div className="result-row">
              <div className="result-intro">
                <span className="overline">
                  {result.id} · {result.episodeId} · {result.coverageId}
                </span>
                <h3>{result.specialty} · {result.professional}</h3>
                <p>{result.paperOnly?
                  "Sin contenido digital: pendiente de escanear papel.":
                  result.summary}</p>
                <small>
                  Prestación: {result.serviceDate??"fecha sin informar"} ·
                  Cargado (ejemplo): {fmtTime.format(new Date(result.enteredAt))}
                </small>
              </div>
              <span className={"result-badge "+(result.findings.length?
                "result-badge--pending":"result-badge--clear")}>
                {result.status}
              </span>
            </div>
            <details className="result-detail">
              <summary>Ver evolución de muestra {result.id}</summary>
              <div className="result-detail-content">
                <div>
                  <h4>Registro ilustrativo</h4>
                  {result.paperOnly?<p className="notice">
                    El archivo de papel aún no fue digitalizado. No se puede
                    consultar una evolución que no está disponible.
                  </p>:<>
                    <p>{result.summary}</p>
                    <dl className="result-field-list">
                      {result.observations.map(field=>
                        <div key={field.label}>
                          <dt>{field.label}</dt><dd>{field.value}</dd>
                        </div>)}
                    </dl>
                  </>}
                </div>
                <div>
                  <h4>Estado documental (solo ejemplo)</h4>
                  <p>Firma profesional: {result.professionalAttestation==="pendiente"?
                    "Pendiente":"Indicador ficticio recibido, NO validado"}</p>
                  <p>Conformidad cuidador: {result.caregiverAttestation==="pendiente"?
                    "Pendiente":result.caregiverAttestation==="recibida"?
                    "Indicador ficticio recibido, NO validado":"No solicitada en este ejemplo"}</p>
                  {result.findings.length?<ul className="result-findings">
                    {result.findings.map(item=>
                      <li key={item.kind}>{item.description}</li>)}
                  </ul>:<p>Sin observaciones en las reglas de demostración.
                    Requiere revisión humana antes de cualquier presentación.</p>}
                </div>
              </div>
            </details>
          </article>):<p className="empty">
            No hay resultados ficticios para estos filtros.
          </p>}
      </div>
      <footer className="result-actions">
        <p className="muted">
          Pantalla de lectura. No permite modificar evoluciones, aprobar firmas,
          cerrar expedientes ni exportar una historia clínica.
        </p>
        <button type="button" disabled className="disabled-action">
          Descargar historia clínica · no disponible
        </button>
      </footer>
    </section>
  </div>;
}
