/**
 * Local test-orders overlay: launched by explicit bookmark on
 * http://psk.testgifts.local/devorders. Only same-origin GET of artwork.
 * All reports and expert labels remain in this page until local download.
 */
import {LOCAL_ORDERS,isAllowedTestOrderPage,discoverOrderRows,
  inspectSameOriginArtwork,diagnoseTestOrderTable} from './row-scanner.mjs';
import {makeLocalExpertDataset} from './local-training-zip.mjs';
const ID='vision-local-order-overlay',STYLE_ID='vision-local-order-style';
const CSS=[
 '#vision-local-order-overlay{position:fixed!important;top:12px!important;right:12px!important;z-index:2147483640!important;width:min(390px,calc(100vw - 24px))!important;max-height:76vh!important;overflow:auto!important;background:#24383c!important;border:1px solid #5c777a!important;border-radius:9px!important;box-shadow:0 8px 35px #101b22a8!important;color:#eef5f2!important;padding:15px!important;text-align:left!important;font:13px/1.45 system-ui,sans-serif!important}',
 '#vision-local-order-overlay *{box-sizing:border-box!important;font:inherit!important}',
 '#vision-local-order-overlay h2{font-size:17px!important;margin:0 0 5px!important;color:white!important}',
 '#vision-local-order-overlay p{margin:6px 0 9px!important;color:#cbd8d4!important}',
 '#vision-local-order-overlay .vlo-actions{display:flex!important;flex-wrap:wrap!important;gap:7px!important;margin:10px 0!important}',
 '#vision-local-order-overlay button{border-radius:5px!important;border:1px solid #839b99!important;background:#e9efec!important;color:#263c41!important;padding:6px 9px!important;cursor:pointer!important}',
 '#vision-local-order-overlay button:disabled{opacity:.5!important;cursor:not-allowed!important}',
 '#vision-local-order-overlay .vlo-start{background:#8fb83f!important;border-color:#8fb83f!important;font-weight:700!important}',
 '#vision-local-order-overlay .vlo-note{font-size:12px!important;line-height:1.4!important}',
 '#vision-local-order-overlay .vlo-stats{white-space:pre-line!important;margin:8px 0!important;color:#cbe3d6!important}',
 '.vision-order-result-cell{min-width:210px!important;font:12px/1.5 system-ui,sans-serif!important;white-space:normal!important;color:#2f4348!important;padding:6px!important;vertical-align:middle!important}',
 '.vision-order-result-cell .vlo-label{font-weight:700!important;color:#36515a!important}',
 '.vision-order-result-cell .vlo-detail{display:block!important;white-space:normal!important;color:#6b777a!important}',
 '.vision-order-result-cell button,.vision-order-result-cell select{font:12px system-ui,sans-serif!important;margin:3px 4px 3px 0!important;border:1px solid #a4b6b5!important;border-radius:4px!important;background:#f5f8f6!important;color:#345058!important;padding:3px 5px!important;cursor:pointer!important;max-width:160px!important}',
 '.vision-order-result-cell [data-vlo-grade]{display:block!important}'
].join('\n');
const node=(tag,text,cls)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=text;
 return el;
};
const safeNumber=n=>Number.isFinite(n)?n.toFixed(3)+' мм':'не измерено';
function summarize(res){
 if(res.status!=='RESEARCH_ONLY')
   return (res.type||'файл').toUpperCase()+': ручная проверка — '+
     String(res.reason||'не определено').slice(0,80);
 if(res.type==='svg')
   return 'SVG: '+res.detected_regions+' мест; линия '+safeNumber(res.min_line_document_mm)+
     ', пробел '+safeNumber(res.min_gap_document_mm)+' (не подтвержден масштаб заказа)';
 return 'Растр: '+res.detected_regions+
   ' кандидатов (синтетический MLP; масштаб неизвестен)';
}
const makeButton=(text,fn)=>{
 const b=node('button',text);b.type='button';b.addEventListener('click',fn);return b;
};
export function initLocalOrdersOverlay(){
 if(!isAllowedTestOrderPage()){
   alert('Vision Check: запуск только на http://psk.testgifts.local/devorders');
   return false;
 }
 const prior=window.__visionLocalOrderOverlay;
 if(prior?.close){prior.close();return true}
 document.getElementById(ID)?.remove();
 document.getElementById(STYLE_ID)?.remove();
 const style=node('style');style.id=STYLE_ID;style.textContent=CSS;document.head.append(style);
 const panel=node('section');panel.id=ID;
 panel.setAttribute('aria-label','Vision Check — таблица тестовых заказов');
 const title=node('h2','Vision Check · тестовые заказы');
 const description=node('p',
   'Только локальная сеть. Ссылки на макеты загружаются в память браузера после вашего нажатия; файлы не отправляются на GitHub.');
 const actions=node('div',undefined,'vlo-actions');
 const stats=node('div','Подготовка поиска строк…','vlo-stats');
 stats.setAttribute('role','status');
 const warning=node('p','Это исследовательский анализ, не допуск к печати. Нет найденных мест ≠ макет годен. PDF и сложные векторы: MANUAL. Локальный ZIP содержит исходные тестовые файлы — не публикуйте его.','vlo-note');
 let rows=[],busy=false,closed=false,fileBudget=LOCAL_ORDERS.maxBatchFiles;
 function close(){
   closed=true;panel.remove();style.remove();
   document.querySelectorAll('[data-vision-order-cell]').forEach(n=>n.remove());
   if(window.__visionLocalOrderOverlay?.close===close)
     delete window.__visionLocalOrderOverlay;
 }
 function localReport(){
   return {
     schema:'printcheck.vision.local-order-feedback.v1',
     scope:'anonymous_local_test_only',created_at:new Date().toISOString(),
     host:LOCAL_ORDERS.host,source_artwork_included:false,
     order_urls_included:false,raw_artwork_bytes_included:false,
     production_approved:false,real_world_accuracy_verified:false,
     rows:rows.map(r=>({
       row_index:r.row_index,discovered_links:r.anchors.length,
       same_origin_files:r.files.length,
       excluded_links:r.local_only_excluded,
       expert_label:r.grade?.value||'unreviewed',
       artifacts:(r.results||[]).map((result,i)=>({
         file_index:i+1,type:result.type,status:result.status,
         reason:result.reason||null,detected_regions:result.detected_regions??null,
         source_shape_count:result.source_shape_count??null,
         min_line_document_mm:Number.isFinite(result.min_line_document_mm)?
           result.min_line_document_mm:null,
         min_gap_document_mm:Number.isFinite(result.min_gap_document_mm)?
           result.min_gap_document_mm:null,
         production_approved:false
       }))
     }))
   };
 }
 function saveReport(){
   const u=URL.createObjectURL(new Blob([JSON.stringify(localReport(),null,2)+'\n'],{type:'application/json'}));
   const a=node('a');a.href=u;a.download='vision-local-test-order-review.json';
   a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
 }
 const refreshBtn=makeButton('Найти строки',refresh);
 const scanBtn=makeButton('Проверить макеты',()=>scanAll());
 scanBtn.className='vlo-start';
 const exportBtn=makeButton('Отчёт JSON',saveReport);
 const diagnosticBtn=makeButton('Диагностика таблицы',()=>{
   const report=diagnoseTestOrderTable(document);
   const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],
     {type:'application/json'}));
   const a=node('a');a.href=url;a.download='vision-local-table-diagnostic.json';
   a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 const bundleBtn=makeButton('Локальные примеры ZIP',async()=>{
   if(busy||closed)return;
   if(!window.confirm('Скачать локальный ZIP с ОРИГИНАЛАМИ тестовых макетов из выбранных строк? Файлы могут содержать конфиденциальные данные. Не загружайте ZIP в публичный GitHub.'))return;
   busy=true;bundleBtn.disabled=true;
   refreshBtn.disabled=scanBtn.disabled=true;
   stats.textContent='Локальное скачивание отмеченных технологом тестовых файлов…';
   try{
     const exported=await makeLocalExpertDataset(rows);
     if(closed)return;
     if(exported.status!=='LOCAL_ZIP_READY'){
       renderStats('ZIP не сформирован: '+String(exported.reason).slice(0,90)+
         '. Поставьте экспертную метку хотя бы одной строке.');
       return;
     }
     const u=URL.createObjectURL(exported.zip),a=node('a');
     a.href=u;a.download='vision-local-test-labeled-samples.zip';
     a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);
     renderStats('Локально сохранено '+exported.sample_count+
       ' тестовых примеров. Нужны экспертные ROI и независимая проверка перед обучением.');
   }catch{
     if(!closed)renderStats('Ошибка локального ZIP. Данные наружу не передавались.');
   }finally{
     busy=false;bundleBtn.disabled=false;refreshBtn.disabled=false;
     scanBtn.disabled=rows.length===0;
   }
 });
 actions.append(refreshBtn,scanBtn,exportBtn,diagnosticBtn,bundleBtn,
   makeButton('Закрыть',close));
 panel.append(title,description,actions,stats,warning);
 document.body.append(panel);
 window.__visionLocalOrderOverlay={close,refresh,version:'C3B.3.O'};
 function renderStats(msg){
   const discovered=rows.reduce((n,r)=>n+r.anchors.length,0);
   const local=rows.reduce((n,r)=>n+r.files.length,0);
   const completed=rows.reduce((n,r)=>n+(r.results?.length||0),0);
   stats.textContent='Строк: '+rows.length+' · ссылки: '+discovered+
     ' · файлы этого origin: '+local+' · проверено: '+completed+'\n'+
     (msg||'Нажмите «Проверить макеты».');
 }
 function refresh(){
   if(busy||closed)return;
   document.querySelectorAll('[data-vision-order-cell]').forEach(n=>n.remove());
   rows=discoverOrderRows(document);
   fileBudget=LOCAL_ORDERS.maxBatchFiles;
   for(const r of rows){
     const cell=node(r.element.tagName==='TR'?'td':'div',undefined,
       'vision-order-result-cell');
     cell.setAttribute('data-vision-order-cell','');
     const label=node('span','Vision: не проверено','vlo-label');
     const detail=node('span',
       r.anchors.length===0?'Ссылки на макеты не найдены':
       r.local_only_excluded>0?'Есть ссылки вне текущего origin':
       r.files.length+' файлов доступны для локальной проверки','vlo-detail');
     const trigger=makeButton('Проверить строку',()=>scanRow(r));
     const gradeLabel=node('label','Метка технолога: ');
     gradeLabel.setAttribute('data-vlo-grade','');
     const grade=node('select');
     for(const [value,text] of [
       ['unreviewed','Не размечено'],['confirmed_defect','Подтверждён дефект'],
       ['false_positive','Ложное срабатывание'],['missed_defect','Пропущен дефект'],
       ['expert_clear','Проверено вручную']
     ]){
       const option=node('option',text);option.value=value;grade.append(option);
     }
     gradeLabel.append(grade);r.grade=grade;
     cell.append(label,detail,trigger,gradeLabel);
     r.element.append(cell);
     r.label=label;r.detail=detail;r.button=trigger;
   }
   scanBtn.disabled=rows.length===0;
   renderStats(rows.length?'Загрузка начнётся только по нажатию пользователя.':
     'Строки не распознаны. Требуется адаптер к DOM тестовой таблицы; файловые запросы не выполнялись.');
 }
 async function scanRowContents(r){
   r.button.disabled=true;r.label.textContent='Vision: загрузка и анализ…';
   r.results=[];
   if(!r.anchors.length){
     r.label.textContent='Vision: макеты не найдены';
     r.detail.textContent='Нет распознанных ссылок на макеты';
     r.button.disabled=false;return;
   }
   if(!r.files.length){
     r.label.textContent='Vision: ручная проверка';
     r.detail.textContent='Ссылки вне этого origin; автоматическая загрузка запрещена';
     r.button.disabled=false;return;
   }
   let manual=0,research=0,desc=[];
   for(const a of r.files){
     if(closed)break;
     if(fileBudget<=0){
       manual++;desc.push('Лимит сеанса — остальные не проверены');break;
     }
     fileBudget--;
     const result=await inspectSameOriginArtwork(a);
     if(closed)break;
     r.results.push(result);desc.push(summarize(result));
     if(result.status==='MANUAL')manual++;else research++;
   }
   if(closed)return;
   if(r.limited||r.local_only_excluded)manual++;
   r.label.textContent=manual?'Vision: '+manual+' требуют ручной проверки':
     'Vision: '+research+' исследованы (не допуск)';
   r.detail.textContent=desc.join(' | ').slice(0,600)+
     (r.limited?' · часть файлов пропущена по лимиту':'');
   r.button.disabled=false;
   renderStats('Результаты требуют подтверждения технологом.');
 }
 async function scanRow(r){
   if(busy||closed)return;
   busy=true;refreshBtn.disabled=scanBtn.disabled=true;
   try{await scanRowContents(r)}
   finally{busy=false;refreshBtn.disabled=false;scanBtn.disabled=rows.length===0}
 }
 async function scanAll(){
   if(busy||closed)return;
   busy=true;refreshBtn.disabled=scanBtn.disabled=true;
   try{
     for(const r of rows){
       if(closed)break;
       if(fileBudget<=0){
         renderStats('Лимит '+LOCAL_ORDERS.maxBatchFiles+
           ' файлов. Для нового сеанса нажмите «Найти строки».');break;
       }
       await scanRowContents(r);
       await new Promise(resolve=>setTimeout(resolve,0));
     }
   }finally{busy=false;refreshBtn.disabled=false;scanBtn.disabled=rows.length===0}
 }
 refresh();
 return true;
}
if(typeof window!=='undefined'&&typeof document!=='undefined')
 initLocalOrdersOverlay();
