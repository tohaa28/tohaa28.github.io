// C3B.3.Q: synthetic DOM calibrated to a user-supplied ANONYMOUS LAN report:
// 61 tbody rows / 488 cells / 179 table links / 211 page links,
// 7 misleading offsite artwork candidates, 61 explicit order-detail URLs.
// This fixture is invented; it contains NO original customer data or IDs.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
const built=await readFile('vision-order-overlay.js','utf8');
const host='http://psk.testgifts.local';
const bundle='https://tohaa28.github.io/gifts-layout-workbench-vision/vision-order-overlay.js';
const vector='<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="80mm" viewBox="0 0 100 80">'+
 '<path d="M10 20 H13 V65 H10 Z" fill="#123456"/>'+
 '<path d="M13.12 20 H16.12 V65 H13.12 Z" fill="#123456"/></svg>';
const tbody=Array.from({length:61},(_,i)=>{
 const number=8100001+i;
 // Number of extra links: 2*57+4=118; order links 61 => total 179.
 const count=i<57?2:1;
 const extra=Array.from({length:count},(_,j)=>
   i<7&&j===0
     ? '<a href="http://untrusted.testgifts.local/bogus.pdf">макет PDF</a>'
     : '<a href="/help/info?item='+i+'&x='+j+'">Информация</a>'
 ).join('');
 // Diagnostic is captured with Vision overlay active: 7 source columns +
 // 1 injected Vision result cell = 8 cells per row, 61×8=488.
 const cols=Array.from({length:7},(_,j)=>
   '<td>'+(j===0?'<a href="/private/order/'+number+'">'+number+'</a>'+extra:
      j===1?'140':'—')+'</td>').join('');
 return '<tr>'+cols+'</tr>';
}).join('');
const pageBody='<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body>'+
 '<table><thead><tr><th>№</th></tr></thead><tbody>'+tbody+'</tbody></table>'+
 Array.from({length:32},(_,i)=>'<a href="#help'+i+'">Справка</a>').join('')+
 '</body></html>';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 let cards=0,popups=0,artworks=0,unexpected=[];
 page.on('pageerror',e=>unexpected.push('JS: '+e.message));
 await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   const u=url.href,method=route.request().method();
   if(u===host+'/devorders?status=140')
     return route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:pageBody});
   if(u===bundle)
     return route.fulfill({status:200,contentType:'application/javascript',body:built});
   if(method!=='GET'||url.origin!==host){
     unexpected.push(method+' '+u);return route.abort();
   }
   const card=/^\/private\/order\/(810\d{4})$/.exec(url.pathname);
   if(card){
     cards++;
     const id=String(Number(card[1])+100);
     return route.fulfill({status:200,contentType:'text/html;charset=utf-8',
       body:'<html><body><div id="j_cart_host" data-orderid="'+id+'"></div></body></html>'});
   }
   if(url.pathname==='/ajax/gifts/order'&&url.searchParams.get('action')==='makets_popup'){
     popups++;
     const oid=url.searchParams.get('oid');
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
       html:'<div><h2>Загрузка макетов</h2>'+
        '<a data-maket="true" href="/cart/act/mda?oid='+oid+'&id=42">client-art.svg</a>'+
        (oid==='8100132'?
          '<a data-maket="true" href="/cart/act/mda?oid='+oid+'&id=43">second-art.svg</a>':'')+
        '<h2>Шаблоны макетов для выбранных нанесений</h2>'+
        '<a href="/drawing?action=getOrderItemPdf&orderitemid=909">constructor.pdf</a></div>'
     })});
   }
   if(url.pathname==='/cart/act/mda'&&(
     url.searchParams.get('id')==='42'||
     (url.searchParams.get('id')==='43'&&url.searchParams.get('oid')==='8100132'))){
     artworks++;return route.fulfill({status:200,contentType:'application/octet-stream',body:vector});
   }
   unexpected.push(method+' '+u);return route.abort();
 });
 await page.goto(host+'/devorders?status=140');
 await page.addScriptTag({url:bundle});
 assert.equal(await page.locator('[data-vision-order-cell]').count(),61);
 assert.equal(await page.locator('table tbody tr').count(),61);
 assert.equal(cards,0);assert.equal(popups,0);assert.equal(artworks,0);
 const diagWait=page.waitForEvent('download');
 await page.locator('#vision-local-order-overlay button')
   .filter({hasText:'Диагностика таблицы'}).click();
 const diag=JSON.parse(await readFile(await (await diagWait).path(),'utf8'));
 assert.equal(diag.table_count,1);
 assert.equal(diag.tables[0].body_row_count,61);
 assert.equal(diag.tables[0].cell_count,488);
 assert.equal(diag.tables[0].anchor_count,179);
 assert.equal(diag.all_anchor_count,211);
 assert.equal(diag.recognized_rows,61);
 assert.equal(diag.order_navigation_patterns.explicit_order_links,61);
 assert.equal(diag.candidate_anchor_count,7);
 assert.equal(diag.same_origin_candidate_count,0);
 assert.equal(diag.cross_origin_or_unsafe_candidate_count,7);
 assert.equal(diag.order_detail_first_required,true);
 assert.equal(diag.file_attachments_verified,false);
 assert.ok(!JSON.stringify(diag).includes('8100001'));
 assert.equal(cards,0,'Diagnostics must not open even one order card');
 const clickNext=async expected=>{
   await page.locator('#vision-local-order-overlay button')
     .filter({hasText:'Проверить следующие'}).click();
   await page.waitForFunction((count)=>
     [...document.querySelectorAll('[data-vision-order-cell] .vlo-label')]
       .filter(label=>label.textContent.includes('исследованы')).length>=count,
     expected,{timeout:30000});
 };
 await clickNext(10);
 assert.equal(cards,10);assert.equal(popups,10);assert.equal(artworks,10);
 assert.equal(await page.locator('[data-vision-order-cell] .vlo-label').allTextContents()
   .then(labels=>labels.filter(x=>x.includes('исследованы')).length),10);
 assert.ok((await page.locator('#vision-local-order-overlay .vlo-stats').innerText())
   .includes('обработано строк: 10'));
 await clickNext(20);
 assert.equal(cards,20);assert.equal(artworks,20);
 await clickNext(30);
 assert.equal(cards,30);assert.equal(artworks,30);
 await clickNext(31);
 assert.equal(cards,32);
 assert.equal(artworks,32);
 assert.match(await page.locator('[data-vision-order-cell]').nth(31).innerText(),
   /частично, нужен новый лимит файлов/);
 assert.equal(await page.locator('#vision-local-order-overlay .vlo-start').isDisabled(),true);
 assert.equal(await page.locator('#vision-local-order-overlay button')
   .filter({hasText:'Новый лимит файлов'}).isEnabled(),true);
 await page.locator('#vision-local-order-overlay button')
   .filter({hasText:'Новый лимит файлов'}).click();
 await clickNext(41); // resumes order 32 + 9 new orders without refetching its first attachment
 await clickNext(51);
 await clickNext(61);
 assert.equal(cards,61);assert.equal(popups,61);assert.equal(artworks,62);
 assert.ok((await page.locator('#vision-local-order-overlay .vlo-start').innerText())
   .includes('Все строки обработаны'));
 assert.equal(await page.locator('[data-vision-order-cell] .vlo-label').allTextContents()
   .then(labels=>labels.filter(x=>x.includes('исследованы')).length),61);
 assert.equal(page.url(),host+'/devorders?status=140',
   'Original table remains open throughout all batches');
 assert.deepEqual(unexpected,[],'7 offsite false candidates and all template GETs must be ignored');
 const save=page.waitForEvent('download');
 await page.locator('#vision-local-order-overlay button').filter({hasText:'Отчёт JSON'}).click();
 const exported=JSON.parse(await readFile(await (await save).path(),'utf8'));
 assert.equal(exported.rows.length,61);
 assert.equal(exported.rows.every(x=>x.order_card_discovered===true),true);
 assert.equal(exported.rows.every((x,i)=>x.artifacts.length===(i===31?2:1)),true);
 assert.equal(exported.rows.every(x=>x.analysis_complete===true),true);
 assert.equal(exported.rows[31].pending_file_count,0);
 assert.equal(exported.rows.every(x=>x.artifacts[0].production_approved===false),true);
 assert.ok(!JSON.stringify(exported).includes('8100001'));
 await context.close();
 console.log('61-order anonymous DOM fixture: 61 explicit links, 7 offsite candidates ignored, 10-order chunks, partial-file resume across 32-file renewal without duplicate GET, JSON privacy PASS');
}finally{await browser.close()}
