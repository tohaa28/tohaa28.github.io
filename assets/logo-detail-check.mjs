import {renderArtworkPreview} from './logo-artwork-view.mjs?v=20261001-1';
import {scanPlan} from './logo-detail-engine.mjs?v=20261006-11';
const DELAY=800,labels={positive:'Тонкий печатный элемент',negative:'Узкий пробел / выворотка',isolated:'Мелкий отдельный элемент'};
let api=null,timer=0,worker=null,renderTask=null,job=0,holding=false,idle=0,busy=false,watchdog=0,lastAction=0,runs=0,cancellations=0;
let enabled=true,mode='auto',threshold=0,show=true,selected=-1,currentKey='',lastPanelKey='',lastDrawKey='';
const ids=new WeakMap(),placementKeys=new WeakMap(),entries=new Map();let sequence=0;
const colors={positive:'#ffd600',negative:'#00e5ff',isolated:'#ff8000'};
const source='https://gifts.ru/maket-problems/10002362';
function sourcePalette(art){
 const facts=art?.preflight||{},direct=Array.isArray(facts.vectorColors?.rgb)?facts.vectorColors.rgb.filter(c=>Array.isArray(c)&&c.length>=3).map(c=>c.slice(0,3).map(Number)):[];
 if(direct.length)return direct;
 const colors=[];
 for(const c of facts.originalColors||[]){
  if(c?.model==="RGB"&&Array.isArray(c.values)&&c.values.length===3)colors.push(c.values.map(v=>Math.round(Number(v)*255)));
  else if(c?.model==="Gray"&&Array.isArray(c.values)&&c.values.length===1){const g=Math.round(Number(c.values[0])*255);colors.push([g,g,g]);}
  else if(c?.model==="CMYK"&&Array.isArray(c.values)&&c.values.length===4){
   const [C,M,Y,K]=c.values.map(Number);colors.push([255*(1-Math.min(1,C+K)),255*(1-Math.min(1,M+K)),255*(1-Math.min(1,Y+K))].map(Math.round));
  }
 }
 return colors.slice(0,32);
}
function entryFor(art,placement,field,rule){
 if(!ids.has(art))ids.set(art,++sequence);const scale=field?.templateScale||1,wMm=placement.w*scale,hMm=placement.h*scale;
 const key=JSON.stringify([ids.get(art),wMm,hMm,rule.positive,rule.negative,rule.isolated,mode,threshold]);placementKeys.set(placement,key);
 let entry=entries.get(key);if(!entry){entry={key,art,wMm,hMm,rule:{positive:rule.positive,negative:rule.negative,isolated:rule.isolated},mode,threshold,palette:sourcePalette(art),sourceWidth:art?.pixelW||0,sourceHeight:art?.pixelH||0,state:'pending'};entries.set(key,entry);}
 return entry;
}
const compactNames={positive:'линии',negative:'пробелы',isolated:'отдельные'};
const mm=v=>Number(v).toFixed(2).replace(/0+$/,'').replace(/[.,]$/,'').replace('.',',');
export function compactDetailSummary(result,rule={}){
 const boxes=Array.isArray(result?.boxes)?result.boxes:[],counts=result?.counts||{};
 if(!boxes.length)return 'PrintCheck · мелкие элементы: не найдены.';
 const parts=[];
 for(const kind of ['positive','negative','isolated']){
  const count=Number(counts[kind]||boxes.filter(b=>b.kind===kind).length);
  if(!count)continue;
  const own=boxes.filter(b=>b.kind===kind&&Number.isFinite(Number(b.minWidthMm))),minimum=own.length?Math.min(...own.map(b=>Number(b.minWidthMm))):null,required=Number(rule[kind]||own[0]?.threshold||0);
  let text=`${compactNames[kind]} ${count}`;
  if(minimum!==null&&required>0)text+=` (${mm(minimum)}<${mm(required)} мм)`;
  parts.push(text);
 }
 return `PrintCheck · мелкие элементы: ${boxes.length}${parts.length?' — '+parts.join(', '):''}.`;
}
export function detailFindings({art,placement,field,rule}){
 if(!rule||rule.settings?.enabled===false||rule.settings?.checks.details===false||![rule.positive,rule.negative,rule.isolated].some(v=>v>0)){placementKeys.delete(placement);return [];}const e=entryFor(art,placement,field,rule);schedule();
 if(!enabled)return [{id:'detail-scan',status:'manual',text:'Поиск мелких элементов выключен.',source}];
 if(e.state!=='done')return [{id:'detail-scan',status:'manual',text:e.state==='error'?e.error:'поиск мелких элементов...',displayText:e.state==='error'?e.error:'поиск мелких элементов...',overlay:true,transient:e.state!=='error',source}];
 const r=e.result,found=r.boxes.length>0,precision=r.lowResolution?' Разрешение исходного растра ограничивает точность проверки.':'';return [{id:'detail-scan',status:found?'manual':'ok',text:`PrintCheck: найдено областей для проверки — ${r.boxes.length}. Шаг анализа ${r.step.toFixed(4)} мм.${precision} ${found?'Это кандидаты, а не доказанный брак.':'Кандидаты на мелкие элементы не найдены.'}`,displayText:compactDetailSummary(r,e.rule),overlay:true,source,evidence:r.algorithm,candidateCount:r.boxes.length,counts:r.counts,step:r.step,maskMode:r.autoMask?.kind||'auto',maskThreshold:r.autoMask?.threshold??null},...r.notes.map(text=>({id:'detail-coverage',status:'manual',text,source}))];
}
function validEntries(){if(!api)return [];return [...new Set(api.getState().placements.filter(p=>p.art&&p.placement).map(p=>entries.get(placementKeys.get(p.placement))).filter(Boolean))];}
function cancel(){clearTimeout(watchdog);clearTimeout(timer);timer=0;if(idle){(window.cancelIdleCallback||clearTimeout)(idle);idle=0;}job++;if(worker){worker.terminate();worker=null;cancellations++;}renderTask?.cancel();renderTask=null;busy=false;for(const e of entries.values())if(e.state==='running')e.state='pending';}
function activity(){lastAction=Date.now();cancel();schedule();}
function schedule(){if(!api||!enabled||holding||busy||timer||idle||!validEntries().some(e=>e.state==='pending'))return;
 timer=setTimeout(()=>{timer=0;const run=()=>{idle=0;if(!holding&&enabled)start();};idle=window.requestIdleCallback?requestIdleCallback(run,{timeout:1500}):setTimeout(run,0);},Math.max(0,DELAY-(Date.now()-lastAction)));}
