// Synthetic browser-only LAN integration. This test does not contact
// psk.testgifts.local, never reads customer orders and never needs VPN.
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const built=await readFile('vision-order-overlay.js','utf8');
const script='https://tohaa28.github.io/gifts-layout-workbench-vision/vision-order-overlay.js';
const local='http://psk.testgifts.local';
const vector='<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="80mm" viewBox="0 0 100 80">'+
  '<path fill="#123456" d="M10 20 H13 V65 H10 Z"/>'+
  '<path fill="#123456" d="M13.12 20 H16.12 V65 H13.12 Z"/></svg>';
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8">'+
  '<title>Local test order fixture</title></head><body>'+
  '<table id="orders"><thead><tr><th>Заказ</th><th>Макет</th></tr></thead><tbody>'+
  '<tr data-order-id="10001"><td>10001</td><td><a href="/files/a.svg">макет SVG</a></td></tr>'+
  '<tr data-order-id="10002"><td>10002</td><td><a href="/files/b.pdf">макет PDF</a></td></tr>'+
  '<tr data-order-id="10003"><td>10003</td><td><a href="http://files.testgifts.local/sensitive.pdf">макет не в этом origin</a></td></tr>'+
  '<tr data-order-id="10004"><td>10004</td><td><a href="/files/c.png">макет PNG</a></td></tr>'+
  '</tbody></table><div id="unmodified">ORIGINAL SITE DATA</div></body></html>';
