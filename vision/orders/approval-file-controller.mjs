/**
 * Vision AI: scan only IDs explicitly imported from a local TXT file.
 * Independent of numeric range mode. Durable state and unarchived bytes are
 * maintained in the extension origin in IndexedDB across page reloads.
 */
import {parseOrderListText,explicitListOrderUrl,ORDER_LIST_MAX_BYTES}
 from './approval-file-list.mjs';
import {probeTzForOrder,isRecoverableRangeFailure} from './approval-range-scanner.mjs';
import {ApprovalBatchSession} from './approval-batch-archive.mjs';
import {APPROVED_ORDERS_PER_ZIP,SOFT_BATCH_PAYLOAD_LIMIT,
 archivePayloadBytes,selectArchiveRows,archiveBatchDue}
 from './approval-file-batch-policy.mjs';
import {startExtensionZipDownload} from './extension-zip-transfer.mjs';
import {controlledOrderProbe,normalizeNetworkHealth,freshNetworkHealth} from './approval-network-control.mjs';
import {loadOrderFileState,importOrderFileQueue,saveOrderFileProgress,
 saveOrderFileStatus,commitOrderFileArchive,exportOrderFileRegistry,
 clearOrderFileQueue} from './approval-file-persistence.mjs';

const el=(tag,value)=>{
 const n=document.createElement(tag);
 if(value!==undefined)n.textContent=value;
 return n;
};
const button=(label,fn)=>{
 const b=el('button',label);b.type='button';
 b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void fn()});
 return b;
};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pad=n=>String(n).padStart(5,'0');
const acceptedRate=n=>Number.isSafeInteger(n)&&n>=100&&n<=60000;

