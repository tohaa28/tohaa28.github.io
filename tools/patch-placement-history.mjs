// Isolated, fail-closed compiled Maketnaya Undo/Redo patch.
import fs from 'node:fs';
const file=new URL('../assets/index-BpU9kvz8.js',import.meta.url);
const anchor='function X(){gwbSyncLogoUploadHint();const c=y.template;';
const hooked='function X(){gwbHistoryObserve();gwbSyncLogoUploadHint();const c=y.template;';
const exitAnchor='gwbArtworkView?.refresh()}function co(';
const eventAnchor='v("artwork").onchange=c=>Ai(c,"art");';
const marker='window.gwbPlacementHistory={undo:gwbHistoryUndo,redo:gwbHistoryRedo';
const body=String.raw`
/* Placement history: one transaction per gesture, no duplicated artwork bytes. */
const gwbHistoryLimit=64;
let gwbHistoryScope=null,gwbHistoryFrames=[],gwbHistoryIndex=-1,gwbHistoryRestoring=false;
const gwbHistoryArtIds=new WeakMap();
let gwbHistoryNextArtId=0;
function gwbHistoryArtId(art){
 if(!art||typeof art!=='object')return '-';
 if(!gwbHistoryArtIds.has(art))gwbHistoryArtIds.set(art,++gwbHistoryNextArtId);
 return gwbHistoryArtIds.get(art);
}
function gwbHistoryScopeKey(){
 return [y.template,y.page,String(y.selectedEntry?.article||''),
   String(y.selectedEntry?.itemId||''),String(v("order")?.value||'')];
}
function gwbHistorySameScope(a,b){
 return !!a&&!!b&&a.length===b.length&&a.every((part,i)=>part===b[i]);
}
function gwbHistorySignature(){
 // Empty field selection is not an edit; content and geometry are.
 return y.placements.filter(p=>p.art&&p.placement).map(p=>{
   const q=p.placement;
   return [p.fieldIndex??'manual',p.page,gwbHistoryArtId(p.art),
     q.x,q.y,q.w,q.h,q.rotation||0,q.clipToField?1:0,
     p.field?.x,p.field?.y,p.field?.w,p.field?.h].join(':');
 }).join('|');
}
function gwbHistorySnapshot(){
 return {sig:gwbHistorySignature(),active:y.active,
   placements:y.placements.map(p=>({
     ...p,field:p.field?{...p.field}:p.field,
     placement:p.placement?{...p.placement}:p.placement
   }))};
}
function gwbHistoryControls(){
 const visible=!!y.template&&!!y.view&&!!y.field&&!v("fieldLogoTools").hidden;
 const previous=gwbHistoryFrames.length>0&&gwbHistoryIndex>0;
 const next=gwbHistoryFrames.length>0&&gwbHistoryIndex<gwbHistoryFrames.length-1;
 const undo=v("editorUndo"),redo=v("editorRedo");
 if(undo)undo.disabled=!visible||y.busy||!!y.drag||!previous;
 if(redo)redo.disabled=!visible||y.busy||!!y.drag||!next;
}
function gwbHistoryObserve(force=false){
 if(gwbHistoryRestoring)return;
 const scope=gwbHistoryScopeKey();
 if(!y.template){gwbHistoryScope=null;gwbHistoryFrames=[];gwbHistoryIndex=-1;gwbHistoryControls();return;}
 if(!gwbHistorySameScope(scope,gwbHistoryScope)){
   gwbHistoryScope=scope;
   gwbHistoryFrames=[gwbHistorySnapshot()];
   gwbHistoryIndex=0;gwbHistoryControls();return;
 }
 if(y.busy||y.drag||(!force&&/^(editorAngle|rotation|width|height)$/.test(document.activeElement?.id||''))){
   gwbHistoryControls();return;
 }
 const next=gwbHistorySnapshot(),current=gwbHistoryFrames[gwbHistoryIndex];
 if(next.sig!==current?.sig){
   gwbHistoryFrames=gwbHistoryFrames.slice(0,gwbHistoryIndex+1);
   gwbHistoryFrames.push(next);
   if(gwbHistoryFrames.length>gwbHistoryLimit)gwbHistoryFrames.shift();
   gwbHistoryIndex=gwbHistoryFrames.length-1;
 }else if(current){
   // Switching active fields without changing artwork is not undoable.
   current.active=next.active;
   current.placements=next.placements;
 }
 gwbHistoryControls();
}
function gwbHistoryRestore(frame){
 gwbHistoryRestoring=true;
 try{
   const previous=y.placements[y.active];
   const previousFieldKey=previous?[previous.fieldIndex,previous.page].join(':'):'none';
   y.placements=frame.placements.map(p=>({
     ...p,field:p.field?{...p.field}:p.field,
     placement:p.placement?{...p.placement}:p.placement
   }));
   const active=Number.isInteger(frame.active)&&frame.active>=0&&
     frame.active<y.placements.length?frame.active:-1;
   y.active=active;
   const selected=active<0?null:y.placements[active];
   y.field=selected?.field||null;
   y.art=selected?.art||null;
   y.placement=selected?.placement||null;
   y.drag=null;
   const selectedFieldKey=selected?[selected.fieldIndex,selected.page].join(':'):'none';
   const fieldChanged=selectedFieldKey!==previousFieldKey;
   if(fieldChanged&&y.field)gs(false);
   Qt();
   v("artworkName").textContent=y.art?.name||"Выбрать файл";
   _t();X();
   if(fieldChanged&&y.field)void zt();
   window.dispatchEvent(new CustomEvent("gwb-editor-readiness-changed"));
 }finally{gwbHistoryRestoring=false;}
 gwbHistoryControls();
}
function gwbHistoryMove(delta){
 if(y.busy||y.drag||!y.template)return false;
 gwbHistoryObserve(true);
 const dest=gwbHistoryIndex+delta;
 if(dest<0||dest>=gwbHistoryFrames.length)return false;
 gwbHistoryIndex=dest;
 gwbHistoryRestore(gwbHistoryFrames[dest]);
 Q(delta<0?"Последнее изменение логотипа отменено.":"Изменение логотипа повторено.");
 return true;
}
function gwbHistoryUndo(){return gwbHistoryMove(-1);}
function gwbHistoryRedo(){return gwbHistoryMove(1);}
window.gwbPlacementHistory={undo:gwbHistoryUndo,redo:gwbHistoryRedo,
 getState:()=>({index:gwbHistoryIndex,length:gwbHistoryFrames.length})};
v("editorUndo").addEventListener("click",gwbHistoryUndo);
v("editorRedo").addEventListener("click",gwbHistoryRedo);
// Native pointerup nulls y.drag before X(); intermediate drag redraws are ignored.
for(const id of ["editorAngle","rotation","width","height"]){
 const input=v(id);if(!input)continue;
 for(const eventName of ["change","focusout"]){
   input.addEventListener(eventName,()=>queueMicrotask(()=>gwbHistoryObserve(true)));
 }
}
document.addEventListener("keydown",event=>{
 if(!(event.ctrlKey||event.metaKey)||event.altKey||event.isComposing||event.repeat)return;
 const tag=document.activeElement?.tagName?.toLowerCase()||"";
 if(["input","textarea","select"].includes(tag)||document.activeElement?.isContentEditable)return;
 if(v("fieldLogoTools").hidden||!y.template||y.busy)return;
 if(document.getElementById("gwbVectorcraftHost")||
    document.getElementById("gwbTraceDrawHost")||
    document.getElementById("gwbVeDialog"))return;
 const key=event.key.toLowerCase();
 const delta=key==="z"?(event.shiftKey?1:-1):key==="y"?1:0;
 if(!delta)return;
 if(gwbHistoryMove(delta))event.preventDefault();
},true);
`;
export function applyPlacementHistory(){
 let source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 if(source.includes(marker)){
   if(source.split(hooked).length!==2)throw Error('Placement history exists but render hook is absent/duplicated');
   return;
 }
 if(source.split(anchor).length!==2||source.split(eventAnchor).length!==2||source.split(exitAnchor).length!==2)
   throw Error('Unknown Maketnaya compiled editor version. Refusing history injection.');
 if(!source.includes('window.gwbGetActiveLogoForEditor=function()'))
   throw Error('Placement history needs the verified logo editor bridge.');
 source=source.replace(anchor,body+'\n'+hooked);
 source=source.replace(exitAnchor,'gwbArtworkView?.refresh();gwbHistoryControls()}function co(');
 // Native event handlers are installed before the first placement UI redraw.
 fs.writeFileSync(file,source);
}
