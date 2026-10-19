/* Animated native-editor chooser. Does not change artwork or active field. */
(function(){
'use strict';
if(window.gwbLogoEditorChooserInstalled)return;
window.gwbLogoEditorChooserInstalled=true;

const css=String.raw`
#gwbEditorChoice[hidden]{display:none!important}
#gwbEditorChoice{position:fixed;inset:0;z-index:2147483200;display:grid;place-items:center;padding:22px;box-sizing:border-box;background:rgba(20,30,25,.66);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#293b35}
#gwbEditorChoice *,#gwbEditorChoice *::before,#gwbEditorChoice *::after{box-sizing:border-box}
#gwbEditorChoice .gwb-choice-stage{width:min(820px,100%);max-height:min(680px,calc(100vh - 44px));overflow:auto;position:relative;padding:26px 27px 29px;border:1px solid rgba(205,220,202,.85);border-radius:25px;background:linear-gradient(155deg,#fff 0%,#f7faf5 100%);box-shadow:0 30px 90px #0d241a6b,0 1px 0 #fff inset;transform:translateY(22px) scale(.96);opacity:0;transition:opacity .35s ease,transform .55s cubic-bezier(.19,1,.22,1)}
#gwbEditorChoice.is-active .gwb-choice-stage{transform:translateY(0) scale(1);opacity:1}
#gwbEditorChoice .gwb-choice-overline{display:block;text-align:center;letter-spacing:.20em;color:#709060;font-size:10px;font-weight:800}
#gwbEditorChoice .gwb-choice-title{margin:7px 38px 0;text-align:center;font-size:clamp(19px,3vw,27px);font-weight:800;letter-spacing:-.04em;color:#273d2b}
#gwbEditorChoice .gwb-choice-subtitle{margin:5px 15px 12px;text-align:center;font-size:12px;color:#758473}
#gwbEditorChoice .gwb-choice-close{all:unset;position:absolute;top:16px;right:16px;display:grid;place-items:center;width:31px;height:31px;border:1px solid #dfebd9;border-radius:50%;color:#647b5b;background:#fff;cursor:pointer;font:23px/1 system-ui}
#gwbEditorChoice .gwb-choice-close:hover,#gwbEditorChoice .gwb-choice-close:focus-visible{background:#eaf3e2;outline:2px solid #9fbd86;outline-offset:2px}
#gwbEditorChoice .gwb-choice-duo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:stretch;gap:18px;position:relative;margin-top:8px}
#gwbEditorChoice .gwb-choice-or{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;border:1px solid #dfead9;background:#fff;color:#8b9a85;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:700;box-shadow:0 2px 10px #173b1812;pointer-events:none}
#gwbEditorChoice .gwb-choice-card{appearance:none;cursor:pointer;position:relative;min-width:0;min-height:315px;padding:16px 17px 18px;border:1px solid #e2e7e2;border-radius:21px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;overflow:hidden;isolation:isolate;color:inherit;box-shadow:0 5px 23px #193a250b;transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease}
#gwbEditorChoice .gwb-choice-card::before{content:"";position:absolute;inset:0;z-index:-2;opacity:.88;background:radial-gradient(ellipse at 50% 33%,#ffece4 0%,#fff 68%);transition:opacity .25s}
#gwbEditorChoice .gwb-choice-card--angel::before{background:radial-gradient(ellipse at 50% 32%,#eff9ed 0%,#fff 68%)}
#gwbEditorChoice .gwb-choice-card:hover,#gwbEditorChoice .gwb-choice-card:focus-visible{outline:none;transform:translateY(-5px);border-color:#a0be83;box-shadow:0 13px 35px #25492226}
#gwbEditorChoice .gwb-choice-card:focus-visible{outline:3px solid #80b315;outline-offset:2px}
#gwbEditorChoice .gwb-choice-role{position:absolute;top:15px;left:16px;z-index:2;font-size:10px;font-weight:750;text-transform:uppercase;letter-spacing:.11em;color:#a56b60}
#gwbEditorChoice .gwb-choice-card--angel .gwb-choice-role{color:#669d59}
#gwbEditorChoice .gwb-choice-art{position:relative;width:min(230px,100%);height:195px;margin:0 auto 2px;display:flex;align-items:end;justify-content:center}
#gwbEditorChoice .gwb-choice-art svg{width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 10px 6px #40201c10)}
#gwbEditorChoice.is-active .gwb-choice-art--devil{animation:gwbDevilEntrance .72s cubic-bezier(.2,1,.28,1) both, gwbDevilFloat 3s ease-in-out .72s infinite}
#gwbEditorChoice.is-active .gwb-choice-art--angel{animation:gwbAngelEntrance .8s cubic-bezier(.16,1,.25,1) both, gwbAngelFloat 3.2s ease-in-out .8s infinite}
#gwbEditorChoice .gwb-choice-card:hover .gwb-choice-art svg{filter:drop-shadow(0 13px 9px #2435261a)}
#gwbEditorChoice .gwb-choice-name{font-size:20px;font-weight:850;letter-spacing:-.045em;color:#2a3936}
#gwbEditorChoice .gwb-choice-description{font-size:12px;color:#5d715c}
#gwbEditorChoice .gwb-choice-hint{font-size:11px;color:#91a288;margin-top:10px;display:inline-flex;align-items:center;gap:5px}
#gwbEditorChoice .gwb-choice-hint svg{width:13px;height:13px}
#gwbEditorChoice .gwb-spark{position:absolute;z-index:0;pointer-events:none;opacity:0;font-size:18px}
#gwbEditorChoice .gwb-spark--one{top:57px;left:15%;color:#ec9885}
#gwbEditorChoice .gwb-spark--two{top:80px;right:15%;color:#e6b07e}
#gwbEditorChoice .gwb-choice-card--angel .gwb-spark{color:#a4c487}
#gwbEditorChoice.is-active .gwb-spark--one{animation:gwbSparkIn 2.4s ease-in-out .55s infinite}
#gwbEditorChoice.is-active .gwb-spark--two{animation:gwbSparkIn 2.8s ease-in-out 1s infinite}
#gwbEditorChoice .gwb-choice-footnote{font-size:10px;line-height:1.45;text-align:center;color:#95a093;margin-top:15px}
@keyframes gwbDevilEntrance{0%{opacity:0;transform:translate(-85px,60px) rotate(-24deg) scale(.48)}63%{opacity:1;transform:translate(13px,-12px) rotate(9deg) scale(1.07)}100%{opacity:1;transform:translate(0,0) rotate(0) scale(1)}}
@keyframes gwbAngelEntrance{0%{opacity:0;transform:translate(90px,-88px) rotate(19deg) scale(.45)}65%{opacity:1;transform:translate(-10px,8px) rotate(-7deg) scale(1.07)}100%{opacity:1;transform:translate(0,0) rotate(0) scale(1)}}
@keyframes gwbDevilFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-7px) rotate(2deg)}}
@keyframes gwbAngelFloat{0%,100%{transform:translateY(0) rotate(1deg)}50%{transform:translateY(-10px) rotate(-1deg)}}
@keyframes gwbSparkIn{0%,100%{opacity:0;transform:translateY(8px) scale(.65) rotate(0)}45%{opacity:.85;transform:translateY(-6px) scale(1.13) rotate(15deg)}}
@media(max-width:580px){#gwbEditorChoice{padding:11px}#gwbEditorChoice .gwb-choice-stage{padding:19px 12px 16px;border-radius:19px;max-height:calc(100vh - 22px)}#gwbEditorChoice .gwb-choice-duo{gap:10px}#gwbEditorChoice .gwb-choice-card{min-height:253px;padding:10px 6px 12px;border-radius:16px}#gwbEditorChoice .gwb-choice-art{height:155px}#gwbEditorChoice .gwb-choice-name{font-size:16px}#gwbEditorChoice .gwb-choice-description{font-size:10px}#gwbEditorChoice .gwb-choice-role{font-size:9px;top:10px;left:10px}#gwbEditorChoice .gwb-choice-hint{font-size:9px;margin-top:5px}#gwbEditorChoice .gwb-choice-or{width:27px;height:27px;font-size:8px}#gwbEditorChoice .gwb-choice-title{margin:9px 34px 0;font-size:20px}}
@media(prefers-reduced-motion:reduce){#gwbEditorChoice .gwb-choice-stage{transition:none}#gwbEditorChoice.is-active .gwb-choice-art,#gwbEditorChoice.is-active .gwb-spark{animation:none;opacity:1}#gwbEditorChoice .gwb-choice-card{transition:none}}
`;

const devilSvg=String.raw`
<svg viewBox="0 0 240 210" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
<ellipse cx="119" cy="201" rx="65" ry="7" fill="#552522" opacity=".08"/>
<path d="M160 153c35-5 49 13 29 26-10 7-22 0-18-10" stroke="#b74440" stroke-width="8" fill="none" stroke-linecap="round"/>
<path d="m172 169 14 4-7 12z" fill="#b74440"/>
<path d="M84 139c-6 12-13 27-19 43-3 8 6 11 12 5l25-28M148 137l18 32c4 9 16 5 13-3l-10-35" fill="#ad3835" stroke="#902b31" stroke-width="4" stroke-linejoin="round"/>
<path d="M98 160l-6 29q-9 13-24 5l-1-8 17-30M140 159l12 29q16 10 29-3l-5-8-17-28" fill="#472b40"/>
<path d="M81 125q39-28 79 0l8 39q-47 27-94-3z" fill="#c84945" stroke="#9e3339" stroke-width="3"/>
<path d="M86 119q-15 10-24 32" stroke="#a43b36" stroke-width="13" fill="none" stroke-linecap="round"/>
<circle cx="61" cy="152" r="9" fill="#e57464"/>
<path d="M148 116q16-1 23 22" stroke="#a43b36" stroke-width="13" fill="none" stroke-linecap="round"/>
<circle cx="173" cy="139" r="9" fill="#e57464"/>
<path d="M63 69Q45 52 60 21q14 18 30 24M147 43q21-19 28-37 16 35-7 63" fill="#be3e3c" stroke="#8e2632" stroke-width="3"/>
<path d="M67 71Q66 25 121 28q57 0 57 63 0 54-60 67Q60 142 67 71" fill="#ec6e5e" stroke="#a63c39" stroke-width="3"/>
<ellipse cx="88" cy="96" rx="8" ry="12" fill="#fffaf0" transform="rotate(-10 88 96)"/>
<ellipse cx="147" cy="96" rx="8" ry="12" fill="#fffaf0" transform="rotate(10 147 96)"/>
<ellipse cx="91" cy="99" rx="3.5" ry="6" fill="#2c2935"/>
<ellipse cx="144" cy="99" rx="3.5" ry="6" fill="#2c2935"/>
<path d="M78 80q11-6 21 0M136 79q10-6 20 0" stroke="#7c3032" stroke-width="4" stroke-linecap="round" fill="none"/>
<ellipse cx="78" cy="119" rx="11" ry="7" fill="#f9a088" opacity=".7"/>
<ellipse cx="158" cy="119" rx="11" ry="7" fill="#f9a088" opacity=".7"/>
<path d="M96 121q23 24 46-1" stroke="#6a2730" stroke-width="4" stroke-linecap="round" fill="none"/>
<path d="m101 125 7 0-3 10z m30 1 7-3-5 11z" fill="#fff8ed"/>
<path d="m115 140 8 0-4 7z" fill="#f2b39b"/>
<path d="M57 150 43 105" stroke="#7f564f" stroke-width="6" stroke-linecap="round"/>
<path d="m42 105-6-16 8 3 7-13 3 17-7 3" fill="#e6ad6b" stroke="#a97843" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M55 146q7-4 13 7" stroke="#df8172" stroke-width="11" stroke-linecap="round"/>
</svg>`;
const angelSvg=String.raw`
<svg viewBox="0 0 240 210" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
<ellipse cx="120" cy="203" rx="69" ry="7" fill="#345d40" opacity=".08"/>
<path d="M84 109Q37 79 29 110q-4 24 26 32-38-3-28 24 12 23 65-8M155 109q47-30 55 1 4 24-26 32 38-3 28 24-12 23-65-8" fill="#edf6f7" stroke="#c6dfdb" stroke-width="4" stroke-linejoin="round"/>
<path d="M76 135q-15 16-35 13M165 135q19 12 35 10" stroke="#dae9e5" stroke-width="4" fill="none" stroke-linecap="round"/>
<ellipse cx="120" cy="26" rx="51" ry="13" fill="none" stroke="#e3ae43" stroke-width="7"/>
<ellipse cx="120" cy="25" rx="51" ry="13" fill="none" stroke="#fff0b7" stroke-width="2"/>
<path d="M88 142 80 190q39 24 82 0l-12-50" fill="#fdfefa" stroke="#d5e5e0" stroke-width="3"/>
<path d="M89 178q-12 16-15 15-7 11 10 12l24-8M144 197l19 8q18-1 8-13l-9-17" fill="#f4bb98" stroke="#d9987a" stroke-width="2"/>
<path d="M84 118q-20 2-24 30M153 118q24 2 27 31" stroke="#f8c39d" stroke-width="12" stroke-linecap="round" fill="none"/>
<circle cx="61" cy="149" r="8" fill="#f7c69e"/>
<circle cx="179" cy="151" r="8" fill="#f7c69e"/>
<path d="M69 71q-5-42 50-42 50 0 53 42l-10 65-77-3z" fill="#f1d788" stroke="#d7a95a" stroke-width="3"/>
<path d="M83 79q1-38 38-39t40 37v29q-8 37-41 42-42-11-40-47z" fill="#ffd4b3" stroke="#dba481" stroke-width="3"/>
<path d="M80 81q-2-43 41-46 40 0 43 42-10-12-14-20-23 23-70 24z" fill="#f5db95"/>
<path d="M99 100q10-9 18 0M135 100q9-9 18 0" stroke="#6d6556" stroke-width="3.5" stroke-linecap="round" fill="none"/>
<path d="M108 117q12 11 26 0" stroke="#a66b5e" stroke-width="3" fill="none" stroke-linecap="round"/>
<ellipse cx="94" cy="112" rx="10" ry="6" fill="#f4a99f" opacity=".55"/>
<ellipse cx="154" cy="112" rx="10" ry="6" fill="#f4a99f" opacity=".55"/>
<path d="M83 142q36-19 75 0l-3 33q-33 16-72 0z" fill="#fff" stroke="#d5e3dc" stroke-width="3"/>
<path d="M108 148q12 6 25 0" stroke="#f2d39b" stroke-width="3" fill="none"/>
<path d="M178 140 185 96" stroke="#d5b46a" stroke-width="5" stroke-linecap="round"/>
<path d="m185 88 4 7 9 2-8 5 0 9-6-5-8 4 2-9-7-6 9-1z" fill="#f4c65e" stroke="#daa94c" stroke-width="1.7"/>
</svg>`;

function arrow(){
  return '<svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function install(){
 const trigger=document.getElementById('editorOpenLogoEditor');
 if(!trigger)return;
 const style=document.createElement('style');style.id='gwbEditorChoiceStyle';style.textContent=css;document.head.append(style);
 const menu=document.createElement('div');menu.id='gwbEditorChoice';menu.hidden=true;
 menu.setAttribute('role','dialog');menu.setAttribute('aria-modal','true');menu.setAttribute('aria-label','Выберите редактор логотипа');
 const stage=document.createElement('section');stage.className='gwb-choice-stage';stage.setAttribute('aria-labelledby','gwbEditorChoiceTitle');
 stage.innerHTML='<span class="gwb-choice-overline">МАКЕТНАЯ • РЕДАКТОР ЛОГОТИПА</span>'+
  '<h2 class="gwb-choice-title" id="gwbEditorChoiceTitle">На чьей ты стороне?</h2>'+
  '<p class="gwb-choice-subtitle">Два редактора. Один и тот же логотип и поле нанесения.</p>';
 const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='gwb-choice-close';closeButton.setAttribute('aria-label','Закрыть выбор редактора');closeButton.textContent='×';
 stage.append(closeButton);
 const duo=document.createElement('div');duo.className='gwb-choice-duo';
 function option(name,role,summary,type,illustration,action){
   const b=document.createElement('button');
   b.type='button';b.className='gwb-choice-card gwb-choice-card--'+type;
   b.setAttribute('aria-label',name+' — '+summary);
   b.innerHTML='<span class="gwb-choice-role">'+role+'</span>'+
     '<span class="gwb-spark gwb-spark--one" aria-hidden="true">✦</span>'+
     '<span class="gwb-spark gwb-spark--two" aria-hidden="true">✧</span>'+
     '<span class="gwb-choice-art gwb-choice-art--'+type+'">'+illustration+'</span>'+
     '<strong class="gwb-choice-name">'+name+'</strong>'+
     '<span class="gwb-choice-description">'+summary+'</span>'+
     '<span class="gwb-choice-hint">Выбрать редактор '+arrow()+'</span>';
   b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();hide();action();});
   duo.append(b);return b;
 }
 const vector=option('VectorCraft','ЧЁРТИК','Аналог Adobe Illustrator','devil',devilSvg,()=>{
   if(typeof window.gwbVectorcraftHost?.open==='function')void window.gwbVectorcraftHost.open();
   else alert('VectorCraft ещё не загружен. Обновите редактор.');
 });
 const or=document.createElement('div');or.className='gwb-choice-or';or.textContent='ИЛИ';or.setAttribute('aria-hidden','true');duo.append(or);
 const trace=option('TraceDraw','АНГЕЛ','Аналог CorelDRAW','angel',angelSvg,()=>{
   if(typeof window.gwbTraceDrawHost?.open==='function')void window.gwbTraceDrawHost.open();
   else alert('Модуль TraceDraw не загрузился. VectorCraft доступен отдельно.');
 });
 stage.append(duo);
 const footnote=document.createElement('div');footnote.className='gwb-choice-footnote';
 footnote.textContent='Нарисованный логотип вернётся в исходное поле выбранного артикула.';
 stage.append(footnote);menu.append(stage);document.body.append(menu);
 let returnFocus=null;
 function hide(){
   if(menu.hidden)return;
   menu.classList.remove('is-active');menu.hidden=true;
   trigger.setAttribute('aria-expanded','false');
   if(returnFocus?.isConnected)try{returnFocus.focus({preventScroll:true})}catch{}
 }
 function show(){
   if(!menu.hidden)return;
   returnFocus=document.activeElement;
   menu.hidden=false;
   // Restart the short intro whenever the chooser is reopened.
   menu.classList.remove('is-active');void menu.offsetWidth;
   menu.classList.add('is-active');
   trigger.setAttribute('aria-expanded','true');
   vector.focus({preventScroll:true});
 }
 trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
 trigger.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();menu.hidden?show():hide()},true);
 closeButton.addEventListener('click',hide);
 menu.addEventListener('pointerdown',event=>{if(event.target===menu)hide()});
 document.addEventListener('keydown',event=>{
   if(menu.hidden)return;
   if(event.key==='Escape'){event.preventDefault();hide();return}
   if(event.key==='Tab'){
     const controls=[closeButton,vector,trace];
     const i=controls.indexOf(document.activeElement);
     if(event.shiftKey&&i===0){event.preventDefault();controls.at(-1).focus()}
     else if(!event.shiftKey&&i===controls.length-1){event.preventDefault();controls[0].focus()}
   }
 },true);
 window.gwbEditorChooser={show,hide,vectorcraft:()=>vector.click(),tracedraw:()=>trace.click()};

 // Suppress only the obsolete success sentence. Other readiness messages,
 // errors and technical PrintCheck statuses remain untouched.
 const status=document.getElementById('status');
 if(status){
   const obsolete='Из VectorCraft возвращён только нарисованный логотип с его габаритами и положением.';
   const suppress=()=>{if(status.textContent.trim()===obsolete)status.textContent=''};
   const watcher=new MutationObserver(suppress);
   watcher.observe(status,{childList:true,characterData:true,subtree:true});
   suppress();
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();