/* Read-only gifts.ru customer uploads. Import is explicit, into the current selected
   field, via the same File input parser used by the existing Add Logo button.
   No automatic item-to-file guessing: Gifts upload links are ORDER scoped. */
(function(){
'use strict';
if(window.gwbUploadedMaketsUiInstalled)return;
window.gwbUploadedMaketsUiInstalled=true;
function start(){
 const basket=document.getElementById('basketOrders');
 const editor=document.getElementById('orderEditor');
 const orderInput=document.getElementById('order');
 const artwork=document.getElementById('artwork');
 const tools=document.getElementById('fieldLogoTools');
 const status=document.getElementById('status');
 if(!basket||!editor||!orderInput||!artwork||!tools)return;
 const css=[
 '.gwb-order-makets{border:1px solid #d5e3c7;border-radius:9px;background:#fbfdf8;margin:10px 0 14px;padding:12px;color:#345034;font:13px/1.5 system-ui,sans-serif}',
 '.gwb-order-makets[hidden]{display:none!important}',
 '.gwb-order-makets-head{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:7px}',
 '.gwb-order-makets-head strong{font-size:14px}',
 '.gwb-order-makets-list{display:flex;flex-direction:column;gap:7px}',
 '.gwb-order-maket-item{display:grid;grid-template-columns:minmax(0,1fr);gap:9px;align-items:stretch;min-width:0;max-width:100%;padding:10px;background:#fff;border:1px solid #e1e9dd;border-radius:7px;box-sizing:border-box}',
 '.gwb-order-maket-data{min-width:0;max-width:100%;width:100%}',
 '.gwb-order-maket-filename{display:block;min-width:0;max-width:100%;white-space:normal;word-break:normal;overflow-wrap:anywhere;font-weight:700;line-height:1.4;color:#354b37}',
 '.gwb-order-maket-meta{min-width:0;max-width:100%;color:#788779;font-size:11px;line-height:1.4;overflow-wrap:anywhere;word-break:normal}',
 '.gwb-order-maket-name-row{display:flex;align-items:flex-start;gap:6px;min-width:0}',
 '.gwb-order-maket-name-row .gwb-order-maket-filename{flex:1;min-width:0}',
 '.gwb-order-maket-origin{display:inline-flex;align-items:center;justify-content:center;flex:none;width:19px;height:19px;border-radius:5px;border:1px solid #b9d998;background:#ecf6e7;color:#568728;font:bold 13px/1 system-ui;cursor:help}',
 '.gwb-order-maket-item button{display:block;box-sizing:border-box;width:100%;min-width:0;max-width:100%;min-height:36px;border-radius:6px;padding:8px 10px;background:#eff6e6;border:1px solid #b8d19a;color:#416b19;cursor:pointer;font:650 12px/1.35 system-ui,sans-serif;text-align:center;white-space:normal}',
 '.gwb-order-maket-item button:hover{background:#e3f0d1}',
 '.gwb-order-maket-item button:disabled{cursor:wait;opacity:.65}',
 '.gwb-order-maket-actions{display:grid;grid-template-columns:minmax(0,1fr) 32px;align-items:center;gap:7px;width:100%;min-width:0;max-width:100%}',
 '.gwb-order-maket-actions.is-field-mode{grid-template-columns:minmax(0,1fr)}',
 '.gwb-order-maket-download{background:#fff!important;color:#435159!important;border-color:#d5ded6!important}',
 '.gwb-order-maket-item button.gwb-order-maket-delete{width:32px!important;min-width:32px!important;max-width:32px!important;height:34px;min-height:34px!important;padding:0!important;display:flex!important;align-items:center;justify-content:center;background:transparent!important;border:1px solid transparent!important;border-radius:6px;color:#435159!important;cursor:pointer}',
 '.gwb-order-maket-item button.gwb-order-maket-delete:hover:not(:disabled){color:#c43d3d!important;background:#fff0f0!important}',
 '.gwb-order-maket-item button.gwb-order-maket-delete:focus-visible{outline:2px solid #629d31;outline-offset:2px}',
 '.gwb-order-maket-delete g-icon{display:block;width:18px;height:18px;flex:none}',
 '.gwb-order-maket-delete svg{display:block;width:100%;height:100%;fill:currentColor}',
 '.gwb-ready-upload{margin-top:7px;width:100%;font-weight:700;min-height:36px}',
 '.gwb-ready-upload[hidden]{display:none!important}',
 '.gwb-order-makets-help{font-size:11px;color:#647566;margin-top:6px}',
 '.gwb-order-maket-badge{display:inline-flex;align-items:center;margin:5px 0 0;padding:3px 7px;background:#edf5e6;color:#507329;border:1px solid #d9e6cc;border-radius:6px;font:700 11px system-ui,sans-serif}',
 '@media(max-width:580px){.gwb-order-maket-item{grid-template-columns:minmax(0,1fr)}.gwb-order-maket-actions{width:100%}}'
 ].join('\n');
 const style=document.createElement('style');style.id='gwbOrderMaketsStyle';style.textContent=css;document.head.append(style);
 const section=document.createElement('section');section.id='gwbOrderMakets';section.className='gwb-order-makets';
 section.hidden=true;section.setAttribute('aria-label','Макеты, загруженные в заказ gifts.ru');
 const head=document.createElement('div');head.className='gwb-order-makets-head';
 const title=document.createElement('strong');title.textContent='Макеты, загруженные в gifts.ru';
 head.append(title);
 const items=document.createElement('div');items.className='gwb-order-makets-list';
 const help=document.createElement('p');help.className='gwb-order-makets-help';
 help.textContent='В режиме выбранного поля — открыть для редактирования. В остальных режимах — скачать PDF или удалить выбранный файл после подтверждения.';
 section.append(head,items,help);
 editor.querySelector('#orderTemplatePicker')?.insertAdjacentElement('afterend',section);
 if(!section.isConnected)editor.insertBefore(section,editor.firstChild);
 // Two explicit finished-layout destinations reuse the same native preflight.
 // No hidden automatic uploads: a server mutation begins only on this click.
 const readyButtons=[];
 function addReadyButton(anchorId,buttonId){
   const anchor=document.getElementById(anchorId);
   if(!anchor)return;
   const button=document.createElement('button');
   button.id=buttonId;button.type='button';
   button.className='primary gwb-ready-upload';
   button.textContent='Загрузить готовый PDF в заказ';
   button.title='Добавить PDF в «Макеты для заказа» gifts.ru, не удаляя прежние файлы';
   button.addEventListener('click',()=>{void uploadFinishedPdf(button)});
   anchor.insertAdjacentElement('afterend',button);
   readyButtons.push({button,anchor});
   new MutationObserver(syncReadyButtons).observe(anchor,{attributes:true,attributeFilter:['disabled','hidden']});
 }
 addReadyButton('simpleExport','gwbUploadReadySimple');
 addReadyButton('prepareOrderPdf','gwbUploadReadyAdvanced');
 let activeUpload=false;
 function readySnapshot(){
   try{return window.gwbReadyPdfNative?.snapshot?.()||null}catch{return null}
 }
 function syncReadyButtons(){
   const snapshot=readySnapshot();
   for(const {button,anchor} of readyButtons){
     button.hidden=!!anchor.hidden;
     button.disabled=activeUpload||anchor.disabled||!snapshot||snapshot.order!==orderInput.value.trim();
   }
 }
 async function uploadFinishedPdf(button){
   if(activeUpload)return;
   const api=window.gwbReadyPdfNative,selected=readySnapshot();
   const order=orderInput.value.trim();
   if(!selected||!valid(order)||selected.order!==order||button.disabled)return;
   if(!window.confirm('Добавить готовый PDF к заказу №'+order+' на gifts.ru? Существующие файлы останутся без изменений.'))return;
   activeUpload=true;syncReadyButtons();
   try{
     if(status)status.textContent='Собираю готовый PDF для заказа №'+order+'…';
     const pdf=await api.make(selected);
     const after=readySnapshot();
     if(!after||after.order!==selected.order||after.entry!==selected.entry||after.template!==selected.template)
       throw Error('Заказ или артикул изменились. Отправка отменена.');
     if(!/\.pdf$/i.test(pdf?.name||'')||pdf.size<5||pdf.size>40*1024*1024)
       throw Error('Для отправки доступен PDF размером до 40 МБ.');
     if(status)status.textContent='Загружаю PDF в раздел «Макеты для заказа»…';
     const payload=new FormData();
     payload.append('media_file[]',pdf,pdf.name);
     const response=await fetch('/api/orders/'+order+'/uploaded-makets',{
       method:'POST',body:payload,credentials:'same-origin',cache:'no-store'
     });
     let result;
     try{result=await response.json()}catch{throw Error('Не удалось прочитать ответ gifts.ru. Проверьте список макетов в заказе.')}
     if(!response.ok||result?.ok!==true)
       throw Error(result?.error||'gifts.ru не подтвердил загрузку.');
     let recognized=false;
     try{
       recognized=await window.gwbMaketnayaSidecar?.bindUploaded(
         order,String(result.uploadedId),new Uint8Array(await pdf.arrayBuffer()))===true;
     }catch(error){console.warn('Макетная: внешняя отметка PDF недоступна',error)}
     state.delete(order);
     await refreshCards();
     if(status)status.textContent='Готовый PDF «'+pdf.name+'» добавлен к заказу №'+order+
       (recognized?'. Макет отмечен пиктограммой М.':
         '. Внешний реестр происхождения недоступен; PDF не изменялся.');
   }catch(error){
     if(status)status.textContent='Отправка не подтверждена: '+String(error?.message||error);
   }finally{
     activeUpload=false;syncReadyButtons();
   }
 }
 let activeDelete=false;
 async function deleteUploadedMaket(order,file,button){
   if(activeDelete||!file.canDelete||button.disabled||isFieldMode()||
      orderInput.value.trim()!==order)return;
   if(!window.confirm('Удалить только макет «'+file.original+'» из заказа №'+order+
     '?\nЭто действие нельзя отменить. Остальные макеты останутся в заказе.'))return;
   if(orderInput.value.trim()!==order||isFieldMode()||editor.hidden)return;
   activeDelete=true;button.disabled=true;
   try{
     if(status)status.textContent='Удаляю «'+file.original+'» из заказа №'+order+'…';
     const response=await fetch('/api/orders/'+order+'/uploaded-makets/'+file.id,{
       method:'DELETE',credentials:'same-origin',cache:'no-store'
     });
     let reply;
     try{reply=await response.json()}catch{throw Error('Непонятный ответ gifts.ru; проверьте макеты в заказе.')}
     if(!response.ok||reply?.ok!==true||reply.deletedId!==file.id)
       throw Error(reply?.error||'Удаление файла не подтверждено.');
     try{await window.gwbMaketnayaSidecar?.forget(order,file.id)}catch{}
     state.delete(order);
     await refreshCards();
     if(status)status.textContent='Удалён только макет «'+file.original+'» из заказа №'+order+'.';
   }catch(error){
     if(status)status.textContent='Удаление не подтверждено: '+String(error?.message||error);
   }finally{
     activeDelete=false;button.disabled=false;
   }
 }
 async function downloadUploadedMaket(order,file,button){
   if(button.disabled)return;
   button.disabled=true;
   try{
     const response=await fetch('/api/orders/'+order+'/uploaded-makets/'+file.id+'.pdf',{
       credentials:'same-origin',cache:'no-store'
     });
     if(!response.ok)throw Error('Не удалось скачать PDF.');
     const bytes=await response.arrayBuffer();
     if(bytes.byteLength<5||bytes.byteLength>40*1024*1024||
       new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Некорректный PDF.');
     const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
     const link=document.createElement('a');
     link.href=url;link.download=file.original;link.style.display='none';
     document.body.append(link);link.click();link.remove();
     setTimeout(()=>URL.revokeObjectURL(url),60000);
   }catch(error){
     if(status)status.textContent='Не удалось скачать файл: '+String(error?.message||error);
   }finally{button.disabled=false}
 }
 const state=new Map();
 let refreshGeneration=0;
 let activeLoad=null;
 function valid(order){return /^\d{5,12}$/.test(order)}
 function cleanFiles(data,order){
   if(!Array.isArray(data?.uploadedMakets))return [];
   const seen=new Set(),out=[];
   for(const file of data.uploadedMakets){
     const id=String(file?.id||''),name=String(file?.filename||'');
     if(!/^\d{1,20}$/.test(id)||!/^.{1,200}\.pdf$/i.test(name)||
        String(file?.order||'')!==order||seen.has(id))continue;
     seen.add(id);
     out.push({id,name,original:String(file.originalName||name).slice(0,200),canDelete:file.canDelete===true,origin:'external'});
   }
   return out;
 }
 async function readOrder(order){
   if(!valid(order))return [];
   if(state.has(order))return state.get(order);
   const task=(async()=>{
     const response=await fetch('/api/orders/'+order,{credentials:'same-origin',cache:'no-store'});
     const data=await response.json();
     if(!response.ok)throw Error(data.error||'Не удалось прочитать заказ');
     const files=cleanFiles(data,order);
     await Promise.all(files.map(async file=>{
       try{
         if(await window.gwbMaketnayaSidecar?.marker(order,file.id))
           file.origin='maketnaya';
       }catch{}
     }));
     return files;
   })();
   state.set(order,task);
   try{return await task}catch(error){state.delete(order);throw error}
 }
 function basketCards(){return [...basket.querySelectorAll('.basket-order')]}
 function cardOrder(card){
   const txt=card.querySelector('.basket-order-title')?.textContent||'';
   return txt.match(/Заказ\s*№\s*(\d{5,12})/i)?.[1]||'';
 }
 async function refreshCards(){
   const gen=++refreshGeneration;
   const cards=basketCards();
   for(const card of cards){
     const order=cardOrder(card);if(!valid(order))continue;
     card.querySelector('.gwb-order-maket-badge')?.remove();
     const titleNode=card.querySelector('.basket-order-title');if(!titleNode)continue;
     void readOrder(order).then(files=>{
       if(gen!==refreshGeneration||!card.isConnected||!files.length)return;
       const badge=document.createElement('span');
       badge.className='gwb-order-maket-badge';
       badge.textContent='Загружено макетов: '+files.length;
       badge.title='Клиентские PDF заказа доступны для открытия в Макетной';
       badge.addEventListener('click',e=>{e.stopPropagation();card.click()});
       titleNode.insertAdjacentElement('afterend',badge);
       if(orderInput.value.trim()===order)render();
     }).catch(()=>{});
   }
   render();
 }
 function nativeScope(){
   try{return window.gwbUploadedMaketNative?.getScope?.()||null}catch{return null}
 }
 function isFieldMode(){
   // This is a UI mode, not permission to import. The native getScope()
   // temporarily returns null while the selected field is loading (y.busy).
   // X() already maintains these three visible indicators of the actual
   // selected-field view even when no artwork has been added yet.
   const step=document.getElementById('editorStep3');
   const zoom=document.getElementById('zoomPage');
   return !editor.hidden && !!step && !step.hidden &&
     !tools.hidden && !!zoom && !zoom.hidden;
 }
 function render(){
   const order=orderInput.value.trim(),inEditor=!editor.hidden;
   if(!inEditor||!valid(order)){section.hidden=true;items.replaceChildren();return}
   const pending=state.get(order);
   if(!pending){section.hidden=true;return}
   void pending.then(files=>{
     if(editor.hidden||orderInput.value.trim()!==order)return;
     section.hidden=!files.length;items.replaceChildren();
     if(!files.length)return;
     title.textContent='Макеты, загруженные в gifts.ru ('+files.length+')';
     const fieldMode=isFieldMode();
     files.forEach(file=>{
       const item=document.createElement('div');item.className='gwb-order-maket-item';
       const data=document.createElement('div');data.className='gwb-order-maket-data';
       const filename=document.createElement('div');filename.className='gwb-order-maket-filename';
       filename.textContent=file.original;
       const meta=document.createElement('div');meta.className='gwb-order-maket-meta';
       meta.textContent=file.original!==file.name?'В заказе: '+file.name:'PDF из заказа';
       const nameRow=document.createElement('div');nameRow.className='gwb-order-maket-name-row';
       if(file.origin==='maketnaya'){
         const mark=document.createElement('span');
         mark.className='gwb-order-maket-origin';mark.textContent='М';
         mark.title='Создано в Макетной · внешний реестр, PDF без служебной отметки';
         mark.setAttribute('aria-label','Создано в Макетной');
         nameRow.append(mark);
       }
       nameRow.append(filename);data.append(nameRow,meta);
       const actions=document.createElement('div');
       actions.className='gwb-order-maket-actions'+(fieldMode?' is-field-mode':'');
       const action=document.createElement('button');action.type='button';
       if(fieldMode){
         action.className='gwb-order-maket-edit';
         action.textContent='Открыть для редактирования';
         action.title='Загрузить этот PDF в выбранное поле, не изменяя оригинал в gifts.ru';
         action.addEventListener('click',()=>{void importMaket(order,file,action)});
       }else{
         action.className='gwb-order-maket-download';
         action.textContent='Скачать PDF';
         action.title='Скачать исходный PDF из заказа gifts.ru';
         action.addEventListener('click',()=>{void downloadUploadedMaket(order,file,action)});
       }
       actions.append(action);
       if(!fieldMode){
         const remove=document.createElement('button');remove.type='button';
         remove.className='gwb-order-maket-delete';
         // Identical gifts.ru basket trash pictogram, from its icon sprite.
         // The source is fixed and never incorporates an attachment filename.
         const icon=document.createElement('g-icon');icon.setAttribute('name','trash');
         const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
         svg.setAttribute('width','100%');svg.setAttribute('height','100%');
         const use=document.createElementNS('http://www.w3.org/2000/svg','use');
         use.setAttribute('href','/components/images/icons.svg?19#trash');
         svg.append(use);icon.append(svg);remove.append(icon);
         remove.setAttribute('aria-label','Удалить макет: '+file.original);
         remove.title=file.canDelete
           ? 'Безвозвратно удалить только этот PDF из заказа gifts.ru'
           : 'gifts.ru не предоставил право удаления этого PDF';
         remove.disabled=!file.canDelete;
         remove.addEventListener('click',()=>{void deleteUploadedMaket(order,file,remove)});
         actions.append(remove);
       }
       item.append(data,actions);items.append(item);
     });
   }).catch(()=>{});
 }
 async function importMaket(order,file,button){
   if(activeLoad)return;
   const native=window.gwbUploadedMaketNative;
   const scope=nativeScope();
   if(orderInput.value.trim()!==order||!scope||tools.hidden||document.getElementById('zoomPage')?.hidden){
     if(status)status.textContent='Сначала выберите артикул и откройте нужное поле нанесения в шаблоне.';
     return;
   }
   activeLoad={order,id:file.id};button.disabled=true;
   const before=orderInput.value.trim();
   try{
     const response=await fetch('/api/orders/'+order+'/uploaded-makets/'+file.id+'.pdf',{
       credentials:'same-origin',cache:'no-store'
     });
     if(!response.ok){
       let msg='Не удалось скачать загруженный макет.';
       try{msg=(await response.json()).error||msg}catch{}
       throw Error(msg);
     }
     const bytes=new Uint8Array(await response.arrayBuffer());
     if(bytes.length<5||bytes.length>40*1024*1024||
        new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Некорректный PDF из заказа');
     if(orderInput.value.trim()!==before||editor.hidden||!nativeScope())
       throw Error('Заказ или выбранное поле изменились во время загрузки. Повторите импорт.');
     const pdf=new File([bytes],file.original||file.name,{type:'application/pdf'});
     if(!native?.inspect||!native?.apply)
       throw Error('Модуль анализа PDF ещё не загрузился.');
     let origin={kind:'external'};
     try{origin=await window.gwbMaketnayaSidecar?.inspect(bytes,scope,order,file.id)||origin}
     catch(error){console.warn('Макетная: внешний реестр недоступен',error)}
     if(origin.kind==='external')origin=await native.inspect(pdf,scope);
     if(orderInput.value.trim()!==before||!nativeScope()||editor.hidden)
       throw Error('Заказ или поле изменились во время проверки PDF.');
     if(origin.kind==='maketnaya'){
       const logo=new File([origin.bytes],file.original.replace(/\.pdf$/i,'')+'-логотип.pdf',
         {type:'application/pdf'});
       // Only the separately stored artwork enters the chosen application field:
       // no constructor, title-block, page frame or metadata.
       await native.apply(logo,scope,{sourceField:origin.sourceField,placement:origin.placement});
       if(status)status.textContent='Обнаружен макет Макетной. В поле перенесён только логотип, конструктор исключён.';
     }else{
       // Unknown/legacy PDF: never guess which graphics belong to the logo.
       // Both editors receive the ORIGINAL PDF, without modifying the field
       // until the user explicitly applies the edited result.
       const chooser=window.gwbEditorChooser;
       if(!chooser?.showWithFile)throw Error('Редакторы VectorCraft/TraceDraw ещё загружаются.');
       chooser.showWithFile(pdf);
       if(status)status.textContent=origin.kind==='invalid'
         ? 'Нельзя надёжно отделить исходник Макетной: '+origin.error+'. Оригинал открыт для выбора редактора.'
         : 'Сторонний PDF: выберите VectorCraft или TraceDraw. Содержимое поля не менялось.';
     }
   }catch(error){
     if(status)status.textContent='Не удалось открыть загруженный макет: '+String(error?.message||error);
   }finally{button.disabled=false;activeLoad=null}
 }
 basket.addEventListener('click',()=>{queueMicrotask(render)});
 document.getElementById('refreshBasket')?.addEventListener('click',()=>{
   ++refreshGeneration;state.clear();section.hidden=true;
 });
 const observer=new MutationObserver(mutations=>{
   if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&
      (n.matches?.('.basket-order')||n.querySelector?.('.basket-order'))))){
     state.clear();void refreshCards();
   }
 });
 observer.observe(basket,{childList:true});
 const editorObserver=new MutationObserver(render);
 editorObserver.observe(editor,{attributes:true,attributeFilter:['hidden']});
 const modeObserver=new MutationObserver(()=>{render();syncReadyButtons()});
 modeObserver.observe(tools,{attributes:true,attributeFilter:['hidden']});
 const editorStep3=document.getElementById('editorStep3');
 if(editorStep3)modeObserver.observe(editorStep3,{attributes:true,attributeFilter:['hidden']});
 const zoomPage=document.getElementById('zoomPage');
 if(zoomPage)modeObserver.observe(zoomPage,{attributes:true,attributeFilter:['hidden']});
 orderInput.addEventListener('change',()=>{render();syncReadyButtons()});
 document.getElementById('loadOrder')?.addEventListener('click',()=>{
   const order=orderInput.value.trim();
   if(valid(order)&&!state.has(order))
     void readOrder(order).then(render).catch(()=>{});
   queueMicrotask(render);
 });
 window.gwbUploadedMaketsUi={refresh:()=>{state.clear();return refreshCards()},getOrder:readOrder};
 syncReadyButtons();
 void refreshCards();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();