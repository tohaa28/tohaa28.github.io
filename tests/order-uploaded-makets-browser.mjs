import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const ORDER='8006776',OID='7824901';
const filenames=[
 {id:'18311644',filename:'8006776_maket_2_201026_143328.pdf',original:'gerb2.pdf'},
 {id:'18311643',filename:'8006776_maket_1_201026_143328.pdf',original:'che.pdf'}
];
const uploadMarkup=file=>
 '<div class="j_maket_host"><div class="flex"><div class="flex-item flex-main"><span class="size--md">'+
 '<a data-maket="true" href="https://gifts.ru/cart/act/mda?oid='+OID+'&amp;id='+file.id+'">'+file.filename+'</a>'+
 '</span><br><span class="size--sm"><span title="Исходное имя закачанного файла">'+file.original+'</span></span></div>'+
 '<div class="flex-item"><a href="'+(file.id==='18311644'?'https://gifts.ru/cart#':
   file.id==='18311643'?'https://gifts.ru/private/order/'+ORDER+'#':'#')+'" title="Удалить макет" '+
 'class="j_delete_maket" data-id="'+file.id+'" data-orderid="'+OID+'"></a></div></div></div>';
const uploaded=filenames.map(uploadMarkup).join('');
const removedIds=new Set();
const visibleUploads=()=>filenames.filter(file=>!removedIds.has(file.id)).map(uploadMarkup).join('');
let uploadedExtra=[],nextUploadId=18311645,failDeleteId=null;
const uploadForm='<form id="j_upload_area"><input type="hidden" name="oid" value="'+OID+'">'+
 '<input type="hidden" name="type" value="10"><input type="hidden" name="order" value="'+ORDER+'">'+
 '<input type="hidden" name="folder" value="S1"><input type="file" name="media_file[]" multiple></form>';
const malicious='<a data-maket="true" href="https://gifts.ru/cart/act/mda?oid=99999&amp;id=1234567">not-ours.pdf</a>'+
 '<a href="https://gifts.ru/drawing?action=getOrderItemPdf&amp;orderitemid=49428451">Шаблон конструктора</a>'+
 '<a class="j_delete_maket" data-id="-111" data-orderid="'+OID+'" href="https://gifts.ru/private/order/'+ORDER+'#">Удалить все</a>';
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
 '<div id="stage"></div><div id="editorStep3" hidden></div><div id="fieldLogoTools" hidden><button id="editorAddLogo">Добавить логотип</button><button id="editorOpenLogoEditor">Редактор логотипа</button><button id="editorUndo">Undo</button><button id="editorFit">Подогнать</button><input id="editorAngle" type="number"></div>'+ 
 '<button id="zoomPage" hidden></button><button id="simpleExport">Скачать PDF</button>'+ 
 '<button id="prepareOrderPdf">Скачать для заказа</button></div>'+
 '<input id="order" value="8006776"><input id="artwork" type="file"><button id="simpleFit">Подогнать</button><button id="simpleDraw">Выбрать поле</button><button id="rotateLeft">↶</button>'+
 '<button id="loadOrder"></button><div id="status"></div></body></html>';

