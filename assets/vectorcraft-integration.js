/* Full VectorCraft WASM editor hosted inside Maketnaya.
   All artwork roundtrips via structured-clone byte arrays and the trusted
   current-placement bridge. No upload, token persistence, or file downloads. */
(function(){
'use strict';
if(window.gwbVectorcraftIntegrationInstalled)return;
window.gwbVectorcraftIntegrationInstalled=true;
const ORIGIN='https://tohaa28.github.io';
const URL_BASE=ORIGIN+'/gifts-layout-workbench-mockups/vectorcraft/index.html?v=20261017-transfer-only-1';
let active=null;
const el=(tag,opts={})=>Object.assign(document.createElement(tag),opts);
function reportEditorVisibility(visible){
  // VectorCraft and the retained simple logo editor both suppress the gifts.ru
  // launcher's close X. The editor uses srcdoc: location.origin may be "null"
  // even though the frame can access its same-origin gifts.ru parent.
  const hide=!!(visible || active || window.gwbLogoEditor?.active);
  if(window.parent===window)return;
  try{
    const outer=window.parent.document.getElementById('gifts-layout-workbench-host');
    const closeButton=outer?.querySelector('.gwb-close');
    if(closeButton){
      closeButton.hidden=hide;
      closeButton.disabled=hide;
      closeButton.style.display=hide?'none':'';
    }
  }catch{}
  try{
    const targetOrigin=window.parent.location.origin;
    if(targetOrigin&&targetOrigin!=='null')window.parent.postMessage({
      type:'gwb-maketnaya-vectorcraft-visibility',visible:hide
    },targetOrigin);
  }catch{}
}
function syncFullscreen(s){
  if(active!==s)return;
  const immersive=document.fullscreenElement===s.overlay;
  s.bar.style.display=immersive?'none':'flex';
  s.footer.style.display=immersive?'none':'flex';
  s.overlay.classList.toggle('gwb-vectorcraft-immersive',immersive);
  s.fullscreenBtn.textContent=immersive?'Выйти из полного экрана':'На весь экран';
  s.fullscreenBtn.setAttribute('aria-pressed',String(immersive));
}
async function toggleFullscreen(s){
  if(!s||active!==s)return;
  try{
    if(document.fullscreenElement===s.overlay)await document.exitFullscreen();
    else if(document.fullscreenElement)throw Error('Другое окно уже использует полноэкранный режим');
    else if(!s.overlay.requestFullscreen)throw Error('Браузер не поддерживает полноэкранный режим');
    else await s.overlay.requestFullscreen();
  }catch(error){notice(s,'Полный экран недоступен: '+error.message,true)}
}
function secret(){
  const data=new Uint8Array(24);crypto.getRandomValues(data);
  return Array.from(data,b=>b.toString(16).padStart(2,'0')).join('');
}
function close(force=false){
  const s=active;if(!s)return;
  if(!force&&s.opened&&!confirm('Закрыть VectorCraft? Несохранённые изменения не попадут в шаблон.'))return;
  active=null;window.removeEventListener('message',receive);
  document.removeEventListener('fullscreenchange',s.onFullscreenChange);
  if(document.fullscreenElement===s.overlay)void document.exitFullscreen().catch(()=>{});
  reportEditorVisibility(false);
  s.overlay.remove();
  document.body.style.overflow=s.oldOverflow;
}
function notice(s,message,bad=false){
  s.status.textContent=message;
  s.status.style.color=bad?'#d4483f':(s.giftsMode?'#5d705f':'#dbe5ea');
}
function decorateHost(s){
  const gifts=!!s.giftsMode;
  Object.assign(s.overlay.style,{
    background:gifts?'#e9efe6':'#20282c',color:gifts?'#26352b':'#fff'
  });
  Object.assign(s.bar.style,{
    background:gifts?'#fff':'#435159',
    borderBottom:gifts?'1px solid #dae6d0':'0'
  });
  Object.assign(s.footer.style,{
    background:gifts?'#f7faf3':'#334047',
    borderTop:gifts?'1px solid #dce8d5':'0'
  });
  Object.assign(s.cancel.style,{
    border:gifts?'1px solid #c8d9c0':'1px solid #708287',
    color:gifts?'#35513a':'#fff',
    background:gifts?'#fff':'transparent'
  });
  Object.assign(s.fallback.style,{color:gifts?'#527d16':'#bddb7a'});
  Object.assign(s.themeBtn.style,{
    border:gifts?'1px solid #80b82b':'1px solid #708287',
    color:gifts?'#345710':'#dbe8d3',
    background:gifts?'#e3f2cd':'transparent',
    borderRadius:'7px',padding:'5px 11px',cursor:'pointer',font:'inherit',
    fontWeight:gifts?'700':'500'
  });
  s.themeBtn.textContent=gifts?'Стиль gifts.ru ✓':'Стиль gifts.ru';
  s.themeBtn.setAttribute('aria-pressed',String(gifts));
  s.themeBtn.title=gifts?'Вернуться к стандартному оформлению VectorCraft':'Включить оформление gifts.ru';
  s.status.style.color=gifts?'#5d705f':'#dbe5ea';
}
function changeTheme(s,gifts){
  if(!s?.opened||s.applying||s.themePending)return;
  s.themePending=true;s.themeBtn.disabled=true;
  s.themeBtn.textContent='Меняем оформление…';
  s.iframe.contentWindow.postMessage({
    type:'gwb-vectorcraft-theme',token:s.session,mode:gifts?'gifts':'native'
  },ORIGIN);
}

async function receive(event){
  const s=active;
  if(!s||event.source!==s.iframe.contentWindow||event.origin!==ORIGIN)return;
  const d=event.data;
  if(!d||d.token!==s.session||typeof d.type!=='string')return;
  if(d.type==='gwb-vectorcraft-ready'){
    if(s.sent)return;
    s.sent=true;
    // Each embedded VectorCraft session starts in gifts.ru styling. Use the
    // existing native theme API, not a new editor or persistent user setting.
    // The original appearance remains available via the adjacent toggle.
    s.themePending=true;
    s.themeBtn.disabled=true;
    s.iframe.contentWindow.postMessage({
      type:'gwb-vectorcraft-theme',token:s.session,mode:'gifts'
    },ORIGIN);
    try{
      const bytes=await s.file.arrayBuffer();
      if(active!==s)return;
      s.iframe.contentWindow.postMessage({type:'gwb-vectorcraft-open',token:s.session,name:s.file.name,bytes,fieldSizeMm:s.fieldSizeMm,fieldCanvas:s.fieldCanvas},ORIGIN,[bytes]);
      notice(s,'Передаём оригинальный файл в VectorCraft…');
    }catch(error){notice(s,'Ошибка передачи файла: '+error.message,true)}
  }else if(d.type==='gwb-vectorcraft-opened'){
    s.opened=true;notice(s,'Поле '+s.fieldSizeMm.w.toFixed(2)+' × '+s.fieldSizeMm.h.toFixed(2)+' мм. VectorCraft открыл документ — редактируйте логотип.');
    s.apply.disabled=false;
    s.themeBtn.disabled=s.themePending;
  }else if(d.type==='gwb-vectorcraft-theme-applied'){
    s.themePending=false;
    s.themeBtn.disabled=false;
    s.giftsMode=d.message==='gifts';
    decorateHost(s);
  }else if(d.type==='gwb-vectorcraft-error'){
    s.applying=false;s.apply.disabled=false;
    notice(s,'VectorCraft: '+String(d.message||'Ошибка обработки').slice(0,360),true);
  }else if(d.type==='gwb-vectorcraft-apply-request'){
    // Trusted native VectorCraft action goes through the same detached transfer
    // trigger and export validation; no duplicate Maketnaya button is rendered.
    if(s.opened&&!s.applying&&!s.apply.disabled)s.apply.click();
  }else if(d.type==='gwb-vectorcraft-svg'){
    if(!s.applying)return;
    s.applying=false;
    try{
      const bytes=d.bytes instanceof Uint8Array?d.bytes:null;
      if(!bytes||bytes.byteLength===0||bytes.byteLength>40*1024*1024)throw Error('Некорректный или слишком большой SVG');
      const raw=new TextDecoder().decode(bytes);
      const cropped=window.gwbVectorcraftField.normalizeExport(raw,s.fieldSizeMm,d.logoBoundsMm);
      const file=new File([cropped.svg],s.filename.replace(/\.[^.]*$/,'')+'-vectorcraft.svg',{type:'image/svg+xml'});
      const xml=new DOMParser().parseFromString(cropped.svg,'image/svg+xml');
      if(xml.querySelector('script,foreignObject'))throw Error('SVG содержит неподдерживаемые исполняемые элементы');
      const warnings=String(d.message||'').trim();
      if(warnings&&!confirm('VectorCraft сообщает об особенностях экспорта:\n'+warnings.slice(0,900)+'\nПрименить результат?')){s.apply.disabled=false;notice(s,'Экспорт отменён. Исходный макет сохранён.');return}
      if(active!==s)return;
      if(typeof window.gwbApplyEditedLogoToActiveField!=='function')throw Error('Мост к выбранному полю Макетной недоступен');
      notice(s,'Сохраняем изменённый вектор в выбранном поле…');
      await window.gwbApplyEditedLogoToActiveField(file,s.placement,{
        artworkBoundsMm:cropped.boundsMm,fieldSizeMm:s.fieldSizeMm
      });
      if(active===s)close(true);
    }catch(error){
      s.apply.disabled=false;
      notice(s,'Изменённый логотип не применён: '+error.message,true);
    }
  }
}
async function open(){
  if(active)return;
  const selected=window.gwbGetActiveLogoForEditor?.();
  if(!selected){
    alert('Сначала выберите конкретное поле нанесения в Макетной.');
    return;
  }
  let physical;
  try{
    const dimensions=window.gwbVectorcraftField.fieldInfo(selected);
    const file=selected.file||new File([
      '<svg xmlns="http://www.w3.org/2000/svg" width="'+dimensions.w+'mm" height="'+dimensions.h+
      'mm" viewBox="0 0 '+dimensions.w+' '+dimensions.h+'"></svg>'
    ],'Новый.svg',{type:'image/svg+xml'});
    if(file.size>40*1024*1024)throw Error('VectorCraft принимает файлы размером до 40 МБ');
    physical=await window.gwbVectorcraftField.prepare(file,selected);
  }catch(error){alert('Размеры поля или исходное изображение: '+error.message);return}
  if(active)return;
  const {file,fieldSizeMm,fieldCanvas}=physical;
  const token=secret();
  const overlay=el('div');overlay.id='gwbVectorcraftHost';
  Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483450',background:'#20282c',color:'#fff',display:'flex',flexDirection:'column',font:'13px system-ui,sans-serif'});
  const bar=el('div');
  Object.assign(bar.style,{display:'flex',gap:'12px',alignItems:'center',padding:'9px 16px',background:'#435159',minHeight:'55px',boxSizing:'border-box'});
  const heading=el('strong',{textContent:'VectorCraft · Редактор логотипа'});
  const field=el('span',{textContent:(Number.isInteger(selected.fieldIndex)?'Поле '+(selected.fieldIndex+1):'Выбранное поле')+' · '+fieldSizeMm.w.toFixed(2)+' × '+fieldSizeMm.h.toFixed(2)+' мм'});
  field.style.opacity='.75';
  const space=el('div');space.style.flex='1';
  // Internal, detached transfer trigger: only native VectorCraft exposes an Apply button.
  const apply=el('button',{type:'button',disabled:true});
  const cancel=el('button',{textContent:'Закрыть без изменений',type:'button'});
  Object.assign(cancel.style,{border:'1px solid #708287',borderRadius:'6px',background:'transparent',color:'#fff',padding:'10px 14px',cursor:'pointer'});
  const fullscreenBtn=el('button',{type:'button',textContent:'На весь экран'});
  Object.assign(fullscreenBtn.style,{border:'1px solid #c8d9c0',background:'#f7faf3',color:'#35513a',borderRadius:'6px',padding:'10px 14px',cursor:'pointer'});
  bar.append(heading,field,space,fullscreenBtn,cancel);
  const iframe=el('iframe',{title:'VectorCraft — векторный редактор',allow:'webgpu; clipboard-read; clipboard-write; fullscreen'});
  iframe.setAttribute('allowfullscreen','');
  Object.assign(iframe.style,{flex:'1',width:'100%',border:0,minHeight:'0',background:'#262626'});
  const footer=el('div');
  Object.assign(footer.style,{background:'#334047',minHeight:'29px',display:'flex',alignItems:'center',gap:'9px',flexWrap:'wrap',padding:'6px 16px'});
  const status=el('span',{textContent:'Запускаем VectorCraft WebAssembly…'});
  status.style.flex='1';
  footer.append(status);overlay.append(bar,iframe,footer);
  const oldOverflow=document.body.style.overflow;
  active={session:token,iframe,overlay,bar,footer,cancel,status,apply,fullscreenBtn,file,filename:selected.file?.name||file.name,placement:selected.token,fieldSizeMm,fieldCanvas,oldOverflow,sent:false,opened:false,applying:false,giftsMode:true,themePending:false};
  active.onFullscreenChange=()=>syncFullscreen(active);
  document.addEventListener('fullscreenchange',active.onFullscreenChange);
  fullscreenBtn.onclick=()=>{void toggleFullscreen(active)};
  window.addEventListener('message',receive);
  apply.onclick=()=>{
    const s=active;if(!s||s.applying)return;
    s.applying=true;s.apply.disabled=true;notice(s,'VectorCraft формирует SVG из текущего документа…');
    s.iframe.contentWindow.postMessage({type:'gwb-vectorcraft-apply',token:s.session},ORIGIN);
  };
  cancel.onclick=()=>close();
  const fallback=el('button',{type:'button',textContent:'Открыть прежний редактор'});
  Object.assign(fallback.style,{background:'none',border:0,color:'#bddb7a',cursor:'pointer',font:'inherit'});
  const themeBtn=el('button',{type:'button',textContent:'Стиль gifts.ru',disabled:true});
  const s=active;
  s.themeBtn=themeBtn;s.fallback=fallback;
  fallback.onclick=()=>{close(true);window.gwbLogoEditor?.open()};
  themeBtn.onclick=()=>changeTheme(active,!active.giftsMode);
  // Keep the legacy/simple editor and native-theme mechanisms available in code,
  // but remove both switches from the user-facing interface.
  fallback.hidden=true;fallback.style.display='none';
  themeBtn.hidden=true;themeBtn.style.display='none';
  footer.append(fallback,themeBtn);
  decorateHost(s);
  iframe.onerror=()=>notice(active||{status},'Ошибка загрузки VectorCraft. Можно открыть прежний редактор.',true);
  document.body.style.overflow='hidden';
  document.body.append(overlay);
  reportEditorVisibility(true);
  iframe.src=URL_BASE+'#gwb='+encodeURIComponent(token);
}
function install(){
  const button=document.getElementById('editorOpenLogoEditor');
  if(!button)return;
  button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();void open()},true);
  window.gwbVectorcraftHost={open,close:()=>close()};
  window.gwbReportLogoEditorVisibility=reportEditorVisibility;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
