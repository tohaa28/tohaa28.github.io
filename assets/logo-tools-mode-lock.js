/* Prevent editing logos while the full template or article picker is active.
   Keep field selection, template navigation and page controls available. */
(function(){
'use strict';
if(window.gwbLogoToolsModeLockInstalled)return;
window.gwbLogoToolsModeLockInstalled=true;
const IDS=[
'artwork','fit','center','width','height','lockRatio',
'rotateLeft','rotateRight','rotation','clipToField',
'simpleFit','simpleCenter','simpleFill','fillEmpty','removePlacement',
'editorAddLogo','editorOpenLogoEditor','editorUndo','editorRedo',
'editorFit','editorCenter','editorAngle','editorRotateLeft',
'editorRotateRight','editorClip','editorRemoveLogo'
];
const $=x=>document.getElementById(x);
function isFieldMode(){
 const editor=$('orderEditor'),step=$('editorStep3'),tools=$('fieldLogoTools'),zoom=$('zoomPage');
 return !!editor&&!editor.hidden&&!!step&&!step.hidden&&!!tools&&!tools.hidden&&
   !!zoom&&!zoom.hidden;
}
function sync(){
 const locked=!isFieldMode();
 document.body.classList.toggle('gwb-logo-selection-locked',locked);
 for(const id of IDS){
  const control=$(id);
  if(!control)continue;
  // Engine X() owns disabled flags for the placement; inert is an independent
  // hard gate that the engine cannot accidentally re-enable.
  control.inert=locked;
  control.setAttribute('aria-disabled',locked?'true':String(!!control.disabled));
 }
}
const style=document.createElement('style');
style.textContent='.gwb-logo-selection-locked #fieldLogoTools,.gwb-logo-selection-locked #transformControls{opacity:.45}'+
'.gwb-logo-selection-locked #simpleFit,.gwb-logo-selection-locked #simpleCenter,'+
'.gwb-logo-selection-locked #simpleFill,.gwb-logo-selection-locked #fillEmpty,'+
'.gwb-logo-selection-locked #removePlacement,.gwb-logo-selection-locked #fit,'+
'.gwb-logo-selection-locked #center,.gwb-logo-selection-locked #artwork,'+
'.gwb-logo-selection-locked #width,.gwb-logo-selection-locked #height,'+
'.gwb-logo-selection-locked #lockRatio{opacity:.4;cursor:not-allowed}';
document.head.append(style);
const blockers=new Set(IDS);
function stopWhenLocked(e){
 if(isFieldMode())return;
 const node=e.target?.closest?.('[id]');
 if(node&&blockers.has(node.id)){e.preventDefault();e.stopImmediatePropagation()}
}
for(const name of ['click','change','input','pointerdown','keydown'])
 document.addEventListener(name,stopWhenLocked,true);
function init(){
 for(const id of ['editorStep3','fieldLogoTools','zoomPage','orderEditor']){
  const node=$(id);if(node)new MutationObserver(sync).observe(node,{
   attributes:true,attributeFilter:['hidden']
  });
 }
 const order=$('orderFieldChoice');if(order)order.addEventListener('change',()=>queueMicrotask(sync));
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
window.gwbLogoSelectionMode={isFieldMode,sync};
})();
