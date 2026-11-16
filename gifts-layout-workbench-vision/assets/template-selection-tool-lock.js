/* In template/field selection there is no target for artwork operations.
 * Lock both simple and advanced logo controls, retaining template picking. */
(function(root){
'use strict';
if(root.gwbTemplateToolLockInstalled)return;
root.gwbTemplateToolLockInstalled=true;
const ids=[
 'artwork','editorAddLogo','editorOpenLogoEditor','editorUndo','editorRedo',
 'editorFit','editorCenter','editorAngle','editorRotateLeft','editorRotateRight',
 'editorClip','editorRemoveLogo','rotateLeft','rotateRight','rotation',
 'clipToField','fit','center','width','height','lockRatio','simpleFit',
 'simpleCenter','simpleFill','fillEmpty','removePlacement'
];
function install(){
 const editor=document.getElementById('orderEditor');
 const stage=document.getElementById('editorStep3');
 const tools=document.getElementById('fieldLogoTools');
 const zoom=document.getElementById('zoomPage');
 if(!editor||!stage||!tools||!zoom)return;
 const controls=ids.map(id=>document.getElementById(id)).filter(Boolean);
 const former=new Map();
 let wasLocked=null,inside=false;
 function fieldActive(){
   // Native X() sets Step 3 hidden=!(y.view&&y.field). This is the
   // authoritative state for editing. The zoom/back button can be hidden
   // transiently during PDF loading and must not re-lock a valid field.
   return !editor.hidden&&!stage.hidden;
 }
 function sync(){
   if(inside)return;
   inside=true;
   try{
     const locked=!fieldActive();
     document.documentElement.classList.toggle('gwb-template-logo-locked',locked);
     for(const el of controls){
       if(locked){
         if(!former.has(el))former.set(el,el.disabled);
         if(!el.disabled)el.disabled=true;
         el.setAttribute('aria-disabled','true');
       }else{
         if(former.has(el)){
           el.disabled=former.get(el);
           former.delete(el);
         }
         // Native X() can toggle disabled between observer frames.
         // Never leave a stale ARIA-disabled flag on an editable field.
         if(el.hasAttribute('aria-disabled'))el.removeAttribute('aria-disabled');
       }
     }
     const becameEditable=wasLocked===true&&!locked;
     wasLocked=locked;
     if(becameEditable)
       queueMicrotask(()=>{try{root.gwbRefreshEditorState?.()}catch{}});
   }finally{inside=false}
 }
 const observer=new MutationObserver(sync);
 for(const el of [editor,stage,tools,zoom])
   observer.observe(el,{attributes:true,attributeFilter:['hidden']});
 for(const el of controls)
   observer.observe(el,{attributes:true,attributeFilter:['disabled']});
 // Defend keyboard shortcuts/clicks that bypass visible disabling.
 document.addEventListener('click',event=>{
   if(fieldActive())return;
   if(controls.some(el=>event.target===el||el.contains(event.target))){
     event.preventDefault();event.stopImmediatePropagation();
   }
 },true);
 document.addEventListener('change',event=>{
   if(fieldActive())return;
   if(controls.includes(event.target)){
     event.preventDefault();event.stopImmediatePropagation();
   }
 },true);
 sync();
 root.gwbTemplateToolLock={sync,fieldActive};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})(window);
