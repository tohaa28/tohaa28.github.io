import assert from 'node:assert/strict';
export async function verifyStepMotion(frame) {
  await frame.waitForFunction(() => !!window.gwbFlow && !!window.gwbGetEditorReadiness?.().logoReady);
  const data = () => frame.evaluate(() => ({
    name: document.getElementById('artworkName').textContent,
    width: document.getElementById('width').value, height: document.getElementById('height').value,
    angle: document.getElementById('editorAngle').value,
    field: document.getElementById('orderFieldChoice').value,
    ready: window.gwbGetEditorReadiness(),
    frame: document.getElementById('mockupFrame').contentWindow.location.href,
    factor: document.getElementById('fieldZoom')?.dataset.factor
  }));
  await frame.evaluate(() => window.gwbFlow.setSettings(false));
  const before = await data();
  await frame.page().screenshot({path:'step-motion-desktop.png'});
  await frame.locator('[data-flow-step="2"]').click();
  assert.equal(await frame.locator('#orderEditor').getAttribute('data-flow-step'), '2');
  assert.equal(await frame.locator('[data-flow-part="artwork"]').isVisible(), false);
  await frame.locator('[data-flow-step="3"]').click();
  assert.equal(await frame.locator('[data-flow-part="artwork"]').isVisible(), true);
  await frame.locator('#flowSettings').click();
  await frame.locator('#flowSettingsDock').waitFor({state:'visible'});
  assert.equal(await frame.locator('#width').isVisible(), true);
  assert.equal(await frame.locator('#editorAngle').isVisible(), true);
  await frame.page().screenshot({path:'step-motion-settings.png'});
  await frame.locator('#flowCloseSettings').focus();
  await frame.page().keyboard.press('Escape');
  await frame.locator('#flowSettingsDock').waitFor({state:'hidden'});
  assert.equal(await frame.locator('#flowSettingsDock').isVisible(), false);
  assert.equal(await frame.locator('#flowSettings').getAttribute('aria-expanded'), 'false');
  await frame.locator('#flowNext').click();
  assert.equal(await frame.locator('#orderEditor').getAttribute('data-flow-step'), '4');
  assert.equal(await frame.locator('#simpleExport').isVisible(), true);
  await frame.page().screenshot({path:'step-motion-export.png'});
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
  await frame.page().screenshot({path:'step-motion-mobile.png',fullPage:true});
  await frame.locator('#flowCloseSettings').click();
  if(originalViewport) await frame.page().setViewportSize(originalViewport);
  await frame.page().emulateMedia({reducedMotion:'reduce'});
  await frame.locator('[data-flow-step="2"]').click();
  await frame.locator('[data-flow-step="3"]').click();
  assert.equal(await frame.evaluate(()=>window.gwbFlow.getState().step),3);
  await frame.page().emulateMedia({reducedMotion:'no-preference'});
  await frame.evaluate(()=>window.gwbFlow.setSettings(true));
  console.log('Step motion browser: progressive controls, drawer, Escape, export step, native data preservation, rapid navigation, mobile width and reduced motion passed');
}
