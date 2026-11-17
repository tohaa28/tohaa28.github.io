/**
 * Local test-orders overlay: launched by explicit bookmark on
 * http://psk.testgifts.local/devorders. Only same-origin GET of artwork.
 * All reports and expert labels remain in this page until local download.
 */
import {LOCAL_ORDERS,isAllowedTestOrderPage,discoverOrderRows,
  inspectSameOriginArtwork,inspectOrderArtworkBytes,
  diagnoseTestOrderTable} from './row-scanner.mjs';
import {rowOrderTarget,inspectOrderPageFromRow,fetchOrderResourceBytes,
  recheckOrderPopupReferences} from './order-page-discovery.mjs';
import {makeLocalExpertDataset,exportLocalDatasetParts} from './local-training-zip.mjs';
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
 '.vision-order-result-cell .vlo-files{margin:4px 0!important;max-width:320px!important}',
 '.vision-order-result-cell .vlo-filename{white-space:pre-wrap!important;overflow-wrap:anywhere!important;margin:3px 0!important}',
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
     String(res.reason||'не определено').slice(0,80)+
     (res.reference_state?' · '+res.reference_state:'');
 if(res.type==='svg')
   return 'SVG: '+res.detected_regions+' мест; линия '+safeNumber(res.min_line_document_mm)+
     ', пробел '+safeNumber(res.min_gap_document_mm)+' (не подтвержден масштаб заказа)';
 return 'Растр: '+res.detected_regions+
   ' кандидатов (синтетический MLP; масштаб неизвестен)';
}
const makeButton=(text,fn)=>{
 const b=node('button',text);b.type='button';
 b.addEventListener('click',event=>{
   // Some test order tables navigate on TR onclick. An overlay button
   // must never trigger the original row's handler or change the page.
   event.preventDefault();event.stopPropagation();fn(event);
 });
 return b;
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
 let rows=[],busy=false,closed=false,pauseRequested=false,nextRowIndex=0;
 function close(){
   closed=true;pauseRequested=true;panel.remove();style.remove();
   document.querySelectorAll('[data-vision-order-cell]').forEach(n=>n.remove());
   if(window.__visionLocalOrderOverlay?.close===close)
     delete window.__visionLocalOrderOverlay;
 }
 function localReport(){
   return {
     schema:'printcheck.vision.local-order-feedback.v1',
     scope:'anonymous_local_test_only',created_at:new Date().toISOString(),
     host:LOCAL_ORDERS.host,
     transport_kind:typeof globalThis.__visionLocalTrustedTransport==='function'?'mv3_background':'browser_fetch',
     source_artwork_included:false,
     order_urls_included:false,raw_artwork_bytes_included:false,
     production_approved:false,real_world_accuracy_verified:false,
     rows:rows.map(r=>({
       row_index:r.row_index,discovered_links:r.anchors.length,
       same_origin_files:r.files.length,
       order_card_discovered:r.hasOrderLink,
       analysis_complete:r.scanAttempted===true,
       pending_file_count:r.partial?
         Math.max(0,r.partial.candidates.length-r.partial.nextIndex):0,
       customer_uploaded_artworks:r.orderUploads?.length??null,
       constructor_template_count:r.orderTemplates??null,
       excluded_links:r.local_only_excluded,
       expert_label:r.grade?.value||'unreviewed',
       artifacts:(r.results||[]).map((result,i)=>({
         file_index:i+1,type:result.type,status:result.status,
         reason:result.reason||null,
         stage:result.stage||null,
         origin_relation:result.origin_relation||null,
         failure_class:result.failure_class||null,
         http_status:result.http_status??null,
         reference_state:result.reference_state||null,
         reference_recheck_failure_class:result.reference_recheck_failure_class||null,
         fetch_exception_family:result.fetch_exception_family||null,
         transport_error:result.transport_error||null,
         detected_regions:result.detected_regions??null,
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
 const scanBtn=makeButton('Проверить все заказы',()=>scanAll());
 const pauseBtn=makeButton('Остановить после файла',()=>{
   if(!busy||closed)return;
   pauseRequested=true;
   pauseBtn.disabled=true;
   renderStats('Остановка запрошена: текущий файл завершится, остальные останутся в очереди.');
 });
 pauseBtn.disabled=true;
 scanBtn.className='vlo-start';
 const exportBtn=makeButton('Отчёт JSON',saveReport);
 const diagnosticBtn=makeButton('Диагностика таблицы',()=>{
   const report=diagnoseTestOrderTable(document);
   const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],
     {type:'application/json'}));
   const a=node('a');a.href=url;a.download='vision-local-table-diagnostic.json';
   a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 const bundleBtn=makeButton('Локальные примеры ZIP — все',async()=>{
   if(busy||closed)return;
   if(!window.confirm('Скачать ВСЕ доступные оригиналы тестовых макетов в последовательные локальные ZIP-части? Имена и файлы конфиденциальны; браузер может запросить разрешение на несколько загрузок. В архивах нет подтверждённых ROI для обучения. НЕ загружайте их в публичный GitHub.'))return;
   busy=true;bundleBtn.disabled=true;
   refreshBtn.disabled=scanBtn.disabled=true;
   let saved=0,parts=0,unavailable=0;
   stats.textContent='Локальное последовательное чтение всех файлов. Каждый архив ограничен размером, а не общим количеством файлов.';
   try{
     for await(const part of exportLocalDatasetParts(rows,{
       onProgress:progress=>{
         if(!closed)stats.textContent='Локальное сохранение '+progress.processed+
           '/'+progress.total+' · записано '+progress.saved+
           ' · часть '+progress.part;
       }
     })){
       if(closed)break;
       if(part.status!=='LOCAL_ZIP_READY'){
         if(!saved)renderStats('ZIP не сформирован: '+String(part.reason).slice(0,90));
         continue;
       }
       const u=URL.createObjectURL(part.zip),a=node('a');
       a.href=u;a.download='vision-private-originals-part-'+
         String(part.part).padStart(4,'0')+'.zip';
       document.body.append(a);a.click();a.remove();
       setTimeout(()=>URL.revokeObjectURL(u),4000);
       saved+=part.sample_count;parts++;unavailable+=part.skipped_count;
       await new Promise(resolve=>setTimeout(resolve,180));
     }
     if(!closed&&saved)renderStats('Локально выгружено '+saved+
       ' исходных файлов в '+parts+' ZIP-частях. Не удалось выгрузить: '+
       unavailable+'. Браузер может запросить разрешение на многократное скачивание.'+
       ' Без экспертных ROI модель не дообучается.');
   }catch{
     if(!closed)renderStats('Сбой формирования ZIP. Уже созданные локальные части сохранены; данные наружу не передавались.');
   }finally{
     busy=false;bundleBtn.disabled=false;refreshBtn.disabled=false;
     updateBatchControls();
   }
 });
 actions.append(refreshBtn,scanBtn,pauseBtn,exportBtn,diagnosticBtn,bundleBtn,
   makeButton('Закрыть',close));
 panel.append(title,description,actions,stats,warning);
 document.body.append(panel);
 window.__visionLocalOrderOverlay={close,refresh,version:'C3B.3.R'};
 function renderStats(msg){
   const discovered=rows.reduce((n,r)=>n+r.anchors.length,0);
   const local=rows.reduce((n,r)=>
     n+(r.orderUploads?.length??r.files.length),0);
   const completed=rows.reduce((n,r)=>n+(r.results?.length||0),0);
   const scanned=rows.filter(r=>r.scanAttempted).length;
   const linked=rows.filter(r=>r.hasOrderLink).length;
   stats.textContent='Строк: '+rows.length+' · карточки: '+linked+
     ' · обработано строк: '+scanned+' · файлов/отказов: '+completed+
     ' · вложений найдено: '+local+' · очередь без лимита файлов\n'+
     'Транспорт: '+(typeof globalThis.__visionLocalTrustedTransport==='function'?
       'локальный MV3 (два тестовых хоста)':'обычный браузерный fetch; переход на другой хост может блокироваться')+'\n'+
     (msg||'Нажмите «Проверить макеты».');
 }
 function refresh(){
   if(busy||closed)return;
   document.querySelectorAll('[data-vision-order-cell]').forEach(n=>n.remove());
   rows=discoverOrderRows(document);
   nextRowIndex=0;
   pauseRequested=false;
   for(const r of rows){
     const cell=node(r.element.tagName==='TR'?'td':'div',undefined,
       'vision-order-result-cell');
     cell.setAttribute('data-vision-order-cell','');
     // Respect original order row navigation while isolating Vision controls.
     for(const eventName of ['click','dblclick','pointerdown','mousedown','keydown'])
       cell.addEventListener(eventName,event=>event.stopPropagation());
     const label=node('span','Vision: не проверено','vlo-label');
     const target=rowOrderTarget(r.element,window.location.href);
     r.hasOrderLink=target.status==='ORDER_LINK_FOUND'&&
       !(target.source==='numeric_first_cell'&&r.anchors.length>0);
     const detail=node('span',
       r.hasOrderLink?
         'Загрузка макетов из карточки заказа → «Макеты для заказа»':
       r.anchors.length>0?
         'Обнаружены ссылки в строке; проверю резервный маршрут':
         'Не найден переход в карточку заказа','vlo-detail');
     // Exact private filenames in the local DOM only; never in anonymous JSON.
     const fileNames=node('details',undefined,'vlo-files');fileNames.hidden=true;
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
     cell.append(label,detail,fileNames,trigger,gradeLabel);
     r.element.append(cell);
     r.label=label;r.detail=detail;r.button=trigger;r.fileNames=fileNames;
   }
   updateBatchControls();
   renderStats(rows.length?'Очередь всех заказов запускается вручную, файлы проверяются строго по одному.':
     'Строки не распознаны. Требуется адаптер к DOM тестовой таблицы; файловые запросы не выполнялись.');
 }
 async function scanRowContents(r){
   r.scanAttempted=false;
   r.button.disabled=true;
   r.label.textContent='Vision: карточка заказа → макеты…';
   if(!r.partial)r.results=[];
   let manual=r.partial?.manual||0,research=r.partial?.research||0,
     desc=r.partial?.descriptions||[];
   let candidates=r.partial?.candidates||[],fromOrder=r.partial?.fromOrder||false;
   if(r.partial){
     // Resume the same authenticated file descriptors; do not refetch
     // already processed files or reopen a completed popup.
   }else if(r.hasOrderLink){
     const detail=await inspectOrderPageFromRow(r.element);
     if(closed)return;
     if(detail.status!=='ORDER_DETAIL_DISCOVERED'){
       r.label.textContent='Vision: ручная проверка';
       r.detail.textContent='Карточка заказа / окно макетов: '+
         String(detail.reason||'не прочитано').slice(0,120)+
         (detail.stage?' · этап '+detail.stage:'')+
         (detail.origin_relation?' · '+detail.origin_relation:'');
       r.results.push({type:'order',status:'MANUAL',
         reason:detail.reason||'ORDER_DETAIL_UNAVAILABLE',
         stage:detail.stage||null,origin_relation:detail.origin_relation||null,
         failure_class:detail.failure_class||null,
         http_status:detail.http_status??null,
         fetch_exception_family:detail.fetch_exception_family||null});
       r.scanAttempted=true;
       r.button.disabled=false;renderStats('Нужен доступ к карточке заказа и AJAX окну');
       return;
     }
     fromOrder=true;r.orderUploads=detail.uploads;
     r.orderTemplates=detail.templates.length;
     if(!detail.uploads.length){
       r.label.textContent='Vision: ручная проверка';
       r.detail.textContent='В окне «Макеты для заказа» отсутствуют подтверждённые загрузки клиента; '+
         'найдено конструкторов: '+detail.templates.length;
       r.results.push({type:'order',status:'MANUAL',
         reason:'CUSTOMER_UPLOADS_NOT_FOUND'});
       r.scanAttempted=true;
       r.button.disabled=false;renderStats('Конструкторы не являются исходными макетами клиента');
       return;
     }
     candidates=detail.uploads;
     r.fileNames.replaceChildren(node('summary','Оригинальные имена ('+detail.uploads.length+')'));
     for(const upload of detail.uploads){
       // textContent only: retain exact Unicode, whitespace and case.
       r.fileNames.append(node('div',upload.originalFilename??upload.filename,'vlo-filename'));
     }
     r.fileNames.hidden=false;
     r.detail.textContent='Загружено заказчиком: '+detail.uploads.length+
       '; конструкторов: '+detail.templates.length;
   }else{
     // Explicit legacy fallback only when the list itself actually exposes
     // download links. No synthetic order URL guessing or DOM click execution.
     candidates=r.files;
     if(!candidates.length){
       r.label.textContent='Vision: ручная проверка';
       r.detail.textContent='Не удалось найти безопасную ссылку на карточку заказа';
       r.results.push({type:'order',status:'MANUAL',
         reason:'ORDER_DETAIL_LINK_REQUIRED'});
       r.scanAttempted=true;
       r.button.disabled=false;renderStats('Не найден переход на страницу заказа');
       return;
     }
   }
   const total=candidates.length;
   let popup404Recheck=null;
   for(let i=r.partial?.nextIndex||0;i<total;i++){
     if(closed)return;
     if(pauseRequested){
       r.partial={candidates,fromOrder,nextIndex:i,manual,research,
         descriptions:desc};
       r.label.textContent='Vision: очередь остановлена, можно продолжить';
       r.detail.textContent='Проверено '+i+' из '+total+
         ' вложений. При продолжении уже обработанные файлы не скачиваются повторно.';
       r.button.disabled=false;
       renderStats('Очередь остановлена. Состояние текущего заказа сохранено в памяти страницы.');
       return;
     }
     const a=candidates[i];
     let result;
     try{
       if(fromOrder){
         const artifact=await fetchOrderResourceBytes(a);
         result=artifact.status==='LOCAL_BYTES_ONLY'?
           await inspectOrderArtworkBytes(artifact.bytes,artifact.url,
             artifact.mime,a.filename):
           {status:'MANUAL',type:'order_artwork',
             reason:artifact.reason||'ARTWORK_DOWNLOAD_FAILED',
           stage:artifact.stage||'artwork',http_status:artifact.http_status??null,
           failure_class:artifact.failure_class||null};
       }else result=await inspectSameOriginArtwork(a);
     }catch{
       // One unreadable file never stops the rest of the sequential queue.
       result={status:'MANUAL',type:'order_artwork',reason:'ARTWORK_INSPECTION_FAILED'};
     }
     if(fromOrder&&result.reason==='ARTWORK_HTTP_ERROR'&&
        result.http_status===404){
       // Exactly one additional popup GET per affected order; never retry
       // 404 file downloads or guess alternative download paths.
       if(!popup404Recheck)
         popup404Recheck=await recheckOrderPopupReferences(candidates);
       result.reference_state=popup404Recheck.status==='REFERENCE_RECHECKED'?
         popup404Recheck.listed[i]?'STILL_LISTED_IN_POPUP':'MISSING_FROM_POPUP':
         'POPUP_RECHECK_UNAVAILABLE';
       if(result.reference_state==='POPUP_RECHECK_UNAVAILABLE')
         result.reference_recheck_failure_class=
           popup404Recheck.failure_class||null;
     }
     if(closed)return;
     r.results.push(result);
     desc.push(summarize(result));
     if(result.status==='MANUAL')manual++;else research++;
     renderStats('Проверено файлов в текущем заказе: '+(i+1)+'/'+total);
     // Small inter-request pause limits stress on the internal test server.
     if(i+1<total)await new Promise(resolve=>
       setTimeout(resolve,LOCAL_ORDERS.fetchPaceMs));
   }
   if(closed)return;
   r.partial=null;
   r.scanAttempted=true;
   if(r.local_only_excluded>0&&!fromOrder)
     manual++;
   r.label.textContent=manual?
     'Vision: '+manual+' требуют ручной проверки':
     'Vision: '+research+' исследованы (не допуск)';
   r.detail.textContent=(fromOrder?'Карточка заказа: '+candidates.length+
     ' клиентских файлов, '+r.orderTemplates+' конструкторов. ':'')+
     desc.join(' | ').slice(0,520);
   r.button.disabled=false;
   renderStats('Проверено по карточкам заказов. Вывод не является допуском.');
 }
 async function scanRow(r){
   if(busy||closed)return;
   busy=true;pauseRequested=false;refreshBtn.disabled=scanBtn.disabled=true;
   pauseBtn.disabled=false;
   try{await scanRowContents(r)}
   finally{busy=false;refreshBtn.disabled=false;updateBatchControls()}
 }
 function updateBatchControls(){
   pauseBtn.disabled=!busy||closed||pauseRequested;
   scanBtn.disabled=busy||closed||nextRowIndex>=rows.length;
   scanBtn.textContent=nextRowIndex>=rows.length?'Все строки обработаны':
     pauseRequested?'Продолжить очередь ('+(rows.length-nextRowIndex)+')':
     'Проверить все заказы ('+(rows.length-nextRowIndex)+')';
 }
 async function scanAll(){
   if(busy||closed)return;
   busy=true;pauseRequested=false;refreshBtn.disabled=scanBtn.disabled=true;
   pauseBtn.disabled=false;
   let examined=0;
   try{
     while(nextRowIndex<rows.length&&!closed&&!pauseRequested){
       const r=rows[nextRowIndex++];
       if(r.scanAttempted)continue;
       try{await scanRowContents(r)}
       catch{
         r.results=[{type:'order',status:'MANUAL',reason:'ORDER_INSPECTION_FAILED'}];
         r.scanAttempted=true;
         r.button.disabled=false;
       }
       if(r.partial){nextRowIndex--;break}
       examined++;
       renderStats('Очередь: обработано '+examined+
         ' заказов с момента запуска, следующий '+(nextRowIndex+1)+'/'+rows.length);
       await new Promise(resolve=>setTimeout(resolve,LOCAL_ORDERS.fetchPaceMs));
     }
     if(!closed)renderStats(nextRowIndex>=rows.length?
       'Очередь завершена. Все найденные файлы проверены или помечены для ручной проверки.':
       'Очередь остановлена после текущего файла. Нажмите «Продолжить очередь».');
   }finally{
     busy=false;refreshBtn.disabled=false;updateBatchControls();
   }
 }

 refresh();
 return true;
}
if(typeof window!=='undefined'&&typeof document!=='undefined')
 initLocalOrdersOverlay();
