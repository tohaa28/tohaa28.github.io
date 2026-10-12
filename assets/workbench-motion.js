// Maketnaya transitions; visual only. No changes to application data or PDF canvas.
(()=>{"use strict";
 if(window.__gwbMotionController)return;
 document.documentElement.classList.add("gwb-motion-ready");
 const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)");
 const animations=new WeakMap(),stats={windows:0,articles:0,fields:0,tools:0,checks:0,downloads:0,mockups:0};
 const el=id=>document.getElementById(id);
 const visible=n=>n?.isConnected&&!n.closest("[hidden]")&&n.getClientRects().length>0;
 const play=(n,frames,duration=350)=>{
  if(!visible(n)||reduced?.matches||!n.animate)return;
  try{animations.get(n)?.cancel();const a=n.animate(frames,{duration,easing:"cubic-bezier(.22,.8,.22,1)"});
   animations.set(n,a);a.finished.catch(()=>{}).then(()=>{if(animations.get(n)===a)animations.delete(n)})}catch{}
 };
 const rise=(n,t=350)=>play(n,[{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],t);
 const activate=(n,cls)=>{if(!visible(n))return;n.classList.remove(cls);void n.offsetWidth;n.classList.add(cls)};
 const focusField=()=>{stats.fields++;activate(el("stageScroll"),"gwb-motion-field");activate(el("selectedFieldSize"),"gwb-motion-selected")};
 const onShow=n=>{
  if(!visible(n))return;
  stats.windows++;
  switch(n.id){
   case "orderEditor":rise(n.querySelector(".article-card"),450);rise(el("orderFieldChoiceBox"),380);break;
   case "orderBrowser":rise(el("basketOrders"),360);break;
   case "mockupShell":stats.mockups++;activate(n,"gwb-motion-enter");break;
   case "orderFieldChoiceBox":case "step4Box":case "fieldLogoTools":case "editorStep3":case "fieldsPanel":case "checksPanel":rise(n,300);break;
  }
 };
 for(const id of ["orderEditor","orderBrowser","mockupShell","orderFieldChoiceBox","step4Box","fieldLogoTools","editorStep3","fieldsPanel","checksPanel"]){
  const n=el(id);if(!n)continue;
  new MutationObserver(changes=>{if(changes.some(c=>c.attributeName==="hidden")){
   if(!n.hidden)requestAnimationFrame(()=>onShow(n));else if(id==="mockupShell")rise(el("orderEditor"),300);
  }}).observe(n,{attributes:true,attributeFilter:["hidden"]});
 }
 const choices=el("orderTemplateList");
 if(choices)new MutationObserver(records=>{
  for(const r of records)if(r.type==="attributes"&&r.target.classList.contains("selected")){
   stats.articles++;play(r.target,[{opacity:.78,transform:"translateY(5px)"},{opacity:1,transform:"none"}],250)
  }
 }).observe(choices,{subtree:true,attributes:true,attributeFilter:["class"]});
 document.addEventListener("change",event=>{
  if(["orderFieldChoice","fields"].includes(event.target?.id))requestAnimationFrame(focusField);
  if(event.target?.id==="orderTemplates")requestAnimationFrame(()=>{
   const n=choices?.querySelector(".selected");if(n){stats.articles++;rise(n,230)}
  });
 });
 document.addEventListener("click",event=>{
  const button=event.target?.closest?.("button");if(!button||button.disabled)return;
  if(["zoomPage","simpleDraw","drawField"].includes(button.id))requestAnimationFrame(focusField);
  if(["simpleExport","downloadLayoutMockup","export","saveProject","prepareOrderPdf"].includes(button.id)){
   stats.downloads++;activate(button,"gwb-motion-export");
  }
  if(button.closest("#fieldLogoTools,#transformControls,#simpleControls,.toolbar")){
   stats.tools++;play(button,[{filter:"brightness(1.15)"},{filter:"brightness(1)"}],180);
  }
 });
 let lastCheck=0;
 for(const id of ["simpleChecks","checks"]){const n=el(id);if(!n)continue;
  new MutationObserver(()=>{const now=Date.now();if(now-lastCheck<500||!visible(n))return;
   lastCheck=now;stats.checks++;activate(n,"gwb-motion-check")})
   .observe(n,{childList:true,characterData:true,subtree:true});
 }
 window.__gwbMotionController={version:"1.0",stats,changesGeometry:false,
  rollback:"backup/maketnaya-source-before-motion-system-2026-10-12"};
})();
