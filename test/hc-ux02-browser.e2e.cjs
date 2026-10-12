"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {chromium}=require("playwright");
const repo=path.resolve(__dirname,"..");
const preview=pathToFileURL(path.join(repo,"apps/form-prototypes/preview.html")).href;
const catalog=JSON.parse(fs.readFileSync(path.join(repo,"apps/mobile/src/formPreviewCatalog.json"),"utf8"));
const widths=[{width:1440,height:900},{width:768,height:1024},{width:390,height:844}];
const capture=path.join(repo,"artifacts/hc-ux02");
fs.mkdirSync(capture,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:"chrome",headless:true,
    args:["--no-sandbox","--disable-dev-shm-usage"]});
  try{
    for(const size of widths){
      const context=await browser.newContext({
        viewport:size,colorScheme:"light",reducedMotion:"reduce",
        locale:"es-AR",timezoneId:"America/Argentina/Buenos_Aires",
      });
      const requests=[],errors=[];
      await context.route(/^https?:\/\//,async route=>{
        requests.push(route.request().url());await route.abort();
      });
      const page=await context.newPage();
      page.on("pageerror",e=>errors.push(e.message));
      page.on("console",e=>{if(e.type()==="error")errors.push(e.text());});
      try{
        await page.goto(preview,{waitUntil:"load",timeout:20000});
        await page.locator("h1").filter({hasText:"Una tarea por vez"}).waitFor();
        const metadata=await page.evaluate(()=>window.HC_UX02_DEMO);
        assert.deepEqual(metadata,{
          templates:7,attendance:6,paper:4,source:"HC-03A",
          emissionEnabled:false,signatureCaptureEnabled:false,patientDataReal:false,
        },"Only source-backed synthetic preview is mounted");
        assert.equal(await page.locator("input,textarea,form").count(),0);
        const overflow=await page.evaluate(()=>({
          width:document.documentElement.scrollWidth,viewport:window.innerWidth,
        }));
        assert.ok(overflow.width<=overflow.viewport+2,
          "No global horizontal overflow "+size.width+" "+JSON.stringify(overflow));
        await page.screenshot({path:path.join(capture,"inicio-"+size.width+".png"),
          fullPage:true,animations:"disabled"});
        for(const f of catalog.templates.filter(x=>x.kind==="ATTENDANCE")){
          await page.locator("#specialty").selectOption(f.id);
          await page.getByRole("button",{name:"Abrir mi prestación"}).click();
          await page.locator("h2").filter({hasText:"Campos verificados de la hoja"}).waitFor();
          assert.equal(await page.locator("[data-field-id]").count(),
            f.headerFields.length+f.rowFields.length,
            "Only verified fields for "+f.id);
          assert.equal(await page.locator("[data-field-id='serviceTime']").count(),
            f.id==="NURSING_CAREGIVER_ATTENDANCE"?1:0,
            "Horario only source-verifiable for nursing/caregiver");
          await page.getByRole("button",{name:"Ver borrador de la planilla"}).click();
          await page.locator(".sheet").waitFor();
          assert.equal(await page.locator("table.source-table thead th").count(),
            f.rowFields.length,"Source columns preserved "+f.id);
          assert.match(await page.locator(".sheet").innerText(),/NO EMITIDO/);
          assert.match(await page.locator(".sheet").innerText(),/DEMO SIN VALIDEZ/);
          if(f.id==="NURSING_CAREGIVER_ATTENDANCE"){
            await page.screenshot({path:path.join(capture,"enfermeria-"+size.width+".png"),
              fullPage:true,animations:"disabled"});
          }
          await page.locator("[data-section='inicio']").click();
          await page.locator("#specialty").waitFor();
        }
        // Clinical narrative MUST be reached separately via catalog, not offered
        // as proof of attendance or a substitute for an existing signed record.
        await page.locator("[data-section='planillas']").click();
        const evo=page.getByText("La evolución no es una constancia de asistencia.");
        await evo.waitFor({state:"visible"});
        await page.getByRole("button",{name:"Ver"}).last().click();
        assert.equal(await page.locator("[data-field-id='evolution']").count(),1);
        assert.equal(await page.locator("[data-field-id='professionalSignature']").count(),0);
        await page.locator("[data-section='mensual']").click();
        await page.getByText("0 documentos emitidos").waitFor();
        await page.getByText("0 documentos autorizados").waitFor();
        await page.getByText("FALTA COTEJO CON LOS ORIGINALES").waitFor();
        const sourceReview=page.locator("details").filter({
          hasText:"Ver las siete planillas pendientes de comparación",
        });
        await sourceReview.locator("summary").click();
        assert.equal(await page.locator("[data-review-id]").count(),7,
          "All 7 source documents must request private visual comparison");
        assert.equal(await page.locator("[data-review-id] .tag.warn").count(),7);
        assert.match(await page.locator("#stage").innerText(),/no una cantidad fija/);
        assert.equal(await page.getByText("PAPEL",{exact:true}).count(),4);
        assert.match(await page.locator("#stage").innerText(),/56 páginas escaneadas/);
        await page.screenshot({path:path.join(capture,"expediente-"+size.width+".png"),
          fullPage:true,animations:"disabled"});
        assert.deepEqual(requests,[],"ZERO HTTP requests at "+size.width);
        assert.deepEqual(errors,[],"ZERO JavaScript errors at "+size.width);
        process.stdout.write("HC_UX02_BROWSER_PASS "+size.width+"x"+size.height+"\n");
      }finally{await context.close();}
    }
  }finally{await browser.close();}
  process.stdout.write("HC_UX02_BROWSER_QA_SUCCESS\n");
})().catch(e=>{
  process.stderr.write("HC_UX02_BROWSER_QA_FAILED "+e.stack+"\n");
  process.exitCode=1;
});
