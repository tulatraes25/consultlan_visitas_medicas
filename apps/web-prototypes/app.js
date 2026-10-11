/* WEB-COORD-01A — Offline-only visual prototype. All values are fictitious. */
(function () {
  "use strict";
  const data = window.CONSULTLAN_WEB_DEMO;
  const host = document.getElementById("app");
  const modal = document.getElementById("episode-modal");
  const modalBody = document.getElementById("episode-modal-content");
  if (!data || !host || !modal || !modalBody) throw new Error("Missing offline demo assets");

  const state = { variant: "c", section: "agenda", mode: "semana", day: data.DAYS[0].date, specialty: "Todas" };
  const sections = [
    { key: "resumen", label: "Resumen", icon: "dashboard" },
    { key: "agenda", label: "Agenda 24/7", icon: "calendar" },
    { key: "episodios", label: "Episodios", icon: "folder" },
    { key: "profesionales", label: "Profesionales", icon: "users" },
    { key: "relevos", label: "Relevos", icon: "repeat" },
    { key: "reportes", label: "Reportes", icon: "chart" },
  ];
  const titles = {
    resumen: ["Panorama operativo", "Vista consolidada de las coberturas domiciliarias"],
    agenda: ["Agenda de coberturas", "Visitas, guardias y continuidad entre días"],
    episodios: ["Episodios domiciliarios", "Seguimiento administrativo por episodio"],
    profesionales: ["Equipo interdisciplinario", "Disponibilidad y asignaciones por especialidad"],
    relevos: ["Relevos y contingencias", "Solicitudes y validaciones humanas pendientes"],
    reportes: ["Resumen de gestión", "Indicadores ilustrativos, no liquidables"],
  };
  const glyph = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 2v6M16 2v6M3 11h18"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M19 20v-2a5 5 0 0 0-3-4.6"/>',
    repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
    chart: '<path d="M4 20V11M10 20V4M16 20v-8M22 20v-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    chevron: '<path d="m8 5 7 7-7 7"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    shield: '<path d="m12 2 9 4v6c0 5-3 8-9 10-6-2-9-5-9-10V6z"/><path d="m9 12 2 2 4-4"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  };
  function icon(name, extra) {
    return '<svg class="ico ' + (extra || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' + (glyph[name] || glyph.layers) + "</svg>";
  }
  function esc(value) {
    return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function tag(label, tone) { return '<span class="tag tag--' + (tone || "neutral") + '">' + esc(label) + "</span>"; }
  function tone(event) {
    if (!event.professionalId) return "danger";
    if (event.status === "Relevo pendiente") return "warning";
    if (event.status === "Confirmada") return "success";
    return "neutral";
  }
  function eventHours(e) {
    return data.formatClock(e.start) + " — " + data.formatClock(e.end) + (data.isOvernight(e) ? " · +1 día" : "");
  }
  function type(e) { return e.type === "SHIFT" ? "Guardia" : "Visita"; }
  function forFilter(obj) { return data.filterCoverages(Object.assign({ specialty: state.specialty }, obj || {})); }
  function sectionButton(item) {
    const current = state.section === item.key;
    return '<button type="button" data-section="' + item.key + '" class="nav-item ' +
      (current ? "is-current" : "") + '" aria-current="' + (current ? "page" : "false") +
      '">' + icon(item.icon) + '<span>' + esc(item.label) + "</span>" +
      (current ? '<span class="nav-indicator" aria-hidden="true"></span>' : "") + "</button>";
  }
  function brand() {
    return '<div class="product-brand"><span class="brand-symbol" aria-hidden="true">✚</span>' +
      '<span><strong>Pediatrics</strong><small>ATENCIÓN DOMICILIARIA</small></span></div>';
  }
  function sidebar() {
    return '<aside class="sidebar">' + brand() +
      '<div class="sidebar-overline">ESPACIO DE COORDINACIÓN</div>' +
      '<nav class="primary-nav" aria-label="Módulos de demostración">' +
      sections.map(sectionButton).join("") + '</nav>' +
      '<div class="sidebar-bottom">' + icon("shield") +
      '<span>Accesos simulados<small>Sin datos clínicos</small></span></div>' +
      "</aside>";
  }
  function topnav() {
    return '<nav class="topnav" aria-label="Módulos de demostración">' +
      sections.map(sectionButton).join("") + "</nav>";
  }
  function toolbar() {
    return '<div class="toolbar"><div class="heading"><p class="eyebrow">COORDINACIÓN / ' +
      esc(titles[state.section][0].toUpperCase()) + '</p><h1>' +
      esc(titles[state.section][0]) + '</h1><p class="heading-sub">' +
      esc(titles[state.section][1]) + '</p></div>' +
      '<div class="toolbar-end"><span class="tz-label">' + icon("clock") +
      'America/Argentina/Buenos_Aires · UTC−03</span>' +
      '<div class="avatar" aria-label="Perfil de coordinación ficticio">CO</div></div></div>';
  }
  function metric(value, label, detail, kind, glyphName) {
    return '<div class="metric metric--' + (kind || "default") + '">' +
      '<div class="metric-top"><span>' + esc(label) + '</span>' + icon(glyphName || "layers") + '</div>' +
      '<div class="metric-value">' + esc(value) + '</div><div class="metric-detail">' + esc(detail) + '</div></div>';
  }
  function metrics() {
    const s = data.summary();
    return '<div class="metrics-grid">' +
      metric(s.total, "Coberturas / semana", "Datos sintéticos", "default", "calendar") +
      metric(s.unassigned, "Sin profesional", "Requieren coordinación", "danger", "users") +
      metric(s.pendingRelief, "Relevos pendientes", "Validación humana", "warning", "repeat") +
      metric(s.episodes, "Episodios activos", "Códigos inventados", "success", "folder") +
      "</div>";
  }
  function filters() {
    const options = ["Todas", "Enfermería", "Kinesiología", "Medicina", "Fonoaudiología"];
    return '<div class="filterbar">' +
      '<div class="segmented" role="group" aria-label="Modo de agenda">' +
      '<button data-mode="semana" aria-pressed="' + (state.mode === "semana") + '" class="' +
      (state.mode === "semana" ? "active" : "") + '">Semana</button>' +
      '<button data-mode="dia" aria-pressed="' + (state.mode === "dia") + '" class="' +
      (state.mode === "dia" ? "active" : "") + '">24 horas</button></div>' +
      '<label class="select-label">Especialidad <select id="specialty-filter" aria-label="Filtrar especialidad">' +
      options.map(function (o) { return '<option value="' + esc(o) + '" ' + (state.specialty === o ? "selected" : "") + ">" + esc(o) + "</option>"; }).join("") +
      '</select></label><label class="select-label">Jornada <select id="day-filter" aria-label="Elegir día">' +
      data.DAYS.map(function (d) { return '<option value="' + d.date + '" ' +
        (state.day === d.date ? "selected" : "") + ">" + esc(d.full) + "</option>"; }).join("") +
      '</select></label><span class="filter-caption">12–18 OCT 2026 · DEMO</span></div>';
  }
  function eventCard(e, compact) {
    const title = esc(e.episodeId);
    const p = esc(data.personName(e.professionalId));
    return '<button type="button" class="event-card event-card--' + tone(e) +
      (compact ? " event-card--compact" : "") +
      '" data-episode="' + esc(e.episodeId) + '" aria-label="Ver episodio ficticio ' + title +
      ' de ' + esc(type(e)) + ' ' + esc(eventHours(e)) + '">' +
      '<span class="event-top">' + tag(type(e), e.type === "SHIFT" ? "navy" : "light") +
      '<span class="event-id">' + title + '</span></span>' +
      '<strong>' + esc(e.specialty) + '</strong><span class="event-hours">' + icon("clock") +
      esc(eventHours(e)) + '</span><span class="event-person">' + p + '</span>' +
      (compact ? "" : '<span class="event-status">' + esc(e.status) + "</span>") +
      "</button>";
  }
  function empty(label) { return '<p class="empty">' + esc(label || "Sin coberturas en este período.") + "</p>"; }
  function daysHeader() {
    return data.DAYS.map(function (d) {
      return '<div class="week-day-head"><strong>' + esc(d.short) + '</strong>' +
        '<span>' + esc(d.date.slice(-2)) + '</span></div>';
    }).join("");
  }
  function weekPlanner(flavor) {
    const columns = data.DAYS.map(function (d) {
      const rows = forFilter({ day: d.date });
      return '<div class="week-day" data-day="' + d.date + '">' +
        (rows.length ? rows.map(function (e) { return eventCard(e, true); }).join("") : empty("Sin asignaciones")) + "</div>";
    }).join("");
    return '<div class="panel planner-panel"><div class="panel-heading"><div><span class="eyebrow">SEMANA DE PRUEBA · 24/7</span>' +
      '<h2>' + (flavor === "b" ? "Tablero de asignaciones" : "Planificador semanal") + '</h2>' +
      '</div><span class="legend">' + tag("Guardia", "navy") + tag("Visita", "light") + tag("Sin asignar", "danger") + '</span></div>' +
      '<div class="week-scroll"><div class="week-grid week-grid--' + flavor + '">' +
      '<div class="week-headings">' + daysHeader() + '</div><div class="week-columns">' +
      columns + '</div></div></div><p class="panel-footnote">' +
      'Las guardias que atraviesan medianoche se ven en ambos días. Un relevo pendiente no equivale a una atención confirmada.' +
      '</p></div>';
  }
  function institutionalTable() {
    const rows = forFilter();
    return '<section class="panel"><div class="panel-heading"><div><span class="eyebrow">VISTA ADMINISTRATIVA</span>' +
      '<h2>Registro de coberturas semanales</h2></div>' + tag("Solo lectura", "light") + "</div>" +
      '<div class="table-scroll"><table><thead><tr><th>Episodio</th><th>Prestación</th>' +
      '<th>Profesional</th><th>Horario del servicio</th><th>Estado</th><th>Acceso</th></tr></thead><tbody>' +
      rows.map(function (e) {
        return '<tr><td><strong>' + esc(e.episodeId) + '</strong><small>' + esc(e.id) +
          '</small></td><td>' + tag(type(e), e.type === "SHIFT" ? "navy" : "light") +
          '<small>' + esc(e.specialty) + '</small></td><td>' + esc(data.personName(e.professionalId)) +
          '</td><td><strong>' + esc(e.start.slice(8, 10)) + '/10 · ' + esc(eventHours(e)) +
          '</strong></td><td>' + tag(e.status, tone(e)) + '</td><td><button type="button" class="link-btn" data-episode="' +
          esc(e.episodeId) + '">Ver episodio ' + icon("chevron") + "</button></td></tr>";
      }).join("") +
      '</tbody></table></div></section>';
  }
  function dayTimeline() {
    const rows = forFilter({ day: state.day });
    const ticks = Array.from({ length: 13 }, function (_, i) {
      const hour = i * 2;
      return '<div class="time-ruler-tick" style="top:' + (hour / 24 * 100) +
        '%"><span>' + String(hour).padStart(2, "0") + ':00</span></div>';
    }).join("");
    const blocks = rows.map(function (e, i) {
      const range = data.daySlice(e, state.day);
      if (!range) return "";
      const start = range.fromMinute / 1440 * 100;
      const height = Math.max(1.75, (range.toMinute - range.fromMinute) / 1440 * 100);
      const lane = i % 2 === 0 ? "lane-a" : "lane-b";
      const extra = range.continuesFromPreviousDay ? " · continúa" :
        range.continuesToNextDay ? " · continúa mañana" : "";
      return '<button type="button" class="time-block time-block--' + tone(e) + " " + lane +
        '" style="top:' + start.toFixed(3) + "%;height:" + height.toFixed(3) +
        '%;" data-episode="' + esc(e.episodeId) + '">' +
        '<strong>' + esc(e.episodeId) + " · " + esc(type(e)) + '</strong><span>' +
        esc(e.specialty + " · " + data.formatClock(e.start) + "–" + data.formatClock(e.end) + extra) +
        "</span></button>";
    }).join("");
    return '<section class="panel"><div class="panel-heading"><div><span class="eyebrow">24 HORAS · ZONA UTC−03</span>' +
      '<h2>Jornada ' + esc(data.DAYS.find(function (x) { return x.date === state.day; }).full) +
      "</h2></div>" + tag(rows.length + " coberturas visibles", "light") +
      '</div><div class="timeline"><div class="timeline-ruler">' + ticks +
      '</div><div class="timeline-track">' + blocks + '</div></div>' +
      '<p class="panel-footnote">Los bloques muestran solo la porción de cada cobertura dentro de esta jornada. ' +
      'No hay confirmaciones ni acciones clínicas reales.</p></section>';
  }
  function unassignedQueue() {
    const open = forFilter().filter(function (e) { return !e.professionalId; });
    return '<section class="panel queue-panel"><div class="panel-heading"><div><span class="eyebrow">NECESITAN GESTIÓN</span>' +
      '<h2>Sin asignar</h2></div>' + tag(open.length, "danger") + "</div><div class=\"queue-items\">" +
      open.map(function (e) {
        return '<button type="button" class="queue-item" data-episode="' + esc(e.episodeId) + '">' +
          '<span class="queue-rail"></span><span><strong>' + esc(e.episodeId) + ' · ' +
          esc(type(e)) + '</strong><small>' + esc(e.specialty + " · " + eventHours(e)) +
          '</small><em>Sin profesional confirmado</em></span>' + icon("chevron") + "</button>";
      }).join("") + "</div></section>";
  }
  function legendText() {
    return '<div class="read-only-note">' + icon("shield") +
      '<span>Diseño demostrativo, sin operaciones ni pacientes reales. ' +
      'La aprobación de relevos y la activación de planes clínicos están bloqueadas.</span></div>';
  }
  function rail() {
    const count = data.ALERTS.length;
    return '<aside class="insights" aria-label="Alertas operativas ficticias">' +
      '<section class="insight-card"><div class="insight-title">' +
      '<div><span class="eyebrow">PRIORIDADES</span><h3>Atención requerida</h3></div>' +
      '<span class="insight-count">' + count + '</span></div>' +
      data.ALERTS.map(function (a) {
        const e = data.COVERAGES.find(function (x) { return x.id === a.coverageId; });
        return '<button class="alert-item" type="button" data-episode="' + esc(e.episodeId) + '">' +
          '<span class="alert-dot alert-dot--' + a.tone + '"></span><span><strong>' + esc(a.label) +
          '</strong><small>' + esc(a.detail) + '</small><em>' + esc(e.episodeId) +
          '</em></span>' + icon("chevron") + '</button>';
      }).join("") + '</section><section class="insight-card insight-card--muted">' +
      '<span class="eyebrow">RELEVO A CONTROLAR</span><h3>Confirmación pendiente</h3>' +
      '<p>Un cambio de guardia requiere propuesta, aceptación y autorización de Coordinación.</p>' +
      '<button type="button" class="small-action" data-section="relevos">Ver circuito ' +
      icon("chevron") + '</button></section></aside>';
  }
  function agenda() {
    const content = state.mode === "dia" ? dayTimeline() :
      state.variant === "a" ? institutionalTable() : weekPlanner(state.variant);
    if (state.variant === "b") {
      return '<div class="agenda-layout agenda-layout--ops"><div>' + content + '</div>' +
        '<div class="ops-queue">' + unassignedQueue() + legendText() + '</div></div>';
    }
    if (state.variant === "a") {
      return '<div class="section-stack">' + content + legendText() + "</div>";
    }
    return '<div class="section-stack">' + content + unassignedQueue() + legendText() + "</div>";
  }
  function overview() {
    const rows = forFilter();
    return '<div class="section-stack">' + metrics() +
      '<div class="overview-grid"><section class="panel"><div class="panel-heading"><div>' +
      '<span class="eyebrow">VENTANA DE PRUEBA</span><h2>Próximas coberturas</h2></div>' +
      '<button type="button" class="link-btn" data-section="agenda">Abrir agenda ' + icon("chevron") + '</button></div>' +
      '<div class="compact-list">' + rows.slice(0, 5).map(function (e) {
        return '<button type="button" data-episode="' + esc(e.episodeId) + '" class="compact-row">' +
          '<span class="compact-icon ' + (e.type === "SHIFT" ? "shift-icon" : "") + '">' +
          icon(e.type === "SHIFT" ? "clock" : "calendar") + '</span><span><strong>' + esc(e.episodeId) +
          " · " + esc(e.specialty) + '</strong><small>' + esc(eventHours(e)) + '</small></span>' +
          tag(e.status, tone(e)) + '</button>';
      }).join("") + "</div></section>" + unassignedQueue() + "</div>" +
      legendText() + "</div>";
  }
  function episodes() {
    return '<section class="panel"><div class="panel-heading"><div><span class="eyebrow">GESTIÓN DE EPISODIOS</span>' +
      '<h2>Listado administrativo</h2></div>' + tag("Solo identificadores inventados", "light") + '</div>' +
      '<div class="episode-grid">' + data.EPISODES.map(function (e) {
        const count = data.COVERAGES.filter(function (x) { return x.episodeId === e.id; }).length;
        return '<button type="button" data-episode="' + esc(e.id) + '" class="episode-tile">' +
          '<div class="episode-icon">' + icon("folder") + '</div><span><strong>' + esc(e.id) +
          '</strong><small>' + esc(e.area) + '</small></span><span class="episode-total">' + count +
          '<small>coberturas</small></span><span class="episode-services">' +
          e.services.map(function (s) { return tag(s, "light"); }).join("") +
          '</span></button>';
      }).join("") + '</div></section>';
  }
  function professionals() {
    return '<div class="section-stack"><section class="panel"><div class="panel-heading"><div>' +
      '<span class="eyebrow">RECURSOS HUMANOS</span><h2>Equipo de demostración</h2></div>' +
      tag(data.PROFESSIONALS.length + " fichas sintéticas", "light") + '</div><div class="professionals-grid">' +
      data.PROFESSIONALS.map(function (p, index) {
        const count = data.COVERAGES.filter(function (x) { return x.professionalId === p.id; }).length;
        return '<div class="professional-card"><div class="person-top"><span class="person-avatar">' +
          String.fromCharCode(65 + index) + '</span>' + tag(p.state, p.state === "A verificar" ? "warning" : "success") +
          '</div><h3>' + esc(p.label) + '</h3><p>' + esc(p.specialty) + '</p><div class="person-foot">' +
          '<span>' + icon("calendar") + " " + count + ' asignaciones</span><small>' +
          esc(p.availability) + '</small></div></div>';
      }).join("") + '</div></section>' + legendText() + "</div>";
  }
  function handovers() {
    return '<div class="section-stack"><section class="panel"><div class="panel-heading"><div>' +
      '<span class="eyebrow">DOBLE VERIFICACIÓN HUMANA</span><h2>Propuestas de relevo</h2></div>' +
      tag(data.HANDOVERS.length + " ejemplos", "warning") + '</div><div class="handover-grid">' +
      data.HANDOVERS.map(function (r) {
        const e = data.COVERAGES.find(function (x) { return x.id === r.coverageId; });
        return '<article class="handover-card"><div class="handover-top"><strong>' +
          esc(r.id) + '</strong>' + tag(r.stage, "warning") + '</div><p class="handover-case">' +
          esc(e.episodeId) + ' · ' + esc(type(e)) + ' · ' + esc(eventHours(e)) + '</p>' +
          '<div class="handover-steps"><div class="handover-step"><span class="step-number">1</span>' +
          '<span>Propuesta de cambio<small>' + esc(data.personName(r.outgoingId)) + '</small></span></div>' +
          '<div class="step-connector"></div><div class="handover-step"><span class="step-number">2</span>' +
          '<span>Aceptación y autorización<small>' + esc(data.personName(r.incomingId)) + '</small></span></div></div>' +
          '<p class="handover-message">' + esc(r.message) + '</p>' +
          '<button disabled type="button" class="disabled-action" aria-label="Aprobar relevo deshabilitado en demostración">' +
          'Aprobar cambio · deshabilitado</button></article>';
      }).join("") + '</div></section>' + legendText() + "</div>";
  }
  function reports() {
    const s = data.summary();
    return '<div class="section-stack">' + metrics() +
      '<section class="panel"><div class="panel-heading"><div><span class="eyebrow">SOLO MÉTRICAS ILUSTRATIVAS</span>' +
      '<h2>Distribución de la semana</h2></div></div>' +
      '<div class="report-bars">' + [
        { label: "Visitas", v: s.visits, total: s.total },
        { label: "Guardias", v: s.shifts, total: s.total },
        { label: "Sin asignar", v: s.unassigned, total: s.total },
      ].map(function (it) {
        return '<div class="report-row"><div><strong>' + esc(it.label) +
          '</strong><span>' + it.v + ' eventos</span></div><div class="bar-track"><div class="bar-fill" style="width:' +
          (it.v / it.total * 100).toFixed(2) + '%"></div></div></div>';
      }).join("") + '</div><p class="panel-footnote">Estas cifras no representan prestaciones realizadas, facturación ni indicadores médicos.</p></section></div>';
  }
  function content() {
    switch (state.section) {
      case "resumen": return overview();
      case "agenda": return metrics() + agenda();
      case "episodios": return episodes();
      case "profesionales": return professionals();
      case "relevos": return handovers();
      case "reportes": return reports();
      default: return agenda();
    }
  }
  function render() {
    document.querySelectorAll("[data-variant]").forEach(function (btn) {
      const isActive = btn.getAttribute("data-variant") === state.variant;
      btn.setAttribute("aria-pressed", String(isActive));
      btn.classList.toggle("is-selected", isActive);
    });
    const shell = state.variant === "b" ?
      '<div class="shell shell--b"><div class="top-shell">' +
      '<div class="top-shell-head">' + brand() + '<span>Gestión operativa / Semana demostrativa</span></div>' +
      topnav() + '</div><div class="shell-content">' + toolbar() +
      (state.section === "agenda" ? filters() : "") +
      '<div class="workspace workspace--b"><div class="workspace-main">' + content() +
      '</div>' + (state.section === "agenda" || state.section === "resumen" ? rail() : "") +
      '</div></div></div>' :
      '<div class="shell shell--' + state.variant + '">' + sidebar() +
      '<div class="shell-content">' + toolbar() +
      (state.section === "agenda" ? filters() : "") +
      '<div class="workspace workspace--' + state.variant + '"><div class="workspace-main">' + content() +
      '</div>' + (state.variant === "c" && (state.section === "agenda" || state.section === "resumen") ? rail() : "") +
      "</div></div></div>";
    host.innerHTML = shell;
    document.getElementById("current-style").textContent = {
      a: "A · Institucional", b: "B · Operativo", c: "C · Híbrido",
    }[state.variant];
  }
  function openEpisode(code) {
    const episode = data.EPISODES.find(function (x) { return x.id === code; });
    if (!episode) return;
    const rows = data.COVERAGES.filter(function (x) { return x.episodeId === code; });
    modalBody.innerHTML = '<div class="modal-header"><span class="eyebrow">EPISODIO FICTICIO · SOLO LECTURA</span>' +
      '<h2>' + esc(episode.id) + '</h2><p>' + esc(episode.area) + " · " + esc(episode.status) +
      '</p></div><div class="modal-stats">' + tag(rows.length + " coberturas", "light") +
      episode.services.map(function (s) { return tag(s, "light"); }).join("") + '</div>' +
      '<div class="modal-coverages">' + rows.map(function (e) {
        return '<div><strong>' + esc(type(e) + " · " + e.specialty) +
          '</strong><span>' + esc(eventHours(e)) + '</span><small>' + esc(e.status) +
          ' · ' + esc(data.personName(e.professionalId)) + '</small></div>';
      }).join("") + '</div><p class="modal-warning">' +
      'Sin identidad de paciente, historia clínica, diagnósticos, órdenes ni firmas. ' +
      'El acceso real dependerá de permisos y autorización institucional.</p>';
    modal.showModal();
  }
  document.addEventListener("click", function (event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-variant")) {
      const next = button.getAttribute("data-variant");
      if (["a", "b", "c"].includes(next)) { state.variant = next; render(); }
    } else if (button.hasAttribute("data-section")) {
      const next = button.getAttribute("data-section");
      if (titles[next]) { state.section = next; render(); }
    } else if (button.hasAttribute("data-mode")) {
      const next = button.getAttribute("data-mode");
      if (["semana", "dia"].includes(next)) { state.mode = next; render(); }
    } else if (button.hasAttribute("data-episode")) {
      openEpisode(button.getAttribute("data-episode"));
    } else if (button.hasAttribute("data-close")) {
      modal.close();
    }
  });
  document.addEventListener("change", function (event) {
    if (event.target.id === "specialty-filter") {
      const valid = ["Todas", "Enfermería", "Kinesiología", "Medicina", "Fonoaudiología"];
      if (valid.includes(event.target.value)) state.specialty = event.target.value;
      render();
    } else if (event.target.id === "day-filter") {
      if (data.DAYS.some(function (d) { return d.date === event.target.value; })) state.day = event.target.value;
      render();
    }
  });
  modal.addEventListener("click", function (event) {
    if (event.target === modal) modal.close();
  });
  render();
}());
