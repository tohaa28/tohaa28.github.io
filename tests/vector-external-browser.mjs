import assert from 'node:assert/strict';
export async function verifyVectorExternal(frame){
 const edit=frame.locator('#editorVectorEdit');
 await edit.waitFor({state:'visible'});
 assert.equal(await edit.isDisabled(),false);
 const original=await frame.evaluate(()=>window.gwbLogoPreflight.map(r=>({index:r.fieldIndex,name:r.format,status:r.status})));
 const snapshot=await frame.locator('#width').inputValue();
 const angle=await frame.locator('#editorAngle').inputValue();
 const clip=await frame.locator('#editorClip').isChecked();
 await edit.click();
 const dialog=frame.locator('#vectorExternalDialog');
 await dialog.waitFor({state:'visible'});
 assert.match(await frame.locator('#vectorExternalName').textContent(),/sharp-stripes.pdf/);
 const replacement=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" viewBox="0 0 20 10"><path d="M1 1H19V9H1Z" fill="green"/></svg>');
 await frame.locator('#vectorExternalFile').setInputFiles({name:'edited-return.svg',mimeType:'image/svg+xml',buffer:replacement});
 await frame.waitForFunction(()=>document.getElementById('artworkName')?.textContent==='edited-return.svg',null,{timeout:15000});
 assert.equal(await frame.locator('#editorAngle').inputValue(),angle,'Rotation was changed on vector reimport');
 assert.equal(await frame.locator('#editorClip').isChecked(),clip,'Clipping changed on vector reimport');
 const revised=Number(await frame.locator('#width').inputValue());
 assert.ok(revised>0&&revised<=Number(snapshot)+.05,'Physical footprint unexpectedly grew');
 const after=await frame.evaluate(()=>window.gwbLogoPreflight.map(r=>({index:r.fieldIndex,name:r.format,status:r.status})));
 assert.equal(after.find(r=>r.index===1)?.name,'svg');
 assert.deepEqual(after.filter(r=>r.index!==1),original.filter(r=>r.index!==1),'Other print fields were modified');
 assert.match(await frame.locator('#vectorExternalStatus').textContent(),/возвращён/);
 await dialog.locator('form button').click();
 await dialog.waitFor({state:'hidden'});
 // Simulate the loopback helper from the browser's own fetch interface; actual
 // HTTP/origin/file safety is covered independently by the Python server tests.
 await frame.evaluate(()=>{
   const originalFetch=window.fetch.bind(window);
   window.__gwbRestoreFetch=()=>window.fetch=originalFetch;
   const newSvg='<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" viewBox="0 0 20 10"><path d="M1 1H18V9H1Z" fill="blue"/></svg>';
   let launched=false;
   const reply=(body,headers={'Content-Type':'application/json'})=>Promise.resolve(new Response(body,{status:200,headers}));
   window.fetch=(url,options={})=>{
     const target=String(url);
     if(!target.startsWith('http://127.0.0.1:14762/'))return originalFetch(url,options);
     if(target.endsWith('/api/status'))return reply(JSON.stringify({nonce:'mock-nonce',ready:true}));
     if(target.endsWith('/api/sessions')&&options.method==='POST')return reply(JSON.stringify({id:'a'.repeat(32),revision:'original'}));
     if(target.endsWith('/launch')){launched=true;return reply('{"started":true}');}
     if(target.endsWith('/status'))return reply(JSON.stringify({changed:launched,revision:launched?'blue-edit':'original'}));
     if(target.endsWith('/file'))return reply(newSvg,{'Content-Type':'application/octet-stream'});
     return Promise.reject(Error('Unexpected local bridge route: '+target));
   };
 });
 const beforeAuto=await frame.locator('#artworkVectorLayer > g[data-format="svg"]').last().locator(':scope > image').getAttribute('href');
 await edit.click();
 await frame.locator('#vectorExternalApp').selectOption('illustrator');
 await frame.locator('#vectorExternalLaunch').click();
 await frame.waitForFunction(()=>document.querySelector('#vectorExternalStatus')?.textContent?.includes('возвращён'),null,{timeout:12000});
 const afterAuto=await frame.locator('#artworkVectorLayer > g[data-format="svg"]').last().locator(':scope > image').getAttribute('href');
 assert.notEqual(afterAuto,beforeAuto,'Save in native editor did not refresh source artwork');
 assert.equal(await frame.locator('#editorAngle').inputValue(),angle);
 await dialog.locator('form button').click();
 await frame.evaluate(()=>window.__gwbRestoreFetch());
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
 await frame.locator('#artwork').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});
 await frame.waitForFunction(()=>document.getElementById('artworkName').textContent==='photo.png');
 assert.equal(await edit.isVisible(),false,'Vector editor tool must not appear for raster logos');
 await frame.locator('#artwork').setInputFiles({name:'edited-return.svg',mimeType:'image/svg+xml',buffer:replacement});
 await frame.waitForFunction(()=>document.getElementById('artworkName').textContent==='edited-return.svg');
 await edit.waitFor({state:'visible'});
 console.log('External vector edit: manual return, field identity, geometry, clipping, rotation and raster exclusion passed');
}
