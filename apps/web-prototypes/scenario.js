/* WEB-COORD-01A — Fixture exclusively synthetic, no clinical or patient identity. */
(function () {
  "use strict";
  const TIMEZONE = "America/Argentina/Buenos_Aires";
  const OFFSET = "-03:00";
  const DAYS = Object.freeze([
    { date: "2026-10-12", short: "Lun", full: "Lunes 12" },
    { date: "2026-10-13", short: "Mar", full: "Martes 13" },
    { date: "2026-10-14", short: "Mié", full: "Miércoles 14" },
    { date: "2026-10-15", short: "Jue", full: "Jueves 15" },
    { date: "2026-10-16", short: "Vie", full: "Viernes 16" },
    { date: "2026-10-17", short: "Sáb", full: "Sábado 17" },
    { date: "2026-10-18", short: "Dom", full: "Domingo 18" },
  ]);
  const EPISODES = Object.freeze([
    { id: "EPI-101", area: "Zona Norte", status: "En seguimiento", services: ["Enfermería", "Medicina"] },
    { id: "EPI-102", area: "Zona Centro", status: "En seguimiento", services: ["Kinesiología", "Enfermería"] },
    { id: "EPI-103", area: "Zona Sur", status: "En seguimiento", services: ["Fonoaudiología", "Enfermería"] },
    { id: "EPI-104", area: "Zona Oeste", status: "En seguimiento", services: ["Medicina", "Kinesiología"] },
  ]);
  const PROFESSIONALS = Object.freeze([
    { id: "PRO-01", label: "Profesional A", specialty: "Enfermería", availability: "12 h / disponibilidad a validar", state: "Asignado" },
    { id: "PRO-02", label: "Profesional B", specialty: "Kinesiología", availability: "Visitas programadas", state: "Asignado" },
    { id: "PRO-03", label: "Profesional C", specialty: "Medicina", availability: "Visitas programadas", state: "Asignado" },
    { id: "PRO-04", label: "Profesional D", specialty: "Fonoaudiología", availability: "Visitas programadas", state: "Asignado" },
    { id: "PRO-05", label: "Profesional E", specialty: "Enfermería", availability: "Disponibilidad sin verificar", state: "A verificar" },
  ]);
  const COVERAGES = Object.freeze([
    { id: "COB-001", episodeId: "EPI-101", professionalId: "PRO-01", specialty: "Enfermería", type: "VISIT", start: "2026-10-12T08:30:00-03:00", end: "2026-10-12T09:30:00-03:00", status: "Confirmada" },
    { id: "COB-002", episodeId: "EPI-102", professionalId: "PRO-02", specialty: "Kinesiología", type: "VISIT", start: "2026-10-12T11:00:00-03:00", end: "2026-10-12T12:00:00-03:00", status: "Asignada" },
    { id: "COB-003", episodeId: "EPI-101", professionalId: "PRO-01", specialty: "Enfermería", type: "SHIFT", start: "2026-10-12T20:00:00-03:00", end: "2026-10-13T08:00:00-03:00", status: "Relevo pendiente" },
    { id: "COB-004", episodeId: "EPI-104", professionalId: "PRO-03", specialty: "Medicina", type: "VISIT", start: "2026-10-13T10:00:00-03:00", end: "2026-10-13T11:00:00-03:00", status: "Confirmada" },
    { id: "COB-005", episodeId: "EPI-102", professionalId: null, specialty: "Enfermería", type: "SHIFT", start: "2026-10-13T20:00:00-03:00", end: "2026-10-14T08:00:00-03:00", status: "Sin asignar" },
    { id: "COB-006", episodeId: "EPI-102", professionalId: "PRO-02", specialty: "Kinesiología", type: "VISIT", start: "2026-10-14T09:00:00-03:00", end: "2026-10-14T10:00:00-03:00", status: "Asignada" },
    { id: "COB-007", episodeId: "EPI-104", professionalId: null, specialty: "Kinesiología", type: "VISIT", start: "2026-10-14T16:00:00-03:00", end: "2026-10-14T17:00:00-03:00", status: "Sin asignar" },
    { id: "COB-008", episodeId: "EPI-103", professionalId: "PRO-01", specialty: "Enfermería", type: "SHIFT", start: "2026-10-14T19:00:00-03:00", end: "2026-10-15T07:00:00-03:00", status: "Confirmada" },
    { id: "COB-009", episodeId: "EPI-101", professionalId: "PRO-03", specialty: "Medicina", type: "VISIT", start: "2026-10-15T10:30:00-03:00", end: "2026-10-15T11:30:00-03:00", status: "Asignada" },
    { id: "COB-010", episodeId: "EPI-103", professionalId: "PRO-04", specialty: "Fonoaudiología", type: "VISIT", start: "2026-10-16T09:00:00-03:00", end: "2026-10-16T10:00:00-03:00", status: "Confirmada" },
    { id: "COB-011", episodeId: "EPI-103", professionalId: "PRO-01", specialty: "Enfermería", type: "SHIFT", start: "2026-10-16T20:00:00-03:00", end: "2026-10-17T08:00:00-03:00", status: "Asignada" },
    { id: "COB-012", episodeId: "EPI-104", professionalId: "PRO-02", specialty: "Kinesiología", type: "VISIT", start: "2026-10-17T10:00:00-03:00", end: "2026-10-17T11:00:00-03:00", status: "Asignada" },
    { id: "COB-013", episodeId: "EPI-104", professionalId: "PRO-03", specialty: "Medicina", type: "VISIT", start: "2026-10-18T09:30:00-03:00", end: "2026-10-18T10:30:00-03:00", status: "Asignada" },
  ]);
  const HANDOVERS = Object.freeze([
    { id: "REL-001", coverageId: "COB-003", outgoingId: "PRO-01", incomingId: "PRO-05", stage: "Pendiente de confirmación", message: "El relevo requiere validación humana." },
    { id: "REL-002", coverageId: "COB-005", outgoingId: null, incomingId: null, stage: "Sin reemplazo", message: "Guardia sin profesional confirmado." },
  ]);
  const ALERTS = Object.freeze([
    { id: "ALT-001", coverageId: "COB-005", tone: "danger", label: "Guardia sin asignación", detail: "Mar 13, 20:00 a Mié 14, 08:00" },
    { id: "ALT-002", coverageId: "COB-003", tone: "warning", label: "Relevo pendiente", detail: "Lun 12, 20:00 a Mar 13, 08:00" },
    { id: "ALT-003", coverageId: "COB-007", tone: "warning", label: "Visita sin asignación", detail: "Mié 14, 16:00 a 17:00" },
  ]);
  function dateMillis(iso) { return Date.parse(iso); }
  function nextDate(date) {
    const start = Date.parse(date + "T00:00:00Z");
    return new Date(start + 86400000).toISOString().slice(0, 10);
  }
  function dayWindow(date) {
    if (!DAYS.some(function (d) { return d.date === date; })) return null;
    return {
      start: dateMillis(date + "T00:00:00" + OFFSET),
      end: dateMillis(nextDate(date) + "T00:00:00" + OFFSET),
    };
  }
  function overlapsDay(coverage, date) {
    const day = dayWindow(date);
    return !!day && dateMillis(coverage.end) > day.start && dateMillis(coverage.start) < day.end;
  }
  function daySlice(coverage, date) {
    const day = dayWindow(date);
    if (!day || !overlapsDay(coverage, date)) return null;
    return {
      fromMinute: Math.max(0, (dateMillis(coverage.start) - day.start) / 60000),
      toMinute: Math.min(1440, (dateMillis(coverage.end) - day.start) / 60000),
      continuesFromPreviousDay: dateMillis(coverage.start) < day.start,
      continuesToNextDay: dateMillis(coverage.end) > day.end,
    };
  }
  function filterCoverages(spec) {
    const options = spec || {};
    return COVERAGES.filter(function (item) {
      return (!options.specialty || options.specialty === "Todas" || item.specialty === options.specialty) &&
        (!options.day || overlapsDay(item, options.day)) &&
        (!options.episodeId || item.episodeId === options.episodeId);
    }).sort(function (a, b) {
      return dateMillis(a.start) - dateMillis(b.start) || a.id.localeCompare(b.id);
    });
  }
  function formatClock(iso) {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(new Date(iso));
  }
  function isOvernight(coverage) {
    const dayStart = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(coverage.start));
    const dayEnd = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(coverage.end));
    return dayStart !== dayEnd;
  }
  function summary(rows) {
    const items = rows || COVERAGES;
    return {
      total: items.length,
      visits: items.filter(function (x) { return x.type === "VISIT"; }).length,
      shifts: items.filter(function (x) { return x.type === "SHIFT"; }).length,
      unassigned: items.filter(function (x) { return x.professionalId === null; }).length,
      pendingRelief: items.filter(function (x) { return x.status === "Relevo pendiente"; }).length,
      episodes: EPISODES.length,
    };
  }
  function personName(id) {
    const p = PROFESSIONALS.find(function (x) { return x.id === id; });
    return p ? p.label : "Sin asignar";
  }
  const api = {
    TIMEZONE: TIMEZONE, OFFSET: OFFSET,
    DAYS: DAYS, EPISODES: EPISODES, PROFESSIONALS: PROFESSIONALS,
    COVERAGES: COVERAGES, HANDOVERS: HANDOVERS, ALERTS: ALERTS,
    dayWindow: dayWindow, overlapsDay: overlapsDay, daySlice: daySlice,
    filterCoverages: filterCoverages, summary: summary,
    formatClock: formatClock, isOvernight: isOvernight, personName: personName,
  };
  window.CONSULTLAN_WEB_DEMO = Object.freeze(api);
}());
