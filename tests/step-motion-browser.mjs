import assert from 'node:assert/strict';
export async function verifyStepMotion(frame) {
  await frame.waitForFunction(() => !!window.gwbFlow && !!window.gwbGetEditorReadiness?.().logoReady);
  const settle = async () => {
    await frame.evaluate(async()=>{
      for(let round=0;round<4;round++) {
        await new Promise(requestAnimationFrame);
        const animations=document.getAnimations().filter(animation=>animation.playState==='running'&&Number.isFinite(animation.effect.getComputedTiming().endTime));
        if(!animations.length)return;
        await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
      }
    });
  };
  const capture = async path => {await settle();await frame.page().screenshot({path,animations:'disabled'})};
  const data = () => frame.evaluate(() => ({
    name: document.getElementById('artworkName').textContent,
    width: document.getElementById('width').value, height: document.getElementById('height').value,
    angle: document.getElementById('editorAngle').value,
    field: document.getElementById('orderFieldChoice').value,
    ready: window.gwbGetEditorReadiness(),
    frame: document.getElementById('mockupFrame').contentWindow.location.href,
    factor: document.getElementById('fieldZoom')?.dataset.factor
  }));
  await frame.evaluate(() => {
    window.gwbFlow.setSettings(false); window.gwbFlow.go(3);
    for (const id of ['logoPreflight','logoDetailCheck']) { const node=document.getElementById(id); if(node)node.open=false; }
    document.querySelector('.rail').scrollTop=0;
  });
  await frame.locator('#flowSettingsDock').waitFor({state:'hidden'});
  const before = await data();
  await capture('step-motion-desktop.png');
  await frame.locator('[data-flow-step="2"]').click();
  assert.equal(await frame.locator('#orderEditor').getAttribute('data-flow-step'), '2');
  assert.equal(await frame.locator('[data-flow-part="artwork"]').isVisible(), false);
  await frame.locator('[data-flow-step="3"]').click();
  assert.equal(await frame.locator('[data-flow-part="artwork"]').isVisible(), true);
  await frame.locator('#flowSettings').click();
  await frame.locator('#flowSettingsDock').waitFor({state:'visible'});
  assert.equal(await frame.locator('#width').isVisible(), true);
  assert.equal(await frame.locator('#editorAngle').isVisible(), true);
  await capture('step-motion-settings.png');
  await frame.locator('#flowCloseSettings').focus();
  await frame.page().keyboard.press('Escape');
  await frame.locator('#flowSettingsDock').waitFor({state:'hidden'});
  assert.equal(await frame.locator('#flowSettingsDock').isVisible(), false);
  assert.equal(await frame.locator('#flowSettings').getAttribute('aria-expanded'), 'false');
  await frame.locator('#flowNext').click();
  assert.equal(await frame.locator('#orderEditor').getAttribute('data-flow-step'), '4');
  assert.equal(await frame.locator('#simpleExport').isVisible(), true);
  await frame.evaluate(()=>document.querySelector('.rail').scrollTop=0);
  await capture('step-motion-export.png');
  const exportButton = await frame.locator('#simpleExport').boundingBox();
  const railBox = await frame.locator('.rail').boundingBox();
  assert.ok(exportButton.y >= railBox.y && exportButton.y + exportButton.height <= railBox.y + railBox.height,
    'The download button must fit in the settled desktop step: '+JSON.stringify({exportButton,railBox}));
  await frame.locator('#flowReviewEdit').click();
  assert.equal(await frame.locator('#orderEditor').getAttribute('data-flow-step'), '3');
  assert.deepEqual(await data(), before, 'Backtracking must preserve files, dimensions, rotation, selection, zoom and native readiness');
  // Fast clicks must never leave two active steps or queued navigation.
  await frame.evaluate(() => { for(let i=0;i<20;i++){window.gwbFlow.go(2);window.gwbFlow.go(3)} });
  assert.equal(await frame.locator('#flowNavigation [aria-current="step"]').count(), 1);
  const originalViewport = frame.page().viewportSize();
  await frame.page().setViewportSize({width:390,height:844});
  await frame.locator('#flowSettings').click();
  const mobile = await frame.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    position: getComputedStyle(document.getElementById('flowSettingsDock')).position,
    widths: [...document.querySelectorAll('#flowNavigation button')].map(b=>b.getBoundingClientRect().width)
  }));
  assert.equal(mobile.overflow, false, JSON.stringify(mobile));
  assert.equal(mobile.position, 'relative');
  assert.ok(mobile.widths.every(w=>w>0));
  await frame.waitForFunction(()=>{
    const close=document.getElementById('flowCloseSettings').getBoundingClientRect(),header=document.getElementById('flowHeader').getBoundingClientRect();
    return close.y>=header.bottom && close.bottom<=innerHeight;
  });
  assert.equal(await frame.locator('#flowHeader').evaluate(node=>node.parentElement.classList.contains('app')),true);
  await capture('step-motion-mobile-settings.png');
  await frame.locator('#flowCloseSettings').click();
  await frame.locator('#flowSettingsDock').waitFor({state:'hidden'});
  await frame.locator('[data-flow-step="3"]').click();
  await capture('step-motion-mobile.png');
  const mobileHeader=await frame.locator('#flowHeader').boundingBox();
  await frame.evaluate(()=>document.querySelector('.app>main').scrollTop=400);
  const scrolledHeader=await frame.locator('#flowHeader').boundingBox();
  assert.equal(scrolledHeader.y,mobileHeader.y,'Mobile steps stay reachable while the workspace scrolls');
  await frame.page().setViewportSize({width:320,height:740});
  const narrow=await frame.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,header:document.getElementById('flowHeader').getBoundingClientRect().width}));
  assert.equal(narrow.overflow,false,JSON.stringify(narrow));
  await capture('step-motion-mobile-narrow.png');
  if(originalViewport) await frame.page().setViewportSize(originalViewport);
  await frame.page().emulateMedia({reducedMotion:'reduce'});
  await frame.locator('[data-flow-step="2"]').click();
  await frame.locator('[data-flow-step="3"]').click();
  assert.equal(await frame.evaluate(()=>window.gwbFlow.getState().step),3);
  await frame.page().emulateMedia({reducedMotion:'no-preference'});
  await frame.evaluate(()=>window.gwbFlow.setSettings(true));
  await frame.locator('#mockupModeButton').click();
  await frame.locator('#mockupShell').waitFor({state:'visible'});
  await frame.locator('#mockupBackButton').click();
  await frame.locator('#mockupShell').waitFor({state:'hidden'});
  assert.equal(await frame.evaluate(()=>window.gwbMotion.isClosing(document.getElementById('mockupShell'))),false);
  console.log('Step motion browser: progressive controls, drawer, Escape, export step, native data preservation, rapid navigation, mobile width and reduced motion passed');
}