try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 const routed=[];
 let postedPdf='',deleteCount=0;
 await page.route('https://gifts.ru/**',async route=>{
   const u=new URL(route.request().url());
   routed.push(u.pathname+u.search);
   if(u.pathname==='/private/orders/basket'){
     return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:pageHtml});
   }
   if(u.pathname==='/private/order/'+ORDER)
     return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:orderHtml.replace(uploaded+malicious,visibleUploads()+uploadedExtra.map(uploadMarkup).join('')+malicious)});
   if(u.pathname==='/ajax/gifts/order'&&u.searchParams.get('action')==='makets_popup')
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({html:ajaxHtml.replace(uploaded+malicious,visibleUploads()+uploadedExtra.map(uploadMarkup).join('')+malicious)})});
   if(u.pathname==='/ajax/gifts/order'&&u.searchParams.get('action')==='upload_makets'){
     assert.equal(route.request().method(),'POST');
     const body=route.request().postDataBuffer()?.toString('utf8')||'';
     for(const expected of ['name="oid"','name="type"','name="order"','name="folder"','name="media_file[]"','%PDF-'])
       assert.ok(body.includes(expected),'Missing verified form field: '+expected);
     postedPdf=body.includes('готовый_макет.pdf')?'готовый_макет.pdf':'8006776_77700.60_макет.pdf';
     const id=String(nextUploadId++);
     uploadedExtra.push({id,filename:'8006776_maket_'+id+'.pdf',original:postedPdf});
     return route.fulfill({status:200,contentType:'application/json',body:'{"success":true}'});
   }
   if(u.pathname==='/ajax/gifts/order'&&u.searchParams.get('action')==='delete_maket'){
     assert.equal(route.request().method(),'GET','Only native per-file GET action is supported');
     assert.equal(u.searchParams.get('type'),'10');
     assert.equal(u.searchParams.get('orderid'),OID);
     assert.equal(u.searchParams.get('oid'),OID,'Delete must use the same validated internal order ID as downloads/uploads');
     const id=u.searchParams.get('id');
     assert.ok(['18311644','18311643','18311645','18311646','18311647'].includes(id),
       'Never delete all or foreign IDs');
     deleteCount++;
     if(id===failDeleteId)
       return route.fulfill({status:500,contentType:'application/json',body:'{"success":false}'});
     removedIds.add(id);
     uploadedExtra=uploadedExtra.filter(file=>file.id!==id);
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
 assert.ok(files.every(f=>f.canDelete===true),
   'Both native forms must grant per-file deletion: gifts.ru/cart# and private/order/:number#');
 const badDelete=await page.evaluate(async()=>fetch('/api/orders/8006776/uploaded-makets/1234567',{method:'DELETE'}).then(r=>r.status));
 assert.equal(badDelete,404,'Unknown ID must not invoke destructive gifts.ru action');
 const invalidReplace=await page.evaluate(async()=>{
   const form=new FormData();
   form.append('media_file[]',new File(['%PDF-1.7\\nchanged'],'changed.pdf',{type:'application/pdf'}));
   form.append('expected_original_name','not-the-real-original.pdf');
   const response=await fetch('/api/orders/8006776/uploaded-makets/18311644',{
     method:'PUT',body:form
   });
   return response.status;
 });
 assert.equal(invalidReplace,409,'Replace requires exact original name and verified file ID');
 assert.equal(uploadedExtra.length,0,'Failed replacement must not upload any file');
 const good=await page.evaluate(async()=>{const r=await fetch('/api/orders/8006776/uploaded-makets/18311644.pdf');return {ok:r.ok,bytes:new Uint8Array(await r.arrayBuffer())}});
 assert.ok(good.ok);
 assert.equal(new TextDecoder().decode(good.bytes.slice(0,5)),'%PDF-');
 const forbidden=await page.evaluate(async()=>{const r=await fetch('/api/orders/8006776/uploaded-makets/1234567.pdf');return r.status});
 assert.equal(forbidden,404,'A file outside the current order must not download');
 await page.addScriptTag({path:'assets/order-uploaded-makets.js'});
 await page.addScriptTag({path:'assets/template-selection-tool-lock.js'});
 assert.equal(await page.locator('#artwork').isDisabled(),true,
   'File input is disabled while selecting a template');
 assert.equal(await page.locator('#editorAddLogo').isDisabled(),true,
   'Add-logo command cannot run in template selection');
 assert.equal(await page.locator('#editorOpenLogoEditor').isDisabled(),true,
   'Both vector editors are unavailable without a selected imprint field');
 assert.equal(await page.locator('#simpleFit').isDisabled(),true,
   'Simple mode artwork tools remain disabled');
 assert.equal(await page.locator('#simpleDraw').isDisabled(),false,
   'Field selection itself remains usable');
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
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-delete').count(),2,
   'Non-field mode shows a compact delete icon beside every download');
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-delete g-icon[name="trash"] use[href="/components/images/icons.svg?19#trash"]').count(),2,
   'Use the exact same GIFTS basket trash icon and sprite');
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-delete').first().getAttribute('aria-label'),
   'Удалить макет: gerb2.pdf','Icon-only action has an accessible name');
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-delete').first().textContent(),'',
   'Compact trash action must not show a text label');
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-item button').count(),4,
   'Exactly download and delete for every attached PDF');
 // Destructive operation must never begin without explicit confirmation.
 await page.evaluate(()=>{window.confirm=()=>false});
 await page.locator('#gwbOrderMakets .gwb-order-maket-delete').first().click();
 assert.equal(deleteCount,0,'Cancelled dialog never reaches the deletion endpoint');
 await page.evaluate(()=>{
   window.__imported=[];window.__externalFiles=[];
   window.__inspectOrigin='maketnaya';
   const scope={order:'8006776',article:'77700.60',itemId:'49428451',
     page:0,active:0,fieldIndex:0,template:{id:'t'},entry:{id:'e'},field:{id:'f'}};
   window.__fieldLoading=true;
   window.gwbUploadedMaketNative={
     getScope(){return window.__fieldLoading?null:scope;},
     async identify(){return {kind:'maketnaya',format:2}},
     async inspect(file,expected){
       if(expected!==scope)throw Error('Stale inspected field');
       if(window.__inspectOrigin==='external')return {kind:'external'};
       return {kind:'maketnaya',
         bytes:new TextEncoder().encode('%PDF-1.7 LOGO ONLY'),
         sourceField:{x:0,y:0,w:20,h:15},
         placement:{x:2,y:2,w:10,h:8,rotation:0}};
     },
     async apply(file,expected,options){
       if(expected!==scope||!options?.placement)throw Error('Incorrect logo extraction');
       window.__imported.push({name:file.name,head:(await file.text()).slice(0,5),
         placement:options.placement});
     }
   };
   window.gwbEditorChooser={showWithFile(file){window.__externalFiles.push(file.name)}};
   const entry={id:'current'},template={id:'template'};
   window.gwbReadyPdfNative={
     snapshot(){return {order:'8006776',article:'77700.60',itemId:'49428451',entry,template};},
     async make(){return new File(['%PDF-1.7\\nready PDF'],'8006776_77700.60_макет.pdf',{type:'application/pdf'});}
   };
   document.getElementById('status').textContent='Загрузите логотип для выбранного поля.';
   document.getElementById('editorStep3').hidden=false;
   document.getElementById('fieldLogoTools').hidden=false;
   document.getElementById('zoomPage').hidden=false;
 });
 // Regression: selecting a real field sets the visible UI before native
 // getScope() is ready (the old busy-state dependency left Download/Delete).
 await page.waitForFunction(()=>document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-edit').length===2);
 await page.waitForFunction(()=>document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-origin').length===2);
 assert.equal(await page.locator('#editorAddLogo').isDisabled(),false,
   'Native Add Logo is enabled on selected imprint field');
 assert.equal(await page.locator('#editorOpenLogoEditor').isDisabled(),false,
   'Editors become available after field selection');
 assert.equal(await page.locator('#artwork').isDisabled(),false,
   'File upload restored in active field');
 assert.equal(await page.evaluate(()=>window.gwbUploadedMaketNative.getScope()),null,
   'Editing action is displayed even while native scope is temporarily busy');
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-download').count(),0,
   'Download is replaced, not displayed beside Edit');
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-delete').count(),0,
   'Delete must disappear in field editor mode');
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-item button').count(),2,
   'One action per PDF must be preserved in field editing mode');
 await page.evaluate(()=>{window.__fieldLoading=false});
 await page.locator('#gwbOrderMakets .gwb-order-maket-item button').first().click();
 await page.waitForFunction(()=>window.__imported?.length===1);
 const imported=await page.evaluate(()=>window.__imported);
 assert.equal(imported[0].head,'%PDF-');
 assert.deepEqual(imported.map(x=>x.name),['gerb2-логотип.pdf']);
 assert.equal(imported[0].placement.x,2,'Maketnaya source geometry is handed to field importer');
 // An external customer PDF MUST go to a real editor chooser without applying
 // the entire constructor as a logo or resetting already-placed artwork.
 await page.evaluate(()=>{window.__inspectOrigin='external'});
 await page.locator('#gwbOrderMakets .gwb-order-maket-item button').nth(1).click();
 await page.waitForFunction(()=>window.__externalFiles?.length===1);
 assert.deepEqual(await page.evaluate(()=>window.__externalFiles),['che.pdf']);
 assert.equal(await page.evaluate(()=>window.__imported.length),1,
   'External PDF must not enter the imprint field automatically');
 assert.ok(routed.some(path=>path.includes('/cart/act/mda?')),
   'Authorized download was routed via gifts.ru with its internal order ID');
 // Leaving field view restores download and delete for every file.
 await page.evaluate(()=>{
   document.getElementById('zoomPage').hidden=true;
   document.getElementById('fieldLogoTools').hidden=true;
   document.getElementById('editorStep3').hidden=true;
 });
 await page.waitForFunction(()=>document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-item button').length===4);
 await page.waitForFunction(()=>document.getElementById('artwork')?.disabled===true);
 assert.equal(await page.locator('#editorOpenLogoEditor').isDisabled(),true,
   'Logo editor is locked again when returning to full template');
 assert.equal(await page.locator('#gwbOrderMakets button').filter({hasText:'Открыть для редактирования'}).count(),0);
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-download').count(),2);
 assert.equal(await page.locator('#gwbOrderMakets .gwb-order-maket-delete').count(),2);
 const duplicatePost=await page.evaluate(async()=>{
   const form=new FormData();form.append('require_unique_name','1');
   form.append('media_file[]',new File(['%PDF-1.7 duplicate'],'GERB2.pdf',{type:'application/pdf'}));
   return (await fetch('/api/orders/8006776/uploaded-makets',{method:'POST',body:form})).status;
 });
 assert.equal(duplicatePost,409,'A concurrent duplicate is blocked before native upload');
 assert.equal(uploadedExtra.length,0);
 // A completed layout uses the exact gifts.ru upload form and is verified by a new attachment ID.
 await page.evaluate(()=>{window.confirm=()=>true;window.prompt=()=> '8006776_77700.60_макет.pdf'});
 assert.equal(await page.locator('#gwbSaveReadySimple').textContent(),'Сохранить макет в заказ на gifts.ru');
 assert.equal(await page.locator('.gwb-ready-save-as').count(),0,'Save As is merged into Save');
 assert.equal(await page.locator('.gwb-save-actions button').count(),2,'One Save in each editor mode');
 // A server change after the list was cached must still trigger the collision dialog.
 filenames[1].original='server-fresh.pdf';
 await page.evaluate(()=>{window.prompt=()=> 'server-fresh.pdf'});
 await page.locator('#gwbSaveReadyAdvanced').click();
 await page.locator('#gwbSaveConflict').screenshot({path:'test-results/unified-save-conflict.png'});
 await page.locator('[data-save-choice="cancel"]').click();
 await page.waitForFunction(()=>!document.getElementById('gwbSaveReadyAdvanced').disabled);
 assert.equal(uploadedExtra.length,0,'Fresh server collision is detected in advanced mode');
 filenames[1].original='che.pdf';
 // A failed list read must never be interpreted as an empty order.
 await page.evaluate(()=>{
   window.__savedFetch=window.fetch;
   window.fetch=(url,init)=>String(url).includes('?fresh=1')?
     Promise.resolve(new Response(JSON.stringify({error:'test list unavailable'}),{status:503})):window.__savedFetch(url,init);
 });
 await page.locator('#gwbSaveReadySimple').click();
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('test list unavailable'));
 assert.equal(uploadedExtra.length,0,'Read failure cannot upload');
 await page.evaluate(()=>{window.fetch=window.__savedFetch});
 // A collision with an unrelated server file offers cancellation and repeated renaming.
 await page.evaluate(()=>{window.prompt=()=> 'GERB2.pdf'});
 await page.locator('#gwbSaveReadySimple').click();
 await page.locator('[data-save-choice="cancel"]').click();
 await page.waitForFunction(()=>!document.getElementById('gwbSaveReadySimple').disabled);
 assert.equal(uploadedExtra.length,0,'Cancel never uploads or deletes');
 assert.equal(deleteCount,0);
 await page.locator('#gwbSaveReadySimple').click();
 await page.locator('[data-save-choice="rename"]').click();
 await page.locator('[data-save-choice="rename"]').waitFor();
 assert.equal(uploadedExtra.length,0,'A second colliding name must ask again');
 await page.evaluate(()=>{window.prompt=()=> '8006776_77700.60_макет.pdf'});
 await page.locator('[data-save-choice="rename"]').click();
 await page.waitForFunction(()=>document.getElementById('status')?.textContent.includes('Сохранён новый макет'),null,{timeout:15000});
 assert.ok(postedPdf,'Ready PDF uploaded to the original order');
 // Basket/card refresh resolves asynchronously after the server confirms upload.
 await page.waitForFunction(()=>document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-item').length===3,null,{timeout:15000});
 assert.equal((await page.locator('.gwb-order-maket-item').count()),3);
 assert.match(await page.locator('.gwb-order-maket-badge').textContent(),/3/);
 // Save targets the newly saved PDF, never other customer attachments.
 await page.locator('#gwbSaveReadySimple').click();
 await page.locator('[data-save-choice="replace"]').click();
 await page.waitForFunction(()=>document.getElementById('status')?.textContent.includes('перезаписан'),null,{timeout:15000});
 await page.waitForFunction(()=>document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-item').length===3);
 assert.equal(deleteCount,1,'Overwrite only deletes the verified previous PDF');
 assert.deepEqual([...removedIds],['18311645']);
 assert.equal(uploadedExtra.length,1,'Only the verified replacement remains');
 assert.equal(uploadedExtra[0].id,'18311646');
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
     const buttons=[...actions.querySelectorAll('button')].map(button=>button.getBoundingClientRect());
     return {buttonBounds:buttons.map(box=>({left:box.left,right:box.right,top:box.top,bottom:box.bottom})),
       dataWidth:dr.width,filenameWidth:fr.width,filenameHeight:fr.height,
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
   assert.equal(item.buttons,2,'Two actions fit in non-field view');
   assert.ok(item.buttonBounds.every(box=>box.left>=item.cardLeft-1&&box.right<=item.cardRight+1),
     'Both actions must fit inside the card');
   assert.ok(item.buttonBounds[0].right<item.buttonBounds[1].left,
     'Full download button and trash pictogram must not overlap');
   assert.ok(Math.abs(item.buttonBounds[0].top-item.buttonBounds[1].top)<3,
     'Download and trash icon share one row');
   const downloadWidth=item.buttonBounds[0].right-item.buttonBounds[0].left;
   const iconWidth=item.buttonBounds[1].right-item.buttonBounds[1].left;
   assert.ok(iconWidth>=29&&iconWidth<=35,
     'Trash icon remains a compact 32px control');
   assert.ok(downloadWidth>=130&&downloadWidth>iconWidth*3,
     'Download uses remaining width instead of sharing equal columns');
 }
 // A failed deletion AFTER confirmed upload must preserve both copies and
 // report partial success. It cannot be incorrectly announced as overwrite.
 failDeleteId='18311646';
 await page.locator('#gwbSaveReadySimple').click();
 await page.locator('[data-save-choice="replace"]').click();
 await page.waitForFunction(()=>document.getElementById('status')?.textContent.includes('Новый PDF сохранён'),null,{timeout:15000});
 await page.waitForFunction(()=>document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-item').length===4,null,{timeout:15000});
 assert.ok(uploadedExtra.some(x=>x.id==='18311646')&&uploadedExtra.some(x=>x.id==='18311647'),
   'Both original and new copy survive if GIFTS refuses deletion');
 assert.deepEqual([...removedIds],['18311645'],'Failed delete must leave old attachment intact');
 failDeleteId=null;
 // Explicitly remove one original PDF, never the already uploaded third file.
 await page.locator('#gwbOrderMakets .gwb-order-maket-item').filter({hasText:'gerb2.pdf'})
   .locator('button.gwb-order-maket-delete').click();
 await page.waitForFunction(()=>document.getElementById('status')?.textContent.includes('Удалён только макет'),null,{timeout:15000});
 await page.waitForFunction(()=>document.querySelectorAll('#gwbOrderMakets .gwb-order-maket-item').length===3,null,{timeout:15000});
 assert.equal(deleteCount,3,'One overwrite deletion, one unsuccessful replacement delete, one explicit removal');
 assert.deepEqual([...removedIds],['18311645','18311644']);
 assert.match(await page.locator('#gwbOrderMakets').textContent(),/che\.pdf/);
 assert.match(await page.locator('#gwbOrderMakets').textContent(),/8006776_77700\.60_макет\.pdf/);
 assert.doesNotMatch(await page.locator('#gwbOrderMakets').textContent(),/gerb2\.pdf/);
 assert.match(await page.locator('.gwb-order-maket-badge').textContent(),/3/);
 assert.deepEqual(errors,[],'No browser runtime errors');
 console.log('Uploaded order layouts: 2 files, visible in basket and editor, explicit editable PDF import, foreign attachment rejected — PASS');
} finally { await browser.close(); }
