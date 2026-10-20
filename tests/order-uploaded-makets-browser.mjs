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
const malicious='<a data-maket="true" href="https://gifts.ru/cart/act/mda?oid=99999&amp;id=1234567">not-ours.pdf</a>'+
 '<a href="https://gifts.ru/drawing?action=getOrderItemPdf&amp;orderitemid=49428451">Шаблон конструктора</a>';
const orderHtml='<!doctype html><html><body>'+
 '<div id="j_cart_host" data-orderid="'+OID+'">'+
 '<li data-itemid="49428451" data-drawtaskids="27237891"><div class="cart-tbl-id">'+
 '<a class="cart-tbl-name">77700.60</a><div class="cart-tbl-lbl">Кружка</div></div>'+
 '<span class="cart-qty">5</span><div class="cart-tbl-imp"><g-droper>'+
 '<span>SB1: Сублимация/посуда,1</span></g-droper></div></li></div>'+
 '<template shadowrootmode="open"><div name="Макеты для заказа 8006776">'+uploaded+malicious+'</div></template>'+
 '</body></html>';
const ajaxHtml='<div><label>Загрузка макетов</label>'+uploaded+malicious+
 '<label>Шаблоны макетов</label></div>';
const pageHtml='<!doctype html><html><body><div id="basketOrders">'+
 '<div class="basket-order"><div class="basket-order-title">Заказ №8006776</div></div></div>'+
 '<div id="orderEditor"><details id="orderTemplatePicker"></details>'+
 '<div id="stage"></div><div id="fieldLogoTools"></div></div>'+
 '<input id="order" value="8006776"><input id="artwork" type="file">'+
 '<button id="loadOrder"></button><div id="status"></div></body></html>';

try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 const routed=[];
 await page.route('https://gifts.ru/**',async route=>{
   const u=new URL(route.request().url());
   routed.push(u.pathname+u.search);
   if(u.pathname==='/private/orders/basket'){
     return route.fulfill({status:200,contentType:'text/html',body:pageHtml});
   }
   if(u.pathname==='/private/order/'+ORDER)
     return route.fulfill({status:200,contentType:'text/html',body:orderHtml});
   if(u.pathname==='/ajax/gifts/order'&&u.searchParams.get('action')==='makets_popup')
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({html:ajaxHtml})});
   if(u.pathname==='/cart/act/mda')
     return route.fulfill({status:200,contentType:'application/pdf',
       body:'%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF'});
   return route.fulfill({status:404,contentType:'text/html',body:'Not found'});
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
 await page.waitForFunction(()=>document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-item').length===2);
 assert.match(await page.locator('.gwb-order-maket-badge').textContent(),/2/);
 assert.match(await page.locator('#gwbOrderMakets').textContent(),/gerb2\.pdf/);
 assert.match(await page.locator('#gwbOrderMakets').textContent(),/che\.pdf/);
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
 });
 await page.locator('#gwbOrderMakets .gwb-order-maket-item button').first().click();
 await page.waitForFunction(()=>window.__imported?.length===1);
 const imported=await page.evaluate(()=>window.__imported);
 assert.equal(imported[0].head,'%PDF-');
 assert.deepEqual(imported.map(x=>x.name),['8006776_maket_2_201026_143328.pdf']);
 assert.match(imported[0].name,/\.pdf$/i);
 assert.ok(routed.some(path=>path.includes('/cart/act/mda?')),
   'Authorized download was routed via gifts.ru with its internal order ID');
 assert.deepEqual(errors,[],'No browser runtime errors');
 console.log('Uploaded order layouts: 2 files, visible in basket and editor, explicit editable PDF import, foreign attachment rejected — PASS');
} finally { await browser.close(); }
