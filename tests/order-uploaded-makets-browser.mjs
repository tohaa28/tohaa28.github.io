import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const ORDER='8006776',OID='7824901';
const filenames=[
 {id:'18311644',filename:'8006776_maket_2_201026_143328.pdf',original:'gerb2.pdf'},
 {id:'18311643',filename:'8006776_maket_1_201026_143328.pdf',original:'che.pdf'}
];
const uploaded=filenames.map(file=>
 '<div class="flex-item flex-main"><span class="size--md">'+
 '<a data-maket="true" href="https://gifts.ru/cart/act/mda?oid='+OID+'&amp;id='+file.id+'">'+file.filename+'</a>'+
 '</span><br><span class="size--sm"><span title="Исходное имя закачанного файла">'+file.original+'</span></span></div>'
).join('');
let uploadedExtra='';
const uploadForm='<form id="j_upload_area"><input type="hidden" name="oid" value="'+OID+'">'+
 '<input type="hidden" name="type" value="10"><input type="hidden" name="order" value="'+ORDER+'">'+
 '<input type="hidden" name="folder" value="S1"><input type="file" name="media_file[]" multiple></form>';
const malicious='<a data-maket="true" href="https://gifts.ru/cart/act/mda?oid=99999&amp;id=1234567">not-ours.pdf</a>'+
 '<a href="https://gifts.ru/drawing?action=getOrderItemPdf&amp;orderitemid=49428451">Шаблон конструктора</a>';
const orderHtml='<!doctype html><html><body>'+
 '<div id="j_cart_host" data-orderid="'+OID+'">'+
 '<li data-itemid="49428451" data-drawtaskids="27237891"><div class="cart-tbl-id">'+
 '<a class="cart-tbl-name">77700.60</a><div class="cart-tbl-lbl">Кружка</div></div>'+
 '<span class="cart-qty">5</span><div class="cart-tbl-imp"><g-droper>'+
 '<span>SB1: Сублимация/посуда,1</span></g-droper></div></li></div>'+
 '<template shadowrootmode="open"><div name="Макеты для заказа 8006776">'+uploadForm+uploaded+malicious+'</div></template>'+
 '</body></html>';
const ajaxHtml='<div><label>Загрузка макетов</label>'+uploadForm+uploaded+malicious+
 '<label>Шаблоны макетов</label></div>';
const pageHtml='<!doctype html><html><head><meta charset="utf-8"></head><body><div id="basketOrders">'+
 '<div class="basket-order"><div class="basket-order-title">Заказ №8006776</div></div></div>'+
 '<div id="orderEditor" style="width:300px;max-width:300px"><details id="orderTemplatePicker"></details>'+ 
 '<div id="stage"></div><div id="fieldLogoTools" hidden></div>'+ 
 '<button id="zoomPage" hidden></button><button id="simpleExport">Скачать PDF</button>'+ 
 '<button id="prepareOrderPdf">Скачать для заказа</button></div>'+
 '<input id="order" value="8006776"><input id="artwork" type="file">'+
 '<button id="loadOrder"></button><div id="status"></div></body></html>';

