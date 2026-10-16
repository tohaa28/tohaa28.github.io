/* Full VectorCraft WASM editor hosted inside Maketnaya.
   All artwork roundtrips via structured-clone byte arrays and the trusted
   current-placement bridge. No upload, token persistence, or file downloads. */
(function(){
'use strict';
if(window.gwbVectorcraftIntegrationInstalled)return;
window.gwbVectorcraftIntegrationInstalled=true;
const ORIGIN='https://tohaa28.github.io';
const URL_BASE=ORIGIN+'/gifts-layout-workbench-mockups/vectorcraft/index.html';
let active=null;
const el=(tag,opts={})=>Object.assign(document.createElement(tag),opts);
function secret(){
  const data=new Uint8Array(24);crypto.getRandomValues(data);
  return Array.from(data,b=>b.toString(16).padStart(2,'0')).join('');
}
function close(force=false){
  const s=active;if(!s)return;
  if(!force&&s.opened&&!confirm('Закрыть VectorCraft? Несохранённые изменения не попадут в шаблон.'))return;
  active=null;window.removeEventListener('message',receive);
  s.overlay.remove();
  document.body.style.overflow=s.oldOverflow;
}
function notice(s,message,bad=false){s.status.textContent=message;s.status.style.color=bad?'#df5d51':'#dbe5ea'}
async function receive(event){
  const s=active;
  if(!s||event.source!==s.iframe.contentWindow||event.origin!==ORIGIN)return;
  const d=event.data;
  if(!d||d.token!==s.session||typeof d.type!=='string')return;
  if(d.type==='gwb-vectorcraft-ready'){
    if(s.sent)return;
    s.sent=true;
    try{
      const bytes=await s.file.arrayBuffer();
      if(active!==s)return;
      s.iframe.contentWindow.postMessage({type:'gwb-vectorcraft-open',token:s.session,name:s.file.name,bytes},ORIGIN,[bytes]);
      notice(s,'Передаём оригинальный файл в VectorCraft…');
    }catch(error){notice(s,'Ошибка передачи файла: '+error.message,true)}
  }else if(d.type==='gwb-vectorcraft-opened'){
    s.opened=true;notice(s,'Логотип передан в VectorCraft. Редактируйте объекты, затем нажмите «Применить в Макетной».');
    s.apply.disabled=false;
  }else if(d.type==='gwb-vectorcraft-error'){
    s.applying=false;s.apply.disabled=false;
    notice(s,'VectorCraft: '+String(d.message||'Ошибка обработки').slice(0,360),true);
  }else if(d.type==='gwb-vectorcraft-svg'){
    if(!s.applying)return;
    s.applying=false;
    try{
      const bytes=d.bytes instanceof Uint8Array?d.bytes:null;
      if(!bytes||bytes.byteLength===0||bytes.byteLength>40*1024*1024)throw Error('Некорректный или слишком большой SVG');
      const file=new File([bytes],s.filename.replace(/\.[^.]*$/,'')+'-vectorcraft.svg',{type:'image/svg+xml'});
      const text=await file.text();
      const xml=new DOMParser().parseFromString(text,'image/svg+xml');
      if(xml.documentElement.localName!=='svg'||xml.querySelector('parsererror'))throw Error('VectorCraft вернул некорректный SVG');
      if(xml.querySelector('script,foreignObject'))throw Error('SVG содержит неподдерживаемые исполняемые элементы');
      const warnings=String(d.message||'').trim();
      if(warnings&&!confirm('VectorCraft сообщает об особенностях экспорта:\n'+warnings.slice(0,900)+'\nПрименить результат?')){s.apply.disabled=false;notice(s,'Экспорт отменён. Исходный макет сохранён.');return}
      if(active!==s)return;
      if(typeof window.gwbApplyEditedLogoToActiveField!=='function')throw Error('Мост к выбранному полю Макетной недоступен');
      notice(s,'Сохраняем изменённый вектор в выбранном поле…');
      await window.gwbApplyEditedLogoToActiveField(file,s.placement);
      if(active===s)close(true);
    }catch(error){
      s.apply.disabled=false;
      notice(s,'Изменённый логотип не применён: '+error.message,true);
    }
  }
}
function open(){
  if(active)return;
  const selected=window.gwbGetActiveLogoForEditor?.();
  if(!selected){
    alert('Сначала выберите конкретное поле нанесения в Макетной.');
    return;
  }
  const file=selected.file||new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"></svg>'],'Новый.svg',{type:'image/svg+xml'});
  if(file.size>40*1024*1024){alert('VectorCraft принимает файлы размером до 40 МБ.');return}
  const token=secret();
  const overlay=el('div');overlay.id='gwbVectorcraftHost';
  Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483450',background:'#20282c',color:'#fff',display:'flex',flexDirection:'column',font:'13px system-ui,sans-serif'});
  const bar=el('div');
  Object.assign(bar.style,{display:'flex',gap:'12px',alignItems:'center',padding:'9px 16px',background:'#435159',minHeight:'55px',boxSizing:'border-box'});
  const heading=el('strong',{textContent:'VectorCraft · Редактор логотипа'});
  const field=el('span',{textContent:Number.isInteger(selected.fieldIndex)?'Поле '+(selected.fieldIndex+1):'Выбранное поле'});
  field.style.opacity='.75';
  const space=el('div');space.style.flex='1';
  const apply=el('button',{textContent:'Применить в Макетной',disabled:true,type:'button'});
  Object.assign(apply.style,{border:0,borderRadius:'6px',background:'#81b315',color:'#172900',fontWeight:'700',padding:'10px 16px',cursor:'pointer'});
  const cancel=el('button',{textContent:'Закрыть без изменений',type:'button'});
  Object.assign(cancel.style,{border:'1px solid #708287',borderRadius:'6px',background:'transparent',color:'#fff',padding:'10px 14px',cursor:'pointer'});
  bar.append(heading,field,space,apply,cancel);
  const iframe=el('iframe',{title:'VectorCraft — векторный редактор',allow:'webgpu; clipboard-read; clipboard-write; fullscreen'});
  Object.assign(iframe.style,{flex:'1',width:'100%',border:0,minHeight:'0',background:'#262626'});
  const footer=el('div');
  Object.assign(footer.style,{background:'#334047',minHeight:'29px',display:'flex',alignItems:'center',padding:'4px 16px'});
  const status=el('span',{textContent:'Запускаем VectorCraft WebAssembly…'});
  footer.append(status);overlay.append(bar,iframe,footer);
  const oldOverflow=document.body.style.overflow;
  active={session:token,iframe,overlay,status,apply,file,filename:file.name,placement:selected.token,oldOverflow,sent:false,opened:false,applying:false};
  window.addEventListener('message',receive);
  apply.onclick=()=>{
    const s=active;if(!s||s.applying)return;
    s.applying=true;s.apply.disabled=true;notice(s,'VectorCraft формирует SVG из текущего документа…');
    s.iframe.contentWindow.postMessage({type:'gwb-vectorcraft-apply',token:s.session},ORIGIN);
  };
  cancel.onclick=()=>close();
  const fallback=el('button',{type:'button',textContent:'Открыть прежний редактор'});
  Object.assign(fallback.style,{background:'none',border:0,color:'#bddb7a',cursor:'pointer',font:'inherit'});
  fallback.onclick=()=>{close(true);window.gwbLogoEditor?.open()};
  footer.append(el('span',{textContent:' · '}),fallback);
  iframe.onerror=()=>notice(active||{status},'Ошибка загрузки VectorCraft. Можно открыть прежний редактор.',true);
  document.body.style.overflow='hidden';
  document.body.append(overlay);
  iframe.src=URL_BASE+'#gwb='+encodeURIComponent(token);
}
function install(){
  const button=document.getElementById('editorOpenLogoEditor');
  if(!button)return;
  button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();open()},true);
  window.gwbVectorcraftHost={open,close:()=>close()};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
