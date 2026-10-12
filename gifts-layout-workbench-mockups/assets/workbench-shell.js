/* Studio shell: visible navigation and process map over the existing editor.
 * All actual operations are delegated to existing controls; no PDF or state rewrites.
 */
(()=>{"use strict";
 if(window.__gwbStudioShell)return;
 const $=id=>document.getElementById(id);
 const nav=document.createElement("nav");
 nav.className="gwb-shell-tabs";nav.setAttribute("aria-label","Рабочие разделы Макетной");
 const entries=[["orders","Заказы"],["editor","Макет"],["mockups","Мокапы"]];
 for(const [id,label] of entries){
   const btn=document.createElement("button");
   btn.type="button";btn.className="gwb-shell-tab";btn.dataset.view=id;
   btn.textContent=label;nav.append(btn);
 }
 const top=document.querySelector(".app > .site-header .topbar");
 const brand=top?.querySelector(".brand");
 if(top&&brand)brand.insertAdjacentElement("afterend",nav);
 const session=document.createElement("span");session.className="gwb-shell-session";
 session.textContent="WORKSPACE";session.setAttribute("aria-hidden","true");
 if(top)top.insertBefore(session,$("accountButton"));
 const intro=document.createElement("div");intro.className="gwb-shell-intro";
 intro.innerHTML='<div><small>GIFTS.RU / PRODUCTION STUDIO</small><strong>От заказа до готового макета.</strong><span>Выберите изделие — всё остальное в одном рабочем пространстве.</span></div><div class="gwb-shell-intro-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke-width="1.7"><rect x="9" y="13" width="25" height="26" rx="3"/><path d="M15 8H39V33M14 31L21 23L27 28L34 19"/><circle cx="17" cy="19" r="2"/></svg></div>';
 const browser=$("orderBrowser");
 if(browser)browser.insertAdjacentElement("afterbegin",intro);
 const steps=[["01","Артикул"],["02","Поле"],["03","Логотип"],["04","Скачать"]];
 const track=document.createElement("div");track.className="gwb-step-track";
 track.setAttribute("role","group");track.setAttribute("aria-label","Этапы работы с макетом");
 for(let i=0;i<steps.length;i++){
  const item=document.createElement("div");item.className="gwb-step";item.dataset.step=String(i+1);
  item.innerHTML='<span class="gwb-step-index">'+steps[i][0]+'</span><span>'+steps[i][1]+'</span>';
  track.append(item);
 }
 const title=$("editorTitle");if(title)title.insertAdjacentElement("afterend",track);
 document.documentElement.classList.add("gwb-studio-v2");
 const stats={navigations:0,stepUpdates:0,layout:"studio-v2"};
 const isShown=node=>!!node&&!node.hidden&&!node.closest("[hidden]");
 let pending=false;
 const sync=()=>{
   pending=false;
   const page=$("mockupShell");
   const mockupOpen=isShown(page);
   const ordersOpen=!!document.querySelector(".app > main.gwb-orders-full")&&!mockupOpen;
   const active=mockupOpen?"mockups":ordersOpen?"orders":"editor";
   for(const tab of nav.querySelectorAll("button")){
     if(tab.dataset.view===active)tab.setAttribute("aria-current","page");
     else tab.removeAttribute("aria-current");
     if(tab.dataset.view==="editor")tab.disabled=active==="orders"&&!isShown($("resumeEditor"));
     if(tab.dataset.view==="mockups")tab.disabled=active!=="mockups"&&!isShown($("mockupModeButton"));
   }
   const editorVisible=isShown($("orderEditor"))&&!ordersOpen;
   const fieldSet=$("orderFieldChoice")?.value;
   const downloadVisible=isShown($("step4Box"));
   const current=!editorVisible?1:downloadVisible?4:fieldSet?3:2;
   for(const node of track.children){
     const idx=Number(node.dataset.step);
     if(idx===current)node.setAttribute("aria-current","step");else node.removeAttribute("aria-current");
     node.dataset.done=String(editorVisible&&idx<current);
   }
   track.dataset.currentStep=String(current);stats.stepUpdates++;
 };
 const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(sync)};
 nav.addEventListener("click",e=>{
  const button=e.target.closest("button[data-view]");if(!button||button.disabled)return;
  const v=button.dataset.view;stats.navigations++;
  if(v==="orders"){
    if(isShown($("mockupShell")))$("mockupBackButton")?.click();
    if(isShown($("orderEditor")))$("backToOrders")?.click();
  }else if(v==="editor"){
    // Return from the mockup overlay via the existing control instead of
    // relying on a hidden "resume editor" button.
    if(isShown($("mockupShell")))$("mockupBackButton")?.click();
    else if(isShown($("resumeEditor")))$("resumeEditor").click();
  }else if(v==="mockups"){
    const real=$("mockupModeButton");
    if(real&&!real.disabled&&!real.hidden)real.click();
  }
  schedule();
 });
 const ids=["orderEditor","orderBrowser","orderFieldChoiceBox","step4Box","editorStep3","mockupShell","mockupModeButton","resumeEditor","orderTemplatesBox"];
 for(const id of ids){const node=$(id);if(node)new MutationObserver(schedule).observe(node,{attributes:true,attributeFilter:["hidden","class"]})}
 const main=document.querySelector(".app > main");
 if(main)new MutationObserver(schedule).observe(main,{attributes:true,attributeFilter:["class"]});
 document.addEventListener("change",e=>{if(["orderFieldChoice","orderTemplates","fields"].includes(e.target?.id))schedule()},false);
 document.addEventListener("click",e=>{if(e.target?.closest?.(".basket-order,#orderTemplateList button,#orderTemplateList .article-choice,#simpleExport,#editorAddLogo,#backToOrders"))schedule()},false);
 const text=$("placementCount");
 if(text)new MutationObserver(schedule).observe(text,{characterData:true,childList:true,subtree:true});
 window.__gwbStudioShell={version:"2.0",stats,track,nav,sync,changesCanvas:false};
 sync();
})();
