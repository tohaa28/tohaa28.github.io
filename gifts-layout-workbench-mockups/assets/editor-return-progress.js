/* Shared, stage-accurate transfer indicator for VectorCraft / TraceDraw.
   Percentages represent completed processing stages, never fabricated throughput. */
(function(root){
'use strict';
if(root.gwbEditorReturnProgress)return;
function make(overlay,editor){
 if(!overlay)throw Error('Editor overlay is missing');
 const shade=document.createElement('div');
 shade.className='gwb-return-progress';
 shade.setAttribute('role','dialog');
 shade.setAttribute('aria-modal','true');
 shade.setAttribute('aria-label','Передача макета в шаблон');
 shade.tabIndex=-1;
 Object.assign(shade.style,{position:'absolute',inset:'0',zIndex:'2147483640',
   display:'none',alignItems:'center',justifyContent:'center',
   background:'rgba(20,33,29,.88)',font:'13px system-ui,sans-serif',color:'#23342b'});
 const card=document.createElement('div');
 Object.assign(card.style,{width:'min(440px,calc(100% - 40px))',boxSizing:'border-box',
   padding:'24px',borderRadius:'12px',background:'#fff',boxShadow:'0 20px 70px rgba(0,0,0,.3)'});
 const heading=document.createElement('strong');
 heading.textContent='Передача макета в шаблон';
 heading.style.fontSize='17px';
 const amount=document.createElement('strong');
 amount.className='gwb-return-percent';
 amount.style.cssText='float:right;font-size:18px;font-variant-numeric:tabular-nums;color:#568f20';
 const progress=document.createElement('progress');
 progress.className='gwb-return-meter';progress.max=100;progress.value=0;
 progress.setAttribute('aria-label','Завершено процентов');
 progress.style.cssText='width:100%;height:13px;margin:16px 0 10px;accent-color:#80b521';
 const label=document.createElement('div');
 label.className='gwb-return-stage';
 label.setAttribute('role','status');label.setAttribute('aria-live','polite');
 label.style.cssText='min-height:36px;line-height:1.45;color:#475950';
 const hint=document.createElement('div');
 hint.textContent='Дождитесь окончания передачи. Окно и инструменты временно заблокированы.';
 hint.style.cssText='font-size:11px;color:#697a70;margin-top:10px';
 card.append(heading,amount,progress,label,hint);
 shade.append(card);
 overlay.style.position=overlay.style.position||'fixed';
 overlay.append(shade);
 let busy=false,done=0,oldFocus=null;
 const locked=new Map();
 let formerInert=false;
 const keydown=e=>{
   if(!busy)return;
   if(['Tab','Escape','Enter',' '].includes(e.key)){
     e.preventDefault();e.stopImmediatePropagation();
     shade.focus({preventScroll:true});
   }
 };
 function set(percent,stage){
   if(!busy)return;
   const value=Math.max(done,Math.min(99,Math.round(Number(percent)||0)));
   done=value;progress.value=value;amount.textContent=value+'%';
   if(stage)label.textContent=stage;
 }
 function start(stage){
   if(busy)return false;
   busy=true;done=0;oldFocus=document.activeElement;
   locked.clear();
   for(const button of overlay.querySelectorAll('button,input,select,textarea')){
     locked.set(button,button.disabled);
     button.disabled=true;
   }
   if(editor){
     formerInert=editor.inert;
     editor.inert=true;editor.style.pointerEvents='none';
   }
   shade.style.display='flex';
   progress.value=0;amount.textContent='0%';
   label.textContent=stage||'Подготовка макета…';
   shade.focus({preventScroll:true});
   document.addEventListener('keydown',keydown,true);
   return true;
 }
 function stop(success=false){
   if(!busy)return;
   if(success){done=100;progress.value=100;amount.textContent='100%';label.textContent='Макет полностью передан в выбранное поле.'}
   busy=false;
   document.removeEventListener('keydown',keydown,true);
   if(editor){editor.inert=formerInert;editor.style.pointerEvents=''}
   for(const [node,disabled] of locked)if(node.isConnected)node.disabled=disabled;
   locked.clear();
   shade.style.display='none';
   if(!success&&oldFocus?.isConnected)try{oldFocus.focus({preventScroll:true})}catch{}
   oldFocus=null;
 }
 function error(){stop(false)}
 function complete(){stop(true)}
 function destroy(){stop();shade.remove()}
 return {start,set,complete,error,destroy,get busy(){return busy},get value(){return done}};
}
root.gwbEditorReturnProgress={make};
})(window);
