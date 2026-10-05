import assert from "node:assert/strict";
import fs from "node:fs";

export async function verifyMockupCylinder(browserContext){
  const page=await browserContext.newPage();
  const base="https://tohaa28.github.io/gifts-layout-workbench-mockups/";
  await page.route(base+"**",async route=>{
    const url=new URL(route.request().url());
    const relative=url.pathname.replace("/gifts-layout-workbench-mockups/","");
    if(!relative||relative.includes(".."))return route.abort();
    if(!fs.existsSync(relative))return route.abort();
    const type=relative.endsWith(".html")?"text/html; charset=utf-8":relative.endsWith(".mjs")||relative.endsWith(".js")?"application/javascript; charset=utf-8":relative.endsWith(".json")?"application/json; charset=utf-8":"application/octet-stream";
    await route.fulfill({body:fs.readFileSync(relative),contentType:type,headers:{"access-control-allow-origin":"*"}});
  });
  await page.route("https://raw.githubusercontent.com/tohaa28/tohaa28.github.io/gifts-layout-workbench-mockups-source/mockup-profiles.json**",route=>route.fulfill({contentType:"application/json",body:'{"schema":"gifts-mockup-profile-registry/v1","version":1,"profiles":[],"candidates":[],"articleSources":[]}'}));
  await page.goto(base+"mockup.html",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction(()=>typeof window.gwbGetMockupBinding==="function");
  assert.equal(await page.locator("#cylinderControls").isHidden(),true);
  await page.locator("#surface").selectOption("cylinder");
  assert.equal(await page.locator("#cylinderControls").isVisible(),true);
  assert.match(await page.locator("#photoCanvasHint").textContent(),/зелёную рамку/);
  await page.evaluate(async()=>{
    await window.gwbApplyMockupProfile({
      schema:"gifts-mockup-profile/v1",
      article:"CYL-TEST",
      place:"цилиндр",
      method:"TEST",
      field:{id:"field-1",printId:"print1",place:"цилиндр"},
      fieldRect:{x:.2,y:.2,w:.2,h:.2},
      targetQuad:[{x:.35,y:.3},{x:.62,y:.32},{x:.6,y:.56},{x:.34,y:.54}],
      surface:"cylinder",
      cylinder:{
        axis:"horizontal",
        curvature:.84,
        targetQuad:[{x:.18,y:.16},{x:.84,y:.2},{x:.8,y:.86},{x:.16,y:.82}]
      },
      render:{opacity:.9,blend:"source-over",mesh:32}
    });
  });
  const binding=await page.evaluate(()=>window.gwbGetMockupBinding());
  assert.equal(binding.surface,"cylinder");
  assert.equal(binding.cylinder.axis,"horizontal");
  assert.ok(Math.abs(binding.cylinder.curvature-.84)<1e-9);
  assert.deepEqual(binding.cylinder.targetQuad,[{x:.18,y:.16},{x:.84,y:.2},{x:.8,y:.86},{x:.16,y:.82}]);
  const summary=await page.locator("#profileSummary").textContent();
  assert.match(summary,/цилиндр · горизонтальная ось · изгиб 84%/);
  assert.match(summary,/задняя сторона скрывается/);
  const projection=await page.evaluate(async()=>{
    const mod=await import("./assets/mockup-cylinder.mjs?v=20261005-2");
    const range=mod.cylinderVisibleRange(.84);
    return {range,left:mod.cylinderProjection(0,.84),center:mod.cylinderProjection(.5,.84),right:mod.cylinderProjection(1,.84)};
  });
  assert.equal(projection.range.clipped,true);
  assert.ok(projection.range.start>0&&projection.range.end<1);
  assert.equal(projection.left.visible,false);
  assert.equal(projection.center.visible,true);
  assert.equal(projection.right.visible,false);
  await page.locator("#editCylinder").click();
  assert.match(await page.locator("#photoCanvasHint").textContent(),/зелёную рамку/);
  await page.locator("#editField").click();
  assert.match(await page.locator("#photoCanvasHint").textContent(),/синюю рамку/);
  await page.close();
  console.log("Mockup cylinder: surface controls, profile persistence, back-face clipping and edit modes passed");
}
