// Isolated Playwright smoke test for PrintCheck Vision UI.
// Does not load, upload, modify, or submit any real Gifts order.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';

const browser = await chromium.launch({headless:true});
try {
  for (const viewport of [{width:1360,height:880},{width:390,height:800}]) {
    const page = await browser.newPage({viewport,acceptDownloads:true});
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    let externalRequests = 0;
    page.on('request', req => { if (/^https?:\/\//i.test(req.url())) externalRequests++; });
    await page.setContent([
      '<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head><body>',
      '<header class="site-header"><div class="topbar"><span>Макетная</span><button id="accountButton">Войти</button></div></header>',
      '<input id="order" value="12345"><input id="article" value="15255">',
      '<input id="method" value="DTF"><input id="width" value="45"><input id="height" value="30">',
      '<input id="artwork" type="file"><span id="artworkName">sample.svg</span>',
      '<span id="fieldSize">45 × 30 мм</span><select id="orderFieldChoice"><option selected value="1">Грудь</option></select>',
      '<div id="orderEditor"><p id="checks">Размеры макета: проверены</p><p id="simpleChecks"></p>',
      '<canvas id="templateCanvas" width="300" height="200"></canvas><canvas id="overlay" width="300" height="200"></canvas></div>',
      '</body></html>'
    ].join(''));
    await page.addStyleTag({path:path.resolve('assets/printcheck-vision-ui.css')});
    await page.addScriptTag({path:path.resolve('assets/printcheck-vision-ui.js')});
    assert.equal(await page.locator('#gwbVisionToggle').count(),1);
    await page.locator('#gwbVisionToggle').click();
    assert.equal(await page.locator('#gwbVisionPanel').isVisible(),true);
    assert.match(await page.locator('#gwbvArtwork').textContent(),/sample.svg/);
    assert.match(await page.locator('#gwbvMethod').textContent(),/DTF/);
    await page.locator('#gwbvTabProtocol').click();
    assert.match(await page.locator('#gwbvLegacyChecks').textContent(),/Размеры макета/);
    assert.match(await page.locator('#gwbVisionPanel').textContent(),/Нейросетевая проверка ещё не подключена/);
    await page.locator('#gwbvTabVisual').click();
    await page.locator('#gwbvZoom').evaluate(el => { el.value = '3'; el.dispatchEvent(new Event('input', {bubbles:true})); });
    assert.equal(await page.locator('#gwbvZoomLabel').textContent(),'3×');
    await page.locator('#gwbvTabSummary').click();
    const promise = page.waitForEvent('download');
    await page.locator('#gwbvSave').click();
    const download = await promise;
    assert.match(download.suggestedFilename(),/printcheck-vision-summary-12345.txt/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#gwbVisionPanel').isVisible(),false);
    assert.equal(pageErrors.length,0,JSON.stringify(pageErrors));
    assert.equal(externalRequests,0,'The Vision UI itself must not upload artwork or call external services');
    await page.close();
  }
  console.log('PrintCheck Vision UI smoke: desktop/mobile passed');
} finally { await browser.close(); }
