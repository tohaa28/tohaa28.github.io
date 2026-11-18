// Fully synthetic browser regression; no real customer data.
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
const extensionDir=await mkdtemp(path.join(os.tmpdir(),'vision-approval-queue-ext-'));
const profile=await mkdtemp(path.join(os.tmpdir(),'vision-approval-queue-profile-'));
for(const name of ['manifest.json','service-worker.js','content-transport.js'])
 await cp(path.resolve('vision/orders/extension',name),path.join(extensionDir,name));
for(const name of ['vision-order-overlay.js','vision-order-approval.js'])
 await cp(path.resolve(name),path.join(extensionDir,name));
const list='http://psk.testgifts.local/devorders?status=140';
const order='http://testgifts.local/private/order/8001111';
const image='http://files.testgifts.local/maketadjusting/11313/8001111/77/capture.png';
const listing='<html><body><table><tbody><tr><td>'+
 '<a href="'+order+'">8001111</a></td><td>Согласование</td></tr></tbody></table></body></html>';
const comments='<li><div class="comment_wrap"><div class="flex-main">'+
 'Синтетическая ошибка толщины <g-gallery></g-gallery></div></div></li>'+
 '<li><div class="comment_wrap"><div class="flex-main">'+
 'Синтетический ответ о правке.</div></div></li>';
const orderHtml='<html><body><div id="j_cart_host" data-orderid="550"></div>'+
 '<li data-itemid="77"><a class="j_maketadjusting" href="#">'+
 '<span class="gifts-badge">2</span></a></li><script>'+
 'window.fixtureComments='+JSON.stringify(comments)+';'+
 'window.fixtureImage='+JSON.stringify(image)+';'+
 "window.nativeClicks=0;\ndocument.querySelector('a.j_maketadjusting').addEventListener('click',event=>{\nevent.preventDefault();window.nativeClicks++;\nconst modal=document.createElement('g-modal');\nmodal.innerHTML='<form id=\"j_maketAdjustingForm\"><input type=\"hidden\" name=\"oiid\" value=\"77\">'+\n'<label><input type=\"checkbox\" name=\"ma_problem[]\" value=\"55\" checked>Тонкие линии</label></form>'+\n'<div id=\"j_maketadjustingcomments_counter\">2</div>'+\n'<ul id=\"j_maketadjusting_comments_list\">'+window.fixtureComments+'</ul>';\ndocument.body.append(modal);\nconst gallery=modal.querySelector('g-gallery');\ngallery.attachShadow({mode:'open'}).innerHTML='<section><picture><img src=\"'+\nwindow.fixtureImage+'\"></picture></section><nav><img src=\"'+window.fixtureImage+'\"></nav>';\nmodal.setAttribute('visible','');\n});"+
 '</script></body></html>';
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]);
// A local HTTP proxy exercises Chrome extension-created tabs too. Playwright
// route() can miss navigation initiated before a new target is attached.
const requests=[];
const proxy=createServer((req,res)=>{
 const url=req.url?.startsWith('http://')?req.url:
   'http://'+req.headers.host+req.url;
 const method=req.method;
 let type='unexpected',body=Buffer.from('denied'),mime='text/plain',status=404;
 if(url===list){type='list';body=Buffer.from(listing);mime='text/html';status=200}
 else if(url===order){type='order';body=Buffer.from(orderHtml);mime='text/html';status=200}
 else if(url===image){type='image';body=png;mime='image/png';status=200}
 requests.push({type,method});
 res.writeHead(status,{'content-type':mime,'content-length':body.length,
  'cache-control':'no-store'});
 res.end(body);
});
await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
const proxyPort=proxy.address().port;
let browserContext;
try{
 browserContext=await chromium.launchPersistentContext(profile,{
  channel:'chromium',headless:true,acceptDownloads:true,
  args:['--disable-extensions-except='+extensionDir,'--load-extension='+extensionDir,
   '--proxy-server=http://127.0.0.1:'+proxyPort,
   '--proxy-bypass-list=<-loopback>']
 });
 const downloads=[],errors=[];
 browserContext.on('page',page=>{
  page.on('download',d=>downloads.push(d));
  page.on('pageerror',e=>errors.push(String(e)));
 });
 const page=await browserContext.newPage();
 await page.goto(list);
 await page.locator('[data-vision-order-cell]').waitFor({timeout:15000});
 await page.locator('#vision-local-order-overlay button')
  .filter({hasText:'Собрать согласования из всех заказов'}).click();
 await page.waitForFunction(()=>
  document.querySelector('#vision-local-order-overlay .vlo-stats')
    ?.textContent?.includes('Обход согласований завершён'),null,{timeout:45000});
 const debugDownload=page.waitForEvent('download');
 await page.locator('#vision-local-order-overlay button')
  .filter({hasText:'Отчёт согласований JSON'}).click();
 const debugQueue=JSON.parse(await readFile(await (await debugDownload).path(),'utf8'));
 console.log('SYNTHETIC_QUEUE_DIAGNOSTIC',JSON.stringify({
  status:await page.locator('#vision-local-order-overlay .vlo-stats').innerText(),
  requestKinds:requests.map(x=>x.type),report:debugQueue}));
 assert.equal(page.url(),list);
 assert.equal(requests.filter(x=>x.type==='order').length,1);
 assert.ok(requests.some(x=>x.type==='image'));
 assert.ok(requests.every(x=>x.method==='GET'&&x.type!=='unexpected'));
 const status=await page.locator('#vision-local-order-overlay .vlo-stats').innerText();
 assert.match(status,/Прочитано обсуждений: 1/);
 const privateDownload=downloads.find(x=>
  x.suggestedFilename()==='vision-private-approval-evidence-8001111.json');
 assert.ok(privateDownload,'list action automatically downloads private text JSON');
 const report=JSON.parse(await readFile(await privateDownload.path(),'utf8'));
 assert.equal(report.articles[0].observed_human_comments,2);
 assert.equal(report.articles[0].current_problems.length,1);
 assert.equal(report.articles[0].history.length,2);
 const attachment=report.articles[0].history[0].attachments[0];
 assert.equal(attachment.source,'native_approval_gallery');
 assert.equal(attachment.local_get_status,'LOCAL_ATTACHMENT_BYTES_ONLY');
 assert.equal(attachment.sha256.length,64);
 assert.ok(JSON.stringify(report).includes('Синтетическая ошибка'));
 assert.equal(JSON.stringify(report).includes('files.testgifts.local'),false);
 assert.ok(downloads.some(x=>
  x.suggestedFilename()==='vision-private-approval-attachments-part-0001.zip'));
 const anonEvent=page.waitForEvent('download');
 await page.locator('#vision-local-order-overlay button')
  .filter({hasText:'Отчёт согласований JSON'}).click();
 const anon=JSON.parse(await readFile(await (await anonEvent).path(),'utf8'));
 assert.equal(anon.totals.verified_articles,1);
 assert.equal(anon.totals.files,1);
 assert.equal(JSON.stringify(anon).includes('8001111'),false);
 assert.equal(JSON.stringify(anon).includes('capture.png'),false);
 assert.deepEqual(errors,[]);
 console.log('Vision M3.21 list->native approval->gallery PNG->private JSON/ZIP PASS');
}finally{
 if(browserContext)await browserContext.close();
 await new Promise(resolve=>proxy.close(resolve));
 await rm(extensionDir,{recursive:true,force:true});
 await rm(profile,{recursive:true,force:true});
}
