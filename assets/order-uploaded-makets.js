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
 '.gwb-order-maket-item{display:flex;gap:12px;align-items:center;justify-content:space-between;min-width:0;padding:9px 11px;background:#fff;border:1px solid #e1e9dd;border-radius:7px}',
 '.gwb-order-maket-filename{font-weight:700;overflow-wrap:anywhere;color:#354b37}',
 '.gwb-order-maket-meta{color:#788779;font-size:11px;overflow-wrap:anywhere}',
 '.gwb-order-maket-item button{flex:none;border-radius:6px;padding:7px 11px;background:#eff6e6;border:1px solid #b8d19a;color:#416b19;cursor:pointer;font:650 12px system-ui,sans-serif}',
 '.gwb-order-maket-item button:hover{background:#e3f0d1}',
 '.gwb-order-maket-item button:disabled{cursor:wait;opacity:.65}',
 '.gwb-order-makets-help{font-size:11px;color:#647566;margin-top:6px}',
 '.gwb-order-maket-badge{display:inline-flex;align-items:center;margin:5px 0 0;padding:3px 7px;background:#edf5e6;color:#507329;border:1px solid #d9e6cc;border-radius:6px;font:700 11px system-ui,sans-serif}',
 '@media(max-width:580px){.gwb-order-maket-item{align-items:flex-start;flex-direction:column}.gwb-order-maket-item button{width:100%}}'
 ].join('\n');
 const style=document.createElement('style');style.id='gwbOrderMaketsStyle';style.textContent=css;document.head.append(style);
 const section=document.createElement('section');section.id='gwbOrderMakets';section.className='gwb-order-makets';
 section.hidden=true;section.setAttribute('aria-label','Макеты, загруженные в заказ gifts.ru');
 const head=document.createElement('div');head.className='gwb-order-makets-head';
 const title=document.createElement('strong');title.textContent='Макеты, загруженные в gifts.ru';
 head.append(title);
 const items=document.createElement('div');items.className='gwb-order-makets-list';
 const help=document.createElement('p');help.className='gwb-order-makets-help';
 help.textContent='Файлы принадлежат заказу в целом. Выберите артикул и поле нанесения, затем укажите, какой PDF открыть. Уже загруженные файлы на gifts.ru не изменяются.';
 section.append(head,items,help);
 editor.querySelector('#orderTemplatePicker')?.insertAdjacentElement('afterend',section);
 if(!section.isConnected)editor.insertBefore(section,editor.firstChild);
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
     out.push({id,name,original:String(file.originalName||name).slice(0,200)});
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
     return cleanFiles(data,order);
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
     files.forEach(file=>{
       const item=document.createElement('div');item.className='gwb-order-maket-item';
       const data=document.createElement('div');
       const filename=document.createElement('div');filename.className='gwb-order-maket-filename';
       filename.textContent=file.original;
       const meta=document.createElement('div');meta.className='gwb-order-maket-meta';
       meta.textContent=file.original!==file.name?'В заказе: '+file.name:'PDF из заказа';
       data.append(filename,meta);
       const open=document.createElement('button');open.type='button';
       open.textContent='Открыть для редактирования';
       open.title='Загрузить этот PDF в выбранное поле, не изменяя оригинал в gifts.ru';
       open.addEventListener('click',()=>{void importMaket(order,file,open)});
       item.append(data,open);items.append(item);
     });
   }).catch(()=>{});
 }
 async function importMaket(order,file,button){
   if(activeLoad)return;
   const native=window.gwbUploadedMaketNative;
   const scope=nativeScope();
   if(orderInput.value.trim()!==order||!scope){
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
     const pdf=new File([bytes],file.name,{type:'application/pdf'});
     // Keep the artwork editable and its original PDF/CMYK bytes: native Ai().
     // The scope object protects the correct order/article/field during fetch.
     if(!native?.apply)throw Error('Модуль редактора ещё загружается.');
     await native.apply(pdf,scope);
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
 orderInput.addEventListener('change',render);
 document.getElementById('loadOrder')?.addEventListener('click',()=>{
   const order=orderInput.value.trim();
   if(valid(order)&&!state.has(order))
     void readOrder(order).then(render).catch(()=>{});
   queueMicrotask(render);
 });
 window.gwbUploadedMaketsUi={refresh:()=>{state.clear();return refreshCards()},getOrder:readOrder};
 void refreshCards();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();