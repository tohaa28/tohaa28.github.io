import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs';
assert.match(fs.readFileSync('assets/index-BpU9kvz8.js','utf8'),/gwbGetActiveLogoForEditor=function\(\)/,'Published bundle must expose the actual selected logo');
assert.match(fs.readFileSync('assets/index-BpU9kvz8.js','utf8'),/gwbApplyEditedLogoToActiveField=async function/,'Published bundle must preserve placement when replacing artwork');

const browser=await chromium.launch({headless:true});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.setContent('<!doctype html><html><head></head><body><div id="fieldLogoTools"><button id="editorOpenLogoEditor">Редактор логотипа</button></div><input id="artwork" type="file" accept=".svg,.png,.jpg"><span id="artworkName">Выбрать файл</span><p id="status"></p></body></html>');
  await page.evaluate(()=>{window.__changes=[];document.getElementById('artwork').addEventListener('change',e=>window.__changes.push(e.target.files[0]?.name||''))});
  await page.addScriptTag({path:'assets/logo-path.js'});
  await page.addScriptTag({path:'assets/logo-editor.js'});
  await page.click('#editorOpenLogoEditor');
  assert.equal(await page.locator('#gwbLogoEditor').isVisible(),true,'Logo editor opens in the existing Maketnaya page');
  assert.equal(await page.locator('#gwbVeLayer > *').count(),0,'New document starts blank');
  const canvas=page.locator('#gwbVeCanvas');
  await page.locator('[data-tool="rect"]').click();
  const a=await canvas.boundingBox();
  assert.ok(a&&a.width>100&&a.height>100,'Editor SVG stage is visible');
  await page.mouse.move(a.x+75,a.y+65);await page.mouse.down();await page.mouse.move(a.x+230,a.y+160,{steps:9});await page.mouse.up();
  assert.equal(await page.locator('#gwbVeLayer > rect').count(),1,'Rectangle draw tool creates an SVG rectangle');
  await page.click('#gwbVeUndo');
  assert.equal(await page.locator('#gwbVeLayer > rect').count(),0,'Undo removes the rectangle');
  await page.click('#gwbVeRedo');
  assert.equal(await page.locator('#gwbVeLayer > rect').count(),1,'Redo restores the rectangle');
  await page.locator('[data-tool="text"]').click();
  await page.mouse.click(a.x+255,a.y+225);
  assert.equal(await page.locator('#gwbVeLayer text').count(),1,'Text tool adds editable text');
  await page.locator('#gwbVeText').fill('Тестовый логотип');
  await page.locator('#gwbVeText').dispatchEvent('change');
  await page.click('#gwbVeApply');
  assert.equal(await page.locator('#gwbLogoEditor').isVisible(),false,'Apply closes the editor');
  const first=await page.evaluate(async()=>{
    const file=document.getElementById('artwork').files[0];
    return {type:file?.type,name:file?.name,content:await file?.text(),events:window.__changes.slice()};
  });
  assert.equal(first.type,'image/svg+xml','Return to Maketnaya uses a vector SVG file');
  assert.match(first.content,/<rect\b/);
  assert.match(first.content,/Тестовый логотип/);
  assert.equal(first.events.length,1,'Return triggers normal file change event exactly once');
  await page.evaluate(()=>{
    const el=document.getElementById('artwork');
    document.getElementById('artworkName').textContent=el.files[0].name;
    el.value=''; // the original Maketnaya uploader does this after import
  });
  await page.click('#editorOpenLogoEditor');
  await page.locator('#gwbVeLayer text').first().waitFor({state:'attached'});
  assert.equal(await page.locator('#gwbVeLayer text').count(),1,'Editor can re-open current artwork after host clears input.value');
  await page.click('#gwbVeCancel');
  await page.locator('#artwork').setInputFiles({name:'import.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 250 160"><script>window.__svgInjected=1</script><path d="M 10 20 L 60 20 L 60 75 Z" fill="#123456"/><image href="https://untrusted.example/track.png" x="0" y="0" width="20" height="20"/></svg>')});
  await page.click('#editorOpenLogoEditor');
  await page.locator('#gwbVeLayer path').first().waitFor({state:'attached'});
  assert.equal(await page.locator('#gwbVeLayer path').count(),1,'Imports existing vector paths without rasterizing');
  assert.equal(await page.locator('#gwbVeLayer script').count(),0,'Removes executable markup from imported SVG');
  assert.equal(await page.evaluate(()=>window.__svgInjected),undefined,'Does not execute SVG scripts');
  assert.equal(await page.locator('#gwbVeLayer image[href]').count(),0,'Removes external SVG image links');
  await page.click('#gwbVeUngroup');
  assert.equal(await page.locator('#gwbVeLayer > path').count(),1,'Ungroup exposes editable SVG elements');
  await page.click('#gwbVeSmooth');
  const smooth=await page.locator('#gwbVeLayer > path').getAttribute('d');
  assert.match(smooth,/C /,'Smooth polyline creates real cubic Bezier segments');
  await page.locator('[data-tool="nodes"]').click();
  assert.ok(await page.locator('#gwbVeUi [data-path-index]').count()>1,'Bezier node and control handles are exposed');
  const beforeNode=await page.locator('#gwbVeLayer > path').getAttribute('d');
  const handle=page.locator('#gwbVeUi [data-path-index="1"][data-path-key="x"]').first();
  const pos=await handle.boundingBox();
  await page.mouse.move(pos.x+pos.width/2,pos.y+pos.height/2);
  await page.mouse.down();await page.mouse.move(pos.x+pos.width/2+15,pos.y+pos.height/2+9,{steps:5});await page.mouse.up();
  assert.notEqual(await page.locator('#gwbVeLayer > path').getAttribute('d'),beforeNode,'Dragging a node changes the vector path, not a raster preview');
  await page.click('#gwbVeApply');
  const vector=await page.locator('#artwork').evaluate(async e=>await e.files[0].text());
  assert.match(vector,/<path\b/);assert.doesNotMatch(vector,/<script/);
  await page.locator('#artwork').setInputFiles({name:'raster.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y95hwAAAABJRU5ErkJggg==','base64')});
  await page.click('#editorOpenLogoEditor');
  await page.locator('#gwbVeLayer image').first().waitFor({state:'attached'});
  assert.equal(await page.locator('#gwbVeLayer image').count(),1,'Raster is represented as an embedded image');
  await page.locator('#gwbVeCropleft').fill('20');
  await page.locator('#gwbVeCroptop').fill('20');
  await page.click('#gwbVeCrop');
  await page.waitForFunction(()=>Number(document.querySelector('#gwbVeLayer image')?.getAttribute('width'))<1,{timeout:3000}).catch(async error=>{throw Error(error.message+' | status='+await page.locator('#gwbVeStatus').textContent())});
  const cropped=await page.locator('#gwbVeLayer image').getAttribute('width');
  assert.ok(Number(cropped)<1,'Raster crop updates the SVG image bounds');
  await page.click('#gwbVeApply');
  const raster=await page.locator('#artwork').evaluate(async e=>await e.files[0].text());
  assert.match(raster,/<image\b/,'Raster remains detectable inside output SVG');
  assert.match(raster,/data:image\/png;base64,/);
  // When the host has cleared <input type=file>, use the active placement bytes,
  // not any old file remembered by name. Verify the selected field is the only target.
  await page.evaluate(()=>{
    const enc=s=>new File([s],'same-name.svg',{type:'image/svg+xml'});
    window.__placements=[
      enc('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><text x="5" y="25">Поле ОДИН</text></svg>'),
      enc('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><text x="5" y="25">Поле ДВА</text></svg>')
    ];
    window.__current=1;window.__applyCalls=[];
    window.gwbGetActiveLogoForEditor=()=>{
      const i=window.__current;
      return {token:i+'|same-name.svg',fieldIndex:i,hasArtwork:true,file:window.__placements[i],name:'same-name.svg'};
    };
    window.gwbApplyEditedLogoToActiveField=async(file,token)=>{
      const expected=window.__current+'|same-name.svg';
      if(token!==expected)throw Error('Wrong field');
      window.__applyCalls.push({index:window.__current,token});
      window.__placements[window.__current]=file;
    };
    document.getElementById('artwork').value='';
  });
  await page.click('#editorOpenLogoEditor');
  await page.getByText('Поле ДВА',{exact:true}).first().waitFor();
  assert.equal(await page.locator('#gwbVeLayer text').textContent(),'Поле ДВА','Existing selected placement is shown, despite equal filenames');
  await page.locator('#gwbVeText').fill('Исправлено второе');
  await page.locator('#gwbVeText').dispatchEvent('change');
  await page.click('#gwbVeApply');
  assert.equal(await page.locator('#gwbLogoEditor').isVisible(),false);
  const afterBridge=await page.evaluate(async()=>({
    original:await window.__placements[0].text(),
    edited:await window.__placements[1].text(),
    calls:window.__applyCalls
  }));
  assert.match(afterBridge.original,/Поле ОДИН/,'Other placement must remain untouched');
  assert.match(afterBridge.edited,/Исправлено второе/,'Edited artwork replaces only active placement');
  assert.deepEqual(afterBridge.calls,[{index:1,token:'1|same-name.svg'}]);
  assert.deepEqual(errors,[],'Browser JavaScript remains free of unhandled errors');
  console.log('Integrated logo editor: original selected field / cubic Bezier nodes / crop / SVG sanitization / vector-raster validation passed');
}finally{await browser.close()}
