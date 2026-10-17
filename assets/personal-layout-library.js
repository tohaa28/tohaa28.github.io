/* Personal, order-independent artwork library for gifts.ru Maketnaya.
   Browser IndexedDB is private to THIS browser profile/origin; it is not a
   server or a substitute for authenticated multi-device storage. */
(function(){
'use strict';
if(window.gwbPersonalLayoutLibraryInstalled)return;
window.gwbPersonalLayoutLibraryInstalled=true;
const DB='gwb-personal-layouts-v1',TABLE='layouts',VERSION=1;
const LIMIT=60*1024*1024, PDF_LIMIT=45*1024*1024;
const $=id=>document.getElementById(id);
let panel,entries,notice,accountLabel,cloudBadge,saveButton,displayArticle='',displayIdentity='',renderSerial=0,dbPromise;
let serverIdentity=null,serverCheckedFor='';
const serverBase='/private/maketnaya-layouts/v1';
async function cloudRequest(path,method='GET',data){
  const headers={'Accept':'application/json'};
  if(data)headers['Content-Type']='application/json';
  const response=await fetch(serverBase+path,{method,headers,body:data?JSON.stringify(data):undefined,
    credentials:'include',cache:'no-store',redirect:'error'});
  if(!response.headers.get('content-type')?.includes('application/json'))
    throw Error('Защищённый сервер макетов не подключён');
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Ошибка сервера макетов');
  return result;
}
const encodeState=state=>({...state,items:state.items.map(p=>({
  ...p,artwork:{...p.artwork,bytes:b64(p.artwork.bytes)}}))});
const decodeState=state=>({...state,items:state.items.map(p=>({
  ...p,artwork:{...p.artwork,bytes:fromB64(p.artwork.bytes)}}))});
async function checkServer(){
  const username=user();
  if(!username||serverCheckedFor===username)return;
  serverCheckedFor=username;serverIdentity=null;
  try{
    const res=await cloudRequest('/me');
    if(!res.authenticated||typeof res.id!=='string'||clean(res.name)!==username)
      throw Error('Сервер подтвердил другого пользователя');
    serverIdentity=res;
  }catch{serverIdentity=null}
  if(cloudBadge)cloudBadge.textContent=serverIdentity?'Серверное хранилище активно':'Сервер недоступен · локальный резерв';
  if(saveButton)saveButton.textContent=serverIdentity?'Сохранить на сервер':'Сохранить локальную копию';
  void render();
}
const styles=String.raw`#gwbPersonalLibrary{margin:18px 0 0;padding:16px;border:1px solid #cbd9bd;background:#fbfdf8;border-radius:10px;display:grid;gap:10px;font:12px/1.4 system-ui,sans-serif;color:#455449;clear:both;width:100%;box-sizing:border-box}
  #orderEditor>#gwbPersonalLibrary{grid-column:1/-1}
  #gwbPersonalLibrary .gwb-lib-section-title{font-size:15px;font-weight:700;color:#334b29}
  #gwbPersonalLibrary .gwb-lib-subtitle{font-size:11px;color:#728269}
  #gwbPersonalLibrary .gwb-lib-divider{height:1px;background:#e1e8da}
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
const clean=v=>String(v||'').replace(/\s+/g,' ').trim().slice(0,96);
// This is display identity from the REAL authenticated gifts.ru header,
// never a manually entered profile. It is not a server-validated credential.
function giftsIdentity(){
  try{
    const site=window.parent!==window?window.parent:window;
    if(site.location.origin!=='https://gifts.ru')return '';
    const doc=site.document;
    const menus=[...doc.querySelectorAll('g-droper')];
    for(const menu of menus){
      const cabinet=[...menu.querySelectorAll('a[href]')].some(a=>{
        try{return new URL(a.getAttribute('href'),site.location.href).pathname==='/private/cabinet'}catch{return false}
      });
      if(!cabinet)continue;
      const label=menu.querySelector('g-drop .drop--padding .opacity-half')
        ||menu.querySelector('g-drop .drop-item--image .opacity-half');
      const name=clean(label?.textContent);
      if(name&&name.length>=2&&name.length<96)return name;
    }
    return '';
  }catch{return ''}
}
const article=()=>String(window.gwbCurrentLibraryArticle?.()||'').trim();
const user=()=>giftsIdentity();
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
  if(!user())throw Error('Войдите в gifts.ru: не удалось определить имя из личного меню авторизованного пользователя');
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
    const recordUser=user();
    // Persist a REAL vector PDF of the full article template with placements,
    // keeping the original editable source separately for explicit restoration.
    status('Формирую PDF макета артикула…');
    const pdf=await makePdf(state.article);
    if(article()!==state.article||user()!==recordUser)
      throw Error('Артикул или пользователь сменился во время формирования PDF');
    const record={id:crypto.randomUUID(),scope:scope(),profile:user(),article:article(),title,
      savedAt:new Date().toISOString(),personal:true,orderId:null,status:'personal-draft',
      preview:capturePreview(),pdf,data:state};
    if(serverIdentity){
      await cloudRequest('/layouts?article='+encodeURIComponent(record.article),'POST',{
        article:record.article,title:record.title,preview:record.preview,
        pdf:b64(record.pdf.bytes),pdfName:record.pdf.name,layout:encodeState(record.data)});
      status('PDF макета сохранён на сервере, исходники доступны для восстановления. В заказ не отправлялся.');
    }else{
      await operate('readwrite',store=>store.put(record));
      status('СЕРВЕР НЕДОСТУПЕН: PDF и исходники сохранены только на этом устройстве.',true);
    }
    await render();
  }catch(e){status(e.message||String(e),true)}
}
async function doRestore(id){
  try{
    ensure();
    const r=serverIdentity?
      await cloudRequest('/layouts/'+encodeURIComponent(id)+'?article='+encodeURIComponent(article())):
      await one(id);
    if(!r||(serverIdentity?r.article!==article():r.scope!==scope())||r.status!=='personal-draft')
      throw Error('Вариант недоступен для этого профиля и артикула');
    if(!confirm('Восстановить «'+r.title+'» в открытом редакторе?\nТекущие несохранённые размещения будут заменены. В заказ ничего автоматически не отправляется.'))return;
    const restored=await window.gwbRestorePersonalLayout(serverIdentity?decodeState(r.layout):r.data);
    status('Восстановлено '+restored.count+' размещений. Это личный вариант, не макет заказа.');
  }catch(e){status(e.message||String(e),true)}
}
async function doDelete(id){
  try{
    const r=serverIdentity?
      await cloudRequest('/layouts/'+encodeURIComponent(id)+'?article='+encodeURIComponent(article())):
      await one(id);
    if(!r||(serverIdentity?r.article!==article():r.scope!==scope()))throw Error('Не найдено');
    if(!confirm('Удалить личный вариант «'+r.title+'»?'))return;
    if(serverIdentity)await cloudRequest('/layouts/'+encodeURIComponent(id)+'?article='+encodeURIComponent(article()),'DELETE');
    else await operate('readwrite',store=>store.delete(id));
    status('Вариант удалён. Макеты заказов не затронуты.');
    await render();
  }catch(e){status(e.message||String(e),true)}
}
async function makePdf(articleId){
  if(typeof window.gwbCreateReadyLayoutPdf!=='function')
    throw Error('Экспорт PDF ещё не загружен — повторите после открытия конструктора');
  const ready=await window.gwbCreateReadyLayoutPdf();
  if(!(ready?.blob instanceof Blob)||ready.blob.type!=='application/pdf')
    throw Error('Редактор не создал PDF');
  if(ready.blob.size<8||ready.blob.size>PDF_LIMIT)throw Error('Недопустимый размер PDF');
  const bytes=new Uint8Array(await ready.blob.arrayBuffer());
  if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')
    throw Error('Экспортированный файл не является PDF');
  return {name:'art_'+articleId+'_layout.pdf',mime:'application/pdf',bytes};
}
function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function downloadPdf(r){
  try{
    const item=serverIdentity?
      await cloudPdf(r.id,r.article):await one(r.id).then(row=>row?.pdf);
    if(!item)throw Error('В этом старом варианте PDF не сохранён. Восстановите его и сохраните заново.');
    const blob=item instanceof Blob?item:new Blob([item.bytes],{type:'application/pdf'});
    if(blob.size<8||blob.size>PDF_LIMIT)throw Error('Недопустимый PDF');
    const magic=new TextDecoder().decode(new Uint8Array(await blob.slice(0,5).arrayBuffer()));
    if(magic!=='%PDF-')throw Error('Сохранённый файл повреждён — это не PDF');
    downloadBlob(blob,'art_'+r.article+'_'+r.id+'.pdf');
  }catch(e){status(e.message||String(e),true)}
}
async function cloudPdf(id,articleId){
  const response=await fetch(serverBase+'/layouts/'+encodeURIComponent(id)+
    '/pdf?article='+encodeURIComponent(articleId),{
    method:'GET',credentials:'include',cache:'no-store',redirect:'error'});
  if(!response.ok)throw Error('Сервер не вернул PDF ('+response.status+')');
  if(!response.headers.get('content-type')?.includes('application/pdf'))
    throw Error('Сервер вернул не PDF');
  return response.blob();
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
  const currentUser=user();
  if(accountLabel)accountLabel.textContent=currentUser?'Пользователь gifts.ru: '+currentUser:
    'Нет авторизованного пользователя gifts.ru';
  displayIdentity=currentUser;
  if(!currentUser){$('gwbLibCount').textContent='';status('Авторизуйтесь на gifts.ru. Макеты не привязаны к произвольному имени.');return}
  try{
    const list=(serverIdentity?
      (await cloudRequest('/layouts?article='+encodeURIComponent(now))).items:
      await allFor(scope())).filter(r=>r.status==='personal-draft')
      .sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
    if(generation!==renderSerial||now!==article()||currentUser!==user())return;
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
      meta.textContent=new Date(r.savedAt).toLocaleString('ru-RU')+' · '+
        (r.itemCount||r.data?.items?.length||0)+' полей · '+
        (r.hasPdf||r.pdf?'PDF':'старый вариант без PDF')+' · '+
        (serverIdentity?'на сервере':'локально');
      label.append(title,meta);
      const actions=document.createElement('div');actions.className='gwb-lib-actions';
      const pdfButton=button('Скачать PDF',()=>void downloadPdf(r));
      pdfButton.disabled=!(r.hasPdf||r.pdf);
      actions.append(button('Восстановить',()=>doRestore(r.id)),pdfButton,
        button('Удалить',()=>doDelete(r.id)));
      item.append(label,actions);entries.append(item);
    }
    if(!notice.textContent||notice.textContent.startsWith('Укажите'))status('Варианты не подставляются автоматически в заказы.');
  }catch(e){status(e.message||String(e),true)}
}
function install(){
  // Dedicated sibling section; NEVER nest saved variants in Step 2 field picker.
  const host=$('orderEditor');
  if(!host)return;
  const sheet=document.createElement('style');sheet.textContent=styles;document.head.append(sheet);
  panel=document.createElement('section');panel.id='gwbPersonalLibrary';
  panel.className='gwb-library-section';panel.hidden=true;
  const heading=document.createElement('div');heading.className='gwb-lib-head';
  const title=document.createElement('strong');title.className='gwb-lib-section-title';
  title.textContent='Мои сохранённые макеты';
  const badge=document.createElement('span');badge.className='gwb-lib-badge';badge.textContent='Лично · не прикреплено к заказу';
  heading.append(title,badge);
  const articleLabel=document.createElement('div');articleLabel.id='gwbLibArticle';
  const controls=document.createElement('div');controls.className='gwb-lib-actions';
  accountLabel=document.createElement('span');
  accountLabel.id='gwbLibAuthenticatedUser';accountLabel.className='gwb-lib-badge';
  accountLabel.setAttribute('aria-live','polite');
  const save=button('Сохранить локальную копию',doSave);save.className='gwb-lib-save';saveButton=save;
  cloudBadge=document.createElement('span');cloudBadge.className='gwb-lib-badge';
  cloudBadge.textContent='Сервер недоступен';
  controls.append(accountLabel,cloudBadge,save);
  const count=document.createElement('small');count.id='gwbLibCount';
  entries=document.createElement('div');entries.className='gwb-lib-list';
  notice=document.createElement('div');notice.className='gwb-lib-status';notice.setAttribute('role','status');
  const hint=document.createElement('small');
  hint.textContent='Каждый вариант хранится в PDF вместе с исходниками для восстановления. Это личные черновики, не макеты заказа. Когда сервер недоступен, PDF хранится только в этом браузере.';
  const divider=document.createElement('div');divider.className='gwb-lib-divider';
  panel.append(heading,divider,articleLabel,controls,count,entries,hint,notice);
  host.append(panel);
  const update=()=>setTimeout(()=>{
    if(displayArticle!==article()||displayIdentity!==user()){
      if(displayIdentity!==user()){serverIdentity=null;serverCheckedFor='';void checkServer()}
      void render();
    }
  },160);
  $('orderTemplates')?.addEventListener('change',update);
  $('orderTemplateList')?.addEventListener('click',update);
  window.addEventListener('gwb-editor-readiness-changed',update);
  const picker=$('orderFieldChoiceBox');
  if(picker)new MutationObserver(update).observe(picker,{attributes:true,attributeFilter:['hidden']});
  try{
    const site=window.parent!==window?window.parent:window;
    if(site.location.origin==='https://gifts.ru'){
      const target=site.document.querySelector('header')||site.document.body;
      if(target)new MutationObserver(update).observe(target,{childList:true,subtree:true,characterData:true});
    }
  }catch{}
  // The gifts.ru authorization can change in the parent without mutating
  // any Maketnaya DOM node.
  window.addEventListener('focus',update);
  void render();
  void checkServer();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();