"use strict";
/**
 * WEB-COORD-01C: cross-engine compatibility + automated WCAG checks.
 * CI-only dev dependencies: playwright@1.56.1, axe-core@4.10.3
 * Zero healthcare data, zero network requests, zero mutating clinical actions.
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const {pathToFileURL} = require("node:url");
const {chromium,firefox,webkit} = require("playwright");

const url = pathToFileURL(path.resolve(__dirname,"../apps/web-prototypes/preview.html")).href;
const axePath=require.resolve("axe-core/axe.min.js");
const engines=[["firefox",firefox],["webkit",webkit]];
const widths=[{width:1440,height:900},{width:768,height:1024}];
const variants=["a","b","c"];

function expectNoRequests(list,engine,width) {
  assert.deepEqual(list,[],engine+" "+width+" requested external origin");
}
async function createPage(browser,engine,viewport) {
  const context=await browser.newContext({
    viewport,locale:"es-AR",
    timezoneId:"America/Argentina/Buenos_Aires",reducedMotion:"reduce",
  });
  const requests=[],errors=[];
  await context.route(/^https?:\/\//,async route=>{
    requests.push(route.request().url());await route.abort();
  });
  const page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",msg=>{
    if(msg.type()==="error")errors.push(msg.text());
  });
  await page.goto(url,{waitUntil:"load",timeout:20000});
  await page.locator(".shell--c").waitFor({state:"visible"});
  return {context,page,requests,errors};
}
async function checkLayout(page,engine,variant,width) {
  const ui=await page.evaluate(()=>({
    docWidth:document.documentElement.scrollWidth,
    windowWidth:window.innerWidth,
    full:!!document.querySelector(".shell"),
    clipped: [...document.querySelectorAll(".variant-btn")].some(e=>e.getBoundingClientRect().width<=0),
  }));
  assert.equal(ui.full,true,engine+" missing app shell");
  assert.equal(ui.clipped,false,engine+" variant controls clipped");
  assert.ok(ui.docWidth<=ui.windowWidth+2,
    engine+" "+variant+" width="+width+" horizontal document overflow: "+JSON.stringify(ui));
}
async function crossEngine(){
  for(const [engine,type] of engines){
    const browser=await type.launch({headless:true});
    try{
      for(const viewport of widths){
        const {context,page,requests,errors}=await createPage(browser,engine,viewport);
        try{
          for(const variant of variants){
            await page.locator(".variant-btn[data-variant='"+variant+"']").click();
            await page.locator(".shell--"+variant).waitFor({state:"visible"});
            const pressed=await page.locator(".variant-btn[data-variant='"+variant+"']").getAttribute("aria-pressed");
            assert.equal(pressed,"true",engine+" "+variant+" pressed state");
            if(variant==="a"){
              assert.equal(await page.locator(".shell--a table tbody tr").count(),13);
            }else{
              assert.equal(await page.locator(".week-day").count(),7);
              assert.equal(await page.locator(".week-day[data-day='2026-10-12']")
                .locator("[data-episode='EPI-101']").count(),2,
                "Week has one visit and one night shift on Monday");
              assert.ok((await page.locator(".week-day[data-day='2026-10-13']")
                .locator("[data-episode='EPI-101']").count())>=1,
                "Tuesday must show overnight shift continuation");
            }
            await checkLayout(page,engine,variant,viewport.width);
          }
          await page.locator("#specialty-filter").selectOption("Enfermería");
          assert.equal(await page.locator(".event-card").count(),9,
            "filtered nurse coverages can appear on multiple days");
          await page.locator("#day-filter").selectOption("2026-10-13");
          await page.locator(".timeline").waitFor({state:"visible"});
          assert.ok(await page.locator(".time-block").count()>=1);
          await page.locator(".nav-item[data-section='relevos']").first().click();
          assert.equal(await page.locator(".disabled-action").count(),2);
          assert.equal(await page.locator(".disabled-action:not(:disabled)").count(),0);
          await page.locator(".nav-item[data-section='episodios']").first().click();
          await page.locator("button.episode-tile[data-episode='EPI-101']").click();
          await page.locator("dialog[open]").waitFor({state:"visible"});
          assert.match(await page.locator("dialog[open]").innerText(),/Sin identidad de paciente/);
          await page.keyboard.press("Escape");
          assert.equal(await page.locator("dialog[open]").count(),0);
          expectNoRequests(requests,engine,viewport.width);
          assert.deepEqual(errors,[],engine+" "+viewport.width+" JavaScript console errors");
          process.stdout.write("CROSS_BROWSER_PASS "+engine+" "+viewport.width+"px\n");
        }finally{await context.close()}
      }
    }finally{await browser.close()}
  }
}
async function wcagAudit(){
  const browser=await chromium.launch({
    channel:"chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"],
  });
  try{
    for(const viewport of widths){
      const {context,page,requests,errors}=await createPage(browser,"chrome-axe",viewport);
      try{
        await page.addScriptTag({path:axePath});
        for(const variant of variants){
          await page.locator(".variant-btn[data-variant='"+variant+"']").click();
          await page.locator(".shell--"+variant).waitFor({state:"visible"});
          for(const section of ["agenda","episodios","relevos"]){
            await page.locator(".nav-item[data-section='"+section+"']").first().click();
            const result=await page.evaluate(async()=>window.axe.run(document,{
              runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]},
            }));
            const findings=result.violations.filter(v=>v.impact==="critical"||v.impact==="serious");
            if(findings.length){
              for(const v of findings){
                process.stderr.write("AXE_FINDING "+JSON.stringify({
                  viewport:viewport.width,variant,section,id:v.id,
                  impact:v.impact,description:v.description,
                  samples:v.nodes.slice(0,6).map(n=>({target:n.target,summary:n.failureSummary})),
                })+"\n");
              }
            }
            assert.equal(findings.length,0,
              "Accessibility issues in "+variant+"/"+section+"/"+viewport.width+"px");
          }
        }
        expectNoRequests(requests,"chrome-axe",viewport.width);
        assert.deepEqual(errors,[],"Chrome axe scan JS errors");
        process.stdout.write("WCAG_AUTOMATED_PASS chrome "+viewport.width+"px variants A/B/C\n");
      }finally{await context.close()}
    }
  }finally{await browser.close()}
}
(async()=>{
  await crossEngine();
  await wcagAudit();
  process.stdout.write("WEB_COORD_01C_CROSS_BROWSER_AND_WCAG_PASS\n");
})().catch(err=>{
  process.stderr.write("WEB_COORD_01C_FAILED: "+err.stack+"\n");
  process.exitCode=1;
});
