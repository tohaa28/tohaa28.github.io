import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Reproduce the actual gifts.ru bookmarklet topology: a same-origin srcdoc
// workbench iframe under a parent with the outer "Закрыть Макетную" control.
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  await page.route('https://gifts.ru/__gwb_vectorcraft_close_test',async route=>
    route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  await page.route('https://tohaa28.github.io/gifts-layout-workbench-mockups/vectorcraft/index.html*',
    async route=>route.fulfill({status:200,contentType:'text/html',
      body:'<!doctype html><html><body>Mock engine booting</body></html>'}));
  await page.goto('https://gifts.ru/__gwb_vectorcraft_close_test');
  await page.evaluate(()=>{
    const host=document.createElement('div');
    host.id='gifts-layout-workbench-host';
    const close=document.createElement('button');
    close.className='gwb-close';
    close.setAttribute('aria-label','Закрыть Макетную');
    const frame=document.createElement('iframe');
    frame.id='gwb-frame';
    frame.style.cssText='display:block;width:1450px;height:890px;border:0';
    frame.name='workbench';
    frame.srcdoc='<!doctype html><html><body><button id="editorOpenLogoEditor">Редактор логотипа</button></body></html>';
    host.append(frame,close);
    document.body.append(host);
    window.__editorSignals=[];
    window.addEventListener('message',event=>{
      if(event.source!==frame.contentWindow||event.origin!==location.origin||
         event.data?.type!=='gwb-maketnaya-vectorcraft-visibility')return;
      const hide=!!event.data.visible;
      close.style.display=hide?'none':'';
      close.disabled=hide;
      window.__editorSignals.push(hide);
    });
  });
  await page.frameLocator('#gwb-frame').locator('#editorOpenLogoEditor').waitFor();
  const frame=page.frame({name:'workbench'});
  assert.ok(frame,'The srcdoc workbench iframe must be mounted');
  await frame.evaluate(()=>{
    const file=new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'],
      'logo.svg',{type:'image/svg+xml'});
    window.gwbGetActiveLogoForEditor=()=>({
      file,token:'current-placement',fieldIndex:0,fieldSizeMm:{w:120,h:80},
      placementMm:{x:0,y:0,w:10,h:10,rotation:0}
    });
    window.gwbVectorcraftField={
      fieldInfo:()=>({w:120,h:80}),
      prepare:async(selected)=>({file:selected,fieldSizeMm:{w:120,h:80},fieldCanvas:true})
    };
  });
  await frame.addScriptTag({path:'assets/vectorcraft-integration.js'});
  assert.equal(await page.locator('.gwb-close').isVisible(),true,'Outer close visible without editor');
  await frame.locator('#editorOpenLogoEditor').click();
  await page.waitForFunction(()=>document.querySelector('.gwb-close')?.disabled===true);
  assert.equal(await page.locator('.gwb-close').isHidden(),true,
    'VectorCraft reliably hides parent gifts.ru close button');
  assert.deepEqual(await page.evaluate(()=>window.__editorSignals),[true],
    'srcdoc sends message to inherited parent origin, not to about:srcdoc null origin');
  await frame.getByRole('button',{name:'Закрыть без изменений'}).click();
  await page.waitForFunction(()=>document.querySelector('.gwb-close')?.disabled===false);
  assert.equal(await page.locator('.gwb-close').isVisible(),true,
    'Outer close is restored when VectorCraft is closed');
  assert.deepEqual(await page.evaluate(()=>window.__editorSignals),[true,false]);

  // Keep the older editor functioning and apply the same visibility contract.
  await frame.evaluate(()=>{
    window.gwbLogoEditor={active:true};
    window.gwbReportLogoEditorVisibility(true);
  });
  await page.waitForFunction(()=>document.querySelector('.gwb-close')?.disabled===true);
  assert.equal(await page.locator('.gwb-close').isHidden(),true,
    'Simple logo editor also hides the outer close button');
  await frame.evaluate(()=>{
    window.gwbLogoEditor.active=false;
    window.gwbReportLogoEditorVisibility(false);
  });
  await page.waitForFunction(()=>document.querySelector('.gwb-close')?.disabled===false);
  assert.equal(await page.locator('.gwb-close').isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>window.__editorSignals),[true,false,true,false]);
  console.log('Srcdoc bookmarklet: both logo editors correctly hide/restore Maketnaya close button');
} finally {
  await browser.close();
}
