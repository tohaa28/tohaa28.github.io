/**
 * Chrome MV3, local test order page only.
 * Read the ALREADY OPEN native article "Согласование макета" modal.
 * Zero network requests, zero native modal clicks, zero HTML storage,
 * zero training labels, zero customer details in the downloadable JSON.
 */
import {inspectOpenMaketApprovalDom} from './maket-approval-probe.mjs';
import {exportNativeApprovalAttachmentParts} from './approval-attachments.mjs';
import {encodeTransferChunks} from './approval-batch-archive.mjs';
import {readTzApprovedStatus} from './approval-range-scanner.mjs';
import {collectMaketApprovalsOnOrderPage,anonymousApprovalCollection}
 from './approval-auto-scan.mjs';
const BOX_ID='vision-approval-inspector',STYLE_ID='vision-approval-inspector-css';
const ACCEPTED=['testgifts.local'];
function isOrderPage(loc=globalThis.location){
 return loc?.protocol==='http:'&&ACCEPTED.includes(loc.hostname)&&
   !loc.port&&/^\/private\/order\/\d{5,12}\/?$/.test(loc.pathname);
}
const make=(tag,contents)=>{
 const n=document.createElement(tag);
 if(contents!=null)n.textContent=contents;
 return n;
};
export function initApprovalPageEntry(){
 if(!isOrderPage()||document.getElementById(BOX_ID))return false;
 const style=make('style');
 style.id=STYLE_ID;
 style.textContent='#'+BOX_ID+'{position:fixed!important;right:12px!important;'+
  'top:12px!important;z-index:2147483605!important;width:315px!important;'+
  'max-width:calc(100vw - 20px)!important;background:#253a3f!important;'+
  'color:#fff!important;border:1px solid #92aea6!important;'+
  'box-shadow:0 4px 22px #0008!important;border-radius:10px!important;'+
  'padding:12px!important;font:13px/1.35 system-ui,sans-serif!important}'+
  '#'+BOX_ID+' button{cursor:pointer!important;margin:4px!important;'+
  'background:#e5f0e8!important;color:#203336!important;'+
  'border:0!important;border-radius:5px!important;padding:7px!important}'+
  '#'+BOX_ID+' p{margin:6px 0!important;white-space:pre-wrap!important}';
 document.head.append(style);
 const panel=make('section');panel.id=BOX_ID;
 panel.setAttribute('aria-label','Vision AI — исследование открытого согласования');
 const header=make('strong','Vision AI · Согласование макета · v0.1.8');
 const note=make('p','Пакетный сбор: переписки, имена, проблемы и вложения передаются на страницу списка заказов. По завершении сохраняется ОДИН ZIP с папками заказов, обсуждений и файлов. Не закрывайте страницу до скачивания.');
 const stats=make('p','Ожидается открытое окно.');stats.setAttribute('role','status');
 const scan=make('button','Прочитать открытое согласование');
 const exportButton=make('button','Скачать анонимный JSON');
 const autoScan=make('button','Автообход согласований >1');
 const stopScan=make('button','Остановить обход');
 const privateSave=make('button','Сохранить приватные данные');
 const anonymousSave=make('button','Анонимный отчёт обхода');
 const attachmentRetry=make('button','Повторить скачивание вложений');
 const close=make('button','Закрыть Vision');
 exportButton.disabled=true;
 stopScan.disabled=privateSave.disabled=anonymousSave.disabled=attachmentRetry.disabled=true;
 let last=null,collection=null,busy=false,stopRequested=false;
 for(const b of [scan,exportButton,autoScan,stopScan,privateSave,anonymousSave,
  attachmentRetry,close])
  b.type='button';
 const stop=e=>{e.preventDefault();e.stopPropagation()};
 scan.addEventListener('click',event=>{
  stop(event);
  if(busy)return;
  last=inspectOpenMaketApprovalDom(document);
  const r=last;
  if(r.status!=='VISIBLE_MODAL_STRUCTURE_ONLY'){
   exportButton.disabled=true;
   stats.textContent='Окно не открыто или структура не подтверждена: '+
     r.status+'. Сначала откройте штатное «Согласование макета».';
   return;
  }
  exportButton.disabled=false;
  stats.textContent='Вариантов проблем: '+r.problems_available_count+
   ' · отмечено сейчас: '+r.problems_checked_current_count+
   '\nСообщений: '+r.human_comment_count+
   ' · событий: '+r.history_system_entry_count+
   ' · вложений: '+r.attachments_total+
   ' (PDF '+r.attachments_pdf+', PSD '+r.attachments_psd+
   ', изображения '+r.attachments_image_candidates+')'+
   '\nДанные предназначены только для исследования; допуск к печати не выдаётся.';
 });
 exportButton.addEventListener('click',event=>{
  stop(event);
  if(!last||last.status!=='VISIBLE_MODAL_STRUCTURE_ONLY')return;
  // Never export DOM, order id, message text, full hrefs or anything
  // dynamically copied from unknown page properties.
  const safeKeys=['status','trigger_count','article_scoped_trigger_count',
   'modal_loaded','modal_currently_visible','problems_available_count',
   'problems_checked_current_count','human_comment_count','history_entry_count',
   'history_system_entry_count','problem_add_events','problem_remove_events',
   'status_change_events','other_system_events','attachments_total',
   'attachments_pdf','attachments_psd','attachments_image_candidates',
   'attachments_other','badge_comment_count','badge_matches_human_messages'];
  const safe=Object.fromEntries(safeKeys.map(key=>[key,last[key]]));
  const topics=['positive_min','negative_min','text_height','color',
   'raster_resolution','effects','field_boundary','constructor','fonts',
   'wrong_artwork','complex_work','revision'];
  const report={
   schema:'printcheck.vision.local-maket-approval.v1',
   scope:'CURRENT_VISIBLE_NATIVE_MODAL_ONLY',
   ...safe,
   checked_problem_topic_hints:topics.filter(x=>
     last.checked_problem_topic_hints?.includes(x)).sort(),
   weak_message_topic_hints:topics.filter(x=>
     last.weak_message_topic_hints?.includes(x)).sort(),
   unselected_problem_options_are_not_defects:true,
   reported_issues_expert_verified:false,history_version_alignment_verified:false,
   training_ready:false,production_approved:false,
   order_numbers_included:false,item_ids_included:false,
   message_text_included:false,author_names_included:false,
   attachment_names_or_urls_included:false,attachments_downloaded:false
  };
  const url=URL.createObjectURL(new Blob(
   [JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));
  const anchor=make('a');anchor.href=url;
  anchor.download='vision-local-maket-approval.json';
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 });
 function downloadJson(data,filename){
  const uri=URL.createObjectURL(new Blob(
   [JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));
  const a=make('a');a.href=uri;a.download=filename;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(uri),2500);
 }
  /** Bounded, acknowledged transfer to explicit local list queue. */
  async function stageForBatch(kind,stage,part,bytes){
   const order=String(collection?.order_number||'');
   if(!/^\d{5,12}$/.test(order))return {status:'MANUAL_BATCH_ORDER_INVALID'};
   let chunks;
   try{chunks=encodeTransferChunks(bytes)}
   catch{return {status:'MANUAL_BATCH_PAYLOAD_TOO_LARGE'}}
   for(let i=0;i<chunks.length;i++){
    let res;
    try{res=await chrome.runtime.sendMessage({
      op:'vision-approval-batch-transfer-v1',
      order_number:order,kind,stage,part,
      sequence:i,chunk_count:chunks.length,chunk:chunks[i]
     })}
    catch{return {status:'MANUAL_BATCH_RELAY_FAILED'}}
    if(res?.status!=='BATCH_CHUNK_ACCEPTED')
     return {status:res?.status||'MANUAL_BATCH_RELAY_REJECTED'};
   }
   return {status:kind==='evidence'?'BATCH_EVIDENCE_STAGED':'BATCH_ZIP_PART_STAGED'};
  }
  /**
   * Download from the extension worker, not a transient hidden page anchor.
   * Both RAW (before binary GETs) and FINAL (with ZIP byte/SHA mappings)
   * are retained locally. The worker waits for Chrome 'complete' before
   * acknowledging; lack of confirmation is NEVER shown as success.
   */
  async function persistOrderEvidence(stage,{batchMode=false}={}){
   if(!collection||!Array.isArray(collection.articles))return {
    status:'MANUAL_NO_ORDER_EVIDENCE'};
   const order=String(collection.order_number||'');
   if(!/^\d{5,12}$/.test(order))return {
    status:'MANUAL_ORDER_IDENTIFIER_INVALID'};
   if(typeof chrome==='undefined'||!chrome.runtime?.sendMessage)
    return {status:'MANUAL_EXTENSION_DOWNLOAD_UNAVAILABLE'};
   if(batchMode){
    try{
     const bytes=new TextEncoder().encode(JSON.stringify(collection)+'\n');
     return await stageForBatch('evidence',stage,0,bytes);
    }catch{return {status:'MANUAL_BATCH_EVIDENCE_ENCODING_FAILED'}}
   }
   try{
    return await chrome.runtime.sendMessage({
     op:'vision-approval-save-evidence-v1',stage,
     order_number:order,evidence:collection
    })||{status:'MANUAL_EVIDENCE_DOWNLOAD_NO_RESPONSE'};
   }catch{return {status:'MANUAL_EVIDENCE_DOWNLOAD_NO_RESPONSE'}}
  }
 /**
  * Native attachment GETs are separate from the approval dialog.
  * All bytes are confined to short-lived numbered local ZIP parts.
  * No payloads, customer identifiers, or errors are sent to GitHub.
  */
 async function savePrivateAttachmentParts({queueMode=false}={}){
  if(!collection)return {status:'NO_COLLECTION',files:0,parts:0};
  let files=0,parts=0,processed=0,failures=0;
  for await(const item of exportNativeApprovalAttachmentParts(collection,{
   stop:()=>stopRequested||!panel.isConnected,
   onProgress:p=>{
    if(panel.isConnected)stats.textContent='Файлы из обсуждений: '+
     p.processed+' / '+p.total+' · считано '+p.successful+
     '\nТолько авторизованные GET, без сохранения на сайте.';
   }
  })){
   if(item.status==='PRIVATE_LOCAL_ZIP_READY'){
    if(queueMode){
     const bytes=new Uint8Array(await item.zip.arrayBuffer());
     const staged=await stageForBatch('attachment_zip','binary',item.part,bytes);
     if(staged.status!=='BATCH_ZIP_PART_STAGED')
      return {status:staged.status,files,parts,processed,failures:failures+1};
    }else{
     const u=URL.createObjectURL(item.zip),a=make('a');
     a.href=u;a.download='vision-private-approval-attachments-part-'+
       String(item.part).padStart(4,'0')+'.zip';
     document.body.append(a);a.click();a.remove();
     setTimeout(()=>URL.revokeObjectURL(u),30000);
    }
    files+=item.files;parts++;processed=item.processed;
    failures+=item.manifest.skipped.length;
   }else if(item.status==='STOPPED'){
    return {status:'STOPPED',files,parts,processed,failures};
   }else if(item.status==='NO_ATTACHMENT_FILES_VERIFIED'){
    processed=item.processed;failures+=item.skipped_count;
    return {status:'MANUAL_NO_FILE_BYTES',files,parts,processed,failures};
   }else{
    return {status:item.status,files,parts,processed,failures};
   }
  }
  return {status:files?'LOCAL_ZIP_PARTS_PREPARED':'NO_ATTACHMENTS',
   files,parts,processed,failures};
 }
 async function performAutomaticApprovalScan(queueMode=false){
  if(busy)return {status:'BUSY'};
  busy=true;stopRequested=false;collection=null;
  scan.disabled=autoScan.disabled=exportButton.disabled=true;
  stopScan.disabled=false;
  privateSave.disabled=anonymousSave.disabled=attachmentRetry.disabled=true;
  try{
   collection=await collectMaketApprovalsOnOrderPage(document,{
    orderNumber:location.pathname.split('/').filter(Boolean).at(-1),
    stop:()=>stopRequested||!panel.isConnected,
    onProgress:p=>{
     if(!panel.isConnected)return;
     stats.textContent=p.complete?
      'Автообход завершён. Проверено: '+p.processed+' / '+p.total:
      'Автообход: '+p.processed+' / '+p.total+
      ' · проверка следующего согласования; сообщений '+p.badge;
    }
   });
   if(!panel.isConnected)return;
   const done=collection.articles.filter(x=>x.status==='PRIVATE_REVIEW_ONLY').length;
   const skipped=collection.skipped.length;
   // Preserve all messages and order facts BEFORE downloading attachments.
   const rawEvidence=queueMode?await persistOrderEvidence('raw',{batchMode:true}):
    {status:'MANUAL_SAVE_ON_DEMAND'};
   const attachmentReport=stopRequested?
    {status:'STOPPED',files:0,parts:0,failures:0}:
    await savePrivateAttachmentParts({queueMode});
   collection.attachment_download_summary={
    status:attachmentReport.status,verified_files:attachmentReport.files,
    local_zip_parts:attachmentReport.parts,
    read_failures:attachmentReport.failures,
    source_pdf_revision_confirmed:false,training_ready:false};
   if(!panel.isConnected)return;
   stats.textContent='Обход: '+collection.status+
     '\nАртикулов: '+collection.articles.length+
     ' · история проверена: '+done+' · пропущено: '+skipped+
     '\nФайлы: '+attachmentReport.files+
     ' · ZIP-частей: '+attachmentReport.parts+
     ' · ошибок чтения: '+attachmentReport.failures+
     ' · статус: '+attachmentReport.status+
     '\nПриватный JSON содержит текст замечаний. Сохраните его отдельно.'+
     ' Chrome может запросить разрешение на несколько скачиваний.';
   privateSave.disabled=anonymousSave.disabled=attachmentRetry.disabled=false;
   const finalEvidence=queueMode?await persistOrderEvidence('final',{batchMode:true}):
    {status:'MANUAL_SAVE_ON_DEMAND'};
   const textSaved=rawEvidence.status==='BATCH_EVIDENCE_STAGED'||
    finalEvidence.status==='BATCH_EVIDENCE_STAGED';
   if(queueMode){
    stats.textContent+='\nДанные переданы в единый архив: '+
      (textSaved?'да':'ОШИБКА ПЕРЕДАЧИ')+
      ' · резервная '+rawEvidence.status+
      ' · итоговая '+finalEvidence.status;
   }
   return {status:collection.status,eligible_articles:collection.selected_by_badge,
     verified_articles:done,files:attachmentReport.files,
     zip_parts:attachmentReport.parts,failures:attachmentReport.failures,
     private_text_saved:textSaved,raw_evidence_status:rawEvidence.status,
     final_evidence_status:finalEvidence.status,batch_mode:queueMode};
  }catch{
   if(panel.isConnected)stats.textContent='MANUAL: ошибка автоматического обхода.';
   return {status:'MANUAL_AUTO_SCAN_FAILED'};
  }finally{
   busy=false;scan.disabled=autoScan.disabled=false;
   stopScan.disabled=true;
   exportButton.disabled=last?.status!=='VISIBLE_MODAL_STRUCTURE_ONLY';
  }
 }
 autoScan.addEventListener('click',event=>{
  stop(event);void performAutomaticApprovalScan();
 });
 // The service worker opens a background tab only after an explicit button
 // on the local orders list. Do not derive automation from URL query strings.
 if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage){
  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
   if(message?.op!=='vision-approval-order-collect-v1')return false;
   if(!isOrderPage()||message.order_url!==location.href){
    respond({status:'MANUAL_ORDER_URL_MISMATCH'});return false;
   }
   if(message.require_tz_approved===true){
    const order=location.pathname.split('/').filter(Boolean).at(-1);
    const gate=readTzApprovedStatus(document,order);
    if(gate.status!=='TZ_APPROVED'){
     respond({status:gate.status==='TZ_NOT_APPROVED'?
      'MANUAL_TZ_CHANGED_BEFORE_SCAN':'MANUAL_TZ_RECHECK_FAILED'});
     return false;
    }
   }
   performAutomaticApprovalScan(true).then(respond,()=>
     respond({status:'MANUAL_AUTO_SCAN_FAILED'}));
   return true;
  });
 }
 attachmentRetry.addEventListener('click',async event=>{
  stop(event);
  if(busy||!collection)return;
  busy=true;stopRequested=false;
  autoScan.disabled=attachmentRetry.disabled=true;
  stopScan.disabled=false;
  try{
   const res=await savePrivateAttachmentParts();
   if(panel.isConnected)stats.textContent='Повторное чтение файлов: '+
    res.status+' · считано '+res.files+
    ' · ZIP-частей '+res.parts+' · отказов '+res.failures;
  }finally{
   busy=false;autoScan.disabled=attachmentRetry.disabled=false;
   stopScan.disabled=true;
  }
 });
 stopScan.addEventListener('click',event=>{
  stop(event);stopRequested=true;stopScan.disabled=true;
  stats.textContent='Остановка запрошена. Текущий шаг завершится безопасно.';
 });
 privateSave.addEventListener('click',event=>{
  stop(event);if(!collection)return;
  if(!window.confirm('В приватном JSON находятся сообщения о заказе, идентификаторы артикулов и имена вложений. Сохранить только на свой компьютер? Не публикуйте файл в GitHub и не отправляйте в общедоступные сервисы.'))return;
  downloadJson(collection,'vision-private-approval-evidence-'+
   (collection.order_number||'order')+'.json');
 });
 anonymousSave.addEventListener('click',event=>{
  stop(event);if(!collection)return;
  downloadJson(anonymousApprovalCollection(collection),
   'vision-anonymous-approval-collection.json');
 });
 close.addEventListener('click',event=>{
  stop(event);stopRequested=true;panel.remove();style.remove();
 });
 panel.append(header,note,autoScan,stopScan,privateSave,anonymousSave,
  attachmentRetry,scan,exportButton,close,stats);
 document.body.append(panel);
 return true;
}
if(typeof document!=='undefined'&&typeof location!=='undefined')
 initApprovalPageEntry();
