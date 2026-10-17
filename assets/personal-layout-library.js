/* Personal, order-independent artwork library for gifts.ru Maketnaya.
   Browser IndexedDB is private to THIS browser profile/origin; it is not a
   server or a substitute for authenticated multi-device storage. */
(function(){
'use strict';
if(window.gwbPersonalLayoutLibraryInstalled)return;
window.gwbPersonalLayoutLibraryInstalled=true;
const DB='gwb-personal-layouts-v1',TABLE='layouts',PROFILE='gwb.personalLayout.profile.v1',VERSION=1;
const LIMIT=60*1024*1024;
const $=id=>document.getElementById(id);
let panel,entries,notice,profile,displayArticle='',renderSerial=0,dbPromise;
const styles=String.raw`#gwbPersonalLibrary{margin:12px 0 0;padding:12px;border:1px solid #d5e0cd;background:#fbfdf8;border-radius:8px;display:grid;gap:8px;font:12px/1.4 system-ui,sans-serif;color:#455449}
  #gwbPersonalLibrary .gwb-lib-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
  #gwbPersonalLibrary .gwb-lib-head strong{font-size:13px}
  #gwbPersonalLibrary .gwb-lib-badge{font-size:10px;color:#6c754f}
  #gwbPersonalLibrary .gwb-lib-actions{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
  #gwbPersonalLibrary input{padding:7px 9px;border:1px solid #ced6c8;border-radius:5px;max-width:220px;min-width:110px;flex:1}
  #gwbPersonalLibrary button,#gwbPersonalLibrary .gwb-lib-file{padding:7px 10px;min-height:30px;border:1px solid #c5d2b8;border-radius:5px;color:#49662c;background:#fff;cursor:pointer;font:600 11px system-ui,sans-serif}
  #gwbPersonalLibrary .gwb-lib-save{background:#81b315;color:#182800;border-color:#81b315}
  #gwbPersonalLibrary button:disabled{opacity:.45;cursor:default}
  #gwbPersonalLibrary .gwb-lib-item{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:7px;padding:8px;background:#fff;border:1px solid #e1e8dd;border-radius:5px}
  #gwbPersonalLibrary .gwb-lib-item .gwb-lib-meta{font-size:10px;color:#73816c}
  #gwbPersonalLibrary .gwb-lib-preview{width:92px;height:63px;object-fit:contain;flex:none;border-radius:4px;background:#f4f6f2;border:1px solid #dbe4d3}
  #gwbPersonalLibrary .gwb-lib-status{min-height:16px;font-size:11px;color:#667766}
  #gwbPersonalLibrary .gwb-lib-list{display:grid;gap:6px;max-height:280px;overflow-y:auto}
  #gwbPersonalLibrary .gwb-lib-file input{display:none}
  #gwbPersonalLibrary[hidden]{display:none!important}`;
function openDb(){
  if(!('indexedDB' in window))return Promise.reject(Error('Этот браузер не поддерживает локальное хранилище'));
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(TABLE)){
        const store=db.createObjectStore(TABLE,{keyPath:'id'});
        store.createIndex('scope','scope',{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||Error('Не удалось открыть хранилище'));
  });
  return dbPromise;
}
async function operate(mode,executor){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(TABLE,mode);
    const store=tx.objectStore(TABLE);
    let result;
    try{result=executor(store)}catch(e){tx.abort();reject(e);return}
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||Error('Ошибка локального хранилища'));
    tx.onabort=()=>reject(tx.error||Error('Операция отменена'));
  });
}
async function allFor(scope){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(TABLE,'readonly'),r=tx.objectStore(TABLE).index('scope').getAll(scope);
    r.onsuccess=()=>resolve(r.result||[]);
    r.onerror=()=>reject(r.error);
  });
}
async function one(id){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(TABLE,'readonly'),r=tx.objectStore(TABLE).get(id);
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}
const clean=v=>String(v||'').trim().slice(0,64);
const article=()=>String(window.gwbCurrentLibraryArticle?.()||'').trim();
const user=()=>clean(profile?.value);
const scope=()=>user().toLocaleLowerCase('ru-RU')+'|'+article();
function status(text,bad=false){if(!notice)return;notice.textContent=text;notice.style.color=bad?'#ae3434':'#667766'}
function capturePreview(){
  // A small client-side thumbnail of the CURRENT view (template + logo).
  // Failing or tainted canvas never blocks saving the original artwork.
  try{
    const template=$('templateCanvas'),overlay=$('overlay');
    if(!template||!overlay||!template.width||!template.height)return '';
    const dst=document.createElement('canvas');dst.width=184;dst.height=126;
    const ctx=dst.getContext('2d');if(!ctx)return '';
    ctx.fillStyle='#fff';ctx.fillRect(0,0,dst.width,dst.height);
    const w=template.width,h=template.height;
    const scale=Math.min(dst.width/w,dst.height/h);
    const x=(dst.width-w*scale)/2,y=(dst.height-h*scale)/2;
    ctx.drawImage(template,x,y,w*scale,h*scale);
    ctx.drawImage(overlay,x,y,w*scale,h*scale);
    const data=dst.toDataURL('image/jpeg',.72);
    return data.length<130000?data:'';
  }catch{return ''}
}
function ensure(){
  if(!user())throw Error('Введите имя профиля пользователя на этом устройстве');
  if(!article())throw Error('Сначала выберите артикул и откройте его конструктор');
}
function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b}
function b64(u){
  let result='';
  for(let i=0;i<u.length;i+=8192)result+=String.fromCharCode(...u.subarray(i,i+8192));
  return btoa(result);
}
function fromB64(s){
  if(typeof s!=='string'||s.length>LIMIT*1.5)throw Error('Некорректный размер резервной копии');
  const bin=atob(s);return Uint8Array.from(bin,c=>c.charCodeAt(0));
}
async function doSave(){
  try{
    ensure();
    const state=window.gwbCapturePersonalLayout();
    if(state.article!==article())throw Error('Артикул изменился во время подготовки');
    const size=state.items.reduce((n,p)=>n+p.artwork.bytes.length,0);
    if(size>LIMIT)throw Error('Макет больше 60 МБ. Уменьшите файлы или разделите вариант');
    const name=prompt('Название варианта для артикула '+article(),'Вариант '+new Date().toLocaleDateString('ru-RU'));
    if(name===null)return;
    const title=clean(name);
    if(!title)throw Error('Введите название варианта');
    const record={id:crypto.randomUUID(),scope:scope(),profile:user(),article:article(),title,
      savedAt:new Date().toISOString(),personal:true,orderId:null,status:'personal-draft',preview:capturePreview(),data:state};
    await operate('readwrite',store=>store.put(record));
    status('Личный вариант сохранён в браузере. В заказ он не передавался.');
    await render();
  }catch(e){status(e.message||String(e),true)}
}
async function doRestore(id){
  try{
    ensure();
    const r=await one(id);
    if(!r||r.scope!==scope()||r.article!==article()||r.status!=='personal-draft')
      throw Error('Вариант недоступен для этого профиля и артикула');
    if(!confirm('Восстановить «'+r.title+'» в открытом редакторе?\nТекущие несохранённые размещения будут заменены. В заказ ничего автоматически не отправляется.'))return;
    const restored=await window.gwbRestorePersonalLayout(r.data);
    status('Восстановлено '+restored.count+' размещений. Это личный вариант, не макет заказа.');
  }catch(e){status(e.message||String(e),true)}
}
async function doDelete(id){
  try{
    const r=await one(id);
    if(!r||r.scope!==scope())throw Error('Не найдено');
    if(!confirm('Удалить личный вариант «'+r.title+'»?'))return;
    await operate('readwrite',store=>store.delete(id));
    status('Вариант удалён. Макеты заказов не затронуты.');
    await render();
  }catch(e){status(e.message||String(e),true)}
}
function exportRecord(r){
  const data={...r.data,items:r.data.items.map(p=>({
    ...p,artwork:{...p.artwork,bytes:b64(p.artwork.bytes)}
  }))};
  const output={kind:'gwb-personal-layout-backup/v1',article:r.article,
    title:r.title,savedAt:r.savedAt,preview:r.preview||'',layout:data};
  const blob=new Blob([JSON.stringify(output)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='maketnaya-'+r.article+'-'+r.id+'.json';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function importBackup(file){
  try{
    ensure();
    if(!file||file.size>LIMIT*1.5)throw Error('Слишком большой файл');
    const raw=JSON.parse(await file.text());
    if(raw.kind!=='gwb-personal-layout-backup/v1'||raw.article!==article()||
       raw.layout?.schema!=='gwb-personal-layout/v1'||!Array.isArray(raw.layout.items))
       throw Error('Этот файл не является вариантом текущего артикула');
    if(raw.layout.items.length<1||raw.layout.items.length>100)throw Error('Недопустимое количество полей');
    const items=raw.layout.items.map(p=>({...p,artwork:{...p.artwork,bytes:fromB64(p.artwork.bytes)}}));
    const total=items.reduce((n,p)=>n+p.artwork.bytes.byteLength,0);
    if(total>LIMIT)throw Error('Макет слишком большой');
    const data={...raw.layout,items};
    const rec={id:crypto.randomUUID(),scope:scope(),profile:user(),article:article(),
      title:clean(raw.title)||'Импортированный вариант',savedAt:new Date().toISOString(),
      orderId:null,personal:true,status:'personal-draft',
      preview:/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(raw.preview||'')&&raw.preview.length<130000?raw.preview:'',data};
    await operate('readwrite',store=>store.put(rec));
    status('Резервная копия импортирована в личную библиотеку, но не помещена в заказ.');
    await render();
  }catch(e){status(e.message||String(e),true)}
}
async function render(){
  if(!panel)return;
  const generation=++renderSerial;
  const now=article();
  displayArticle=now;
  panel.hidden=!now;
  entries.replaceChildren();
  $('gwbLibArticle').textContent=now?'Артикул '+now:'Выберите артикул';
  if(!now)return;
  if(!user()){status('Укажите свой профиль. Библиотека находится только в этом браузере.');return}
  try{
    const list=(await allFor(scope())).filter(r=>r.status==='personal-draft')
      .sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
    if(generation!==renderSerial||now!==article())return;
    $('gwbLibCount').textContent='Сохранено: '+list.length;
    if(!list.length){const empty=document.createElement('small');empty.textContent='Для этого артикула ещё нет сохранённых вариантов.';entries.append(empty)}
    for(const r of list){
      const item=document.createElement('div');item.className='gwb-lib-item';
      if(typeof r.preview==='string'&&r.preview.startsWith('data:image/jpeg;base64,')&&r.preview.length<130000){
        const image=document.createElement('img');image.className='gwb-lib-preview';
        image.src=r.preview;image.alt='Миниатюра сохранённого варианта';item.append(image);
      }
      const label=document.createElement('div');label.style.flex='1';
      const title=document.createElement('strong');title.textContent=r.title;
      const meta=document.createElement('div');meta.className='gwb-lib-meta';
      meta.textContent=new Date(r.savedAt).toLocaleString('ru-RU')+' · '+r.data.items.length+' полей · личный черновик';
      label.append(title,meta);
      const actions=document.createElement('div');actions.className='gwb-lib-actions';
      actions.append(button('Восстановить',()=>doRestore(r.id)),
        button('Копия JSON',()=>exportRecord(r)),button('Удалить',()=>doDelete(r.id)));
      item.append(label,actions);entries.append(item);
    }
    if(!notice.textContent||notice.textContent.startsWith('Укажите'))status('Варианты не подставляются автоматически в заказы.');
  }catch(e){status(e.message||String(e),true)}
}
function install(){
  const host=$('orderFieldChoiceBox')||$('orderEditor');
  if(!host)return;
  const sheet=document.createElement('style');sheet.textContent=styles;document.head.append(sheet);
  panel=document.createElement('section');panel.id='gwbPersonalLibrary';panel.hidden=true;
  const heading=document.createElement('div');heading.className='gwb-lib-head';
  const title=document.createElement('strong');title.textContent='Мои сохранённые макеты';
  const badge=document.createElement('span');badge.className='gwb-lib-badge';badge.textContent='Лично · не прикреплено к заказу';
  heading.append(title,badge);
  const articleLabel=document.createElement('div');articleLabel.id='gwbLibArticle';
  const controls=document.createElement('div');controls.className='gwb-lib-actions';
  profile=document.createElement('input');profile.type='text';profile.maxLength=64;profile.placeholder='Локальный профиль (не логин gifts.ru)';
  profile.autocomplete='off';profile.setAttribute('aria-label','Имя профиля личной библиотеки');
  try{profile.value=localStorage.getItem(PROFILE)||''}catch{}
  profile.addEventListener('change',()=>{try{localStorage.setItem(PROFILE,user())}catch{};void render()});
  const save=button('Сохранить вариант',doSave);save.className='gwb-lib-save';
  const fileLabel=document.createElement('label');fileLabel.className='gwb-lib-file';fileLabel.textContent='Импортировать копию';
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  input.onchange=()=>{const f=input.files?.[0];input.value='';if(f)void importBackup(f)};
  fileLabel.append(input);
  controls.append(profile,save,fileLabel);
  const count=document.createElement('small');count.id='gwbLibCount';
  entries=document.createElement('div');entries.className='gwb-lib-list';
  notice=document.createElement('div');notice.className='gwb-lib-status';notice.setAttribute('role','status');
  const hint=document.createElement('small');
  hint.textContent='Данные хранятся только в этом браузере. Имя профиля не обеспечивает защиту от других пользователей этого браузера. Для переноса на другой компьютер сохраните JSON-копию.';
  panel.append(heading,articleLabel,controls,count,entries,hint,notice);
  host.append(panel);
  const update=()=>setTimeout(()=>{if(displayArticle!==article())void render()},160);
  $('orderTemplates')?.addEventListener('change',update);
  $('orderTemplateList')?.addEventListener('click',update);
  window.addEventListener('gwb-editor-readiness-changed',update);
  const picker=$('orderFieldChoiceBox');
  if(picker)new MutationObserver(update).observe(picker,{attributes:true,attributeFilter:['hidden']});
  void render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();