/* Origin metadata stays OUTSIDE the print PDF. Browser-local, user-origin
   IndexedDB sidecar tied to exact SHA-256 PDF bytes and, after a verified gifts
   upload, to its per-order attachment ID. Never infer origin from filename. */
(function(root){
'use strict';
const DB='gwb-pdf-origin-sidecar-v1',LIMIT=40*1024*1024;
let dbPromise=null,lastError='';
const enc=new TextEncoder(),dec=new TextDecoder();
function openDb(){
 if(!root.indexedDB)throw Error('Локальная база IndexedDB недоступна');
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
  const req=root.indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('sources'))db.createObjectStore('sources',{keyPath:'hash'});
   if(!db.objectStoreNames.contains('uploads'))db.createObjectStore('uploads',{keyPath:'key'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Не удалось создать реестр макетов'));
 });
 return dbPromise;
}
async function tx(store,mode,work){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const transaction=db.transaction(store,mode),table=transaction.objectStore(store);
  let result;
  const req=work(table);
  if(req){req.onsuccess=()=>{result=req.result};req.onerror=()=>reject(req.error)}
  transaction.oncomplete=()=>resolve(result);
  transaction.onerror=()=>reject(transaction.error||Error('Ошибка записи реестра'));
  transaction.onabort=()=>reject(transaction.error||Error('Запись реестра отменена'));
 });
}
const validOrder=s=>/^\d{5,12}$/.test(String(s||''));
const validId=s=>/^\d{1,20}$/.test(String(s||''));
async function sha(bytes){
 if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);
 if(bytes.length<5||bytes.length>LIMIT||dec.decode(bytes.subarray(0,5))!=='%PDF-')
  throw Error('Нужен корректный готовый PDF до 40 МБ');
 if(!root.crypto?.subtle)throw Error('SHA-256 в браузере недоступен');
 const digest=new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes));
 return [...digest].map(x=>x.toString(16).padStart(2,'0')).join('');
}
const box=v=>v&&['x','y','w','h'].every(k=>Number.isFinite(v[k]))&&v.w>0&&v.h>0;
async function remember(bytes,placements,pdfLib,svgToPdf,identity={}){
 try{
  const hash=await sha(bytes);
  if(!validOrder(identity.order)||!Array.isArray(placements)||placements.length<1||
     placements.length>64)throw Error('Неизвестны заказ или поля исходных логотипов');
  const entries=[],files=new Map();
  for(const p of placements){
   if(!p.art||!box(p.field)||!box(p.placement)||!Number.isInteger(p.page))
    throw Error('Неизвестна геометрия исходного логотипа');
   let artId=files.get(p.art);
   if(!artId){
    artId='art-'+(files.size+1);
    const pdf=await root.gwbMaketnayaPdfProvenance.pdfSource(p.art,pdfLib,svgToPdf);
    if(pdf.length>LIMIT)throw Error('Исходный логотип превышает 40 МБ');
    files.set(p.art,artId);
    entries.push({kind:'source',artId,bytes:new Uint8Array(pdf)});
   }
   entries.push({kind:'placement',artId,page:p.page,fieldIndex:p.fieldIndex??null,
    field:{x:p.field.x,y:p.field.y,w:p.field.w,h:p.field.h},
    placement:{x:p.placement.x,y:p.placement.y,w:p.placement.w,
      h:p.placement.h,rotation:p.placement.rotation||0,
      clipToField:!!p.placement.clipToField}});
  }
  await tx('sources','readwrite',store=>store.put({
   hash,version:1,order:String(identity.order),article:String(identity.article||''),
   itemId:String(identity.itemId||''),createdAt:Date.now(),entries
  }));
  lastError='';
  return hash;
 }catch(e){lastError=String(e?.message||e);throw e}
}
const key=(order,id)=>String(order)+':'+String(id);
async function bindUploaded(order,id,bytes){
 if(!validOrder(order)||!validId(id))throw Error('Неверная привязка к заказу');
 const hash=await sha(bytes);
 const source=await tx('sources','readonly',store=>store.get(hash));
 if(!source||source.order!==String(order))return false;
 await tx('uploads','readwrite',store=>store.put({
  key:key(order,id),hash,order:String(order),id:String(id),boundAt:Date.now()
 }));
 return true;
}
async function marker(order,id){
 if(!validOrder(order)||!validId(id))return false;
 const link=await tx('uploads','readonly',store=>store.get(key(order,id)));
 if(!link)return false;
 const source=await tx('sources','readonly',store=>store.get(link.hash));
 return !!source && source.order===String(order);
}
async function forget(order,id){
 if(validOrder(order)&&validId(id))
  await tx('uploads','readwrite',store=>store.delete(key(order,id)));
}
async function inspect(bytes,selection={},order='',uploadId=''){
 const hash=await sha(bytes);
 const source=await tx('sources','readonly',store=>store.get(hash));
 if(!source)return {kind:'external'};
 if(source.order!==String(order)||selection.order!==String(order))
  return {kind:'invalid',error:'PDF создан для другого заказа'};
 if(source.article&&selection.article&&source.article!==String(selection.article))
  return {kind:'invalid',error:'Артикул в реестре не совпадает'};
 const matching=source.entries.filter(p=>p.kind==='placement' &&
  (selection.fieldIndex==null||p.fieldIndex===selection.fieldIndex)&&
  (selection.page==null||p.page===selection.page));
 if(matching.length!==1)return {kind:'invalid',error:'Не найден единственный логотип выбранного поля'};
 const place=matching[0];
 const art=source.entries.find(p=>p.kind==='source'&&p.artId===place.artId);
 if(!art?.bytes||!box(place.field)||!box(place.placement))
  return {kind:'invalid',error:'Исходный логотип не найден в отдельном реестре'};
 if(uploadId)await bindUploaded(order,uploadId,bytes);
 return {kind:'maketnaya',bytes:new Uint8Array(art.bytes),
  sourceField:place.field,placement:place.placement,
  fieldIndex:place.fieldIndex,page:place.page};
}
root.gwbMaketnayaSidecar={remember,bindUploaded,marker,forget,inspect,get lastError(){return lastError}};
})(window);
