// Non-destructive external vector editing. The editor keeps ownership of the
// artwork and selected PDF field; only a validated returned file is applied.
export const BRIDGE_URL='http://127.0.0.1:14762';
export const VECTOR_EXTENSIONS=new Set(['svg','pdf','ai']);
export function vectorEditable(art){
 return !!art&&VECTOR_EXTENSIONS.has(String(art.ext||'').toLowerCase())&&!!art.bytes?.length;
}
export function restorePlacement(oldBox,oldArt,newArt){
 if(!oldBox)throw Error('Исходное размещение больше не существует.');
 const out={...oldBox};
 const original=Number(oldArt?.w)/Number(oldArt?.h),updated=Number(newArt?.w)/Number(newArt?.h);
 // Retain the user's physical placement, centre, rotation, clipping and field.
 // If artboard aspect changed, fit the new artwork INSIDE the old footprint.
 if(Number.isFinite(original)&&original>0&&Number.isFinite(updated)&&updated>0&&Math.abs(Math.log(original/updated))>0.005){
   const w=oldBox.w,h=oldBox.h,cx=oldBox.x+w/2,cy=oldBox.y+h/2;
   out.w=Math.min(w,h*updated);out.h=out.w/updated;
   out.x=cx-out.w/2;out.y=cy-out.h/2;
 }
 return out;
}
const safeName=name=>String(name||'artwork.svg').replace(/[\\/\x00-\x1f]/g,'_').slice(0,120);
const mime=ext=>({svg:'image/svg+xml',pdf:'application/pdf',ai:'application/postscript'}[ext]||'application/octet-stream');
function download(bytes,name){
 const blob=new Blob([bytes],{type:mime(name.split('.').pop()?.toLowerCase())});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=safeName(name);document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function request(path,{method='GET',body,nonce,asFile=false}={}){
 const headers={};
 if(nonce)headers['X-GWB-Nonce']=nonce;
 if(body instanceof Uint8Array){headers['Content-Type']='application/octet-stream';}
 else if(body!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(body);}
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
   const response=await fetch(BRIDGE_URL+path,{method,headers,body,signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw Error('Локальный помощник: HTTP '+response.status);
   return asFile?new Uint8Array(await response.arrayBuffer()):await response.json();
 }finally{clearTimeout(timeout);}
}
export function mountVectorExternalEditor({getActive,applyEdited,afterReturn=()=>{}}){
 const tool=document.getElementById('editorVectorEdit');
 if(!tool)return null;
 const dialog=document.createElement('dialog');dialog.id='vectorExternalDialog';
 dialog.style.cssText='border:1px solid #cbd6dd;border-radius:13px;padding:22px;max-width:min(520px,94vw);width:100%;box-shadow:0 20px 55px #0003;color:#263b42;background:#fff;font:14px system-ui,sans-serif';
 dialog.innerHTML=`<form method="dialog"><button style="float:right" aria-label="Закрыть">×</button></form>
 <h3 style="margin:0 0 10px;font-size:18px">Редактировать в CorelDRAW / Illustrator</h3>
 <p id="vectorExternalName" style="overflow-wrap:anywhere"></p>
 <p style="font-size:12px;color:#586b74">После сохранения в графическом редакторе обновлённый вектор автоматически вернётся в выбранное поле. Размер, положение, угол и обрезка сохраняются. Поддерживаются SVG, PDF и совместимый AI.</p>
 <label style="display:block;margin:12px 0">Векторный редактор
   <select id="vectorExternalApp" style="display:block;width:100%;padding:9px;margin-top:4px">
   <option value="corel">CorelDRAW</option><option value="illustrator">Adobe Illustrator</option><option value="default">Программа по умолчанию</option></select>
 </label>
 <div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">
 <button type="button" id="vectorExternalLaunch">Открыть в редакторе</button>
 <button type="button" id="vectorExternalDownload">Скачать оригинал</button>
 <button type="button" id="vectorExternalChoose">Вернуть изменённый файл</button>
 </div>
 <input id="vectorExternalFile" type="file" accept=".svg,.pdf,.ai,image/svg+xml,application/pdf" hidden>
 <p id="vectorExternalStatus" role="status" aria-live="polite" style="font-size:12px;line-height:1.5"></p>
 <details><summary>Настроить автоматический возврат (Windows)</summary>
 <p>Установите локальный помощник на этот компьютер один раз. Он запускает CorelDRAW или Illustrator и отслеживает сохранение файла. Без помощника скачайте оригинал и верните отредактированный SVG/PDF вручную.</p>
 <p><a href="https://tohaa28.github.io/gifts-layout-workbench-mockups/tools/gwb-vector-bridge.py" download>Скачать помощник Python</a>
 · <a href="https://tohaa28.github.io/gifts-layout-workbench-mockups/tools/start-vector-bridge.cmd" download>Скачать запуск для Windows</a></p>
 <p>Сохраните оба файла рядом и запустите <code>start-vector-bridge.cmd</code>. Потребуется Python 3 в Windows.</p></details>`;
 document.body.append(dialog);
 const $=id=>dialog.querySelector('#'+id);
 const status=(msg)=>{$('vectorExternalStatus').textContent=msg;};
 let session=null,nonce=null,original=null,timer=null,checking=false;
 const stop=()=>{if(timer)clearInterval(timer);timer=null;session=null;nonce=null;original=null;checking=false;};
 dialog.addEventListener('close',stop);
 const current=()=>getActive();
 const verify=()=>{
   const now=current();
   if(!original||!now||now.key!==original.key||now.art!==original.art)
     throw Error('Выбранное нанесение или логотип изменены. Чтобы не заменить чужой файл, откройте инструмент для нужного поля повторно.');
   return now;
 };
 async function accept(file){
   verify();
   if(!/\.(?:svg|pdf|ai)$/i.test(file?.name||''))throw Error('Для возврата векторного логотипа нужен SVG, PDF или PDF-совместимый AI.');
   if(file.size>40*1024*1024)throw Error('Размер изменённого файла больше 40 МБ.');
   await applyEdited(file,original);
   // Follow further Ctrl+S saves of the same native file. The source artwork
   // object changes on successful import, but the field identity must not.
   const updated=current();
   if(updated?.key===original.key)original={...updated};
   status('Изменённый логотип возвращён в исходное поле. Технические проверки пересчитаны.');
   afterReturn();
 }
 $('vectorExternalChoose').onclick=()=>$('vectorExternalFile').click();
 $('vectorExternalFile').onchange=async e=>{
   const file=e.target.files?.[0];e.target.value='';if(!file)return;
   try{await accept(file)}catch(err){status('Не удалось вернуть файл: '+err.message);}
 };
 $('vectorExternalDownload').onclick=()=>{
   try{const a=verify();download(a.art.bytes,a.art.name);status('Исходный файл скачан. Отредактируйте его и нажмите «Вернуть изменённый файл».');}
   catch(err){status(err.message);}
 };
 async function poll(){
   if(!session||checking||!dialog.open)return;checking=true;
   try{
     verify();
     const state=await request('/api/sessions/'+session.id+'/status',{nonce});
     if(state.changed&&state.revision!==session.revision){
       const bytes=await request('/api/sessions/'+session.id+'/file',{nonce,asFile:true});
       const file=new File([bytes],session.name,{type:mime(session.name.split('.').pop().toLowerCase())});
       await accept(file);
       session.revision=state.revision;
     }
   }catch(err){status('Автоматический возврат: '+err.message+' Можно вернуть файл вручную.');}
   finally{checking=false;}
 }
 $('vectorExternalLaunch').onclick=async()=>{
   try{
     const a=verify();$('vectorExternalLaunch').disabled=true;status('Проверяем локальный помощник Windows…');
     const hello=await request('/api/status');nonce=hello.nonce;
     const bytes=new Uint8Array(a.art.bytes);
     const response=await fetch(BRIDGE_URL+'/api/sessions',{
       method:'POST',headers:{'Content-Type':'application/octet-stream','X-GWB-Nonce':nonce,'X-GWB-File-Name':encodeURIComponent(a.art.name)},body:bytes
     });
     if(!response.ok)throw Error('Локальный помощник не принял исходный файл (HTTP '+response.status+').');
     const job=await response.json();session={id:job.id,revision:job.revision,name:a.art.name};
     await request('/api/sessions/'+session.id+'/launch',{method:'POST',nonce,body:{editor:$('vectorExternalApp').value}});
     status('Редактор запущен. Сохраните SVG/PDF командой Ctrl+S — изменения вернутся в Макетную автоматически.');
     if(!timer)timer=setInterval(poll,1700);
   }catch(err){
     status('Автоматический запуск недоступен: '+err.message+'. Скачайте оригинал, откройте его в CorelDRAW/Illustrator и верните обновлённый SVG/PDF вручную.');
   }finally{$('vectorExternalLaunch').disabled=false;}
 };
 tool.onclick=()=>{
   const a=current();
   if(!a?.art){return;}
   if(!vectorEditable(a.art)){status('Исходный файл должен быть векторным SVG, PDF или PDF-совместимым AI.');return;}
   stop();original={...a};$('vectorExternalName').textContent='Логотип: '+a.art.name+' · поле '+(a.fieldIndex===undefined?'ручное':a.fieldIndex+1);
   status('Для автоматического открытия требуется локальный помощник. Без него можно скачать исходник и загрузить результат вручную.');
   dialog.showModal();
 };
 return {dialog,update:()=>{
   const a=current();
   tool.disabled=!vectorEditable(a?.art);
   tool.hidden=!a?.art||!vectorEditable(a?.art);
 },close:()=>dialog.close()};
}