export function makeApprovalFileListController({
 getBusy=()=>false,setBusy=()=>{},scanOrder=async()=>null,
 isClosed=()=>false,refreshControls=()=>{}
}={}){
 const root=el('div');root.className='vlo-file-list';
 root.style.cssText='width:100%;border:1px solid #69898b;border-radius:8px;'+
  'padding:10px;margin:10px 0;';
 root.append(el('strong','Список заказов из файла TXT'));
 root.append(el('p','Загрузите файл с семизначными номерами: один номер в строке. '+
  'Повторы удаляются. Проверяются только номера из файла, независимо от '+
  'границ режима диапазона. ZIP по 100 утверждённых заказов; '+
  'при завершении списка или остановке — ZIP неполной партии. '+
  'При превышении безопасного размера ZIP партия сохраняется раньше.'));
 const fileLabel=el('label','Выбрать TXT со списком ');
 const fileInput=el('input');fileInput.type='file';
 fileInput.accept='.txt,text/plain';
 fileInput.title='Один семизначный номер заказа в каждой строке, до 20 МБ';
 fileInput.style.cssText='max-width:100%;margin:4px 0;';
 fileLabel.append(fileInput);root.append(fileLabel);
 const rateLabel=el('label','Задержка между номерами, мс ');
 const rateInput=el('input');rateInput.type='number';
 rateInput.value='1200';rateInput.min='100';rateInput.max='60000';
 rateInput.step='100';rateInput.title='100–60000 мс, применяется сразу';
 rateInput.style.cssText='max-width:110px;color:#203436;background:#f2f8f3;'+
  'padding:5px;border-radius:4px;';
 rateLabel.append(rateInput);root.append(rateLabel);
 const controls=el('div');controls.className='vlo-actions';
 const startBtn=button('Старт / продолжить по списку',()=>start());
 const pauseBtn=button('Пауза списка',()=>{paused=true;void setMode('paused');show('Пауза после текущего заказа')});
 const stopBtn=button('Стоп и архив списка',()=>{
  stopped=true;stopWithoutZip=false;
  void setMode('stopped');
  show('Сохраню неполную ZIP-партию после текущего заказа');
  if(!running)void manualSave();
 });
 const saveBtn=button('Сохранить неполную ZIP списка',()=>manualSave());
 const exportBtn=button('Реестр списка JSON',()=>exportRegistry());
 const resetBtn=button('Очистить список и прогресс',()=>reset());
 controls.append(startBtn,pauseBtn,stopBtn,saveBtn,exportBtn,resetBtn);
 root.append(controls);
 const progress=el('p','Список заказов не загружен.');progress.style.whiteSpace='pre-line';
 root.append(progress);
 pauseBtn.disabled=stopBtn.disabled=saveBtn.disabled=true;

 let state=null,queue=null,pending=[],batch=new ApprovalBatchSession();
 let running=false,paused=false,stopped=false,activeOrder=null;
 let currentDelay=1200,lastError=null,checkedSession=0;
 let restoreBlocked=false,writeChain=Promise.resolve();
 let networkHealth=freshNetworkHealth(),lastActivityAt=null;
 let stopWithoutZip=false,stage='idle';
 let init=Promise.resolve(false);
 const write=fn=>{
  writeChain=writeChain.catch(()=>{}).then(fn);
  return writeChain;
 };
 const currentMode=()=>stopped?'stopped':paused?'paused':running?'running':'paused';
 function show(message=''){
  const next=state&&state.index<state.total?
   String(queue[state.index]):'—';
  progress.textContent=(state?
   'Файл: '+state.filename+' · всего: '+state.total+
   ' · обработано: '+state.index+
   ' · задержка: '+currentDelay+' мс':
   'Файл не загружен')+
   '\nСледующий заказ: '+next+
   ' · проверено после открытия: '+checkedSession+
   ' · ZIP: '+(state?.archive_count||0)+
   ' · найдено и архивировано: '+(state?.found_committed||0)+
   ' · в текущей партии: '+activeRows().length+
   '/'+APPROVED_ORDERS_PER_ZIP+
   ' · ZIP загружается: '+(state?.download?1:0)+
   ' · ошибок открытия: '+(state?.failed_count||0)+
   ' · сеть: '+networkHealth.state+
   ' · повторов GET: '+networkHealth.retries+
   ' · сетевых ошибок: '+networkHealth.transient_errors+
   ' · фаза: '+stage+
   (lastError?'\nОшибка: '+lastError:'')+
   (message?'\n'+message:'');
 }
 const activeRows=()=>pending.filter(row=>!state?.download?.order_ids?.includes(row.id));
 const activeBytes=()=>archivePayloadBytes(activeRows());
 const captureMode=mode=>{
  if(!state)return null;
  state={...state,mode,delay_ms:currentDelay};
  return {...state};
 };
 async function setMode(mode){
  if(!state)return;
  const snapshot=captureMode(mode);
  try{await write(()=>saveOrderFileStatus(snapshot))}
  catch(error){lastError=String(error?.message||'MANUAL_LIST_MODE_FAILED');show()}
 }
 function validateDelay(){
  const n=Number(rateInput.value);
  return acceptedRate(n)?n:null;
 }
 rateInput.addEventListener('input',()=>{
  const value=validateDelay();
  if(value===null){show('Допустимая задержка: 100–60000 мс');return}
  if(value===currentDelay)return;
  currentDelay=value;
  if(state)void setMode(currentMode());
  show('Новая задержка '+value+' мс применяется без сброса очереди');
 });
 rateInput.addEventListener('change',()=>{
  if(validateDelay()===null)rateInput.value=String(currentDelay);
 });
 async function dynamicDelay(){
  const started=performance.now();
  while(!paused&&!stopped&&!isClosed()){
   const ms=currentDelay-(performance.now()-started);
   if(ms<=0)break;
   await wait(Math.min(ms,100));
  }
 }
 function audit(phase,rest={}){
  return chrome.runtime.sendMessage({op:'vision-range-download-audit-v1',phase,...rest});
 }
 async function waitForChrome(afterId,bytes,filename){
  for(let i=0;i<240;i++){
   const result=await audit('check',{after_id:afterId,byte_length:bytes,
    expected_filename:filename});
   if(result?.status==='RANGE_DOWNLOAD_COMPLETE')return;
   if(result?.status!=='RANGE_DOWNLOAD_PENDING')
    throw Error(result?.status||'MANUAL_ORDER_LIST_ZIP_AUDIT_FAILED');
   await wait(500);
  }
  throw Error('MANUAL_ORDER_LIST_ZIP_DOWNLOAD_TIMEOUT');
 }
 async function waitForPreviousOrder(){
  // Reload can interrupt the list page while the native order tab still
  // collects. Wait for that worker to finish before retrying this ID.
  for(let i=0;i<210;i++){
   const result=await chrome.runtime.sendMessage({
    op:'vision-approval-queue-status-v1'}).catch(()=>null);
   if(result?.status!=='QUEUE_STATUS_OK')
    throw Error('MANUAL_ORDER_LIST_WORKER_STATUS_FAILED');
   if(!result.busy)return;
   await wait(1000);
  }
  throw Error('MANUAL_ORDER_LIST_OLD_WORKER_BUSY');
 }
 async function commitDownloaded(){
  const info=state?.download;
  if(!info)return;
  const ids=info.order_ids||pending.map(x=>x.id);
  const selected=new Set(ids),rows=pending.filter(x=>selected.has(x.id));
  if(rows.length!==ids.length||!rows.length)
   throw Error('MANUAL_ORDER_LIST_DOWNLOAD_ROWS_MISSING');
  const updated={...state,download:null,archive_count:state.archive_count+1,
   found_committed:state.found_committed+rows.length,
   files_committed:(state.files_committed||0)+
    (Number.isInteger(info.verified_files)?info.verified_files:rows.reduce((n,x)=>n+(x.files||0),0)),
   last_archive:{filename:info.filename,bytes:info.bytes,
    orders:rows.length,
    files_verified:info.verified_files??null,
    files_missing:info.missing_files??null,
    entry_count:info.entry_count??null,
    confirmed_at:new Date().toISOString(),
    storage:info.kind==='directory'?'selected_directory':'chrome_downloads',
    status:info.kind==='directory'?'DIRECTORY_VERIFIED':'CHROME_COMPLETE'},
   mode:currentMode()};
  await write(()=>commitOrderFileArchive(updated,rows));
  state=updated;pending=pending.filter(x=>!selected.has(x.id));
  for(const id of ids)batch.discardOrder(id);
  saveBtn.disabled=running||!activeRows().length;lastError=null;
  show('ZIP №'+state.archive_count+' подтверждён; новая партия сохранена.');
 }
 async function resumePreparingZip(){
  const info=state?.download;
  if(info?.stage!=='preparing')return true;
  if(info.kind==='directory'){
   if(typeof globalThis.__visionArchiveSave!=='function')
    throw Error('VISION_DIRECTORY_ENGINE_REQUIRED');
   const selected=new Set(info.order_ids);
   const rows=pending.filter(row=>selected.has(row.id));
   if(!rows.length||rows.length!==info.order_ids.length)
    throw Error('VISION_DIRECTORY_PENDING_ROWS_MISSING');
   const temp=new ApprovalBatchSession();
   for(const row of rows)temp.restoreOrder(row.id,row.transfers);
   const blob=temp.finalize(rows).blob;
   if(blob.size!==info.bytes)throw Error('VISION_DIRECTORY_ZIP_SIZE_CHANGED');
   const saved=await globalThis.__visionArchiveSave(blob,info.filename);
   if(saved?.status!=='VISION_LOCAL_ARCHIVE_VERIFIED')
    throw Error('VISION_DIRECTORY_FILE_UNCONFIRMED');
   await commitDownloaded();
   return true;
  }
  // A reload might land between download initiation and IDB stage commit.
  // Never send a duplicate ZIP if Chrome already sees the original request.
  const check=await audit('check',{after_id:info.after_id,
   byte_length:info.bytes,expected_filename:info.filename});
  if(check?.status==='RANGE_DOWNLOAD_COMPLETE'){
   await commitDownloaded();return true;
  }
  if(check?.status==='RANGE_DOWNLOAD_PENDING'&&check.matched>0){
   const next={...state,download:{...info,stage:'started'}};
   await write(()=>saveOrderFileStatus(next));state=next;
   for(const id of info.order_ids)batch.discardOrder(id);
   return true;
  }
  if(check?.status!=='RANGE_DOWNLOAD_PENDING')
   throw Error(check?.status||'VISION_ZIP_PREPARED_AUDIT_FAILED');
  const selected=new Set(info.order_ids);
  const rows=pending.filter(row=>selected.has(row.id));
  if(rows.length!==info.order_ids.length)
   throw Error('VISION_ZIP_PREPARED_ROWS_MISSING');
  const temp=new ApprovalBatchSession();
  for(const row of rows)temp.restoreOrder(row.id,row.transfers);
  const blob=temp.finalize(rows).blob;
  if(blob.size!==info.bytes)throw Error('VISION_ZIP_PREPARED_SIZE_CHANGED');
  const downloadId=await startExtensionZipDownload(blob,info.filename);
  const next={...state,download:{...info,stage:'started',
   after_id:downloadId-1}};
  await write(()=>saveOrderFileStatus(next));state=next;
  for(const id of info.order_ids)batch.discardOrder(id);
  return true;
 }
 async function recoverDownload(waitForCompletion=false){
  if(!state?.download)return true;
  try{
   if(state.download.kind==='directory')
    return await resumePreparingZip();
   await resumePreparingZip();
   if(!state.download)return true;
   const info=state.download;
   if(waitForCompletion){
    await waitForChrome(info.after_id,info.bytes,info.filename);
    await commitDownloaded();return true;
   }
   const result=await audit('check',{after_id:info.after_id,
    byte_length:info.bytes,expected_filename:info.filename});
   if(result?.status==='RANGE_DOWNLOAD_COMPLETE'){
    await commitDownloaded();return true;
   }
   if(result?.status==='RANGE_DOWNLOAD_PENDING')return true;
   throw Error(result?.status||'MANUAL_ORDER_LIST_ZIP_AUDIT_FAILED');
  }catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_ZIP_UNCONFIRMED');
   show('Chrome не подтвердил ZIP. Данные сохранены; проверьте загрузки.');
   return false;
  }
 }
 async function saveBatch(reason){
  // v0.2.3: up to 100 approved orders, with a bounded size safety flush.
  let rows=selectArchiveRows(activeRows());
  if(!rows.length)return true;
  if(state.download){
   if(!await recoverDownload(true))return false;
   rows=selectArchiveRows(activeRows());
   if(!rows.length)return true;
  }
  let result;
  try{result=batch.finalize(rows)}
  catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_ZIP_INVALID');show();
   return false;
  }
  const filename='vision-ai-list-part-'+pad(state.archive_count+1)+
   '-'+rows[0].id+'-'+rows.at(-1).id+'.zip';
  try{
   const target=typeof globalThis.__visionArchiveSettings==='function'?
    await globalThis.__visionArchiveSettings():{ready:true,mode:'downloads'};
   if(!target.ready)throw Error(target.reason||'VISION_ARCHIVE_FOLDER_REQUIRED');
   if(target.mode==='directory'){
    const download={kind:'directory',bytes:result.blob.size,
     filename,order_ids:rows.map(x=>x.id),stage:'preparing',
     verified_files:result.counts.verified_files,
     missing_files:result.counts.missing_files,
     entry_count:result.entry_count};
    const snapshot={...state,download,mode:currentMode()};
    await write(()=>saveOrderFileStatus(snapshot));state=snapshot;
    const saved=await globalThis.__visionArchiveSave(result.blob,filename);
    if(saved?.status!=='VISION_LOCAL_ARCHIVE_VERIFIED')
     throw Error('VISION_DIRECTORY_FILE_UNCONFIRMED');
    await commitDownloaded();
    return true;
   }
   const before=await audit('baseline');
   if(before?.status!=='RANGE_DOWNLOAD_BASELINE')
    throw Error('MANUAL_ORDER_LIST_DOWNLOAD_BASELINE');
   const download={after_id:before.highest_id,bytes:result.blob.size,
    filename,order_ids:rows.map(x=>x.id),stage:'preparing',
    verified_files:result.counts.verified_files,
    missing_files:result.counts.missing_files,
    entry_count:result.entry_count};
   const snapshot={...state,download,mode:currentMode()};
   await write(()=>saveOrderFileStatus(snapshot));state=snapshot;
   // Secure extension-origin Blob, not an anchor on an insecure HTTP page.
   const downloadId=await startExtensionZipDownload(result.blob,filename);
   const started={...state,download:{...download,
    stage:'started',after_id:downloadId-1}};
   await write(()=>saveOrderFileStatus(started));state=started;
   for(const row of rows)batch.discardOrder(row.id);
   show('ZIP передан Chrome ('+reason+'); продолжаю проверку новых номеров.');
   return true;
  }catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_DOWNLOAD_FAILED');
   show('ZIP пока не начат/не подтверждён: партия сохранена в IndexedDB');
   return false;
  }
 }
 async function manualSave(){
  if(running||!pending.length)return;
  if(state.download&&!await recoverDownload(true))return;
  while(activeRows().length){
   if(!await saveBatch('вручную'))return;
  }
  if(state.download)await recoverDownload(true);
 }
 async function importFile(file,remote=false,overwrite=false){
  await init;
  if(running||getBusy()){
   show('Нельзя заменить список во время другого сканирования.');
   return;
  }
  if(!file)return;
  if(file.size>ORDER_LIST_MAX_BYTES){
   lastError='MANUAL_ORDER_LIST_FILE_TOO_LARGE';show();return;
  }
  let parsed;
  try{parsed=parseOrderListText(await file.text())}
  catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_PARSE_FAILED');show();return;
  }
  if(state&&(state.index>0||pending.length||state.found_committed>0)){
   if(remote&&!overwrite)return {status:'VISION_IMPORT_REPLACE_REQUIRES_CONFIRMATION'};
   if(!remote&&typeof globalThis.confirm==='function'&&!globalThis.confirm(
    'Импорт нового файла заменит текущий список и его сохранённый прогресс. '+
    'Сначала экспортируйте реестр и сохраните ZIP. Продолжить?'))return;
  }
  try{
   await writeChain.catch(()=>{});
   const next=await importOrderFileQueue(parsed.numbers,file.name,currentDelay);
   state=next;queue=Uint32Array.from(parsed.numbers);
   pending=[];batch=new ApprovalBatchSession();checkedSession=0;
   networkHealth=freshNetworkHealth();lastActivityAt=null;stopWithoutZip=false;
   lastError=null;restoreBlocked=false;paused=stopped=false;
   saveBtn.disabled=true;
   show('Файл принят. Уникальных номеров: '+parsed.numbers.length+
    '; удалено повторов: '+parsed.duplicates+
    '. Нажмите «Старт / продолжить по списку».');
   return {status:'VISION_IMPORT_OK'};
  }catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_IMPORT_FAILED');show();
  }
 }
 fileInput.addEventListener('change',()=>{
  const file=fileInput.files?.[0];
  fileInput.value='';
  void importFile(file);
 });
 async function reset(remote=false){
  await init;
  if(running||getBusy())return {status:'VISION_RESET_STOP_FIRST'};
  if(!remote&&typeof globalThis.confirm==='function'&&!globalThis.confirm(
   'Удалить весь импортированный список, результаты и контрольную точку? '+
   'Скачанные ZIP останутся на диске.'))return;
  try{
   await writeChain.catch(()=>{});
   await clearOrderFileQueue();
   queue=state=null;pending=[];batch=new ApprovalBatchSession();
   networkHealth=freshNetworkHealth();lastActivityAt=null;stopWithoutZip=false;
   checkedSession=0;lastError=null;restoreBlocked=false;
   paused=stopped=false;saveBtn.disabled=true;show('Список и прогресс очищены');
   return {status:'VISION_RESET_COMPLETE'};
  }catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_RESET_FAILED');show();
   return {status:'VISION_RESET_FAILED'};
  }
 }
 async function exportRegistry(){
  if(!state){show('Список ещё не загружен');return}
  try{
   const reg=await exportOrderFileRegistry();
   const json={schema:'printcheck.vision.order-file-registry.v1',
    filename:state.filename,total:state.total,index:state.index,
    next_order:queue[state.index]||null,archives_completed:state.archive_count,
    found_committed:state.found_committed,found_archived:reg.found_archived,
    found_pending:pending.map(({transfers,...other})=>other),
    failed_orders:reg.failed_orders,training_ready:false,
    imported_at:state.imported_at};
   const u=URL.createObjectURL(new Blob([JSON.stringify(json,null,2)+'\n'],
    {type:'application/json'}));
   const a=el('a');a.href=u;a.download='vision-ai-file-list-registry.json';
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(u),15000);
  }catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_REGISTRY_FAILED');show();
  }
 }
 async function start(){
  if(running||getBusy()||isClosed())return;
  await init;
  if(running||getBusy()||isClosed())return;
  if(restoreBlocked){show('Журнал повреждён. Сначала сохраните исходные данные.');return}
  if(!state||!queue){show('Сначала загрузите TXT со списком');return}
  if(!globalThis.__visionLocalTrustedTransport){
   lastError='MANUAL_MV3_TRANSPORT_REQUIRED';show();return;
  }
  if(typeof globalThis.__visionArchiveSettings==='function'){
   const target=await globalThis.__visionArchiveSettings().catch(()=>
    ({ready:false,reason:'VISION_ARCHIVE_FOLDER_CHECK_FAILED'}));
   if(!target.ready){
    lastError=target.reason||'VISION_ARCHIVE_FOLDER_REQUIRED';
    show('Перед стартом обязательно выберите папку сохранения ZIP.');
    return;
   }
  }
  const rate=validateDelay();
  if(rate===null){lastError='MANUAL_ORDER_LIST_DELAY_INVALID';show();return}
  currentDelay=rate;
  if(state.index>=state.total&&!pending.length&&!state.download){
   show('Все номера из списка проверены.');return;
  }
  running=true;paused=stopped=false;setBusy(true);
  startBtn.disabled=resetBtn.disabled=saveBtn.disabled=true;
  pauseBtn.disabled=stopBtn.disabled=false;
  let message='';
  try{
   if(state.download&&!await recoverDownload())
    throw Error('MANUAL_ORDER_LIST_ZIP_UNCONFIRMED');
   await setMode('running');
   // A legacy checkpoint may contain an incomplete, single-order batch.
   // Keep it on resume and fill to 100 instead of draining it.
   while(archiveBatchDue(activeRows())){
    if(!await saveBatch('восстановленная партия'))
     throw Error('MANUAL_ORDER_LIST_ZIP_REQUIRES_REVIEW');
   }
   while(state.index<state.total&&!paused&&!stopped&&!isClosed()){
    const id=queue[state.index],order_number=String(id);
    stage='checking_order';lastActivityAt=new Date().toISOString();
   const measured=await controlledOrderProbe(id,n=>
    probeTzForOrder(n,{explicitList:true}),{health:networkHealth});
   networkHealth=measured.health;
   const inspected=measured.result;
   if(measured.halt){
    lastError=measured.reason;
    const blocked={...state,network:networkHealth,mode:'paused',
     last_activity_at:lastActivityAt};
    await write(()=>saveOrderFileStatus(blocked));state=blocked;
    paused=true;show('Обнаружен общий сбой сети. Очередь сохранена.');
    break;
   }
    let record=null,failure=null;
    if(inspected.status==='TZ_APPROVED'){
     activeOrder=order_number;stage='collecting_approvals';
     let collected;
     try{
      await waitForPreviousOrder();
      collected=await scanOrder(explicitListOrderUrl(id),true);
     }catch{
      collected={status:'MANUAL_NATIVE_APPROVAL_QUEUE_FAILED'};
     }finally{activeOrder=null}
     if(collected?.status==='COMPLETE'&&collected.final_evidence_saved===true){
      try{
       record={
        id:order_number,order_number,collected_at:new Date().toISOString(),
        status:'TZ_APPROVED',native_status_id:'59',
        eligible_articles:collected.eligible_articles||0,
        verified_articles:collected.verified_articles||0,
        files:collected.files||0,
        transfers:batch.exportOrder(order_number)
       };
      }catch(error){
       failure={id:order_number,phase:'native_approval',
        reason:String(error?.message||'MANUAL_ORDER_LIST_MISSING_EVIDENCE')};
      }
     }else{
      failure={id:order_number,phase:'native_approval',
       reason:String(collected?.status||'MANUAL_APPROVAL_COLLECTION_INCOMPLETE')};
     }
    }else if(inspected.status!=='TZ_NOT_APPROVED'&&
      inspected.status!=='ORDER_NOT_FOUND'){
     if(!isRecoverableRangeFailure(inspected.status)){
      lastError='MANUAL_ORDER_LIST_GLOBAL_'+inspected.status;
      break;
     }
     failure={id:order_number,phase:'order_card',reason:inspected.status,
      ...(Number.isInteger(inspected.http_status)?
       {http_status:inspected.http_status}:{})};
    }
    // Stage a record together with its NEXT cursor in one IDB transaction.
    // The current item is revisited after reload if this write does not finish.
    const next={...state,index:state.index+1,
     failed_count:state.failed_count+(failure?1:0),
     delay_ms:currentDelay,mode:currentMode(),network:networkHealth,
     browser_scans:(state.browser_scans||0)+(inspected.status==='TZ_APPROVED'?1:0),
     last_activity_at:new Date().toISOString()};
    await write(()=>saveOrderFileProgress(next,record,failure));
    state=next;lastActivityAt=next.last_activity_at;
    if(record)pending.push(record);
    else batch.discardOrder(order_number);
    checkedSession++;
    if(state.download&&!await recoverDownload(false))break;
    if(archiveBatchDue(activeRows())){
     const bySize=activeBytes()>=SOFT_BATCH_PAYLOAD_LIMIT;
     if(!await saveBatch(bySize?
      'предохранительное ограничение размера':'100 утверждённых заказов'))break;
    }
    show('Последний проверенный номер: '+order_number+
     ' — '+(failure?failure.reason:inspected.status));
    if(!paused&&!stopped)await dynamicDelay();
   }
   if(((stopped&&!stopWithoutZip)||state.index>=state.total)&&pending.length){
    while(activeRows().length){
     if(!await saveBatch(stopped?'остановка':'окончание файла')){
      paused=true;break;
     }
    }
    if(state.download&&!await recoverDownload(true))paused=true;
   }
   message=lastError?'ОСТАНОВЛЕНО: '+lastError:
    paused?'ПАУЗА. Можно продолжить. Данные партии сохранены.':
    stopped?(stopWithoutZip?'Остановлено. Курсор и файлы сохранены в IndexedDB; ZIP — отдельно.':'Остановлено. Реестр и архив сохранены.'):
    state.index>=state.total?'Список полностью проверен.':'Сканирование прервано.';
  }catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_SCAN_FAILED');
   message='ОСТАНОВКА ПО ОШИБКЕ: '+lastError;
  }finally{
   activeOrder=null;running=false;setBusy(false);stage='idle';
   if(state)await setMode(stopped||state.index>=state.total?
    'stopped':'paused');
   startBtn.disabled=resetBtn.disabled=false;
   pauseBtn.disabled=stopBtn.disabled=true;
   saveBtn.disabled=!pending.length;
   refreshControls();show(message);
  }
 }
 init=(async()=>{
  const saved=await loadOrderFileState();
  if(!saved)return false;
  state=saved.state;queue=saved.queue;
  // Migrate a v0.1.13 intent without archived order IDs losslessly.
  if(state.download&&!Array.isArray(state.download.order_ids)){
   state={...state,download:{...state.download,
    order_ids:saved.pending.map(x=>x.id)}};
   await saveOrderFileStatus(state);
  }
  currentDelay=state.delay_ms;rateInput.value=String(currentDelay);
  networkHealth=normalizeNetworkHealth(state.network);
  lastActivityAt=state.last_activity_at||state.updated_at||null;
  if(saved.pending.some(x=>
   !Array.isArray(x.transfers)||!x.transfers.length))
   throw Error('MANUAL_ORDER_LIST_PENDING_INVALID');
  batch=new ApprovalBatchSession();
  for(const record of saved.pending){
   if(!state.download?.order_ids?.includes(record.id)||
     state.download?.stage==='preparing')
    batch.restoreOrder(record.id,record.transfers);
   pending.push(record);
  }
  saveBtn.disabled=!pending.length;
  show('Очередь и неполная ZIP-партия восстановлены после обновления страницы.');
  return state.mode==='running'||state.mode==='downloading';
 })().catch(error=>{
  restoreBlocked=true;lastError=String(error?.message||'MANUAL_ORDER_LIST_RESTORE_FAILED');
  show('Не удалось восстановить очередь. Данные не очищены.');return false;
 });
 init.then(auto=>{if(auto&&!isClosed())void start()});
 return {element:root,
  get activeOrder(){return activeOrder},
  get running(){return running},
  receive:(message,expectedOrder)=>batch.receive(message,expectedOrder),
  remote:async(action,payload={})=>{
   if(action==='status'){
    await init;
    let archive_audit=null;
    if(state?.download){
     const d=state.download;
     try{archive_audit=await audit('check',{after_id:d.after_id,
      byte_length:d.bytes,expected_filename:d.filename})}
     catch{archive_audit={status:'VISION_DOWNLOAD_AUDIT_UNAVAILABLE'}}
    }
    return {mode:'file',running,paused,stopped,
     archive_audit,download_details:state?.download?{
      filename:state.download.filename,bytes:state.download.bytes,
      files_verified:state.download.verified_files??null,
      files_missing:state.download.missing_files??null}:null,
     filename:state?.filename||null,total:state?.total||0,
     checked:state?.index||0,
     progress_percent:state?.total?Math.floor(100*state.index/state.total):0,
     last_activity_at:lastActivityAt||state?.updated_at||null,
     phase:stage,network:{...networkHealth},last_archive:state?.last_archive||null,
     files_archived:state?.files_committed||0,
     files_staged:pending.reduce((n,x)=>n+(x.files||0),0),
     direct_http_checks:networkHealth.attempts,
     browser_scans:state?.browser_scans||0,next_order:queue&&state?.index<state?.total?
      String(queue[state.index]):null,
     archives:state?.archive_count||0,found:state?.found_committed||0,
     pending:pending.length,downloading:!!state?.download,
     errors:state?.failed_count||0,delay_ms:currentDelay,
     blocked:restoreBlocked,error:lastError};
   }
   if(action==='import'){
    if(typeof payload.text!=='string'||payload.text.length>20_000_000||
      typeof payload.filename!=='string')
     throw Error('MANUAL_ORDER_LIST_REMOTE_IMPORT_INVALID');
    const raw=payload.text;
    const file={name:payload.filename.slice(0,120),
     size:new TextEncoder().encode(raw).length,text:async()=>raw};
    const result=await importFile(file,true,payload.overwrite===true);
    return result||{status:lastError||'VISION_IMPORT_NOT_COMPLETED'};
   }
   if(action==='delay'){
    if(!acceptedRate(payload.value))throw Error('MANUAL_ORDER_LIST_DELAY_INVALID');
    rateInput.value=String(payload.value);
    rateInput.dispatchEvent(new Event('input'));
    return {status:'VISION_DELAY_UPDATED'};
   }
   if(action==='start'){
    if(running||getBusy())return {status:'VISION_SCAN_ALREADY_RUNNING'};
    if(restoreBlocked)return {status:'VISION_SCAN_RESTORE_BLOCKED',reason:lastError};
    if(!state||!queue)return {status:'VISION_SCAN_TXT_REQUIRED'};
    if(typeof globalThis.__visionArchiveSettings==='function'){
     const place=await globalThis.__visionArchiveSettings().catch(()=>
      ({ready:false,reason:'VISION_ARCHIVE_FOLDER_CHECK_FAILED'}));
     if(!place.ready)return {status:place.reason||'VISION_ARCHIVE_FOLDER_REQUIRED'};
    }
    void start();return {status:'VISION_SCAN_START_REQUESTED'};
   }
   if(action==='pause'){pauseBtn.click();return {status:'VISION_SCAN_PAUSE_REQUESTED'}}
   if(action==='stop'){
    stopped=true;stopWithoutZip=false;await setMode('stopped');
    if(!running)await manualSave();
    return {status:'VISION_SCAN_STOP_REQUESTED'};
   }
   if(action==='save'){saveBtn.click();return {status:'VISION_SCAN_ZIP_SAVE_REQUESTED'}}
   if(action==='reset'){
    if(payload.confirmed!==true)return {status:'VISION_RESET_CONFIRMATION_REQUIRED'};
    return await reset(true);
   }
   if(action==='export'){exportBtn.click();return {status:'VISION_REGISTRY_EXPORT_REQUESTED'}}
   return {status:'VISION_REMOTE_ACTION_DENIED'};
  },
  requestPause:()=>{paused=true;void setMode('paused')},
  requestStop:()=>{
   stopped=true;stopWithoutZip=false;void setMode('stopped');
   if(!running)void manualSave();
  }
 };
}