const browser=await chromium.launch({headless:true});
try{
 for(const viewport of [{width:1420,height:900},{width:390,height:820}]){
  const context=await browser.newContext({viewport,acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  let foreign=0,artworkFetches=0;
  let raster=null;
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url===local+'/devorders?status=140')
     return route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:html});
   if(url===script||url.startsWith(script+'?'))
     return route.fulfill({status:200,contentType:'application/javascript;charset=utf-8',body:built});
   if(url===local+'/files/a.svg'){
     artworkFetches++;
     return route.fulfill({status:200,contentType:'image/svg+xml',body:vector});
   }
   if(url===local+'/files/b.pdf'){
     artworkFetches++;
     return route.fulfill({status:200,contentType:'application/pdf',
       body:'%PDF-1.4\n'+('0'.repeat(128))});
   }
   if(url===local+'/files/c.png'){
     artworkFetches++;
     return route.fulfill({status:200,contentType:'image/png',body:raster});
   }
   foreign++;return route.abort();
  });
  await page.goto(local+'/devorders?status=140');
  const encoded=await page.evaluate(()=>{
    const c=document.createElement('canvas');
    c.width=c.height=75;
    const x=c.getContext('2d');
    x.fillStyle='#fff';x.fillRect(0,0,75,75);
    x.fillStyle='#254166';x.fillRect(35,8,1,60);
    return c.toDataURL('image/png').split(',')[1];
  });
  raster=Buffer.from(encoded,'base64');
  await page.addScriptTag({url:script});
  assert.equal(await page.locator('#vision-local-order-overlay').count(),1);
  assert.equal(await page.locator('[data-vision-order-cell]').count(),4);
  assert.equal(artworkFetches,0,'No files downloaded before explicit click');
  const diagnosticDownload=page.waitForEvent('download');
  await page.locator('#vision-local-order-overlay button')
    .filter({hasText:'Диагностика таблицы'}).click();
  const diagnostic=JSON.parse(await readFile(
    await (await diagnosticDownload).path(),'utf8'));
  assert.equal(diagnostic.status,'ANONYMOUS_STRUCTURE_ONLY');
  assert.equal(diagnostic.table_count,1);
  assert.equal(diagnostic.recognized_rows,4);
  assert.equal(diagnostic.candidate_anchor_count,4);
  assert.equal(diagnostic.same_origin_candidate_count,3);
  assert.equal(diagnostic.cross_origin_or_unsafe_candidate_count,1);
  assert.equal(diagnostic.raw_artwork_bytes_included,false);
  assert.equal(JSON.stringify(diagnostic).includes('10001'),false);
  assert.equal(JSON.stringify(diagnostic).includes('/files/a.svg'),false);
  assert.equal(artworkFetches,0,'DOM diagnostics must not fetch any order file');
  assert.equal(await page.locator('#unmodified').innerText(),'ORIGINAL SITE DATA');
  await page.locator('#vision-local-order-overlay button').filter({hasText:'Проверить все заказы'}).click();
  await page.waitForFunction(()=>
    document.querySelectorAll('[data-vision-order-cell]')[3]?.textContent
      .includes('Растр:'),null,{timeout:20000});
  const labels=await page.locator('[data-vision-order-cell] .vlo-label').allTextContents();
  assert.match(labels[0],/исследованы/);
  assert.match(labels[1],/ручной проверки/);
  assert.match(labels[2],/ручная проверка/);
  assert.equal(artworkFetches,3,'Exactly 3 same-origin mock files');
  assert.equal(foreign,0,'No offsite file, telemetry or external request');
  await page.locator('[data-vision-order-cell] select').first().selectOption('confirmed_defect');
  const pending=page.waitForEvent('download');
  await page.locator('#vision-local-order-overlay button').filter({hasText:'Отчёт JSON'}).click();
  const saved=JSON.parse(await readFile(await (await pending).path(),'utf8'));
  assert.equal(saved.schema,'printcheck.vision.local-order-feedback.v1');
  assert.equal(saved.rows.length,4);
  assert.equal(saved.rows[0].expert_label,'confirmed_defect');
  assert.equal(saved.rows[0].artifacts[0].type,'svg');
  assert.ok(saved.rows[0].artifacts[0].detected_regions>0);
  assert.ok(Math.abs(saved.rows[0].artifacts[0].min_gap_document_mm-.12)<.01);
  assert.equal(saved.rows[1].artifacts[0].reason,'PDF_VECTOR_PAINT_PIPELINE_NOT_VERIFIED');
  assert.equal(saved.rows[2].excluded_links,1);
  assert.equal(saved.rows[3].artifacts[0].type,'raster');
  assert.equal(saved.production_approved,false);
  assert.equal(saved.source_artwork_included,false);
  assert.equal(saved.order_urls_included,false);
  assert.equal(saved.raw_artwork_bytes_included,false);
  const serialized=JSON.stringify(saved);
  assert.ok(!serialized.includes('/files/a.svg'));
  assert.ok(!serialized.includes('10001'),'No private order identifiers in exported report');
  // Opt-in artifact ZIP re-fetches ONLY the expert-labeled same-origin file.
  // Unlike the anonymous diagnostics, this explicitly downloaded ZIP
  // contains original test artwork; it is never uploaded by the code.
  page.once('dialog',async dialog=>dialog.accept());
  const zipDownload=page.waitForEvent('download');
  await page.locator('#vision-local-order-overlay button')
    .filter({hasText:'Локальные примеры ZIP'}).click();
  const zip=await readFile(await (await zipDownload).path());
  assert.equal(zip.readUInt32LE(0),0x04034b50);
  assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
  assert.ok(zip.includes(Buffer.from('samples/0001.svg')));
  assert.ok(zip.includes(Buffer.from('"training_ready": false')));
  assert.ok(zip.includes(Buffer.from('confirmed_defect')));
  assert.equal(artworkFetches,4,'Only one labeled SVG is locally re-fetched');
  assert.equal(foreign,0,'Expert ZIP must not upload to an external server');
  assert.deepEqual(errors,[]);
  await page.locator('#vision-local-order-overlay button').filter({hasText:'Закрыть'}).click();
  assert.equal(await page.locator('[data-vision-order-cell]').count(),0);
  assert.equal(await page.locator('#vision-local-order-overlay').count(),0);
  assert.equal(await page.locator('#orders tr[data-order-id]').count(),4);
  await context.close();
 }
 // Wrong origin never creates UI or performs file downloads.
 const context=await browser.newContext();
 const page=await context.newPage();
 let dialogs=0,network=0;
 page.on('dialog',async d=>{dialogs++;await d.dismiss()});
 await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='http://testgifts.local/devorders')
     return route.fulfill({status:200,contentType:'text/html',body:html});
   if(url===script)
     return route.fulfill({status:200,contentType:'application/javascript',body:built});
   network++;return route.abort();
 });
 await page.goto('http://testgifts.local/devorders');
 await page.addScriptTag({url:script});
 assert.equal(dialogs,1);
 assert.equal(await page.locator('#vision-local-order-overlay').count(),0);
 assert.equal(network,0);
 await context.close();
 console.log('Local orders overlay: LAN origin guard, SVG vector, PDF MANUAL, raster MLP, per-row UI, expert JSON, no external fetch PASS');
}finally{await browser.close()}
