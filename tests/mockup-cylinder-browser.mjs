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
  const smallPhoto="data:image/svg+xml;base64,"+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="gray"/></svg>').toString("base64");
  const largePhoto="data:image/svg+xml;base64,"+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/></svg>').toString("base64");
  await page.evaluate(async ({smallPhoto,largePhoto})=>{
    await window.gwbApplyMockupHandoff({
      article:"PHOTO-FILTER-TEST",
      place:"лицо",
      method:"TEST",
      photoCandidates:[
        {id:"small",name:"Маленькая 240×240",dataUrl:smallPhoto},
        {id:"large",name:"Рабочая 800×600",dataUrl:largePhoto}
      ],
      fieldCandidates:[{id:"field-1",printId:"print1",place:"лицо",bounds:{x:.2,y:.2,w:.4,h:.4}}]
    });
  },{smallPhoto,largePhoto});
  const photoFilter=await page.evaluate(()=>window.gwbGetArticlePhotoFilter());
  assert.equal(photoFilter.minLongSide,500);
  assert.equal(photoFilter.minShortSide,300);
  assert.equal(photoFilter.count,1,"Small article thumbnails must not enter the photo candidate list");
  assert.deepEqual(photoFilter.photos.map(p=>p.id),["large"]);
  assert.match(await page.locator("#status").textContent(),/Маленьких фото исключено: 1/);
  const mappingStatus=page.locator("#mappingOperationStatus");
  assert.equal(await mappingStatus.isHidden(),true);
  await page.evaluate(()=>window.gwbSetMappingOperationStatus("pending","Сохранение привязки…"));
  assert.equal(await mappingStatus.isVisible(),true);
  assert.equal(await mappingStatus.getAttribute("data-state"),"pending");
  assert.equal((await mappingStatus.textContent()).trim(),"Сохранение привязки…");
  await page.evaluate(()=>window.gwbSetMappingOperationStatus("success","Привязка изменена · Git abc1234"));
  assert.equal(await mappingStatus.getAttribute("data-state"),"success");
  assert.match(await mappingStatus.textContent(),/Привязка изменена/);
  await page.evaluate(()=>window.gwbSetMappingOperationStatus("error","Ошибка Git: тест"));
  assert.equal(await mappingStatus.getAttribute("data-state"),"error");
  assert.match(await mappingStatus.textContent(),/Ошибка Git/);
  await page.evaluate(()=>window.gwbSetMappingOperationStatus("idle",""));
  assert.equal(await mappingStatus.isHidden(),true);
  await page.locator("#photoFile").setInputFiles({
    name:"cylinder-test.svg",
    mimeType:"image/svg+xml",
    buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="white"/><rect x="10" y="10" width="780" height="780" fill="none" stroke="gray"/></svg>')
  });
  await page.waitForFunction(()=>document.getElementById("resetQuad")?.disabled===false);
  await page.locator("#artworkFile").setInputFiles({
    name:"artwork-red.svg",
    mimeType:"image/svg+xml",
    buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="rgb(220,30,30)"/></svg>')
  });
  await page.waitForFunction(()=>document.getElementById("toggleArtwork")?.disabled===false);
  assert.equal(await page.locator("#cylinderControls").isHidden(),true);
  await page.locator("#surface").selectOption("cylinder");
  assert.equal(await page.locator("#cylinderControls").isVisible(),true);
  assert.match(await page.locator("#photoCanvasHint").textContent(),/зелёный 3D-каркас/);
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
  await page.waitForTimeout(80);
  const rendered3D=await page.evaluate(()=>{
    const canvas=document.getElementById("photoCanvas"),view=window.gwbGetMockupPhotoView(),ctx=canvas.getContext("2d");
    const x=Math.max(0,Math.round(view.photoX)),y=Math.max(0,Math.round(view.photoY));
    const w=Math.max(1,Math.min(canvas.width-x,Math.round(view.photoW))),h=Math.max(1,Math.min(canvas.height-y,Math.round(view.photoH)));
    const data=ctx.getImageData(x,y,w,h).data;
    let red=0;
    for(let i=0;i<data.length;i+=4)if(data[i]>150&&data[i+1]<100&&data[i+2]<100&&data[i+3]>80)red++;
    return {red,w,h};
  });
  assert.ok(rendered3D.red>1000,"3D cylinder mesh must render the artwork onto the photo: "+JSON.stringify(rendered3D));
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
    const mod=await import("./assets/mockup-cylinder.mjs?v=20261009-4");
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
  assert.match(await page.locator("#photoCanvasHint").textContent(),/зелёный 3D-каркас/);
  await page.locator("#editField").click();
  assert.match(await page.locator("#photoCanvasHint").textContent(),/синюю развёртку/);
  await page.evaluate(async()=>{
    const mod=await import("./assets/mockup-cylinder.mjs?v=20261009-4");
    const surface=[{x:.08,y:.12},{x:.92,y:.14},{x:.94,y:.88},{x:.06,y:.86}];
    const opts={axis:"vertical",curvature:.72,topArc:.12,bottomArc:.07};
    const fieldLocal=[{x:.28,y:.3},{x:.52,y:.3},{x:.52,y:.5},{x:.28,y:.5}];
    const targetQuad=fieldLocal.map(p=>mod.cylinder3DSurfacePoint(surface,p.x,p.y,opts)).map(p=>({x:p.x,y:p.y}));
    await window.gwbApplyMockupProfile({
      schema:"gifts-mockup-profile/v1",article:"CYL-ASPECT-TEST",place:"поле",method:"TEST",
      field:{id:"field-1",printId:"print1",place:"поле"},fieldRect:{x:.2,y:.2,w:.4,h:.3},
      targetQuad,surface:"cylinder",
      cylinder:{geometry:"3d",axis:"vertical",curvature:.72,topArc:.12,bottomArc:.07,targetQuad:surface},
      render:{opacity:.9,blend:"source-over",mesh:32}
    });
  });
  const aspectLabel=page.locator("#preserveFieldAspectLabel");
  assert.equal(await aspectLabel.isVisible(),true,"aspect-lock option must be visible in cylinder field-placement mode");
  assert.equal(await page.locator("#preserveFieldAspect").isChecked(),false);
  const beforeAspect=await page.evaluate(async()=>{
    const mod=await import("./assets/mockup-cylinder.mjs?v=20261009-4"),b=window.gwbGetMockupBinding(),opts={axis:b.cylinder.axis,curvature:b.cylinder.curvature,topArc:b.cylinder.topArc,bottomArc:b.cylinder.bottomArc};
    const q=b.targetQuad.map(p=>mod.cylinder3DInverseSurfacePoint(b.cylinder.targetQuad,p,opts));
    const width=(Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y)+Math.hypot(q[2].x-q[3].x,q[2].y-q[3].y))/2;
    const height=(Math.hypot(q[3].x-q[0].x,q[3].y-q[0].y)+Math.hypot(q[2].x-q[1].x,q[2].y-q[1].y))/2;
    return {ratio:width/height,anchor:q[0]};
  });
  await page.locator("#preserveFieldAspect").check();
  const dragPoints=await page.evaluate(async()=>{
    const mod=await import("./assets/mockup-cylinder.mjs?v=20261009-4"),b=window.gwbGetMockupBinding(),view=window.gwbGetMockupPhotoView(),canvas=document.getElementById("photoCanvas"),r=canvas.getBoundingClientRect(),opts={axis:b.cylinder.axis,curvature:b.cylinder.curvature,topArc:b.cylinder.topArc,bottomArc:b.cylinder.bottomArc};
    const client=p=>({x:r.left+(view.photoX+p.x*view.photoW)*(r.width/canvas.width),y:r.top+(view.photoY+p.y*view.photoH)*(r.height/canvas.height)});
    return {start:client(b.targetQuad[2]),end:client(mod.cylinder3DSurfacePoint(b.cylinder.targetQuad,.78,.78,opts))};
  });
  await page.mouse.move(dragPoints.start.x,dragPoints.start.y);
  await page.mouse.down();
  await page.mouse.move(dragPoints.end.x,dragPoints.end.y,{steps:8});
  await page.mouse.up();
  const afterAspect=await page.evaluate(async()=>{
    const mod=await import("./assets/mockup-cylinder.mjs?v=20261009-4"),b=window.gwbGetMockupBinding(),opts={axis:b.cylinder.axis,curvature:b.cylinder.curvature,topArc:b.cylinder.topArc,bottomArc:b.cylinder.bottomArc};
    const q=b.targetQuad.map(p=>mod.cylinder3DInverseSurfacePoint(b.cylinder.targetQuad,p,opts));
    const width=(Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y)+Math.hypot(q[2].x-q[3].x,q[2].y-q[3].y))/2;
    const height=(Math.hypot(q[3].x-q[0].x,q[3].y-q[0].y)+Math.hypot(q[2].x-q[1].x,q[2].y-q[1].y))/2;
    return {ratio:width/height,anchor:q[0],preserved:b.cylinder.preserveFieldAspect};
  });
  assert.ok(Math.abs(afterAspect.ratio-beforeAspect.ratio)<1e-5,"field ratio changed despite aspect lock: "+JSON.stringify({beforeAspect,afterAspect}));
  assert.ok(Math.abs(afterAspect.anchor.x-beforeAspect.anchor.x)<1e-6&&Math.abs(afterAspect.anchor.y-beforeAspect.anchor.y)<1e-6,"opposite corner must stay anchored");
  assert.equal(afterAspect.preserved,true,"aspect-lock preference must persist in the profile");
  await page.close();
  console.log("Mockup cylinder: small-photo filtering, mapping status UI, 3D rims, expanded workspace, out-of-frame geometry, profile persistence and back-face clipping passed");
}
