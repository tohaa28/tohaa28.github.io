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

export async function verifyPdfLabels(frame) {
  // Exercise real PDF.js text extraction, vector detection and the editor dropdown.
  await frame.locator('#manualTemplate').setInputFiles({name:'reversed.pdf',mimeType:'application/pdf',buffer:fs.readFileSync('tests/fixtures/reversed.pdf')});
  await frame.waitForFunction(()=>document.querySelectorAll('#fields option').length===3);
  const options=await frame.locator('#fields option').allTextContents();
  assert.match(options[1],/оборот \[print2\]/);
  assert.match(options[2],/лицо \[print1\]/);
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
  assert.match(names[1],/оборот \[print2\]/);assert.match(names[2],/лицо \[print1\]/);
  assert.equal(await frame.locator('#fieldChoiceHint').evaluate(e=>e.classList.contains('unmatched')),false);
  console.log('Order validates PDF names without reordering:',JSON.stringify(names));
  for(const fixture of ['wrong','missing']) {
    await frame.parentFrame().evaluate(base64=>{window.__gwbTemplateOverride=base64;},fs.readFileSync(`tests/fixtures/${fixture}.pdf`).toString('base64'));
    await frame.evaluate(async()=>{document.getElementById('order').value='7920509';await document.getElementById('loadOrder').onclick();});
    await frame.waitForFunction(()=>document.getElementById('orderLoading').hidden && document.querySelectorAll('#orderFieldChoice option').length===2 && document.getElementById('fieldChoiceHint').classList.contains('unmatched'));
    assert.equal(await frame.locator('#orderFieldChoice').inputValue(),'');
    assert.equal(await frame.locator('#editorStep3').evaluate(e=>e.hidden),true);
    const hint=await frame.locator('#fieldChoiceHint').textContent();
    assert.match(hint,/1 в заказе = 1/);assert.match(hint,/Автовыбор отключён/);
    const names=await frame.locator('#orderFieldChoice option').allTextContents();
    assert.equal(names.some(n=>/лицо/.test(n)),false);
    console.log(`Equal-count ${fixture} label safely blocked:`,JSON.stringify(names));
  }

  // Real-world fallback: the order page exposes no place names, while the PDF
  // itself contains two colored fields explicitly numbered 1 and 2.
  const numericPdf=makeNumericPdf();
  await frame.parentFrame().evaluate(base64=>{window.__gwbTemplateOverride=base64;},numericPdf.toString('base64'));
  await frame.evaluate(async()=>{
    document.getElementById('order').value='7920513';
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
  assert.match(numericState.options[1],/Место 1/);
  assert.match(numericState.options[2],/Место 2/);
  assert.match(numericState.options[1],/P1: Шелкография с трансфером/);
  assert.equal(numericState.unmatched,false);
  assert.equal(numericState.selected,'');
  assert.equal(numericState.step3Hidden,true);
  assert.match(numericState.hint,/названия мест не указаны/i);
  assert.match(numericState.hint,/1, 2/);
  assert.match(numericState.rows.find(r=>r.key==='Контроль мест')?.value||'',/2 поля по явной нумерации PDF/);
  assert.match(numericState.rows.find(r=>r.key==='Подписи PDF')?.value||'',/Поля 1, 2 однозначно пронумерованы/);

  await frame.selectOption('#orderFieldChoice',{index:1});
  await frame.waitForFunction(()=>document.getElementById('editorStep3')?.hidden===false);
  assert.equal(await frame.locator('#orderFieldChoice').inputValue(),'0');
  console.log('Numbered PDF fallback without order place names:',JSON.stringify(numericState));

}
