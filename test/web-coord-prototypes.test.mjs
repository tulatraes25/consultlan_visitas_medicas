import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";

const root=new URL("../apps/web-prototypes/",import.meta.url);
const source=(file)=>readFileSync(new URL(file,root),"utf8");
const scenario=source("scenario.js");
const application=source("app.js");
const css=source("styles.css");
const html=source("index.html");
const offline=source("preview.html");
const context={window:{},Date,Intl};
runInNewContext(scenario,context,{timeout:5000});
const demo=context.window.CONSULTLAN_WEB_DEMO;

test("WEB-COORD-01A: synthetic episode-first fixture, same data for all variants",()=>{
  assert.ok(demo);
  assert.equal(demo.TIMEZONE,"America/Argentina/Buenos_Aires");
  assert.equal(demo.DAYS.length,7);
  assert.equal(demo.PROFESSIONALS.length,5);
  assert.equal(demo.EPISODES.length,4);
  assert.equal(demo.COVERAGES.length,13);
  assert.deepEqual({...demo.summary()},{
    total:13,visits:9,shifts:4,unassigned:2,pendingRelief:1,episodes:4,
  });
  assert.equal(new Set(demo.COVERAGES.map(x=>x.id)).size,13);
  const episodes=new Set(demo.EPISODES.map(x=>x.id));
  const professionals=new Set(demo.PROFESSIONALS.map(x=>x.id));
  for(const c of demo.COVERAGES){
    assert.ok(episodes.has(c.episodeId),"orphan episode");
    assert.ok(c.professionalId===null||professionals.has(c.professionalId),"unknown professional");
    assert.ok(Number.isFinite(Date.parse(c.start)));
    assert.ok(Number.isFinite(Date.parse(c.end)));
    assert.ok(Date.parse(c.end)>Date.parse(c.start),"nonpositive interval");
    assert.ok(Date.parse(c.end)-Date.parse(c.start)<=24*3600000,"unexpected excessive shift");
    assert.ok(["VISIT","SHIFT"].includes(c.type));
    assert.ok(["Enfermería","Kinesiología","Medicina","Fonoaudiología"].includes(c.specialty));
    assert.deepEqual(Object.keys(c).sort(),[
      "end","episodeId","id","professionalId","specialty","start","status","type",
    ]);
  }
  assert.deepEqual(demo.COVERAGES.map(x=>x.professionalId).filter(x=>x===null).length,2);
  assert.doesNotMatch(scenario,/\b(?:dni|diagnos(?:is|tico)|medicaci[oó]n|prescripci[oó]n|historia\s+cl[ií]nica|patientName|patient_id|birthDate)\b/i);
});

test("WEB-COORD-01A: guardias 24h continuity and day slices remain correct",()=>{
  const shift=demo.COVERAGES.find(x=>x.id==="COB-003");
  assert.ok(demo.isOvernight(shift));
  assert.equal(demo.formatClock(shift.start),"20:00");
  assert.equal(demo.formatClock(shift.end),"08:00");
  assert.equal(demo.overlapsDay(shift,"2026-10-12"),true);
  assert.equal(demo.overlapsDay(shift,"2026-10-13"),true);
  assert.equal(demo.overlapsDay(shift,"2026-10-14"),false);
  const first=demo.daySlice(shift,"2026-10-12");
  const second=demo.daySlice(shift,"2026-10-13");
  assert.equal(first.fromMinute,1200);
  assert.equal(first.toMinute,1440);
  assert.equal(first.continuesToNextDay,true);
  assert.equal(second.fromMinute,0);
  assert.equal(second.toMinute,480);
  assert.equal(second.continuesFromPreviousDay,true);
  assert.equal(demo.daySlice(shift,"2026-10-14"),null);
  assert.equal(demo.dayWindow("2026-11-02"),null,"cannot consult outside fixture");
});

test("WEB-COORD-01A: specialty and day filters preserve the same roster semantics",()=>{
  const nurse=demo.filterCoverages({specialty:"Enfermería"});
  assert.equal(nurse.length,5);
  assert.ok(nurse.some(x=>x.id==="COB-005"&&x.professionalId===null));
  const mon=demo.filterCoverages({day:"2026-10-12"});
  const tue=demo.filterCoverages({day:"2026-10-13"});
  assert.equal(mon.length,3);
  assert.equal(tue.length,3);
  assert.ok(mon.some(x=>x.id==="COB-003"));
  assert.ok(tue.some(x=>x.id==="COB-003"));
  const none=demo.filterCoverages({specialty:"Fonoaudiología",day:"2026-10-12"});
  assert.equal(none.length,0);
  const intersection=demo.filterCoverages({specialty:"Kinesiología",day:"2026-10-14"});
  assert.equal(intersection.length,2);
  assert.ok(demo.filterCoverages({episodeId:"EPI-999"}).length===0);
});

test("WEB-COORD-01A: staged handovers are not treated as authorized approvals",()=>{
  assert.equal(demo.HANDOVERS.length,2);
  for(const handover of demo.HANDOVERS){
    assert.ok(demo.COVERAGES.some(x=>x.id===handover.coverageId));
    assert.notEqual(handover.stage,"Aprobado");
  }
  assert.match(application,/Aprobar cambio · deshabilitado/);
  assert.match(application,/disabled type="button"/);
  assert.match(application,/No hay confirmaciones ni acciones clínicas reales/);
});

test("WEB-COORD-01A: three distinct navigable layouts and accessible filters",()=>{
  assert.match(html,/lang="es"/);
  assert.match(html,/aria-label="Comparar las tres propuestas visuales"/);
  for(const variant of ["a","b","c"]){
    assert.match(html,new RegExp('data-variant="'+variant+'"'));
    assert.match(application,new RegExp('shell--'+variant));
    assert.match(css,new RegExp('\\.shell--'+variant));
  }
  for(const key of ["resumen","agenda","episodios","profesionales","relevos","reportes"]){
    assert.match(application,new RegExp('key: "'+key+'"'));
  }
  assert.match(application,/function institutionalTable/);
  assert.match(application,/function weekPlanner/);
  assert.match(application,/function dayTimeline/);
  assert.match(application,/function openEpisode/);
  assert.match(application,/specialty-filter/);
  assert.match(application,/day-filter/);
  assert.match(application,/data-mode="dia"/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/@media\(max-width:730px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  new Script(scenario);
  new Script(application);
});

test("WEB-COORD-01A: standalone preview works offline without external URLs",()=>{
  assert.match(html,/src="\.\/scenario\.js"/);
  assert.match(html,/src="\.\/app\.js"/);
  assert.match(html,/href="\.\/styles\.css"/);
  assert.match(offline,/<style>[\s\S]*\.shell--c[\s\S]*<\/style>/);
  assert.match(offline,/<script>[\s\S]*CONSULTLAN_WEB_DEMO[\s\S]*<\/script>/);
  assert.doesNotMatch(offline,/<(?:link[^>]+href|script[^>]+src)=/i);
  assert.doesNotMatch(offline,/\bhttps?:\/\/|<iframe|<form\b/i);
  assert.doesNotMatch(application,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB)\s*(?:\(|\.)/);
  assert.doesNotMatch(scenario,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB)\s*(?:\(|\.)/);
  assert.match(html,/DEMO SIN CONEXIÓN/);
  assert.match(offline,/No habilitado para pacientes reales/);
});
