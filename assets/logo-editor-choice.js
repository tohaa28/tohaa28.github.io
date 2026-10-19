/* Choose real vector editor without affecting article, field or placement. */
(function(){
'use strict';
if(window.gwbLogoEditorChooserInstalled)return;
window.gwbLogoEditorChooserInstalled=true;
const css="#gwbEditorChoice{position:fixed;z-index:2147483200;min-width:250px;max-width:min(340px,calc(100vw - 24px));border:1px solid #b9cbb2;border-radius:10px;background:#fff;box-shadow:0 12px 32px #1f37202d;padding:6px;display:grid;gap:3px;font:12px/1.35 system-ui;color:#283f28}\n#gwbEditorChoice[hidden]{display:none!important}\n#gwbEditorChoice button{all:unset;display:flex;align-items:center;gap:9px;cursor:pointer;border-radius:7px;padding:10px 11px;box-sizing:border-box}\n#gwbEditorChoice button:hover,#gwbEditorChoice button:focus-visible{background:#eff8e3;outline:1px solid #a6cb76}\n#gwbEditorChoice button strong{display:block;font-weight:700}\n#gwbEditorChoice button small{display:block;font-size:10px;color:#60745d;margin-top:2px}\n#gwbEditorChoice .gwb-edit-menu-label{padding:5px 11px;font-size:10px;color:#6a7a66;font-weight:700;letter-spacing:.05em}";
function install(){
 const trigger=document.getElementById('editorOpenLogoEditor');if(!trigger)return;
 const style=document.createElement('style');style.textContent=css;document.head.append(style);
 const menu=document.createElement('div');menu.id='gwbEditorChoice';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Выберите редактор логотипа');
 const label=document.createElement('div');label.className='gwb-edit-menu-label';label.textContent='РЕДАКТИРОВАНИЕ ЛОГОТИПА';
 menu.append(label);
 function option(name,summary,action){
   const b=document.createElement('button');b.type='button';
   const text=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');
   strong.textContent=name;small.textContent=summary;text.append(strong,small);b.append(text);
   b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();hide();action()});
   menu.append(b);return b;
 }
 const vector=option('VectorCraft','Стандартный · проверенный редактор',()=>{
   if(typeof window.gwbVectorcraftHost?.open==='function')void window.gwbVectorcraftHost.open();
   else alert('VectorCraft ещё не загружен. Обновите редактор.');
 });
 const trace=option('TraceDraw','Инструменты в стиле CorelDRAW · SVG/CDR',()=>{
   if(typeof window.gwbTraceDrawHost?.open==='function')void window.gwbTraceDrawHost.open();
   else alert('Модуль TraceDraw не загрузился. VectorCraft доступен отдельно.');
 });
 document.body.append(menu);
 function hide(){menu.hidden=true;trigger.setAttribute('aria-expanded','false')}
 function show(){
   menu.hidden=false;trigger.setAttribute('aria-expanded','true');
   const r=trigger.getBoundingClientRect(),mw=menu.offsetWidth;
   menu.style.left=Math.min(Math.max(8,r.left),innerWidth-mw-8)+'px';
   menu.style.top=Math.min(r.bottom+7,innerHeight-menu.offsetHeight-8)+'px';
   vector.focus();
 }
 trigger.setAttribute('aria-haspopup','true');trigger.setAttribute('aria-expanded','false');
 trigger.addEventListener('click',event=>{
   event.preventDefault();event.stopImmediatePropagation();
   if(menu.hidden)show();else hide();
 },true);
 document.addEventListener('pointerdown',event=>{
   if(!menu.hidden&&!menu.contains(event.target)&&event.target!==trigger)hide();
 },true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){hide();trigger.focus()}},true);
 window.addEventListener('resize',hide);
 window.gwbEditorChooser={show,hide,vectorcraft:()=>vector.click(),tracedraw:()=>trace.click()};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();