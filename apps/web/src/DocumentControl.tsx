import React,{useState} from "react";
import {EPISODES,PERSON_NAME,COVERAGES} from "./data";
import {
  SAMPLE_DOCUMENTS,documentFindings,monthlyDocumentSummary,
} from "./documentReadiness";
import "./documentControl.css";
import {TabletSignaturePractice} from "./TabletSignaturePractice";

/**
 * Demonstration ONLY. Cannot edit, sign, scan, upload, persist, export, close
 * or certify any patient document. It deliberately uses invented identifiers.
 */
export function DocumentControl({onOpenResults}:{onOpenResults:()=>void}){
  const [episode,setEpisode]=useState("Todos");
  const [showSignaturePractice,setShowSignaturePractice]=useState(false);
  const [view,setView]=useState<"Todas"|"Con observaciones"|"Sin observaciones">("Todas");
  const stats=monthlyDocumentSummary();
  const visible=SAMPLE_DOCUMENTS.filter(doc=>{
    const pending=documentFindings(doc).length>0;
    return (episode==="Todos"||doc.episodeId===episode)&&
      (view==="Todas"||(view==="Con observaciones"?pending:!pending));
  });
  return <div className="stack doc-control" data-testid="document-control">
    <div className="notice">
      <strong>SIMULACIÓN · OCTUBRE 2026.</strong> No representa prestaciones realizadas,
      firmas válidas, expedientes completos ni una historia clínica.
      Los criterios de conformidad y presentación deberán definirse con Pediatrics y Laura.
    </div>
    <section className="panel" aria-label="Consulta de registros desde la web">
      <header className="panel-heading">
        <div>
          <h2>Consultar las evoluciones en la web</h2>
          <p>Vista de los registros de muestra tal como los revisaría Coordinación,
            con fecha de carga, profesional y documentación pendiente.</p>
        </div>
        <button type="button" className="doc-shortcut"
          onClick={onOpenResults}>Ver resultados de visitas</button>
      </header>
      <p className="muted">Los registros fueron inventados para esta demostración;
        todavía no hay transferencia desde la tablet.</p>
    </section>
    <section className="panel" aria-label="Precontrol mensual de ejemplo">
      <header className="panel-heading">
        <div>
          <h2>Preparación documental de octubre</h2>
          <p>Comprobar requisitos antes de intentar presentar el expediente mensual.</p>
        </div>
        <span className="tag tag--warning">Cierre deshabilitado</span>
      </header>
      <div className="doc-metrics" aria-label="Indicadores de documentación simulada">
        <div><small>Documentos ficticios</small>
          <strong data-testid="doc-total">{stats.total}</strong></div>
        <div><small>Con observaciones</small>
          <strong data-testid="doc-blocked">{stats.withObservations}</strong></div>
        <div><small>Sin observaciones de esta demo</small>
          <strong data-testid="doc-ready">{stats.noObservations}</strong></div>
      </div>
      <label className="doc-progress-label" htmlFor="doc-progress">
        Sin observaciones ilustrativas: {stats.noObservations} de {stats.total}
      </label>
      <progress id="doc-progress" max={stats.total||1} value={stats.noObservations}>
        {stats.noObservations} de {stats.total}
      </progress>
      <p className="muted doc-footnote">
        Que un documento pase estas reglas ficticias no autoriza su firma,
        cierre clínico ni presentación ante una obra social.
      </p>
      <div className="doc-overview" aria-label="Motivos de pendientes">
        <span>Fechas: <strong>{stats.missingDates}</strong></span>
        <span>Firmas profesionales: <strong>{stats.missingProfessional}</strong></span>
        <span>Conformidades: <strong>{stats.missingCaregiver}</strong></span>
        <span>Correcciones: <strong>{stats.corrections}</strong></span>
        <span>Escaneos: <strong>{stats.pendingScans}</strong></span>
      </div>
    </section>
    <section className="panel" aria-label="Revisión de documentos de muestra">
      <header className="panel-heading">
        <div>
          <h2>Control de evoluciones y constancias</h2>
          <p>Una fila por documento inventado, sin duplicar guardias nocturnas.</p>
        </div>
        <button type="button" className="doc-shortcut"
          onClick={()=>setView("Con observaciones")}>
          Ver pendientes
        </button>
      </header>
      <div className="doc-filters">
        <label>Estado
          <select aria-label="Filtrar documentación por estado"
            value={view}
            onChange={e=>setView(e.target.value as typeof view)}>
            <option value="Todas">Todas</option>
            <option value="Con observaciones">Con observaciones</option>
            <option value="Sin observaciones">Sin observaciones</option>
          </select>
        </label>
        <label>Episodio ficticio
          <select aria-label="Filtrar documentación por episodio"
            value={episode} onChange={e=>setEpisode(e.target.value)}>
            <option value="Todos">Todos los episodios</option>
            {EPISODES.map(e=><option key={e.id} value={e.id}>{e.id}</option>)}
          </select>
        </label>
        <span className="doc-result-count" aria-live="polite">
          {visible.length} documentos de muestra
        </span>
      </div>
      <div className="doc-list">
        {visible.length?visible.map(doc=>{
          const problems=documentFindings(doc);
          const coverage=COVERAGES.find(c=>c.id===doc.coverageId);
          return <article className="doc-item" data-doc-id={doc.id} key={doc.id}>
            <div className="doc-item-head">
              <div>
                <span className="overline">{doc.id} · {doc.episodeId}</span>
                <h3>{doc.specialty} · {doc.coverageId}</h3>
                <span className="doc-meta">
                  {doc.serviceDate??"Fecha sin completar"} · {PERSON_NAME(coverage?.professionalId??null)}
                </span>
              </div>
              <span className={"doc-status "+(problems.length?"doc-status--pending":"doc-status--ok")}>
                {problems.length?"Con observaciones":"Sin observaciones"}
              </span>
            </div>
            <details className="doc-details">
              <summary>Ver comprobaciones ({problems.length} pendientes)</summary>
              {problems.length?
                <ul>{problems.map(f=><li key={f.kind}>{f.description}</li>)}</ul>:
                <p>No se detectaron faltantes en estas reglas de demostración.
                  Se requiere validación humana e institucional.</p>}
              <p className="doc-meta">
                Registro ficticio: {doc.recordedAt.slice(0,10)} ·
                Origen: {doc.origin==="digital"?"digital":"papel por escanear"}
              </p>
            </details>
          </article>;
        }):<p className="empty">No hay documentos de muestra para estos filtros.</p>}
      </div>
    </section>
    <section className="panel signature-practice-example"
      aria-label="Práctica de firma en tablet sin guardar">
      <span className="overline">TABLET · DEDO O BIROME CAPACITIVA</span>
      <h2>Un recuadro amplio para firmar</h2>
      <p className="muted">
        Así podrá practicarse el gesto de una firma directamente en una tablet,
        incluso con una lapicera capacitiva económica sin Bluetooth.
        El profesional y el cuidador autorizado tendrán circuitos diferentes.
      </p>
      <button type="button" className="signature-practice-try"
        onClick={()=>setShowSignaturePractice(true)}>
        Probar recuadro táctil de firma · sin guardar
      </button>
    </section>
    <section className="panel doc-final-gate" aria-label="Control de cierre no habilitado">
      <div>
        <h2>Expediente mensual</h2>
        <p>El cierre y la generación de PDF solo se habilitarán después de
          verificar identidad, integridad documental, requisitos de firma,
          permisos y aprobación institucional en el servidor.</p>
      </div>
      <button type="button" disabled className="disabled-action">
        Preparar expediente mensual · deshabilitado
      </button>
    </section>
    <TabletSignaturePractice open={showSignaturePractice}
      onClose={()=>setShowSignaturePractice(false)}/>
  </div>;
}
