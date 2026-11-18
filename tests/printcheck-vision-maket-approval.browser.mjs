// Synthetic browser replay of REAL testgifts.local native approval DOM
// structure: 13 human replies + 27 timeline events (40 rows), one PDF/PSD
// attachment family. No real order, private HTML, author, URL or message.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const bundle=await readFile('vision-order-approval.js','utf8');
const base='http://testgifts.local',targetUrl=base+'/private/order/8001555';
const checkbox=(i,checked=false)=>
 '<label><input type="checkbox" name="ma_problem[]" value="'+(20+i)+'"'+
 (checked?' checked':'')+' disabled>'+
 '<span class="form-check-text">Толщина линий меньше 0,1 мм</span></label>';
const history=[];
let id=1;
const message=(body,{type='human',extension=''}={})=>{
 const kind=type==='human'?'':'font-size:10px;';
 const attach=extension?
   '<div><a class="j_maketadjusting_attachment" data-id="17777" '+
   'href="#private-attachment">file_'+id+'.'+extension+'</a></div>':'';
 const markup='<li id="maketadjusting_commentid_'+id+'">'+
 '<div class="comment_wrap flex" style="'+kind+'">'+
 '<div class="flex-item flex-main">'+body+attach+'</div>'+
 '<div class="comment_info">Private Person 30.10.26 15:12</div>'+
 '</div></li>';
 id++;history.push(markup);
};
for(let i=0;i<13;i++)
 message('Секретный текст '+i+'. Проверьте тонкую линию',i<6?
   {extension:'pdf'}:i===6?{extension:'psd'}:{});
for(let i=0;i<13;i++)message((i%2?'Выкл':'Вкл')+' [Макет на согласовании]',{type:'event'});
for(let i=0;i<4;i++)message('Добавлены проблемы: <span>Макет доработан</span>',{type:'event'});
for(let i=0;i<4;i++)message('Удалены проблемы: <span>Макет доработан</span>',{type:'event'});
for(let i=0;i<6;i++)message('Менеджеру отправлено уведомление', {type:'event'});
assert.equal(history.length,40);
const pageHtml='<!doctype html><html><head><meta charset="utf-8"></head><body>'+
 '<div id="j_cart_host" data-orderid="999999999999"><ul><li data-itemid="111222333">'+
 '<a class="j_maketadjusting" data-hint="Согласование макета" href="#">'+
 'Согласование макета</a></li></ul></div>'+
 '<g-modal visible id="j_modal_host_1"><h3>Согласование макета</h3>'+
 '<form id="j_maketAdjustingForm"><div class="grid">'+
 Array.from({length:25},(_,i)=>checkbox(i)).join('')+'</div>'+
 '<textarea name="ma_description">Private confidential description</textarea></form>'+
 '<input id="j_ma_comments" type="radio">'+
 '<label for="j_ma_comments">Обсуждение '+
 '<span id="j_maketadjustingcomments_counter">13</span></label>'+
 '<ul id="j_maketadjusting_comments_list">'+history.join('')+'</ul></g-modal>'+
 '</body></html>';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 const forbidden=[];
 await page.route('**/*',route=>{
  if(route.request().url()===targetUrl&&route.request().method()==='GET')
   return route.fulfill({status:200,contentType:'text/html',body:pageHtml});
  forbidden.push({method:route.request().method(),url:route.request().url()});
  return route.abort();
 });
 await page.goto(targetUrl);
 await page.addScriptTag({content:bundle});
 await page.locator('#vision-approval-inspector').waitFor();
 await page.locator('#vision-approval-inspector button')
   .filter({hasText:'Прочитать открытое согласование'}).click();
 assert.match(await page.locator('#vision-approval-inspector').innerText(),/Сообщений: 13/);
 assert.match(await page.locator('#vision-approval-inspector').innerText(),/событий: 27/);
 const saved=page.waitForEvent('download');
 await page.locator('#vision-approval-inspector button')
   .filter({hasText:'Скачать анонимный JSON'}).click();
 const report=JSON.parse(await readFile(await (await saved).path(),'utf8'));
 assert.equal(report.schema,'printcheck.vision.local-maket-approval.v1');
 assert.equal(report.trigger_count,1);
 assert.equal(report.article_scoped_trigger_count,1);
 assert.equal(report.problems_available_count,25);
 assert.equal(report.problems_checked_current_count,0);
 assert.equal(report.history_entry_count,40);
 assert.equal(report.human_comment_count,13);
 assert.equal(report.history_system_entry_count,27);
 assert.equal(report.problem_add_events,4);
 assert.equal(report.problem_remove_events,4);
 assert.equal(report.status_change_events,13);
 assert.equal(report.other_system_events,6);
 assert.equal(report.attachments_total,7);
 assert.equal(report.attachments_pdf,6);
 assert.equal(report.attachments_psd,1);
 assert.equal(report.attachments_image_candidates,0);
 assert.equal(report.badge_comment_count,13);
 assert.equal(report.badge_matches_human_messages,true);
 assert.equal(report.training_ready,false);
 assert.equal(report.reported_issues_expert_verified,false);
 const raw=JSON.stringify(report);
 for(const secret of ['Private Person','Private confidential description','Секретный',
  '8001555','111222333','999999999999','17777','file_1.pdf',
  '30.10.26','private-attachment']){
  assert.equal(raw.includes(secret),false,'No customer data: '+secret);
 }
 // Select only one of 25 AVAILABLE options — current defect status changes,
 // history remains unchanged. Never count all available options as defects.
 await page.evaluate(()=>{
  const cb=document.querySelector('[name="ma_problem[]"]');
  cb.checked=true;
 });
 await page.locator('#vision-approval-inspector button')
   .filter({hasText:'Прочитать открытое согласование'}).click();
 const again=page.waitForEvent('download');
 await page.locator('#vision-approval-inspector button')
   .filter({hasText:'Скачать анонимный JSON'}).click();
 const updated=JSON.parse(await readFile(await (await again).path(),'utf8'));
 assert.equal(updated.problems_checked_current_count,1);
 assert.deepEqual(updated.checked_problem_topic_hints,['positive_min']);
 assert.equal(updated.history_entry_count,40);
 assert.equal(updated.training_ready,false);
 // The native site may leave an older closed modal in DOM; its form and
 // comments must never be mistaken for the current visible article.
 await page.evaluate(()=>{
  const stale=document.querySelector('g-modal').cloneNode(true);
  stale.id='hidden-old-approval';
  stale.removeAttribute('visible');
  document.body.append(stale);
 });
 await page.locator('#vision-approval-inspector button')
   .filter({hasText:'Прочитать открытое согласование'}).click();
 const finalEvent=page.waitForEvent('download');
 await page.locator('#vision-approval-inspector button')
   .filter({hasText:'Скачать анонимный JSON'}).click();
 const current=JSON.parse(await readFile(await (await finalEvent).path(),'utf8'));
 assert.equal(current.status,'VISIBLE_MODAL_STRUCTURE_ONLY');
 assert.equal(current.history_entry_count,40);
 assert.equal(current.problems_checked_current_count,1);
 assert.equal(page.url(),targetUrl);
 assert.deepEqual(forbidden,[],'No network access from inspector');
 await context.close();
 console.log('Vision native approval: 25 options/0 selected; 13+27 timeline; 6PDF+1PSD; zero requests PASS');
}finally{await browser.close()}
