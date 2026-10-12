// Mockup view transitions; photo canvases and artwork geometry untouched.
(()=>{"use strict";
 if(window.__gwbMockupMotionController)return;
 document.documentElement.classList.add("gwb-mockup-motion-ready");
 const stats={candidates:0,tools:0,notices:0};
 const glow=()=>{const panel=document.querySelector(".canvasPanel.wide");if(!panel)return;
  stats.tools++;panel.classList.remove("gwb-mockup-glow");void panel.offsetWidth;panel.classList.add("gwb-mockup-glow")};
 document.addEventListener("click",e=>{
  const option=e.target?.closest?.("#photoCandidates > *,#fieldCandidates > *,#profileLibrary > *");
  if(option){stats.candidates++;requestAnimationFrame(glow)}
  const tool=e.target?.closest?.("#editCylinder,#editField,#resetCylinder,#resetQuad,#selectField");
  if(tool&&!tool.disabled)requestAnimationFrame(glow);
 });
 document.addEventListener("change",e=>{
  if(["surface","blend","cylinderAxis","opacity","preserveFieldAspect"].includes(e.target?.id))requestAnimationFrame(glow);
 });
 const notice=document.getElementById("mappingOperationStatus");
 if(notice)new MutationObserver(changes=>{
  if(notice.hidden||!changes.some(c=>["hidden","childList","characterData"].includes(c.attributeName||c.type)))return;
  stats.notices++;
 }).observe(notice,{childList:true,characterData:true,attributes:true,attributeFilter:["hidden"],subtree:true});
 window.__gwbMockupMotionController={version:"1.0",stats,changesGeometry:false};
})();
