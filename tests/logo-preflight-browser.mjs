import assert from 'node:assert/strict';
import fs from 'node:fs';

export async function verifyLogoPreflight(frame) {
  const compiled=fs.readFileSync(new URL('../assets/index-BpU9kvz8.js',import.meta.url),'utf8');
  assert.ok(compiled.includes('Q("Выберите место нанесения.")'), 'automatic article selection must preserve the place-selection hint');
  assert.ok(!compiled.includes('Артикул выбран автоматически.'), 'redundant automatic selection notice must not be displayed');
  // Run against the real loaded module in the launcher frame, with real SVG DOM,
  // PDF.js, PDF-lib and browser image decoding. No application state is injected.
  const result=await frame.evaluate(async()=>{
    const {inspectArtwork,checkLogo,resolveMethod}=await import('https://tohaa28.github.io/gifts-layout-workbench-mockups/assets/logo-preflight.mjs?v=20261008-3');
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><path d="M1 2H9" fill="none" stroke="black" stroke-width=".2"/><rect x="1" y="5" width="8" height="3" fill="red"/></svg>';
    const root=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
    const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(svg);await image.decode();
    const art={ext:'svg',w:10,h:10,svg:{root},image};art.preflight=await inspectArtwork(art);
    const run=(method,size=10)=>checkLogo({art,placement:{x:0,y:0,w:size,h:size},field:{},method});
    const pdf=await PDFLib.PDFDocument.create();const page=pdf.addPage([72,72]);page.drawText('Live text',{x:5,y:30,size:8});page.drawRectangle({x:5,y:5,width:20,height:10,opacity:.5});
    const bytes=await pdf.save();const doc=await pdfjsLib.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:false}).promise;
    const pdfArt={ext:'pdf',bytes:await pdf.save(),w:25.4,h:25.4,pdfPage:await doc.getPage(1),pages:1};pdfArt.preflight=await inspectArtwork(pdfArt,pdfjsLib.OPS);
    const pdfResult=checkLogo({art:pdfArt,placement:{w:25.4,h:25.4},field:{},method:'LM1'});await doc.destroy();
    const scaled=root.cloneNode(true);scaled.querySelector('path').setAttribute('transform','scale(2)');
    const transformed={...art,svg:{root:scaled}};transformed.preflight=await inspectArtwork(transformed);
    return {stroke:art.preflight.strokes[0]?.width,small:run('DTF1'),pad:run('A1'),large:run('DTF1',40),pdf:pdfResult,pdfColors:pdfArt.preflight.originalColorModels,transformed:transformed.preflight.strokes[0]?.width,unknown:resolveMethod('UV-DTF10')};
  });
  assert.ok(Math.abs(result.stroke-.2)<.01);
  assert.ok(result.small.findings.some(f=>f.id==='positive'&&f.status==='bad'));
  assert.ok(!result.pad.findings.some(f=>f.id==='positive'&&f.status==='bad'));
  assert.ok(!result.large.findings.some(f=>f.id==='positive'&&f.status==='bad'));
  assert.ok(result.pdf.findings.some(f=>f.id==='outlined-text'&&f.status==='bad'));
  assert.ok(result.pdf.findings.some(f=>f.id==='effects'&&f.status==='bad'));
  assert.ok(result.pdfColors?.includes('RGB'),'Original PDF color streams must be inspected before RGB rendering');
  assert.ok(Math.abs(result.transformed-.4)<.02);
  assert.equal(result.unknown.rule,null);

  // The field-upload prompt must be visible only inside a selected template field,
  // and must not persist on the whole-template view or after deselection.
  const fieldChoice=frame.locator('#orderFieldChoice');
  await fieldChoice.selectOption('');
  const deselectedStatus=await frame.evaluate(()=>{
    const e=document.querySelector('#status');
    return {message:e?.textContent||'',hidden:!!e?.hidden};
  });
  assert.ok(deselectedStatus.hidden||deselectedStatus.message!=='Загрузите логотип для выбранного поля.',
    'field-upload prompt must not remain visible after deselection; unrelated status messages remain allowed');
  await fieldChoice.selectOption('0');
  await frame.waitForFunction(()=>{
    const e=document.querySelector('#status');
    return e?.textContent==='Загрузите логотип для выбранного поля.'&&!e.hidden;
  });
  await frame.locator('#zoomPage').click();
  await frame.waitForFunction(()=>document.querySelector('#status')?.hidden===true);
  const wholeTemplateStatus=await frame.evaluate(()=>({
    message:document.querySelector('#status').textContent,
    hidden:document.querySelector('#status').hidden,
    pickHintHidden:document.querySelector('#templatePickHint').hidden
  }));
  assert.equal(wholeTemplateStatus.hidden,true,'prompt must disappear on whole-template view');
  await fieldChoice.selectOption('0');
  await frame.waitForFunction(()=>document.querySelector('#status')?.hidden===false);
  assert.equal(await frame.locator('#status').textContent(),'Загрузите логотип для выбранного поля.');

  // Current fixture is the real-signature umbrella template / B4 application 3.
  const upload=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><text x="1" y="5" font-size="2">Logo</text><path d="M1 7H9" fill="none" stroke="black" stroke-width="0.01"/></svg>');
  await frame.locator('#artwork').setInputFiles({name:'preflight-text.svg',mimeType:'image/svg+xml',buffer:upload});
  await frame.waitForFunction(()=>window.gwbLogoPreflight?.some(r=>r.findings.some(f=>f.id==='outlined-text')));
  await frame.waitForFunction(()=>document.getElementById('logoErrorOverlay')?.textContent.includes('поиск мелких элементов...'));
  const pendingDetail=await frame.locator('#logoErrorOverlay').textContent();
  assert.match(pendingDetail,/поиск мелких элементов\.\.\./,'Transient PrintCheck status must be shown until detail scan finishes');
  await frame.waitForFunction(()=>window.gwbDetailCheck?.entries?.some(e=>e.state==='done'),null,{timeout:30000});
  await frame.waitForFunction(()=>!document.getElementById('logoErrorOverlay')?.textContent.includes('поиск мелких элементов...'));
  const completedDetail=await frame.locator('#logoErrorOverlay').textContent();
  assert.match(completedDetail,/PrintCheck · мелкие элементы(?: проверены)?:/,'Transient PrintCheck status must be replaced by the completed detail result');
  let state=await frame.evaluate(()=>({reports:window.gwbLogoPreflight,disabled:document.getElementById('simpleExport').disabled,field:document.getElementById('fieldSize').textContent,visibleFieldSize:document.getElementById('selectedFieldSize')?.textContent||'',visibleFieldSizeHidden:document.getElementById('selectedFieldSize')?.hidden,templateSize:document.getElementById('dimensions')?.textContent||''}));
  assert.equal(state.reports[0].method,'B4');assert.equal(state.reports[0].rule.positive,.4);assert.equal(state.disabled,true);
  assert.match(state.field,/200\.00 × 100\.00/);
  assert.equal(state.visibleFieldSize,'Размер поля: 200.00 × 100.00 мм');
  assert.equal(state.visibleFieldSizeHidden,false);
  assert.equal(state.templateSize,'','Template size must be hidden while field view is open');
  await frame.locator('#zoomPage').click();
  await frame.waitForFunction(()=>document.getElementById('dimensions')?.textContent.startsWith('Размер шаблона:'));
  const wholeView=await frame.evaluate(()=>({templateSize:document.getElementById('dimensions')?.textContent||'',fieldSize:document.getElementById('fieldSize')?.textContent||'',visibleFieldSize:document.getElementById('selectedFieldSize')?.textContent||'',visibleFieldSizeHidden:document.getElementById('selectedFieldSize')?.hidden}));
  assert.match(wholeView.templateSize,/^Размер шаблона: .* мм$/);
  assert.equal(wholeView.visibleFieldSize,'');
  assert.equal(wholeView.visibleFieldSizeHidden,true);
  assert.doesNotMatch(wholeView.fieldSize,/×/,'Field dimensions must be hidden in whole-template view');
  await frame.locator('#orderFieldChoice').evaluate(el=>el.dispatchEvent(new Event('change',{bubbles:true})));
  await frame.waitForFunction(()=>document.getElementById('selectedFieldSize')?.hidden===false&&document.getElementById('dimensions')?.textContent==='');
  assert.equal(await frame.locator('#dimensions').textContent(),'');
  assert.equal(await frame.locator('#preflightMarkers').isChecked(),true);assert.equal(await frame.locator('#preflightMarkers').isVisible(),false);
  await frame.locator('#logoPreflight summary').click();
  if(process.env.PREFLIGHT_SCREENSHOT)await frame.page().screenshot({path:process.env.PREFLIGHT_SCREENSHOT,fullPage:false});
  await frame.locator('#confirmErrors').check();
  assert.equal(await frame.locator('#simpleExport').isDisabled(),false);
  await frame.locator('#width').evaluate(el=>{el.value='20';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await frame.locator('#confirmErrors').isChecked(),false);
  assert.equal(await frame.locator('#simpleExport').isDisabled(),true);
  const downloadPromise=frame.page().waitForEvent('download');
  await frame.getByRole('button',{name:'Скачать диагностику JSON'}).click();
  const download=await downloadPromise;assert.equal(download.suggestedFilename(),'logo-preflight.json');
  await frame.locator('#editorRemoveLogo').click();
  assert.deepEqual(await frame.evaluate(()=>window.gwbLogoPreflight),[]);
  await frame.locator('#orderTemplates').evaluate(el=>{el.value=[...el.options].find(o=>o.textContent.includes('16535.66')).value;el.dispatchEvent(new Event('change',{bubbles:true}));});
  await frame.waitForFunction(()=>[...document.querySelector('#orderFieldChoice').options].some(o=>o.textContent.includes('F1:')));
  await frame.locator('#orderFieldChoice').selectOption('0');
  await frame.waitForFunction(()=>{
    const button=document.getElementById('mockupModeButton');
    return button&&!button.hidden&&!button.classList.contains('readiness-locked')&&button.getAttribute('aria-disabled')!=='true';
  });
  const noLogoMockup=await frame.evaluate(async()=>{
    const payload=await window.gwbBuildMockupHandoff();
    return {
      fieldCount:Array.isArray(payload?.fieldCandidates)?payload.fieldCandidates.length:0,
      artworkDataUrl:String(payload?.artworkDataUrl||''),
      logoCount:Number(window.gwbGetMockupState?.().logoCount||0)
    };
  });
  assert.ok(noLogoMockup.fieldCount>0,'Mockup Lab handoff must expose template fields before a logo is added');
  assert.equal(noLogoMockup.logoCount,0,'Pre-logo Mockup Lab test must run without artwork');
  assert.equal(noLogoMockup.artworkDataUrl,'','Pre-logo Mockup Lab handoff must not require artwork');
  const twoColors=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="8" fill="red"/><rect x="6" y="1" width="3" height="8" fill="blue"/></svg>');
  await frame.locator('#artwork').setInputFiles({name:'two-colors.svg',mimeType:'image/svg+xml',buffer:twoColors});
  await frame.waitForFunction(()=>window.gwbLogoPreflight?.[0]?.method==='D1');
  const defaultFit=await frame.evaluate(async()=>{
    const handoff=await window.gwbBuildMockupHandoff();
    return {logoWidth:Number(document.getElementById('width').value),fieldWidth:Number(handoff?.selectedField?.bounds?.w||0)};
  });
  assert.ok(defaultFit.fieldWidth>0&&Math.abs(defaultFit.logoWidth/defaultFit.fieldWidth-.95)<.002,`Default logo fit should use 95% of field coordinates, got ${JSON.stringify(defaultFit)}`);
  await frame.locator('#fillEmpty').evaluate(el=>el.click());
  const multiple=await frame.evaluate(()=>window.gwbLogoPreflight);
  assert.deepEqual(multiple.map(r=>r.method),['D1','F1']);
  assert.ok(multiple[1].findings.some(f=>f.id==='colors'&&f.status==='bad'));
  assert.ok(!multiple[0].findings.some(f=>f.id==='colors'&&f.status==='bad'));
  const mockupTargets=await frame.evaluate(()=>window.gwbGetMockupTargets?.()||[]);
  assert.equal(mockupTargets.length,2,'Both filled fields must become mockup export targets');
  assert.deepEqual(mockupTargets.map(t=>t.fieldIndex),[0,1]);
  assert.deepEqual(mockupTargets.map(t=>t.place),['сторона b [черный(Black); белый(White)]','сторона а [черный(403/Black)]']);
  await frame.locator('#orderFieldChoice').selectOption('1');
  assert.equal((await frame.evaluate(()=>window.gwbLogoPreflight))[1].method,'F1');
  console.log('Logo preflight: pre-logo Mockup Lab access, actual SVG/PDF analysis, 95% default fit, multi-field mockup targets, method B4 + underbase, resizing, diagnostics, export confirmation and removal passed');
}
