// M3.14: Synthetic browser integration test for sequential article modal
// navigation. No private customer HTML, real orders, credentials or requests.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const bundle=await readFile('vision-order-approval.js','utf8');
const origin='http://testgifts.local',url=origin+'/private/order/8001555';
const item=(id,badge)=>
 '<li data-itemid="'+id+'"><a href="#" class="j_maketadjusting" '+
 'data-hint="Согласование макета">Согласование макета'+
 '<span class="gifts-badge">'+badge+'</span></a></li>';
const binaryAttachment=Buffer.from([
 137,80,78,71,13,10,26,10,0,0,0,0,73,68,65,84,0,0,0,0]);
const attachmentUrl=origin+'/ajax/gifts/order?'+
 'action=download_maketadjusting_attachment&id=889900';
const html='<!doctype html><html><head><meta charset="utf-8"></head>'+
 '<body><div class="cart-order"><ul>'+item(1001,13)+
 item(1002,1)+item(1003,2)+'</ul></div>'+
 '<g-modal id="approval-modal"></g-modal></body></html>';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 const violations=[];
 await page.route('**/*',route=>{
  if(route.request().url()===url&&route.request().method()==='GET')
   return route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:html});
  if(route.request().url()===attachmentUrl&&route.request().method()==='GET')
   return route.fulfill({status:200,contentType:'image/png',body:binaryAttachment});
  violations.push({url:route.request().url(),method:route.request().method()});
  return route.abort();
 });
 await page.goto(url);
 // Mock only the site's native GET-opened modal renderer; Vision does NOT
 // itself create or edit the native modal, checkbox or comment list.
 await page.evaluate(()=>{
  window.__nativeClicks=[];
  window.__tabClicks=[];
  const modal=document.getElementById('approval-modal');
  for(const a of document.querySelectorAll('li[data-itemid] a.j_maketadjusting')){
   a.addEventListener('click',event=>{
    event.preventDefault();
    const li=a.closest('li[data-itemid]');
    const id=li.dataset.itemid;
    window.__nativeClicks.push(id);
    const messages=id==='1001'?13:id==='1002'?1:2;
    const events=id==='1001'?2:1;
    const history=[];
    for(let i=0;i<messages;i++)
     history.push('<li><div class="comment_wrap"><div class="flex-main">'+
      'Секретный клиент '+id+' - нехорошая тонкая линия #'+i+
      (i===0?'<a class="j_maketadjusting_attachment" data-id="889900" '+
         'href="#">training_image.png</a>':'')+
      '</div><div class="comment_info">Петров 17.11.26 10:22</div></div></li>');
    for(let i=0;i<events;i++)
     history.push('<li><div class="comment_wrap" style="font-size:10px">'+
      '<div class="flex-main">Добавлены проблемы: Толщина линий</div>'+
      '</div></li>');
    modal.innerHTML='<form id="j_maketAdjustingForm">'+
      '<input name="oiid" value="'+id+'" type="hidden">'+
      '<label><input type="checkbox" name="ma_problem[]" value="73"'+
      (id==='1001'?' checked':'')+'><span class="form-check-text">'+
      'Толщина линий меньше 0,25 мм</span></label>'+
      '<textarea name="ma_description">Дополнительное описание #'+id+
      '</textarea></form>'+
      '<div id="j_maketadjustingcomments_counter">'+messages+'</div>'+
      '<input id="j_ma_comments" type="radio">'+
      '<label for="j_ma_comments">Обсуждение</label>'+
      '<ul id="j_maketadjusting_comments_list">'+
      (id==='1003'?'':history.join(''))+'</ul>';
    if(id==='1003'){
     modal.querySelector('label[for="j_ma_comments"]').addEventListener('click',()=>{
      window.__tabClicks.push(id);
      setTimeout(()=>{modal.querySelector('#j_maketadjusting_comments_list').innerHTML=
        history.join('')},80);
     });
    }
    modal.setAttribute('visible','');
   });
  }
 });
 await page.addScriptTag({content:bundle});
 const firstAttachmentZip=page.waitForEvent('download');
 await page.locator('#vision-approval-inspector button')
  .filter({hasText:'Автообход согласований >1'}).click();
 const packaged=await firstAttachmentZip;
 assert.match(packaged.suggestedFilename(),/^vision-private-approval-attachments-part-/);
 const packagedBytes=await readFile(await packaged.path());
 assert.equal(String.fromCharCode(...packagedBytes.subarray(0,2)),'PK');
 assert.ok(packagedBytes.includes(Buffer.from('training_image.png')),
  'Original attachment filename is retained only INSIDE local private ZIP');
 await page.waitForFunction(()=>document.querySelector('#vision-approval-inspector')
   ?.textContent?.includes('Обход: COMPLETE'),{timeout:15000});
 assert.deepEqual(await page.evaluate(()=>window.__nativeClicks),['1001','1003'],
  'Only 13 and 2, not 1; one native click each, strict sequential order');
 assert.deepEqual(await page.evaluate(()=>window.__tabClicks),['1003'],
  'Lazy-loaded comments need exactly one safe native Discussion tab click');
 assert.equal(await page.locator('#approval-modal').getAttribute('visible'),null,
  'Native modal closed after final article');
 page.once('dialog',d=>d.accept());
 const privateEvent=page.waitForEvent('download');
 await page.locator('#vision-approval-inspector button')
  .filter({hasText:'Сохранить приватные данные'}).click();
 const privateReport=JSON.parse(await readFile(
  await (await privateEvent).path(),'utf8'));
 assert.equal(privateReport.schema,'printcheck.vision.private-approval-collection.v1');
 assert.equal(privateReport.selected_by_badge,2);
 assert.equal(privateReport.skipped.length,1);
 assert.equal(privateReport.skipped[0].reason,'BELOW_MESSAGE_THRESHOLD');
 assert.equal(privateReport.articles.length,2);
 assert.equal(privateReport.articles[0].status,'PRIVATE_REVIEW_ONLY');
 assert.equal(privateReport.articles[0].observed_human_comments,13);
 assert.equal(privateReport.articles[0].history.length,15);
 assert.equal(privateReport.articles[0].current_problems.length,1);
 assert.equal(privateReport.articles[0].history[0].attachments[0].kind,'image');
 assert.equal(privateReport.articles[0].history[0].attachments[0].downloaded,false);
 assert.equal(privateReport.articles[0].history[0].attachments[0].local_get_status,
  'LOCAL_ATTACHMENT_BYTES_ONLY');
 assert.equal(privateReport.attachment_download_summary.verified_files,1);
 assert.equal(privateReport.attachment_download_summary.local_zip_parts,1);
 assert.equal(privateReport.articles[1].observed_human_comments,2);
 assert.equal(privateReport.training_ready,false);
 assert.match(JSON.stringify(privateReport),/Секретный клиент/);
 const anonEvent=page.waitForEvent('download');
 await page.locator('#vision-approval-inspector button')
  .filter({hasText:'Анонимный отчёт обхода'}).click();
 const anon=JSON.parse(await readFile(await (await anonEvent).path(),'utf8'));
 assert.equal(anon.schema,'printcheck.vision.anonymous-approval-collection.v1');
 assert.equal(anon.eligible_articles,2);
 assert.equal(anon.articles[0].history_entry_count,15);
 assert.equal(anon.articles[0].human_comment_count,13);
 assert.equal(anon.articles[1].human_comment_count,2);
 for(const s of ['8001555','1001','1002','1003','Петров','Секретный',
  'training_image.png','889900','Дополнительное описание']){
  assert.equal(JSON.stringify(anon).includes(s),false,'PII leaked '+s);
 }
 assert.equal(anon.training_ready,false);
 assert.deepEqual(violations,[],'No non-order GET/POST or attachment requests');
 await context.close();
 console.log('Vision auto approvals: 13,1,2 -> opens 13 & 2, collects private comments, anonymous export, zero POST PASS');
}finally{await browser.close()}
