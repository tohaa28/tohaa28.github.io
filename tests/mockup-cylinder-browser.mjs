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
  await page.locator("#photoFile").setInputFiles({
    name:"cylinder-test.svg",
    mimeType:"image/svg+xml",
    buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="white"/><rect x="10" y="10" width="780" height="780" fill="none" stroke="gray"/></svg>')
  });
  await page.waitForFunction(()=>document.getElementById("resetQuad")?.disabled===false);
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
      targetQuad:[{x:-.42,y:.3},{x:.62,y:.32},{x:1.38,y:.72},{x:-.36,y:.7}],
      surface:"cylinder",
      cylinder:{
        geometry:"3d",
        axis:"vertical",
        curvature:.72,
        topArc:.09,
        bottomArc:.055,
        targetQuad:[{x:.06,y:.16},{x:.94,y:.16},{x:.94,y:.88},{x:.06,y:.88}]
      },
      render:{opacity:.9,blend:"source-over",mesh:32}
    });
  });
  const binding=await page.evaluate(()=>window.gwbGetMockupBinding());
  assert.equal(binding.surface,"cylinder");
  assert.equal(binding.cylinder.axis,"vertical");
  assert.equal(binding.cylinder.geometry,"3d");
  assert.ok(Math.abs(binding.cylinder.topArc-.09)<1e-9);
  assert.ok(Math.abs(binding.cylinder.bottomArc-.055)<1e-9);
  assert.deepEqual(binding.targetQuad,[{x:-.42,y:.3},{x:.62,y:.32},{x:1.38,y:.72},{x:-.36,y:.7}],"Cylinder field must preserve coordinates outside the photo");
  assert.deepEqual(binding.cylinder.targetQuad,[{x:.06,y:.16},{x:.94,y:.16},{x:.94,y:.88},{x:.06,y:.88}],"3D cylinder body must preserve its visible tangent frame");
  const workspace=await page.evaluate(()=>{
    const canvas=document.getElementById("photoCanvas"),wrap=canvas.parentElement,view=window.gwbGetMockupPhotoView();
    const px=x=>view.photoX+x*view.photoW;
    return {
      className:wrap.className,
      clientWidth:wrap.clientWidth,
      scrollWidth:wrap.scrollWidth,
      canvasWidth:canvas.width,
      photoWidth:view.photoW,
      photoX:view.photoX,
      xMin:view.xMin,
      xMax:view.xMax,
      leftCylinderHandle:px(.06),
      rightCylinderHandle:px(.94),
      leftFieldHandle:px(-.42),
      rightFieldHandle:px(1.38)
    };
  });
  assert.match(workspace.className,/cylinderWorkspace/);
  assert.ok(workspace.scrollWidth>workspace.clientWidth*1.5,"Cylinder workspace must be horizontally scrollable");
  assert.ok(workspace.canvasWidth>workspace.photoWidth*2.9,"Cylinder workspace must span about three photo widths");
  assert.ok(workspace.leftCylinderHandle>0&&workspace.leftCylinderHandle<workspace.canvasWidth,"Left cylinder handle must be visible inside workspace");
  assert.ok(workspace.rightCylinderHandle>0&&workspace.rightCylinderHandle<workspace.canvasWidth,"Right cylinder handle must be visible inside workspace");
  assert.ok(workspace.leftFieldHandle>0&&workspace.rightFieldHandle<workspace.canvasWidth,"Out-of-photo field handles must be visible inside workspace");
  assert.ok(workspace.xMin<=-1&&workspace.xMax>=2,"Workspace must expose virtual photo-relative coordinates beyond both sides");
  const summary=await page.locator("#profileSummary").textContent();
  assert.match(summary,/цилиндр 3D · вертикальная ось · верх 9% · дно 6%/);
  const cylinder3d=await page.evaluate(()=>window.gwbGetCylinder3D());
  assert.equal(cylinder3d.axis,"vertical");
  assert.ok(Math.abs(cylinder3d.topArc-.09)<1e-9);
  assert.ok(Math.abs(cylinder3d.bottomArc-.055)<1e-9);
  assert.equal(await page.locator("#cylinderTopArc").inputValue(),"9");
  assert.equal(await page.locator("#cylinderBottomArc").inputValue(),"6");
  assert.match(summary,/задняя сторона скрывается/);
  const projection=await page.evaluate(async()=>{
    const mod=await import("./assets/mockup-cylinder.mjs?v=20261005-3");
    const range=mod.cylinderVisibleRange(.84);
    return {range,left:mod.cylinderProjection(0,.84),center:mod.cylinderProjection(.5,.84),right:mod.cylinderProjection(1,.84)};
  });
  assert.equal(projection.range.clipped,true);
  assert.ok(projection.range.start>0&&projection.range.end<1);
  assert.equal(projection.left.visible,false);
  assert.equal(projection.center.visible,true);
  assert.equal(projection.right.visible,false);
  await page.locator("#cylinderTopArc").evaluate(el=>{el.value="12";el.dispatchEvent(new Event("input",{bubbles:true}))});
  await page.locator("#cylinderBottomArc").evaluate(el=>{el.value="7";el.dispatchEvent(new Event("input",{bubbles:true}))});
  const changed=await page.evaluate(()=>window.gwbGetMockupBinding().cylinder);
  assert.ok(Math.abs(changed.topArc-.12)<1e-9);
  assert.ok(Math.abs(changed.bottomArc-.07)<1e-9);
  await page.locator("#editCylinder").click();
  assert.match(await page.locator("#photoCanvasHint").textContent(),/зелёную рамку/);
  await page.locator("#editField").click();
  assert.match(await page.locator("#photoCanvasHint").textContent(),/синюю рамку/);
  await page.close();
  console.log("Mockup cylinder: 3D rims, expanded workspace, out-of-frame field, profile persistence and back-face clipping passed");
}
