"use strict";
/**
 * WEB-COORD-02: real-browser test of the standalone React candidate.
 * Uses ONLY the synthetic fixture, blocks external HTTP, and never connects
 * Supabase or any clinical endpoint.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {chromium}=require("playwright");
const preview=pathToFileURL(path.resolve(__dirname,
  "../apps/web/dist/preview.html")).href;
const folder=path.resolve(__dirname,"../artifacts/web-coord-react");
fs.mkdirSync(folder,{recursive:true});

async function check(browser,width,height){
  const context=await browser.newContext({
    viewport:{width,height},deviceScaleFactor:1,locale:"es-AR",
    timezoneId:"America/Argentina/Buenos_Aires",reducedMotion:"reduce",
  });
  const network=[],errors=[];
  await context.route(/^https?:\/\//,async route=>{
    network.push(route.request().url());
    await route.abort();
  });
  const page=await context.newPage();
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",msg=>{
    if(msg.type()==="error")errors.push(msg.text());
  });
  try{
    await page.goto(preview,{waitUntil:"load",timeout:25000});
    const wired=await page.evaluate(()=>({
      scripts:document.querySelectorAll("script").length,
      styles:document.querySelectorAll("style").length,
      scriptSrc:document.querySelectorAll("script[src]").length,
      styleHref:document.querySelectorAll('link[rel="stylesheet"][href]').length,
    }));
    assert.deepEqual(wired,{scripts:1,styles:1,scriptSrc:0,styleHref:0},
      "Minified runtime must not inject or retain extra asset tags");
    await page.getByRole("heading",{name:"Agenda domiciliaria"}).waitFor({
      state:"visible",timeout:12000,
    });
    assert.equal(await page.locator(".day-column").count(),7);
    assert.equal(await page.locator(".coverage-card--danger").count(),3,
      "Two unique unassigned coverages, with the overnight card on two days");
    const monday=page.locator('.day-column[data-day="2026-10-12"]');
    const tuesday=page.locator('.day-column[data-day="2026-10-13"]');
    assert.ok(await monday.getByRole("button",{name:/Guardia de prueba EPI-101/}).count()===1);
    const overnightTuesday=tuesday.getByRole("button",{name:/Guardia de prueba EPI-101/});
    assert.equal(await overnightTuesday.count(),1,
      "Overnight guard continues Tuesday, not a second treatment");
    assert.match(await overnightTuesday.innerText(),/00:00.*08:00.*Continúa desde ayer/,
      "Second day shows only 00:00–08:00 service portion");
    await page.getByRole("combobox",{name:"Elegir día"}).selectOption("2026-10-13");
    await page.getByText("Jornada del Martes 13").waitFor({state:"visible"});
    assert.ok(await page.locator(".day-list").getByRole("button",{
      name:/Guardia de prueba EPI-101/,
    }).count()===1);
    await page.getByRole("combobox",{name:"Filtrar especialidad"}).selectOption("Fonoaudiología");
    await page.getByText("Sin coberturas para este filtro y fecha.").waitFor({state:"visible"});
    await page.getByRole("combobox",{name:"Filtrar especialidad"}).selectOption("Todas");
    await page.getByRole("button",{name:"Episodios",exact:true}).click();
    await page.getByRole("button",{name:"Ver episodio ficticio EPI-101"}).click();
    const dialog=page.getByRole("dialog");
    await dialog.waitFor({state:"visible"});
    assert.match(await dialog.innerText(),/Sin identidad de paciente/);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(),0);
    await page.getByRole("button",{name:"Relevos",exact:true}).click();
    assert.equal(await page.locator(".disabled-action:disabled").count(),2);
    await page.getByRole("button",{name:"Reportes",exact:true}).click();
    assert.equal(await page.locator(".disabled-action:disabled").count(),1);
    await page.getByRole("button",{name:"Resumen",exact:true}).click();
    const coordinationAlerts=page.locator(".alerts p");
    assert.equal(await coordinationAlerts.count(),3,
      "Two uncovered visits/shifts and one pending handover, no duplicate overnight alerts");
    assert.match(await coordinationAlerts.nth(0).innerText(),/Relevo COB-003 pendiente/);
    assert.match(await coordinationAlerts.nth(1).innerText(),/Guardia COB-005 sin asignar/);
    assert.match(await coordinationAlerts.nth(1).innerText(),/finaliza al día siguiente/);
    assert.match(await coordinationAlerts.nth(2).innerText(),/Visita COB-007 sin asignar/);
    assert.doesNotMatch(await page.locator(".alerts").innerText(),/COB-008/,
      "Confirmed guards are not coordination alerts");
    await page.getByRole("button",{name:"Agenda 24/7",exact:true}).click();
    const geometry=await page.evaluate(()=>({
      pageWidth:document.documentElement.scrollWidth,windowWidth:window.innerWidth,
    }));
    assert.ok(geometry.pageWidth<=geometry.windowWidth+2,
      "No document-level horizontal overflow: "+JSON.stringify(geometry));
    await page.screenshot({path:path.join(folder,
      width===1440?"desktop.png":"tablet.png"),fullPage:true,animations:"disabled"});
    assert.deepEqual(network,[],"Offline React preview must make zero HTTP requests");
    assert.deepEqual(errors,[],"No JavaScript browser errors");
    process.stdout.write("WEB_COORD_REACT_OFFLINE_PASS "+width+"px\n");
  }finally{
    await context.close();
  }
}
(async()=>{
  const browser=await chromium.launch({
    channel:"chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"],
  });
  try{
    await check(browser,1440,900);
    await check(browser,768,1024);
    process.stdout.write("WEB_COORD_02_BROWSER_QA_SUCCESS\n");
  }finally{await browser.close();}
})().catch(error=>{
  process.stderr.write("WEB_COORD_02_BROWSER_QA_FAILED: "+error.stack+"\n");
  process.exitCode=1;
});
