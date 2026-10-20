/* Drag a local logo from the OS Explorer onto the actual printable field.
   Preserve the Maketnaya native artwork loader, PrintCheck and existing gestures. */
(function(){
'use strict';
if(window.gwbExplorerLogoDropUiInstalled)return;
window.gwbExplorerLogoDropUiInstalled=true;
function start(){
 const scroll=document.getElementById('stageScroll'),stage=document.getElementById('stage');
 const canvas=document.getElementById('overlay'),status=document.getElementById('status');
 if(!scroll||!stage||!canvas)return;
 const style=document.createElement('style');
 style.textContent="\n#gwbFileDropHighlight{position:absolute;display:none;z-index:18;pointer-events:none;box-sizing:border-box;border:3px dashed #70ab12;border-radius:10px;background:rgba(161,211,68,.15);box-shadow:0 0 0 5px rgba(255,255,255,.6),0 0 28px rgba(94,137,34,.18);align-items:center;justify-content:center;text-align:center}\n#gwbFileDropHighlight.active{display:flex}\n#gwbFileDropHighlight span{display:inline-block;max-width:calc(100% - 12px);border-radius:8px;background:#fff;padding:8px 12px;color:#416b12;box-shadow:0 4px 20px #29451530;font:700 13px/1.35 system-ui,sans-serif}\n#gwbFileDropHighlight.is-small span{position:absolute;left:50%;top:calc(100% + 8px);transform:translateX(-50%);max-width:280px;min-width:150px;white-space:normal}\n#gwbFileDropHighlight.is-loading{border-color:#7394a8;background:rgba(115,148,168,.15)}\n#gwbFileDropHighlight.is-loading span{color:#456679}\n@media(prefers-reduced-motion:no-preference){#gwbFileDropHighlight.active{animation:gwbExplorerHighlight .35s ease-out both}@keyframes gwbExplorerHighlight{from{opacity:.4}to{opacity:1}}}\n";
 document.head.append(style);
 const mark=document.createElement('div');mark.id='gwbFileDropHighlight';
 mark.setAttribute('aria-hidden','true');
 const label=document.createElement('span');mark.append(label);stage.append(mark);
 let uploading=false;
 const host=()=>window.gwbExplorerLogoDrop;
 const hasFiles=e=>Array.from(e?.dataTransfer?.types||[]).includes('Files');
 const supported=file=>/\.(?:pdf|ai|svg|png|jpe?g)$/i.test(file?.name||'');
 const notice=message=>{if(status)status.textContent=message};
 function hide(){if(uploading)return;mark.classList.remove('active','is-loading','is-small');mark.style.display='none'}
 function inspect(e){try{return host()?.inspect?.(e.clientX,e.clientY)||null}catch{return null}}
 function display(target,loading=false){
   if(!target){hide();return}
   const rect=canvas.getBoundingClientRect(),box=target.field,view=target.view;
   if(!(rect.width>0&&rect.height>0&&view.w>0&&view.h>0)){hide();return}
   const left=(box.x-view.x)/view.w*rect.width,top=(box.y-view.y)/view.h*rect.height;
   const width=box.w/view.w*rect.width,height=box.h/view.h*rect.height;
   mark.style.left=left+'px';mark.style.top=top+'px';
   mark.style.width=Math.max(1,width)+'px';mark.style.height=Math.max(1,height)+'px';
   label.textContent=loading?'Загружаем логотип…':'Отпустите файл в поле нанесения';
   mark.style.display='flex';mark.classList.add('active');
   mark.classList.toggle('is-loading',loading);
   mark.classList.toggle('is-small',width<160||height<65);
 }
 scroll.addEventListener('dragover',e=>{
   if(!hasFiles(e)||uploading)return;
   e.preventDefault();
   const target=inspect(e);
   e.dataTransfer.dropEffect=target?'copy':'none';
   display(target);
 },true);
 scroll.addEventListener('dragleave',e=>{
   if(hasFiles(e)&&!scroll.contains(e.relatedTarget))hide();
 },true);
 scroll.addEventListener('drop',async e=>{
   if(!hasFiles(e))return;
   e.preventDefault();e.stopPropagation();
   const target=inspect(e);
   const list=Array.from(e.dataTransfer.files||[]);
   if(uploading)return;
   if(!target){hide();notice('Перетащите логотип именно на контур поля нанесения.');return}
   if(list.length!==1){hide();notice('Перетащите один файл логотипа для одного поля.');return}
   const file=list[0];
   if(!supported(file)){hide();notice('Допустимы PDF, AI с PDF-данными, SVG, PNG и JPG. CDR/EPS сначала экспортируйте в PDF.');return}
   if(!file.size||file.size>40*1024*1024){hide();notice('Логотип должен быть размером не больше 40 МБ.');return}
   const api=host();
   if(!api?.accept){hide();notice('Редактор ещё загружается. Повторите после загрузки шаблона.');return}
   uploading=true;display(target,true);
   try{
     await api.accept(file,e.clientX,e.clientY);
   }catch(err){
     notice('Не удалось добавить логотип: '+String(err?.message||err));
   }finally{
     uploading=false;hide();
   }
 },true);
 document.addEventListener('dragover',e=>{
   if(hasFiles(e)&&!scroll.contains(e.target))e.preventDefault();
 },true);
 document.addEventListener('drop',e=>{
   if(!hasFiles(e)||scroll.contains(e.target))return;
   e.preventDefault();notice('Перетащите логотип на поле нанесения в шаблоне.');
 },true);
 window.addEventListener('blur',hide);
 window.gwbExplorerLogoDropUi={hide,enabled:true};
}
if(document.readyState==='loading')
 document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();