import fs from 'node:fs';
import assert from 'node:assert/strict';

function makeNumericPdf() {
  const stream = [
    'q',
    '0 0.65 0.85 RG',
    '1 w',
    '40 60 200 250 re S',
    '340 60 200 250 re S',
    'Q',
    'BT /F1 12 Tf 46 292 Td (1) Tj ET',
    'BT /F1 12 Tf 346 292 Td (2) Tj ET',
    ''
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf='%PDF-1.4\n', offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets.push(Buffer.byteLength(pdf,'ascii'));
    pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref=Buffer.byteLength(pdf,'ascii');
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++) pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf,'ascii');
}



function makeUnlabeledTwoFieldPdf() {
  const stream = [
    'q',
    '0 0.65 0.85 RG',
    '1 w',
    '40 60 200 250 re S',
    '340 60 200 250 re S',
    'Q',
    ''
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}endstream`
  ];
  let pdf='%PDF-1.4\n', offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets.push(Buffer.byteLength(pdf,'ascii'));
    pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref=Buffer.byteLength(pdf,'ascii');
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++) pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf,'ascii');
}

function makeUnlabeledSingleFieldPdf() {
  const stream = [
    'q',
    '0 0.65 0.85 RG',
    '1 w',
    '40 60 200 250 re S',
    'Q',
    ''
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}endstream`
  ];
  let pdf='%PDF-1.4\n', offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets.push(Buffer.byteLength(pdf,'ascii'));
    pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref=Buffer.byteLength(pdf,'ascii');
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++) pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf,'ascii');
}


function makeOpacity98ArbitraryFieldPdf(fillOpacity = 0.02) {
  // Non-rectangular Bezier field. It has no colored stroke and no text label;
  // the only field marker is a 2% opaque fill (= 98% transparency).
  const stream = [
    'q',
    '/GS98 gs',
    '0.5 g',
    '40 60 m',
    '170 35 245 125 205 245 c',
    '135 290 45 245 25 145 c',
    '18 105 22 78 40 60 c',
    'h',
    'f',
    'Q',
    ''
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 340] /Resources << /ExtGState << /GS98 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}endstream`,
    `<< /Type /ExtGState /ca ${fillOpacity} /CA 1 >>`
  ];
  let pdf='%PDF-1.4\n', offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets.push(Buffer.byteLength(pdf,'ascii'));
    pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref=Buffer.byteLength(pdf,'ascii');
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++) pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf,'ascii');
}

function makeRealSignatureOpacityFieldPdf(signature) {
  const pageHeight=Number(signature.pdf.pageRectPt[3]);
  const pts=signature.pdf.polygonPt.map(([x,y])=>[Number(x),pageHeight-Number(y)]);
  const path=[`${pts[0][0]} ${pts[0][1]} m`,...pts.slice(1).map(([x,y])=>`${x} ${y} l`),`${pts[0][0]} ${pts[0][1]} l`];
  const stream=[
    'q',
    '/GS98 gs',
    '0.9647 0.1216 0.1725 rg',
    ...path,
    'f*',
    'Q',
    ''
  ].join('\n');
  const width=Number(signature.pdf.pageRectPt[2]);
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${pageHeight}] /Resources << /ExtGState << /GS98 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}endstream`,
    `<< /Type /ExtGState /ca ${signature.pdf.fillAlpha} /CA 1 >>`
  ];
  let pdf='%PDF-1.4\n',offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf,'ascii'));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf,'ascii');
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf,'ascii');
}