async function raster(entry,plan,token){
 const canvas=document.createElement('canvas');canvas.width=plan.width;canvas.height=plan.height;const ctx=canvas.getContext('2d',{willReadFrequently:true}),art=entry.art;
 if(art.pdfPage){const view=art.pdfPage.getViewport({scale:1});renderTask=art.pdfPage.render({canvasContext:ctx,viewport:view,transform:[plan.width/view.width,0,0,plan.height/view.height,0,0],background:'rgba(0,0,0,0)'});await renderTask.promise;renderTask=null;}
 else ctx.drawImage(art.image,0,0,plan.width,plan.height);
 if(token!==job)throw Error('cancelled');const data=ctx.getImageData(0,0,plan.width,plan.height).data;canvas.width=canvas.height=1;return data;
}
async function start(){
 const e=validEntries().find(e=>e.state==='pending');if(!e)return;const token=++job;busy=true;e.state='running';api.refresh();
 const plan=scanPlan(e.wMm,e.hMm,e.rule,{sourceWidth:e.sourceWidth,sourceHeight:e.sourceHeight});
 if(plan.skip){e.state='error';e.error=plan.skip;busy=false;api.redraw();schedule();return;}
 try{
  const data=await raster(e,plan,token);if(token!==job)return;
  const workerUrl=new URL('./logo-detail-worker.mjs?v=20261006-11',import.meta.url).href;
  const blobUrl=URL.createObjectURL(new Blob([`import ${JSON.stringify(workerUrl)};`],{type:'application/javascript'}));
  try{worker=new Worker(blobUrl,{type:'module'});}finally{URL.revokeObjectURL(blobUrl);}
  runs++;watchdog=setTimeout(()=>complete(null,'Проверка заняла слишком много времени. Мелкие элементы не проверены.'),20000);
  function complete(result,error){clearTimeout(watchdog);if(token!==job)return;worker?.terminate();worker=null;busy=false;if(!validEntries().includes(e)){schedule();return;}
   if(error){e.state='error';e.error=error;}else{e.state='done';e.result=result;if(plan.lowResolution)e.result.notes.push('Недостаточно пикселей на минимальную деталь; мелкие дефекты могут быть пропущены.');
    if(!e.art.svg&&!e.art.pdfPage&&(e.art.pixelW<plan.width||e.art.pixelH<plan.height))e.result.notes.push('Разрешение исходного растра ниже разрешения анализа: увеличение не восстанавливает детали.');
   }api.redraw();schedule();
  }
  worker.onmessage=event=>{if(event.data.id===token)complete(event.data.result,event.data.error);};worker.onerror=event=>{event.preventDefault();complete(null,'Фоновая проверка недоступна: '+event.message);};
  worker.postMessage({id:token,rgba:data.buffer,width:plan.width,height:plan.height,wMm:e.wMm,hMm:e.hMm,rule:e.rule,mode:e.mode,threshold:e.threshold,palette:e.palette,lowResolution:plan.lowResolution,sourceLimited:plan.sourceLimited,samplesPerMinimum:plan.samplesPerMinimum},[data.buffer]);
 }catch(error){if(token!==job)return;busy=false;e.state='error';e.error='Мелкие элементы не проверены: '+String(error.message||error);api.redraw();schedule();}
}
export function installDetailCheck({canvas,getState,redraw}){
 const panel=document.createElement('details');panel.id='logoDetailCheck';panel.open=false;panel.className='logo-detail-check';
 panel.innerHTML='<summary>Мелкие элементы · PrintCheck</summary><label><input id="detailEnabled" type="checkbox" checked> Искать после паузы</label> <label><input id="detailShow" type="checkbox" checked> Показывать отметки</label><p id="detailStatus" role="status"></p><p class="help">Маска и фон определяются автоматически. Каждый кружок отмечает один найденный участок: жёлтые — тонкие элементы, голубые — реальные пробелы, оранжевые — только действительно отдельные маленькие объекты.</p><div id="detailList"></div><div id="detailPreview" style="width:320px;max-width:100%" hidden></div>';
 const separate=document.createElement('section');separate.id='detailPanel';separate.className='panel';separate.append(panel);document.getElementById('step4Box').closest('.panel').after(separate);
 const layer=document.createElement('canvas');layer.id='detailOverlay';layer.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3';canvas.parentElement.append(layer);
 const $=id=>panel.querySelector('#'+id);
 let cancelPreview=null;
 function preview(entry,box){cancelPreview?.();const c=$('detailPreview');c.hidden=false;cancelPreview=renderArtworkPreview(c,{art:entry.art,box,wMm:entry.wMm,hMm:entry.hMm,mode:entry.result?.autoMask?.previewMode||'dark',color:colors[box.kind]});}
 function refresh(){
  const state=getState();separate.hidden=!state.art;const e=entries.get(placementKeys.get(state.placement));const keys=new Set(validEntries().map(e=>e.key));
  for(const [key,value]of entries)if(!keys.has(key)&&entries.size>8)entries.delete(key);
  if(worker&&!validEntries().some(e=>e.state==='running'))cancel();
  if(currentKey!==e?.key){cancelPreview?.();cancelPreview=null;selected=-1;currentKey=e?.key||'';$('detailPreview').hidden=true;}
  $('detailStatus').textContent=!enabled?'Поиск выключен.':!e?(state.art?'Поиск отключён или пороги не заданы в настройках нанесения.':'Выберите логотип.'):e.state==='done'?`Найдено областей: ${e.result.boxes.length}. Шаг ${e.result.step.toFixed(4)} мм.`:e.state==='error'?e.error:'поиск мелких элементов...';
  const panelKey=JSON.stringify([e?.key,e?.state,enabled]);if(lastPanelKey!==panelKey){lastPanelKey=panelKey;$('detailList').replaceChildren();if(enabled&&e?.state==='done'){
   let offset=0;const more=document.createElement('button');more.type='button';more.textContent='Показать ещё';const appendPage=()=>{more.remove();const end=Math.min(offset+100,e.result.boxes.length),fragment=document.createDocumentFragment();for(;offset<end;offset++){const i=offset,b=e.result.boxes[i],button=document.createElement('button');button.type='button';button.textContent=`${i+1}. ${labels[b.kind]} · порог ${b.threshold} мм`;button.onclick=()=>{selected=i;preview(e,b);refresh();};fragment.append(button);}$('detailList').append(fragment);if(offset<e.result.boxes.length)$('detailList').append(more);};more.onclick=appendPage;appendPage();
   for(const note of e.result.notes){const p=document.createElement('p');p.textContent=note;$('detailList').append(p);}
  }}

  // Repaint only when screen geometry or cached results change. Keep circle strokes
  // in screen pixels: resampling a cached raster could erase subpixel outlines.
  const drawKey=JSON.stringify([enabled,show,canvas.width,canvas.height,canvas.clientWidth,state.page,state.view,state.template?.w,state.template?.h,state.placements.map(p=>[p.page,p.placement,placementKeys.get(p.placement),entries.get(placementKeys.get(p.placement))?.state])]);
  if(lastDrawKey!==drawKey){lastDrawKey=drawKey;
   if(layer.width!==canvas.width)layer.width=canvas.width;if(layer.height!==canvas.height)layer.height=canvas.height;const ctx=layer.getContext('2d');ctx.clearRect(0,0,layer.width,layer.height);
   if(enabled&&show&&state.template){const view=state.view||{x:0,y:0,w:state.template.w,h:state.template.h},sx=layer.width/view.w,sy=layer.height/view.h,ratio=canvas.width/Math.max(1,canvas.clientWidth);
    for(const p of state.placements){if(p.page!==state.page||!p.placement)continue;const entry=entries.get(placementKeys.get(p.placement));if(entry?.state!=='done')continue;const a=p.placement,angle=(a.rotation||0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),groups=new Map();
     for(const b of entry.result.boxes){const diameter=b.threshold/entry.wMm*a.w,stroke=Math.max(1.2*ratio/sx,Math.min(2.8*ratio/sx,diameter*.18)),radius=Math.max(1.5*ratio/sx,(diameter-stroke)/2),cx=(b.cx-.5)*a.w,cy=(b.cy-.5)*a.h;
      const x=(a.x+a.w/2-view.x+cx*cos-cy*sin)*sx,y=(a.y+a.h/2-view.y+cx*sin+cy*cos)*sy,r=(radius+stroke)*Math.max(sx,sy);if(x+r<0||y+r<0||x-r>layer.width||y-r>layer.height)continue;
      const key=b.kind+':'+stroke;let group=groups.get(key);if(!group){group={path:new Path2D(),stroke,color:colors[b.kind]};groups.set(key,group);}group.path.moveTo(cx+radius,cy);group.path.arc(cx,cy,radius,0,Math.PI*2);
     }
     ctx.save();ctx.scale(sx,sy);ctx.translate(a.x+a.w/2-view.x,a.y+a.h/2-view.y);ctx.rotate(angle);for(const group of groups.values()){ctx.lineWidth=group.stroke;ctx.strokeStyle=group.color;ctx.stroke(group.path);}ctx.restore();
    }
   }
  }
  window.gwbDetailCheck={enabled,mode:e?.result?.autoMask?.kind||'auto',threshold:e?.result?.autoMask?.threshold??null,holding,busy,runs,cancellations,selectedKey:e?.key||null,entries:validEntries().map(v=>({key:v.key,state:v.state,boxes:v.result?.boxes||[],notes:v.result?.notes||[],algorithm:v.result?.algorithm||'',suppressedTransitions:v.result?.suppressedTransitions||0,layers:v.result?.layers||0,step:v.result?.step||0,autoMask:v.result?.autoMask||null,lowResolution:!!v.result?.lowResolution,sourceLimited:!!v.result?.sourceLimited,samplesPerMinimum:v.result?.samplesPerMinimum||null,error:v.error}))};schedule();
 }
 api={getState,redraw,refresh};
 $('detailEnabled').onchange=event=>{enabled=event.target.checked;activity();lastPanelKey='';redraw();};$('detailShow').onchange=event=>{show=event.target.checked;refresh();};
 document.addEventListener('pointerdown',event=>{if(event.target.closest('#stage,#fieldLogoTools')){holding=true;activity();refresh();}},true);
 const release=()=>{if(holding){holding=false;activity();refresh();}};window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);window.addEventListener('blur',release);
 document.addEventListener('input',event=>{if(!panel.contains(event.target)){activity();}},true);
 document.addEventListener('keydown',event=>{if(event.target.closest('#stage,#fieldLogoTools')||event.key==='Escape')activity();},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){holding=true;cancel();}else{holding=false;activity();}});
 window.addEventListener('pagehide',()=>{cancelPreview?.();cancel();});lastAction=Date.now();refresh();return {refresh};
}

