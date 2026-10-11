"use strict";
/**
 * WEB-COORD-01B-QA — actual headless Chrome against the standalone offline
 * preview. No external navigation, tokens, clinical data, backend or server.
 * Run: npm install --no-save --package-lock=false playwright@1.56.1
 *      node test/web-browser.e2e.cjs
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const {pathToFileURL} = require("node:url");
const {chromium} = require("playwright");

const preview = pathToFileURL(path.resolve(__dirname,
  "../apps/web-prototypes/preview.html")).href;
const artifacts = path.resolve(__dirname,"../artifacts/web-coord");
fs.mkdirSync(artifacts,{recursive:true});

function ensureNoErrors(errors, width) {
  assert.deepEqual(errors,[], "Uncaught browser errors at width "+width);
}
async function visible(page, selector, label) {
  const target=page.locator(selector).first();
  await target.waitFor({state:"visible",timeout:12000});
  assert.equal(await target.isVisible(),true,label);
  return target;
}
async function screenshot(page, name) {
  await page.screenshot({path:path.join(artifacts,name+".png"),
    animations:"disabled",fullPage:true});
}
async function checkVariant(page,variant) {
  await page.locator(".variant-btn[data-variant='"+variant+"']").click();
  await visible(page,".shell--"+variant,variant+" variant");
  assert.equal(await page.locator(".variant-btn[data-variant='"+variant+"']")
    .getAttribute("aria-pressed"),"true");
}
async function runViewport(browser,width,height) {
  const context=await browser.newContext({
    viewport:{width,height},deviceScaleFactor:1,colorScheme:"light",
    reducedMotion:"reduce",locale:"es-AR",timezoneId:"America/Argentina/Buenos_Aires",
  });
  const blocked=[];
  const errors=[];
  // Browser QA must prove the artifact does not reach out to any web service.
  await context.route(/^https?:\/\//,async route=>{
    blocked.push(route.request().url());
    await route.abort();
  });
  const page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",message=>{
    if(message.type()==="error")errors.push(message.text());
  });
  try {
    await page.goto(preview,{waitUntil:"load",timeout:20000});
    await visible(page,".shell--c","default hybrid");
    assert.match(await page.title(),/Pediatrics/);
    assert.equal(await page.locator(".variant-btn").count(),3);
    assert.equal(await page.locator(".nav-item[data-section]").count(),6);
    assert.match(await page.locator(".tz-label").innerText(),
      /America\/Argentina\/Buenos_Aires/);
    // Horizontal calendar scrolling is allowed; viewport itself must not leak.
    const geometry=await page.evaluate(()=>({
      pageWidth:document.documentElement.scrollWidth,
      viewport:window.innerWidth,
    }));
    assert.ok(geometry.pageWidth<=geometry.viewport+2,
      "Document horizontally overflows "+width+"px: "+JSON.stringify(geometry));
    await screenshot(page,"C-"+width);
    if(width===1440){
      await checkVariant(page,"a");
      await visible(page,".shell--a table","institutional table");
      assert.equal(await page.locator(".shell--a table tbody tr").count(),13);
      await screenshot(page,"A-"+width);
      // Keyboard activation is mandatory, not just click event simulation.
      const target=page.locator(".variant-btn[data-variant='b']");
      await target.focus();
      assert.equal(await target.evaluate(el=>el===document.activeElement),true,
        "Keyboard focus must reach variant button");
      await page.keyboard.press("Enter");
      await visible(page,".shell--b .week-grid","operational grid via keyboard");
      assert.equal(await page.locator(".shell--b .queue-item").count(),2);
      await screenshot(page,"B-"+width);
      // Guardias are projected into both calendar days, never as two visits.
      const monday=page.locator(".week-day[data-day='2026-10-12']");
      const tuesday=page.locator(".week-day[data-day='2026-10-13']");
      assert.ok(await monday.getByRole("button",{name:/EPI-101 de Guardia/}).count()>=1,
        "Monday 20h overnight coverage absent");
      assert.ok(await tuesday.getByRole("button",{name:/EPI-101 de Guardia/}).count()>=1,
        "Tuesday 08h inherited coverage absent");
      await page.locator("#day-filter").selectOption("2026-10-13");
      await visible(page,".timeline","24h view after day choice");
      const title=await page.locator(".timeline").locator("..").innerText();
      assert.match(title,/Martes 13/);
      assert.ok(await page.locator(".time-block").count()>0);
      await page.locator(".nav-item[data-section='relevos']").first().click();
      const disabled=await visible(page,".disabled-action","disabled approval");
      assert.equal(await disabled.isDisabled(),true);
      assert.equal(await page.locator("button[data-episode='EPI-101']").count(),0,
        "No episode navigation on the two handover cards in this fixture");
      await page.locator(".nav-item[data-section='episodios']").first().click();
      await page.locator("button.episode-tile[data-episode='EPI-101']").click();
      const dialog=await visible(page,"dialog[open]","synthetic episode detail");
      assert.match(await dialog.innerText(),/Sin identidad de paciente/);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(),0);
      await checkVariant(page,"c");
      await visible(page,".shell--c .week-grid","hybrid weekly screen");
    }else if(width===1024){
      await checkVariant(page,"b");
      await visible(page,".shell--b .week-grid","tablet operational grid");
      await checkVariant(page,"a");
      await visible(page,".shell--a table","tablet institutional view");
    }else{
      await checkVariant(page,"a");
      await visible(page,".shell--a table","compact institutional view");
      await checkVariant(page,"c");
      const scroll=await page.locator(".week-scroll").evaluate(el=>({
        scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
      }));
      assert.ok(scroll.clientWidth>0 && scroll.scrollWidth>=scroll.clientWidth,
        "Calendar must remain accessible in its own horizontal scroll area");
    }
    ensureNoErrors(errors,width);
    assert.deepEqual(blocked,[],"Preview must issue zero HTTP requests");
    process.stdout.write("BROWSER_QA_PASS width="+width+" layout/interactions/accessibility\n");
  } finally {
    await context.close();
  }
}
(async()=>{
  const browser=await chromium.launch({
    channel:"chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"],
  });
  try {
    await runViewport(browser,1440,900);
    await runViewport(browser,1024,768);
    await runViewport(browser,768,1024);
    process.stdout.write("WEB_COORD_01B_BROWSER_QA_SUCCESS\n");
  } finally {
    await browser.close();
  }
})().catch(error=>{
  process.stderr.write("WEB_COORD_01B_BROWSER_QA_FAILED: "+error.message+"\n");
  process.exitCode=1;
});