function makeAnnotationNumericPdf() {
  const stream = [
    'q',
    '0 0.65 0.85 RG',
    '1 w',
    '40 60 200 250 re S',
    '340 60 200 250 re S',
    'Q',
    ''
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R /Annots [6 0 R 7 0 R] >>',
    `<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Annot /Subtype /FreeText /Rect [44 292 56 306] /Contents (1) /DA (/F1 12 Tf 0 g) /F 4 >>',
    '<< /Type /Annot /Subtype /FreeText /Rect [344 292 356 306] /Contents (2) /DA (/F1 12 Tf 0 g) /F 4 >>'
  ];
  let pdf='%PDF-1.4\n', offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets.push(Buffer.byteLength(pdf,'ascii'));
    pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref=Buffer.byteLength(pdf,'ascii');
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++) pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf,'ascii');
}

export async function verifyPdfLabels(frame) {
  // Exercise real PDF.js text extraction, vector detection and the editor dropdown.
  await frame.locator('#manualTemplate').setInputFiles({name:'reversed.pdf',mimeType:'application/pdf',buffer:fs.readFileSync('tests/fixtures/reversed.pdf')});
  await frame.waitForFunction(()=>document.querySelectorAll('#fields option').length===3);
  const options=await frame.locator('#fields option').allTextContents();
  assert.match(options[1],/^оборот · стр\./);
  assert.match(options[2],/^лицо · стр\./);
  assert.match(options[1],/Y 73/);
  assert.match(options[2],/Y 123/);
  console.log('PDF text → geometry (reversed print IDs):',JSON.stringify(options));

  // Same PDF through the order adapter: the order lists face first, PDF draws back first.
  await frame.parentFrame().evaluate(base64=>{
    window.__gwbTemplateOverride=base64;
  },fs.readFileSync('tests/fixtures/reversed.pdf').toString('base64'));
  await frame.evaluate(async()=>{document.getElementById('order').value='7920510';await document.getElementById('loadOrder').onclick();});
  await frame.waitForFunction(()=>document.getElementById('orderLoading').hidden && document.querySelectorAll('#orderFieldChoice option').length===3);
  const names=await frame.locator('#orderFieldChoice option').allTextContents();
  assert.match(names[1],/^оборот · LM1:/);assert.match(names[2],/^лицо · LM1:/);
  assert.equal(await frame.locator('#fieldChoiceHint').evaluate(e=>e.classList.contains('unmatched')),false);
  console.log('Order validates PDF names without reordering:',JSON.stringify(names));
  for(const fixture of ['wrong','missing']) {
    await frame.parentFrame().evaluate(base64=>{window.__gwbTemplateOverride=base64;},fs.readFileSync(`tests/fixtures/${fixture}.pdf`).toString('base64'));
    await frame.evaluate(async()=>{document.getElementById('order').value='7920509';await document.getElementById('loadOrder').onclick();});
    await frame.waitForFunction(()=>document.getElementById('orderLoading').hidden && document.querySelectorAll('#orderFieldChoice option').length===2 && document.getElementById('fieldChoiceHint').classList.contains('unmatched'));
    assert.equal(await frame.locator('#orderFieldChoice').inputValue(),'');
    assert.equal(await frame.locator('#editorStep3').evaluate(e=>e.hidden),true);
    const hint=await frame.locator('#fieldChoiceHint').textContent();
    assert.match(hint,/Не удалось однозначно сопоставить места нанесения/);assert.match(hint,/Автовыбор отключён/);
    assert.doesNotMatch(hint,/Контроль мест|Подписи PDF/);
    const names=await frame.locator('#orderFieldChoice option').allTextContents();
    assert.equal(names.some(n=>/лицо/.test(n)),false);
    console.log(`Equal-count ${fixture} label safely blocked:`,JSON.stringify(names));
  }

  // Real Gifts chain: the order page exposes ",1 -> лицо" and ",2 -> оборот";
  // the template popup repeats those selected-application IDs as "(1)" and "(2)";
  // the PDF contains the corresponding numbered fields.
  const numericPdf=makeUnlabeledTwoFieldPdf();
  await frame.parentFrame().evaluate(base64=>{window.__gwbTemplateOverride=base64;},numericPdf.toString('base64'));
  await frame.evaluate(async()=>{
    document.getElementById('order').value='7920514';
    await document.getElementById('loadOrder').onclick();
  });
  await frame.waitForFunction(()=>{
    const loading=document.getElementById('orderLoading');
    return loading?.hidden===true &&
      document.querySelectorAll('#orderFieldChoice option').length===3 &&
      document.getElementById('orderEditor')?.hidden===false;
  });

  const numericState=await frame.evaluate(()=>({
    options:[...document.querySelectorAll('#orderFieldChoice option')].map(o=>o.textContent||''),
    hint:document.getElementById('fieldChoiceHint')?.textContent||'',
    unmatched:document.getElementById('fieldChoiceHint')?.classList.contains('unmatched')===true,
    selected:document.getElementById('orderFieldChoice')?.value||'',
    step3Hidden:document.getElementById('editorStep3')?.hidden===true,
    rows:[...document.querySelectorAll('#orderTemplateList .article-row')].map(row=>({
      key:row.querySelector('.detail-key')?.textContent?.trim()||'',
      value:row.querySelector('.detail-value')?.textContent?.trim()||''
    }))
  }));
  assert.match(numericState.options[1],/^лицо · LM1: Лазерная гравировка,1$/);
  assert.match(numericState.options[2],/^оборот · LM1: Лазерная гравировка,2$/);
  assert.equal(numericState.unmatched,false);
  assert.equal(numericState.selected,'');
  assert.equal(numericState.step3Hidden,true);
  assert.match(numericState.hint,/Места: лицо, оборот/i);
  assert.match(numericState.rows.find(r=>r.key==='Место 1')?.value||'',/лицо/);
  assert.match(numericState.rows.find(r=>r.key==='Место 2')?.value||'',/оборот/);
  assert.equal(numericState.rows.some(r=>r.key==='Контроль мест'),false);
  assert.equal(numericState.rows.some(r=>r.key==='Подписи PDF'),false);

  await frame.selectOption('#orderFieldChoice',{index:1});
  await frame.waitForFunction(()=>document.getElementById('editorStep3')?.hidden===false);
  assert.equal(await frame.locator('#orderFieldChoice').inputValue(),'0');
  console.log('Order application IDs mapped to numbered PDF fields:',JSON.stringify(numericState));



  // Order-global application id 4 becomes PDF-local print1. Normal colored
  // field detection finds nothing; the field is an arbitrary Bezier path whose
  // fill has 98% transparency (2% opacity), so the new fallback must find it.
  // The real Chromium/Skia Gifts template 7987235_12393.89.pdf stores the
  // nominal 98% transparent field as /ca .025. Keep the observed real-file
  // signature in the repo and exercise that exact alpha in the browser fixture.
  const realOpacitySignature=JSON.parse(fs.readFileSync('tests/fixtures/7987235_12393.89.real-signature.json','utf8'));
  assert.equal(realOpacitySignature.fixture,'7987235_12393.89.pdf');
  assert.equal(realOpacitySignature.sha256,'2095e577e7c512b6a21bd015ab32f78111bcbbc5663dceb11f2d98a8949a96c6');
  assert.equal(realOpacitySignature.pdf.fillAlpha,0.025);
  const singlePdf=makeOpacity98ArbitraryFieldPdf(realOpacitySignature.pdf.fillAlpha);
  const opacityOps=await frame.evaluate(async base64=>{
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const pdf=await globalThis.pdfjsLib.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:false}).promise;
    const page=await pdf.getPage(1);
    const list=await page.getOperatorList();
    const names=new Map(Object.entries(globalThis.pdfjsLib.OPS||{}).map(([name,id])=>[id,name]));
    const rows=list.fnArray.map((fn,index)=>({name:names.get(fn)||String(fn),args:list.argsArray[index]}))
      .filter(row=>/GState|Fill|constructPath|fill|stroke/i.test(row.name));
    await pdf.destroy();
    return rows;
  },singlePdf.toString('base64'));
  console.log('98% opacity PDF operator diagnostics:',JSON.stringify(opacityOps));
  await frame.parentFrame().evaluate(base64=>{window.__gwbTemplateOverride=base64;},singlePdf.toString('base64'));
  await frame.evaluate(async()=>{
    document.getElementById('order').value='7920515';
    await document.getElementById('loadOrder').onclick();
  });
  await frame.waitForFunction(()=>{
    const loading=document.getElementById('orderLoading');
    return loading?.hidden===true &&
      document.querySelectorAll('#orderFieldChoice option').length===2 &&
      document.getElementById('orderEditor')?.hidden===false;
  });
  const singleState=await frame.evaluate(()=>({
    options:[...document.querySelectorAll('#orderFieldChoice option')].map(o=>o.textContent||''),
    hint:document.getElementById('fieldChoiceHint')?.textContent||'',
    unmatched:document.getElementById('fieldChoiceHint')?.classList.contains('unmatched')===true,
    selected:document.getElementById('orderFieldChoice')?.value||'',
    rows:[...document.querySelectorAll('#orderTemplateList .article-row')].map(row=>({
      key:row.querySelector('.detail-key')?.textContent?.trim()||'',
      value:row.querySelector('.detail-value')?.textContent?.trim()||''
    }))
  }));
  assert.match(singleState.options[1],/^оборот · DTF1: Печать DTF,4$/);
  assert.equal(singleState.unmatched,false);
  assert.match(singleState.hint,/Места: оборот/);
  assert.match(singleState.rows.find(r=>r.key==='Место')?.value||'',/оборот/);
  assert.equal(singleState.rows.some(r=>r.key==='Контроль мест'),false);
  assert.equal(singleState.rows.some(r=>r.key==='Подписи PDF'),false);
  console.log('98% transparent arbitrary field -> application 4 -> local print1:',JSON.stringify(singleState));

  // Recreate the actual rotated 200 x 100 mm umbrella field from the recorded
  // 7987235 template signature. This verifies that geometry is preserved rather
  // than reduced to its ~212 x 212 mm axis-aligned bounding box.
  const rotatedPdf=makeRealSignatureOpacityFieldPdf(realOpacitySignature);
  await frame.parentFrame().evaluate(base64=>{window.__gwbTemplateOverride=base64;},rotatedPdf.toString('base64'));
  await frame.evaluate(async()=>{
    document.getElementById('order').value='7920515';
    await document.getElementById('loadOrder').onclick();
  });
  await frame.waitForFunction(()=>document.getElementById('orderLoading').hidden && document.querySelectorAll('#orderFieldChoice option').length===2);
  await frame.selectOption('#orderFieldChoice',{index:1});
  await frame.waitForFunction(()=>/по прозрачной заливке/.test(document.getElementById('fieldSize')?.textContent||''));
  const rotatedState=await frame.evaluate(()=>({
    fieldSize:document.getElementById('fieldSize')?.textContent||'',
    selected:document.getElementById('orderFieldChoice')?.value||'',
    option:document.querySelector('#orderFieldChoice option:nth-child(2)')?.textContent||''
  }));
  assert.equal(rotatedState.selected,'0');
  assert.match(rotatedState.fieldSize,/200(?:[.,]0+)? × 100(?:[.,]0+)? мм/);
  assert.match(rotatedState.fieldSize,/по прозрачной заливке/);
  assert.doesNotMatch(rotatedState.fieldSize,/212(?:[.,]\d+)? × 212/);
  console.log('Real 7987235 rotated field geometry preserved:',JSON.stringify(rotatedState));

  // Verify the PDF exporter clips with the same rotated path, not its bbox.
  const logoSvg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect width="200" height="100" fill="#111"/></svg>');
  await frame.locator('#artwork').setInputFiles({name:'clip-test.svg',mimeType:'image/svg+xml',buffer:logoSvg});
  await frame.waitForFunction(()=>document.getElementById('step4Box')?.hidden===false && document.getElementById('editorClip')?.disabled===false);
  await frame.locator('#editorClip').check();
  const downloadPromise=frame.page().waitForEvent('download',{timeout:30000});
  await frame.locator('#export').click();
  const exported=await downloadPromise;
  const exportedPath=await exported.path();
  assert.ok(exportedPath,'Exported PDF has no temporary path');
  const exportedBytes=fs.readFileSync(exportedPath);
  const clipDiagnostics=await frame.evaluate(async ({base64,signature})=>{
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const pdf=await globalThis.pdfjsLib.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:false}).promise;
    const page=await pdf.getPage(1);
    const list=await page.getOperatorList();
    const ops=globalThis.pdfjsLib.OPS||{};
    const flatten=value=>{
      const out=[];
      const walk=v=>{
        if(v==null)return;
        if(ArrayBuffer.isView(v)){for(const x of v)out.push(Number(x));return;}
        if(Array.isArray(v)){for(const x of v)walk(x);return;}
        if(typeof v==='object'){
          const keys=Object.keys(v).filter(k=>/^\\d+$/.test(k)).sort((a,b)=>Number(a)-Number(b));
          if(keys.length){for(const k of keys)walk(v[k]);return;}
        }
        const n=Number(v);if(Number.isFinite(n))out.push(n);
      };
      walk(value);return out;
    };
    const H=Number(signature.pdf.pageRectPt[3]);
    const p0=[Number(signature.pdf.polygonPt[0][0]),H-Number(signature.pdf.polygonPt[0][1])];
    const p1=[Number(signature.pdf.polygonPt[1][0]),H-Number(signature.pdf.polygonPt[1][1])];
    let matchingContours=0,clipOps=0;
    for(let i=0;i<list.fnArray.length;i++){
      const fn=list.fnArray[i],args=list.argsArray[i];
      if(fn===ops.clip||fn===ops.eoClip)clipOps++;
      if(fn!==ops.constructPath)continue;
      const raw=flatten(args?.[1]);
      for(let j=0;j+5<raw.length;j++){
        if(raw[j]===0 &&
           Math.abs(raw[j+1]-p0[0])<0.1 && Math.abs(raw[j+2]-p0[1])<0.1 &&
           raw[j+3]===1 &&
           Math.abs(raw[j+4]-p1[0])<0.1 && Math.abs(raw[j+5]-p1[1])<0.1){
          matchingContours++;break;
        }
      }
    }
    await pdf.destroy();
    return{matchingContours,clipOps,size:bytes.byteLength};
  },{base64:exportedBytes.toString('base64'),signature:realOpacitySignature});
  assert.ok(clipDiagnostics.clipOps>=1,'Exported PDF contains no clipping operation');
  assert.ok(clipDiagnostics.matchingContours>=2,'Exporter did not repeat the real rotated field contour for clipping: '+JSON.stringify(clipDiagnostics));
  console.log('Export clips by real rotated contour:',JSON.stringify(clipDiagnostics));

  // Same fallback, but the digits exist only as PDF FreeText annotations.
  const annotationPdf=makeAnnotationNumericPdf();
  await frame.parentFrame().evaluate(base64=>{window.__gwbTemplateOverride=base64;},annotationPdf.toString('base64'));
  await frame.evaluate(async()=>{
    document.getElementById('order').value='7920514';
    await document.getElementById('loadOrder').onclick();
  });
  await frame.waitForFunction(()=>{
    const loading=document.getElementById('orderLoading');
    return loading?.hidden===true &&
      document.querySelectorAll('#orderFieldChoice option').length===3 &&
      document.getElementById('orderEditor')?.hidden===false;
  });
  const annotationState=await frame.evaluate(()=>({
    options:[...document.querySelectorAll('#orderFieldChoice option')].map(o=>o.textContent||''),
    hint:document.getElementById('fieldChoiceHint')?.textContent||'',
    unmatched:document.getElementById('fieldChoiceHint')?.classList.contains('unmatched')===true
  }));
  assert.match(annotationState.options[1],/лицо/);
  assert.match(annotationState.options[2],/оборот/);
  assert.equal(annotationState.unmatched,false);
  assert.match(annotationState.hint,/лицо/);
  assert.match(annotationState.hint,/оборот/);
  console.log('Annotation-only PDF uses order application-ID place names:',JSON.stringify(annotationState));

}