try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 const routed=[];
 let postedPdf='';
 await page.route('https://gifts.ru/**',async route=>{
   const u=new URL(route.request().url());
   routed.push(u.pathname+u.search);
   if(u.pathname==='/private/orders/basket'){
     return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:pageHtml});
   }
   if(u.pathname==='/private/order/'+ORDER)
     return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:orderHtml.replace(uploaded+malicious,uploaded+uploadedExtra+malicious)});
   if(u.pathname==='/ajax/gifts/order'&&u.searchParams.get('action')==='makets_popup')
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({html:ajaxHtml.replace(uploaded+malicious,uploaded+uploadedExtra+malicious)})});
   if(u.pathname==='/ajax/gifts/order'&&u.searchParams.get('action')==='upload_makets'){
     assert.equal(route.request().method(),'POST');
     const body=route.request().postDataBuffer()?.toString('utf8')||'';
     for(const expected of ['name="oid"','name="type"','name="order"','name="folder"','name="media_file[]"','%PDF-'])
       assert.ok(body.includes(expected),'Missing verified form field: '+expected);
     postedPdf=body.includes('готовый_макет.pdf')?'готовый_макет.pdf':'8006776_77700.60_макет.pdf';
     uploadedExtra='<div class="flex-item flex-main"><a data-maket="true" href="https://gifts.ru/cart/act/mda?oid='+OID+'&amp;id=18311645">8006776_maket_3.pdf</a><span title="Исходное имя закачанного файла">'+postedPdf+'</span></div>';
     return route.fulfill({status:200,contentType:'application/json',body:'{"success":true}'});
   }
   if(u.pathname==='/cart/act/mda')
     return route.fulfill({status:200,contentType:'application/pdf',
       body:'%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF'});
   return route.fulfill({status:404,contentType:'text/html; charset=utf-8',body:'Not found'});
 });
 await page.goto('https://gifts.ru/private/orders/basket',{waitUntil:'domcontentloaded'});
 await page.addScriptTag({path:'direct-mode.js'});
 const order=await page.evaluate(async orderNumber=>{
   const r=await fetch('/api/orders/'+orderNumber,{cache:'no-store'});
   return {ok:r.ok,data:await r.json()};
 },ORDER);
 assert.equal(order.ok,true,'Real order parser accepts mocked order');
 const files=order.data.uploadedMakets||[];
 assert.equal(files.length,2,'Two uploaded files extracted from Gifts popup and shadow DOM');
 assert.deepEqual(files.map(f=>f.originalName).sort(),['che.pdf','gerb2.pdf']);
 assert.ok(files.every(f=>f.attachmentScope==='order'&&!f.boundItemId&&!f.boundFieldIndex),
   'Order scoped uploads cannot be incorrectly bound to duplicate article or print');
 assert.ok(!files.some(f=>f.id==='1234567'),'Wrong order and templates excluded');
 const good=await page.evaluate(async()=>{const r=await fetch('/api/orders/8006776/uploaded-makets/18311644.pdf');return {ok:r.ok,bytes:new Uint8Array(await r.arrayBuffer())}});
 assert.ok(good.ok);
 assert.equal(new TextDecoder().decode(good.bytes.slice(0,5)),'%PDF-');
 const forbidden=await page.evaluate(async()=>{const r=await fetch('/api/orders/8006776/uploaded-makets/1234567.pdf');return r.status});
 assert.equal(forbidden,404,'A file outside the current order must not download');
 await page.addScriptTag({path:'assets/order-uploaded-makets.js'});
 try {
   await page.waitForFunction(()=>document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-item').length===2,null,{timeout:8000});
 } catch (error) {
   const details=await page.evaluate(()=>({
     installed:window.gwbUploadedMaketsUiInstalled,
     ui:!!window.gwbUploadedMaketsUi,
     basket:document.getElementById('basketOrders')?.outerHTML.slice(0,1000),
     order:document.getElementById('order')?.value,
     editorHidden:document.getElementById('orderEditor')?.hidden,
     section:document.getElementById('gwbOrderMakets')?.outerHTML.slice(0,1400)
   }));
   console.error('Uploaded PDF UI diagnostics',JSON.stringify({details,errors,routed:routed.slice(-10)}));
   throw error;
 }
 assert.match(await page.locator('.gwb-order-maket-badge').textContent(),/2/);
 assert.match(await page.locator('#gwbOrderMakets').textContent(),/gerb2\.pdf/);
 assert.match(await page.locator('#gwbOrderMakets').textContent(),/che\.pdf/);
 assert.equal(await page.locator('#gwbOrderMakets button').filter({hasText:'Открыть для редактирования'}).count(),0,'No field view = no edit buttons');
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-item button.gwb-order-maket-download').count(),2,
   'Every attached PDF has a single download action in full-template mode');
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-item button').count(),2,
   'Do not stack competing actions next to each other');
 await page.evaluate(()=>{
   window.__imported=[];
   const scope={order:'8006776',article:'77700.60',itemId:'49428451',
     page:0,active:0,fieldIndex:0,template:{id:'t'},entry:{id:'e'},field:{id:'f'}};
   window.gwbUploadedMaketNative={
     getScope(){return scope;},
     async apply(file,expected){
       if(expected!==scope)throw Error('Stale selected field');
       window.__imported.push({name:file.name,head:(await file.text()).slice(0,5)});
     }
   };
   const entry={id:'current'},template={id:'template'};
   window.gwbReadyPdfNative={
     snapshot(){return {order:'8006776',article:'77700.60',itemId:'49428451',entry,template};},
     async make(){return new File(['%PDF-1.7\\nready PDF'],'8006776_77700.60_макет.pdf',{type:'application/pdf'});}
   };
   document.getElementById('fieldLogoTools').hidden=false;
   document.getElementById('zoomPage').hidden=false;
 });
 await page.waitForFunction(()=>document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-edit').length===2);
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-download').count(),0,
   'Download is replaced, not displayed beside Edit');
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-item button').count(),2,
   'One action per PDF must be preserved in field editing mode');
 await page.locator('#gwbOrderMakets .gwb-order-maket-item button').first().click();
 await page.waitForFunction(()=>window.__imported?.length===1);
 const imported=await page.evaluate(()=>window.__imported);
 assert.equal(imported[0].head,'%PDF-');
 assert.deepEqual(imported.map(x=>x.name),['8006776_maket_2_201026_143328.pdf']);
 assert.match(imported[0].name,/\.pdf$/i);
 assert.ok(routed.some(path=>path.includes('/cart/act/mda?')),
   'Authorized download was routed via gifts.ru with its internal order ID');
 // Leaving field view restores the single download action for every file.
 await page.evaluate(()=>{document.getElementById('zoomPage').hidden=true;document.getElementById('fieldLogoTools').hidden=true});
 await page.waitForFunction(()=>document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-item button').length===2);
 assert.equal(await page.locator('#gwbOrderMakets button').filter({hasText:'Открыть для редактирования'}).count(),0);
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-download').count(),2);
 // A completed layout uses the exact gifts.ru upload form and is verified by a new attachment ID.
 await page.evaluate(()=>{window.confirm=()=>true});
 await page.locator('#gwbUploadReadySimple').click();
 await page.waitForFunction(()=>document.getElementById('status')?.textContent.includes('добавлен к заказу'),null,{timeout:15000});
 assert.ok(postedPdf,'Ready PDF uploaded to the original order');
 assert.equal((await page.locator('.gwb-order-maket-item').count()),3);
 assert.match(await page.locator('.gwb-order-maket-badge').textContent(),/3/);
 // Regression: 300px sidebar must not squeeze long attachment names into
 // a vertical stack of single glyphs, and the action must stay inside its card.
 const layout=await page.evaluate(()=>{
   return [...document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-item')].map(card=>{
     const data=card.querySelector('.gwb-order-maket-data');
     const filename=card.querySelector('.gwb-order-maket-filename');
     const actions=card.querySelector('.gwb-order-maket-actions');
     const button=actions.querySelector('button');
     const row=card.getBoundingClientRect();
     const dr=data.getBoundingClientRect(),fr=filename.getBoundingClientRect();
     const ar=actions.getBoundingClientRect(),br=button.getBoundingClientRect();
     return {dataWidth:dr.width,filenameWidth:fr.width,filenameHeight:fr.height,
       fontSize:parseFloat(getComputedStyle(filename).fontSize),wordBreak:getComputedStyle(filename).wordBreak,
       cardLeft:row.left,cardRight:row.right,buttonLeft:br.left,buttonRight:br.right,
       actionsWidth:ar.width,buttonWidth:br.width,buttons:actions.querySelectorAll('button').length};
   });
 });
 for(const item of layout){
   assert.ok(item.dataWidth>=175 && item.filenameWidth>=175,
     'Attachment filename needs a full-width text block, not a 10px flex column');
   assert.ok(item.filenameHeight<item.fontSize*6,
     'Filename must wrap over a few lines rather than one character per line');
   assert.equal(item.wordBreak,'normal');
   assert.equal(item.buttons,1);
   assert.ok(item.buttonLeft>=item.cardLeft-1 && item.buttonRight<=item.cardRight+1,
     'Only action button must fit inside the card');
   assert.ok(Math.abs(item.actionsWidth-item.buttonWidth)<3,
     'Action button should use complete available row width');
 }
  assert.deepEqual(errors,[],'No browser runtime errors');
 console.log('Uploaded order layouts: 2 files, visible in basket and editor, explicit editable PDF import, foreign attachment rejected — PASS');
} finally { await browser.close(); }
