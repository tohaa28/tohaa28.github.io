// Chromium synthetic authorized order: discussion discovery must NEVER click,
// POST, fetch attachments, fetch popup or export personal messages.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const bundle=await readFile('vision-order-overlay.js','utf8');
const base='http://psk.testgifts.local',script=
 'https://tohaa28.github.io/gifts-layout-workbench-vision/vision-order-overlay.js';
const table='<table><thead><tr><th>Order</th><th>Status</th></tr></thead><tbody>'+
 '<tr><td><a href="/private/order/8001333">8001333</a></td><td>140</td></tr>'+
 '</tbody></table>';
const card='<html><body><section id="j_cart_host" data-orderid="771">'+
 '<div data-orderitemid="9842"><button type="button" title="Обсуждение по артикулу" '+
 'data-action="open-discussion">Обсуждение</button>'+
 '<section class="discussion-list"><div class="comment-item">'+
 '<p class="comment-body">Клиент: Иван +7 912-555-44-33. Линия тонкая, пробел меньше нормы.</p>'+
 '<a href="/private/screenshots/secret.png"><img src="data:image/png;base64," alt="screenshot"></a>'+
 '</div></section></div>'+
 '<button title="Согласования макетов" type="button">Согласование</button>'+
 '</section></body></html>';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 let reads=0;
 const forbidden=[];
 await page.route('**/*',route=>{
  const url=route.request().url(),method=route.request().method();
  if(url===base+'/devorders?status=140'&&method==='GET')
   return route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:table});
  if(url===script&&method==='GET')
   return route.fulfill({status:200,contentType:'application/javascript',body:bundle});
  if(url===base+'/private/order/8001333'&&method==='GET'){
   reads++;return route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:card});
  }
  forbidden.push({url,method});return route.abort();
 });
 await page.goto(base+'/devorders?status=140');
 await page.addScriptTag({url:script});
 assert.equal(reads,0,'No automatic site requests');
 await page.locator('#vision-local-order-overlay button')
   .filter({hasText:'Найти обсуждения'}).click();
 await page.waitForFunction(()=>document.querySelector('#vision-local-order-overlay .vlo-stats')
  ?.textContent?.includes('Диагностика обсуждений завершена'),null,{timeout:15000});
 assert.equal(reads,1,'One read-only GET; no extra popup or attachment request');
 const event=page.waitForEvent('download');
 await page.locator('#vision-local-order-overlay button')
   .filter({hasText:'Обсуждения JSON'}).click();
 const json=JSON.parse(await readFile(await (await event).path(),'utf8'));
 assert.equal(json.schema,'printcheck.vision.anonymous-article-discussion-probe.v1');
 assert.equal(json.rows_scanned,1);
 const item=json.rows[0];
 assert.equal(item.status,'STRUCTURE_ONLY_UNVERIFIED');
 assert.equal(item.article_scoped_controls,1);
 assert.equal(item.inline_thread_candidates,1);
 assert.equal(item.visible_message_candidates,1);
 assert.equal(item.screenshot_or_image_candidates,1);
 assert.deepEqual(item.weak_topic_candidates,['negative_min','positive_min']);
 assert.equal(item.expert_label_verified,false);
 assert.equal(item.training_ready,false);
 const safe=JSON.stringify(json);
 for(const secret of ['Иван','+7 912','8001333','9842','secret.png',
  'private/screenshots','771','0,1 мм'])
  assert.equal(safe.includes(secret),false,secret);
 assert.deepEqual(forbidden,[],'No screenshot or message requests');
 assert.equal(page.url(),base+'/devorders?status=140');
 await context.close();
 console.log('Vision article discussion: one GET, categorical JSON, no mutation/PII PASS');
}finally{await browser.close()}
