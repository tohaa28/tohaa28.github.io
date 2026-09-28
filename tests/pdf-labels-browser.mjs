import fs from 'node:fs';
import assert from 'node:assert/strict';

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
}
