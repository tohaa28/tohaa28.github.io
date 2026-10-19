/* Real Rust TraceDraw WASM, embedded in Maketnaya.
   No customer logo crosses to the upstream demo or a third-party service.
   Uses the same active-placement token and current field size as VectorCraft. */
(function(){
'use strict';
if(window.gwbTraceDrawHostInstalled)return;
window.gwbTraceDrawHostInstalled=true;
const ORIGIN='https://tohaa28.github.io';
const INDEX=ORIGIN+'/gifts-layout-workbench-mockups/tracedraw/index.html?v=20261019-field-lock-2';
let active=null;
function button(name){const b=document.createElement('button');b.type='button';b.textContent=name;
 Object.assign(b.style,{padding:'8px 13px',borderRadius:'7px',border:'1px solid #b3cda3',
  background:'#fff',color:'#37512c',font:'600 12px system-ui',cursor:'pointer'});return b}
function notify(s,t,bad=false){s.status.textContent=t;s.status.style.color=bad?'#a63730':'#5b7554'}
function hideMaketnayaClose(hidden){
 try{window.gwbReportLogoEditorVisibility?.(hidden)}catch{}
}
function close(force=false){
 const s=active;if(!s)return;
 if(!force&&s.opened&&!confirm('Закрыть TraceDraw без переноса изменений на шаблон?'))return;
 active=null;window.removeEventListener('message',receive);
 if(document.fullscreenElement===s.overlay)void document.exitFullscreen().catch(()=>{});
 s.overlay.remove();document.body.style.overflow=s.originalOverflow;
 hideMaketnayaClose(false);
}
async function receive(event){
 const s=active;
 if(!s||event.origin!==ORIGIN||event.source!==s.iframe.contentWindow)return;
 const d=event.data;if(!d||d.token!==s.token)return;
 if(d.type==='gwb-tracedraw-ready'){
   if(s.sent)return;s.sent=true;
   try{
     const bytes=await s.file.arrayBuffer();if(active!==s)return;
     s.iframe.contentWindow.postMessage({type:'gwb-tracedraw-open',token:s.token,
       name:s.file.name,bytes,w:s.field.w,h:s.field.h},ORIGIN,[bytes]);
     notify(s,'Открываем макет в TraceDraw…');
   }catch(e){notify(s,'Не удалось передать файл: '+e.message,true)}
 }else if(d.type==='gwb-tracedraw-opened'){
   s.opened=true;
   notify(s,'Редактируется поле '+s.field.w.toFixed(2)+' × '+s.field.h.toFixed(2)+' мм. Для возврата нажмите зелёную кнопку внутри TraceDraw.');
 }else if(d.type==='gwb-tracedraw-error'){
   s.applying=false;notify(s,'TraceDraw: '+String(d.message||'Ошибка обработки').slice(0,400),true);
 }else if(d.type==='gwb-tracedraw-svg'){
   if(!s.opened||s.applying)return;
   s.applying=true;
   try{
     const bounds=d.logoBoundsMm;
     if(!bounds||!['x','y','w','h'].every(k=>typeof bounds[k]==='number'&&Number.isFinite(bounds[k]))||
        bounds.w<=0.001||bounds.h<=0.001||bounds.w>2000||bounds.h>2000)
       throw Error('Не переданы реальные размеры нарисованного изображения');
     if(typeof d.svg!=='string'||d.svg.length>40*1024*1024)
       throw Error('Недопустимый SVG');
     const parsed=new DOMParser().parseFromString(d.svg,'image/svg+xml');
     const root=parsed.documentElement;
     if(root?.localName!=='svg'||parsed.querySelector('parsererror,script,foreignObject,iframe,object,embed'))
       throw Error('Экспорт содержит неверные или исполняемые элементы SVG');
     const v=root.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
     if(!v||v.length!==4||!v.every(Number.isFinite)||Math.abs(v[2]-bounds.w)>.05||
       Math.abs(v[3]-bounds.h)>.05||Math.abs(v[0]-bounds.x)>.05||
       Math.abs(v[1]-bounds.y)>.05)
       throw Error('Габариты SVG не совпадают с рассчитанными габаритами объекта');
     for(const el of parsed.querySelectorAll('*')){
       for(const attr of [...el.attributes]){
         if(/^on/i.test(attr.name)||/javascript:|vbscript:/i.test(attr.value)||
            ((attr.name==='href'||attr.name.endsWith(':href'))&&attr.value&&!attr.value.startsWith('#')&&!attr.value.startsWith('data:image/')))
            throw Error('TraceDraw передал внешнюю ссылку или исполняемый атрибут SVG');
       }
     }
     if(active!==s)return;
     const file=new File([d.svg],s.name.replace(/\.[^.]*$/,'')+'-tracedraw.svg',{type:'image/svg+xml'});
     notify(s,'Переносим отредактированную геометрию на поле артикула…');
     await window.gwbApplyEditedLogoToActiveField(file,s.placement,{
       artworkBoundsMm:bounds,fieldSizeMm:s.field
     });
     if(active===s)close(true);
   }catch(e){s.applying=false;notify(s,'Не удалось применить макет: '+e.message,true)}
 }
}
function session(){const x=new Uint8Array(24);crypto.getRandomValues(x);return [...x].map(v=>v.toString(16).padStart(2,'0')).join('')}
async function open(){
 if(active)return;
 if(document.getElementById('gwbVectorcraftHost')){
   alert('Сначала закройте VectorCraft. Два редактора одного поля одновременно не открываются.');
   return;
 }
 const selected=window.gwbGetActiveLogoForEditor?.();
 if(!selected){alert('Сначала откройте шаблон и выберите конкретное поле нанесения.');return}
 let prepared;
 try{
   const fields=window.gwbVectorcraftField;
   if(!fields)throw Error('Не загружен модуль физических размеров');
   const size=fields.fieldInfo(selected);
   const initial=selected.file||new File([
     '<svg xmlns="http://www.w3.org/2000/svg" width="'+size.w+'mm" height="'+size.h+'mm" viewBox="0 0 '+size.w+' '+size.h+'"></svg>'
   ],'Новый.svg',{type:'image/svg+xml'});
   prepared=await fields.prepare(initial,selected);
   if(!/\.(svg|pdf)$/i.test(prepared.file.name))
     throw Error('Для TraceDraw этот исходный формат пока не поддерживается; используйте PDF или SVG');
   // Only a self-hosted TraceDraw binary is ever opened. Its availability
   // is confirmed by WASM-ready handshake, not an unreliable cross-origin HEAD.
 }catch(e){alert('TraceDraw: '+e.message+'\nVectorCraft остаётся доступен.');return}
 if(active)return;
 const overlay=document.createElement('div');overlay.id='gwbTraceDrawHost';
 Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483450',display:'flex',
   flexDirection:'column',background:'#edf1e9',font:'12px system-ui,sans-serif',color:'#2b492c'});
 const header=document.createElement('div');Object.assign(header.style,{display:'flex',alignItems:'center',
   background:'#fff',gap:'12px',padding:'8px 15px',borderBottom:'1px solid #cbdcc5'});
 const label=document.createElement('strong');label.textContent='TraceDraw · Редактор логотипа';
 const size=document.createElement('span');size.textContent='Поле '+prepared.fieldSizeMm.w.toFixed(2)+' × '+prepared.fieldSizeMm.h.toFixed(2)+' мм';
 const spacer=document.createElement('div');spacer.style.flex='1';
 const fullscreen=button('На весь экран'),cancel=button('Закрыть без изменений');
 header.append(label,size,spacer,fullscreen,cancel);
 const iframe=document.createElement('iframe');iframe.title='TraceDraw — векторный редактор в стиле CorelDRAW';
 iframe.allow='webgpu; clipboard-read; clipboard-write; fullscreen';iframe.setAttribute('allowfullscreen','');
 Object.assign(iframe.style,{width:'100%',flex:'1',border:0,background:'#e7e7e7',minHeight:0});
 const footer=document.createElement('div');Object.assign(footer.style,{padding:'7px 16px',
   background:'#f9fbf7',borderTop:'1px solid #dce8d7'});
 const status=document.createElement('span');status.textContent='Загрузка собственного TraceDraw WASM…';
 footer.append(status);overlay.append(header,iframe,footer);
 const old=document.body.style.overflow;document.body.style.overflow='hidden';
 active={overlay,iframe,status,token:session(),file:prepared.file,field:prepared.fieldSizeMm,
   name:selected.file?.name||prepared.file.name,placement:selected.token,originalOverflow:old,
   opened:false,sent:false,applying:false};
 cancel.onclick=()=>close();
 fullscreen.onclick=()=>{
   const s=active;if(!s)return;
   if(document.fullscreenElement===s.overlay)void document.exitFullscreen().catch(()=>{});
   else void s.overlay.requestFullscreen?.().catch(e=>notify(s,e.message,true));
 };
 const s=active;
 iframe.onerror=()=>{if(active===s)notify(s,'Не удалось загрузить локальную сборку TraceDraw.',true)};
 document.body.append(overlay);
 hideMaketnayaClose(true);
 window.addEventListener('message',receive);
 iframe.src=INDEX+'#gwb='+encodeURIComponent(s.token);
}
window.gwbTraceDrawHost={open,close:()=>close()};
})();