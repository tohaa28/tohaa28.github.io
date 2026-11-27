// Playwright smoke for the EXACT Vision bookmarklet and built launcher.
// All network responses are synthetic and intercepted. No real Gifts login,
// cart, order, customer artwork, tokens or external network calls.
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const launcher=readFileSync(new URL('../launcher.js',import.meta.url),'utf8');
const GIFT='https://gifts.ru/';
const PREVIEW='https://tohaa28.github.io/gifts-layout-workbench-vision/';
const browser=await chromium.launch({headless:true});
try{
  const installer=await browser.newPage();
  await installer.setContent(index);
  const bookmarklet=await installer.locator('#visionBookmarklet').getAttribute('href');
  assert.ok(bookmarklet?.startsWith('javascript:'),'Installer must offer actual browser bookmarklet');
  assert.ok(bookmarklet.includes(PREVIEW+'launcher.js'), 'Must load isolated Vision, not main Maketnaya');
  assert.equal(await installer.locator('a[href="./editor.html"]').count(),0,
    'Direct editor on GitHub Pages loses the authenticated gifts.ru session');
  await installer.locator('#visionBookmarklet').click();
  assert.match(await installer.locator('#installStatus').innerText(),/Перетащите/);
  await installer.close();

  for(const viewport of [{width:1366,height:850},{width:390,height:780}]){
    const context=await browser.newContext({viewport,acceptDownloads:true});
    await context.addCookies([{
      name:'mock_logged_in_cookie',value:'synthetic_auth_only',url:GIFT,
      httpOnly:true,secure:true,sameSite:'Lax'
    }]);
    let sessionCookieSeen=false,foreignRequests=0,launcherRequests=0;
    await context.route('**/*',async route=>{
      const url=route.request().url();
      if(url===PREVIEW+'launcher.js' || url.startsWith(PREVIEW+'launcher.js?v=')){
        launcherRequests++;
        return route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:launcher});
      }
      if(url===GIFT || url==='https://gifts.ru'){
        return route.fulfill({status:200,contentType:'text/html',
          body:'<!doctype html><html><head><title>Gifts / signed in / synthetic</title></head><body>'+
            '<div id="giftsSession">SYNTHETIC SIGNED-IN PAGE</div></body></html>'});
      }
      if(url.startsWith('https://gifts.ru/vision-auth-check')){
        const cookie=route.request().headers()['cookie']||'';
        sessionCookieSeen=cookie.includes('mock_logged_in_cookie=synthetic_auth_only');
        return route.fulfill({status:200,contentType:'application/json',
          body:JSON.stringify({authenticated:sessionCookieSeen})});
      }
      if(url.startsWith(PREVIEW)){
        const type=url.split('?')[0].endsWith('.css')?'text/css':'application/javascript';
        return route.fulfill({status:200,contentType:type,body:''});
      }
      foreignRequests++;
      return route.abort();
    });
    const page=await context.newPage();
    const dialogs=[];
    page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss()});
    await page.goto(GIFT);
    const beforeUrl=page.url();
    assert.equal(await page.locator('#giftsSession').innerText(),'SYNTHETIC SIGNED-IN PAGE');
    await page.evaluate(link=>{
      const a=document.createElement('a');a.href=link;a.textContent='synthetic bookmark';
      document.body.appendChild(a);a.click();a.remove();
    },bookmarklet);
    const host=page.locator('#gifts-layout-workbench-host');
    await host.waitFor({state:'attached',timeout:12000});
    assert.equal(await host.getAttribute('data-gwb-variant'),'vision');
    const frame=host.locator('iframe.gwb-frame');
    assert.equal(await frame.getAttribute('title'),'Макетная · PrintCheck Vision');
    const srcdoc=await frame.getAttribute('srcdoc');
    assert.ok(srcdoc?.includes('<base href="https://gifts.ru/">'),
      'Editor should inherit authenticated gifts.ru origin');
    assert.ok(srcdoc.includes(PREVIEW+'assets/printcheck-vision-ui.js'),
      'Vision JS must load from isolated preview');
    assert.ok(srcdoc.includes('parent.fetch.bind(parent)'),
      'Same-origin app should use parent gifts.ru fetch bridge');
    const frameHandle=await frame.elementHandle();
    const subframe=await frameHandle.contentFrame();
    assert.ok(subframe,'iframe srcdoc did not create a real frame');
    await subframe.waitForLoadState('domcontentloaded');
    assert.equal(new URL(subframe.url()).protocol,'about:','srcdoc frame expected');
    // about:srcdoc has an opaque-looking URL; location.origin is 'null'
    // even when the DOCUMENT inherited the embedding parent's origin.
    // Test the actual same-origin capability instead of the URL's origin.
    const directParentAccess=await subframe.evaluate(()=>{
      try{
        return window.parent.location.origin==='https://gifts.ru'&&
          window.parent.document.querySelector('#giftsSession')?.textContent===
            'SYNTHETIC SIGNED-IN PAGE';
      }catch{return false}
    });
    assert.equal(directParentAccess,true,
      'Srcdoc must inherit authorized gifts.ru origin and access parent DOM');
    const fetchResult=await subframe.evaluate(async()=>fetch('https://gifts.ru/vision-auth-check')
      .then(r=>r.json()));
    assert.equal(fetchResult.authenticated,true,
      'The iframe must use the real parent origin and carry HttpOnly auth cookies');
    assert.equal(sessionCookieSeen,true);
    assert.equal(page.url(),beforeUrl,'Launch must not navigate away from gifts session');
    assert.equal(await page.locator('#giftsSession').count(),1,
      'Underlying authorized gifts page must remain in the DOM');
    assert.equal(launcherRequests,1);
    assert.ok(!dialogs.some(x=>/откройте.*gifts\.ru/i.test(x)));
    // Trigger the saved bookmarklet a second time: just toggle the overlay.
    await page.evaluate(link=>{
      const a=document.createElement('a');a.href=link;document.body.appendChild(a);a.click();a.remove();
    },bookmarklet);
    await host.waitFor({state:'detached',timeout:12000});
    assert.equal(page.url(),beforeUrl);
    await context.close();
    assert.ok(foreignRequests<30,'unexpected third-party network use in smoke');
  }

  // Protect an unsaved, already open production Maketnaya. Vision must NOT
  // silently replace or close it when a user clicks the wrong bookmark.
  const context=await browser.newContext();
  await context.route('**/*',route=>{
    const url=route.request().url();
    if(url===GIFT)return route.fulfill({status:200,contentType:'text/html',
      body:'<html><body><div id="gifts-layout-workbench-host" data-gwb-variant="mockups">'+
      '<button class="gwb-close" id="prodClose">×</button></div></body></html>'});
    if(url.startsWith(PREVIEW+'launcher.js'))
      return route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:launcher});
    return route.abort();
  });
  const page=await context.newPage();
  let seenAlert='';
  page.on('dialog',async dialog=>{seenAlert=dialog.message();await dialog.dismiss()});
  await page.goto(GIFT);
  await page.evaluate(link=>{
    const a=document.createElement('a');a.href=link;document.body.appendChild(a);a.click();
  },bookmarklet);
  await page.waitForTimeout(150);
  assert.match(seenAlert,/Основная Макетная уже открыта/);
  assert.equal(await page.locator('#prodClose').count(),1,
    'Vision may not silently discard the open main editor');
  await context.close();
  console.log('Vision bookmarklet: authenticated same-origin launch/toggle and main-editor guard passed');
}finally{await browser.close()}
