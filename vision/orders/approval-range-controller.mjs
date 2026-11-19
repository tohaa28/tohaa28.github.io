/**
 * M3.25: user-triggered bounded range survey on /devorders.
 * One preflight GET per order. Only exact checked native TZ status 59 is
 * eligible for native discussion collection. No remote storage, no POST.
 * The durable cursor advances ONLY after Chrome reports batch ZIP COMPLETE.
 */
import {ApprovalBatchSession} from './approval-batch-archive.mjs';
import {RANGE_MIN,RANGE_MAX,RANGE_ARCHIVE_SIZE,rangeConfig,
 rangeOrderUrl,probeTzForOrder,freshRangeCheckpoint,
 commitRangeArchive,commitOnlySkipped,isRecoverableRangeFailure,
 changeRangeDelay} from './approval-range-scanner.mjs';
import {RANGE_JOURNAL_SCHEMA,loadRangeJournal,saveRangeJournal,
 setRangeJournalMode,replaceRangeJournal,pruneRangeJournalOrders,clearRangeJournal}
 from './approval-range-persistence.mjs';

const KEY='vision-ai-approved-range-checkpoint-v1';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// The immutable scan identity is only the range and archive size.
const sameRange=(a,b)=>a?.start===b?.start&&a?.end===b?.end&&
 a?.archive_size===b?.archive_size;
const create=(tag,text)=>{
 const n=document.createElement(tag);
 if(text!==undefined)n.textContent=text;
 return n;
};
const button=(label,fn)=>{
 const el=create('button',label);el.type='button';
 el.addEventListener('click',event=>{
  event.preventDefault();event.stopPropagation();fn();
 });
 return el;
};
export function makeApprovalRangeController({
 getBusy=()=>false,setBusy=()=>{},scanOrder=async()=>null,
 isClosed=()=>false,refreshControls=()=>{}
}={}){
 const root=create('div');root.className='vlo-range';
 root.style.cssText='width:100%;border:1px solid #69898b;border-radius:8px;'+
  'padding:10px;margin:10px 0;';
 root.append(create('strong','Диапазон заказов · статус «ТЗ утверждено»'));
 root.append(create('p','Только отмеченный статус ID 59. Один GET на номер; '+
  'каждые 100 утверждённых заказов — отдельный ZIP. '+
  'Задержка 100–60000 мс изменяется во время работы. '+
  'Страница списка должна оставаться открытой.'));
 const fields=create('div');fields.style.cssText='display:flex;gap:5px;flex-wrap:wrap';
 const input=(caption,value)=>{
  const label=create('label',caption+' ');
  const el=create('input');el.type='number';el.value=String(value);
  el.style.cssText='max-width:105px;min-width:76px;color:#203436;'+
   'background:#f2f8f3;padding:5px;border-radius:4px';
  label.append(el);fields.append(label);return el;
 };
 const startInput=input('От',RANGE_MIN),endInput=input('До',RANGE_MAX),
  rateInput=input('Задержка, мс',1200);
 startInput.min=endInput.min=String(RANGE_MIN);
 startInput.max=endInput.max=String(RANGE_MAX);
 rateInput.min='100';rateInput.max='60000';rateInput.step='100';
 rateInput.title='Задержка после обработки каждого номера: 100–60000 мс. Изменения применяются без сброса диапазона.';
 root.append(fields);
 const controls=create('div');controls.className='vlo-actions';
 const progress=create('p','Диапазон не запущен.');
 progress.style.whiteSpace='pre-line';
 let running=false,paused=false,stopped=false,activeOrder=null;
 let checkpoint=null,config=null,cursor=null,pending=[],pendingRegistry=[],failedPending=[];
 let batch=new ApprovalBatchSession(),testedThisSession=0,lastError=null;
 let liveDelayMs=1200,delayDirty=false,checkpointWrite=Promise.resolve();
 let journalWrite=Promise.resolve(),initialLoadPromise=Promise.resolve();
 let inflightDownload=null,restoreBlocked=false;
 const activePending=()=>pending.filter(x=>!inflightDownload?.order_numbers?.includes(x.order_number));
 const activeBytes=()=>[...batch.transfers.values()].reduce((n,t)=>
  n+(inflightDownload?.order_numbers?.includes(t.order)?0:t.size||0),0);
 const startBtn=button('Старт / продолжить',()=>{void start()});
 const pauseBtn=button('Пауза',()=>{
  paused=true;void persistMode('paused');show('Пауза после текущего запроса');
 });
 const stopBtn=button('Стоп и архив',()=>{
  stopped=true;void persistMode('stopped');show('Остановка после текущего запроса');
 });
 const saveBtn=button('Сохранить неполную партию ZIP',()=>{
  if(running||!pending.length)return;
  void (async()=>{
   if(inflightDownload){
    if(typeof globalThis.confirm==='function'&&!globalThis.confirm(
     'Предыдущая загрузка ZIP не подтверждена. Проверьте папку загрузок Chrome. '+
     'Повторное сохранение может создать дубликат архива. Продолжить?'))return;
    inflightDownload=null;
    await persistJournal('paused');
   }
   await saveBatch('partial manual');
  })().catch(error=>{lastError=String(error?.message||'MANUAL_ARCHIVE_RETRY_FAILED');show()});
 });
 const registryBtn=button('Экспорт реестра JSON',()=>{void exportRegistry()});
 const resetBtn=button('Сбросить контрольную точку',()=>{void reset()});
 controls.append(startBtn,pauseBtn,stopBtn,saveBtn,registryBtn,resetBtn);
 root.append(controls,progress);
 pauseBtn.disabled=stopBtn.disabled=saveBtn.disabled=true;
 const storage=()=>globalThis.chrome?.storage?.local;
 function currentMode(){
  return stopped?'stopped':paused?'paused':running?'running':'paused';
 }
 function journalSnapshot(mode=currentMode()){
  return {
   schema:RANGE_JOURNAL_SCHEMA,
   config:{start:config.start,end:config.end,archive_size:config.archive_size},
   archives_completed:checkpoint.archives_completed,
   committed_next:checkpoint.committed_next,
   cursor,pending_registry:pendingRegistry.slice(),
   failed_pending:failedPending.slice(),delay_ms:liveDelayMs,
   download:inflightDownload,mode,updated_at:new Date().toISOString()
  };
 }
 async function persistJournal(mode=currentMode(),orderRecord=null){
  const snapshot=journalSnapshot(mode);
  journalWrite=journalWrite.catch(()=>{}).then(()=>
   saveRangeJournal(snapshot,orderRecord));
  await journalWrite;
 }
 async function persistMode(mode){
  if(!checkpoint||!config)return;
  journalWrite=journalWrite.catch(()=>{}).then(()=>
   setRangeJournalMode(mode,liveDelayMs));
  try{await journalWrite}catch(error){
   lastError=String(error?.message||'MANUAL_RANGE_MODE_SAVE_FAILED');show();
  }
 }
 function show(message=''){
  const cp=checkpoint;
  progress.textContent=(cp?
   'Диапазон '+cp.config.start+'–'+cp.config.end+
   ' · задержка (фактическая) '+liveDelayMs+' мс':
   'Контрольная точка не загружена')+
   '\nСледующий номер: '+(cursor??cp?.committed_next??'—')+
   ' · проверено сейчас: '+testedThisSession+
   ' · архивов: '+(cp?.archives_completed||0)+
   ' · найдено и архивировано: '+(cp?.found_committed||0)+
   ' · текущая партия: '+activePending().length+
   ' · ZIP загружается: '+(inflightDownload?1:0)+
   ' · ошибок открытия (реестр): '+
    ((cp?.failed_orders?.length||0)+failedPending.length)+
   (lastError?'\nОшибка: '+lastError:'')+
   (message?'\n'+message:'');
 }
 async function saveCheckpoint(next){
  if(!storage())throw Error('MANUAL_CHROME_STORAGE_UNAVAILABLE');
  // Serialize writes and always persist the latest live delay, preventing
  // a stale rate update from rolling back the committed cursor.
  const snapshot=changeRangeDelay(next,liveDelayMs);
  checkpointWrite=checkpointWrite.catch(()=>{}).then(()=>
   storage().set({[KEY]:snapshot}));
  await checkpointWrite;
  checkpoint=snapshot;
  delayDirty=liveDelayMs!==snapshot.config.delay_ms;
 }
 function validateDelayInput(){
  const value=Number(rateInput.value);
  return Number.isSafeInteger(value)&&value>=100&&value<=60000?
   value:null;
 }
 rateInput.addEventListener('input',()=>{
  const nextDelay=validateDelayInput();
  if(nextDelay===null){
   show('Некорректная задержка: разрешено от 100 до 60000 мс. '+
    'Продолжаю с '+liveDelayMs+' мс.');
   return;
  }
  if(nextDelay===liveDelayMs)return;
  liveDelayMs=nextDelay;
  delayDirty=true;
  if(config)config={...config,delay_ms:liveDelayMs};
  show('Новая задержка '+liveDelayMs+' мс применена к текущему обходу.');
  // Persist live delay in the crash journal even during the sleep window.
  if(checkpoint&&config)void persistMode(currentMode());
  if(checkpoint&&!running)void saveCheckpoint(
   changeRangeDelay(checkpoint,liveDelayMs)).catch(()=>{
    lastError='MANUAL_DELAY_SAVE_FAILED';show();
   });
 });
 rateInput.addEventListener('change',()=>{
  if(validateDelayInput()===null){
   rateInput.value=String(liveDelayMs);
   show('Восстановлено допустимое время задержки: '+liveDelayMs+' мс.');
  }
 });
 async function waitDynamicDelay(){
  const started=performance.now();
  while(!paused&&!stopped&&!isClosed()){
   const remaining=liveDelayMs-(performance.now()-started);
   if(remaining<=0)break;
   await delay(Math.min(remaining,100));
  }
 }
 async function loadCheckpoint(nextConfig){
  if(!storage())throw Error('MANUAL_CHROME_STORAGE_UNAVAILABLE');
  const data=await storage().get(KEY);
  const cp=data?.[KEY];
  if(cp){
   if(cp.schema!=='printcheck.vision.range-checkpoint.v1'||
    !sameRange(cp.config,nextConfig)||
    !Number.isSafeInteger(cp.committed_next)||
    cp.committed_next<nextConfig.start||cp.committed_next>nextConfig.end+1||
    !Array.isArray(cp.registry))
    throw Error('MANUAL_CHECKPOINT_CONFIG_CONFLICT_RESET_REQUIRED');
   if(cp.config.delay_ms!==nextConfig.delay_ms){
    await saveCheckpoint(changeRangeDelay(cp,nextConfig.delay_ms));
    return checkpoint;
   }
   return cp;
  }
  const first=freshRangeCheckpoint(nextConfig);
  await saveCheckpoint(first);
  return first;
 }
 function registryObject(){
  return {
   schema:'printcheck.vision.approved-order-registry.v1',
   config:checkpoint.config,committed_next:checkpoint.committed_next,
   cursor_now:cursor,archives_completed:checkpoint.archives_completed,
   checked_committed:checkpoint.checked_committed,
   found_archived:checkpoint.registry,
   found_pending:pendingRegistry,
   failed_orders:checkpoint.failed_orders||[],
   failed_pending:failedPending,
   training_ready:false
  };
 }
 async function exportRegistry(){
  try{
   if(!checkpoint){
    const cp=(await storage()?.get(KEY))?.[KEY];
    if(!cp){show('Реестр ещё не создан');return}
    checkpoint=cp;
   }
   const url=URL.createObjectURL(new Blob(
    [JSON.stringify(registryObject(),null,2)+'\n'],{type:'application/json'}));
   const a=create('a');a.href=url;
   a.download='vision-ai-approved-orders-register.json';
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch{show('MANUAL_REGISTRY_EXPORT_FAILED')}
 }
 async function reset(){
  if(running||getBusy())return;
  if(typeof globalThis.confirm==='function'&&!globalThis.confirm(
   'Очистить реестр и контрольную точку диапазона? Уже загруженные ZIP останутся на диске.'))
   return;
  try{
   await journalWrite.catch(()=>{});
   await checkpointWrite.catch(()=>{});
   await clearRangeJournal();
   await storage().remove(KEY);
   config=checkpoint=null;cursor=null;inflightDownload=null;restoreBlocked=false;
   pending=[];pendingRegistry=[];failedPending=[];testedThisSession=0;
   batch=new ApprovalBatchSession();lastError=null;
   saveBtn.disabled=true;show('Сброшено');
  }catch{show('MANUAL_CHECKPOINT_RESET_FAILED')}
 }
 function audit(phase,rest={}){
  return chrome.runtime.sendMessage({op:'vision-range-download-audit-v1',phase,...rest});
 }
 async function waitForChrome(id,size,filename){
  for(let i=0;i<240;i++){
   const data=await audit('check',{after_id:id,byte_length:size,
    expected_filename:filename});
   if(data?.status==='RANGE_DOWNLOAD_COMPLETE')return true;
   if(data?.status!=='RANGE_DOWNLOAD_PENDING')
    throw Error(data?.status||'MANUAL_RANGE_DOWNLOAD_FAILED');
   await delay(500);
  }
  throw Error('MANUAL_RANGE_DOWNLOAD_TIMEOUT');
 }
 async function commitConfirmedArchive(reason){
  const info=inflightDownload;
  if(!info)return;
  const ids=info.order_numbers||pendingRegistry.map(x=>x.order_number);
  const selected=new Set(ids);
  const found=pendingRegistry.filter(x=>selected.has(x.order_number));
  if(found.length!==ids.length||!found.length)
   throw Error('MANUAL_RANGE_ARCHIVE_ROWS_LOST');
  const next=commitRangeArchive(checkpoint,{
   next:info.end_cursor??cursor,found,
   failed_orders:info.failed_orders||failedPending
  });
  // Crash between checkpoint and IDB prune is reconciled on reload.
  await saveCheckpoint(next);
  pendingRegistry=pendingRegistry.filter(x=>!selected.has(x.order_number));
  pending=pendingRegistry.slice();
  const oldFailures=info.failed_orders||failedPending;
  failedPending=failedPending.filter(x=>!oldFailures.some(y=>y.order_number===x.order_number));
  inflightDownload=null;
  for(const id of ids)batch.discardOrder(id);
  await journalWrite.catch(()=>{});
  await pruneRangeJournalOrders(journalSnapshot(currentMode()),ids);
  saveBtn.disabled=running||!pending.length;lastError=null;
  show('ZIP №'+next.archives_completed+' подтверждён: '+reason+
   '. Новая партия и курсор сохранены.');
 }
 async function waitForPreviousOrderTab(){
  // A site reload can interrupt collection while its old tab is still live.
  for(let i=0;i<210;i++){
   const status=await chrome.runtime.sendMessage({
    op:'vision-approval-queue-status-v1'}).catch(()=>null);
   if(status?.status!=='QUEUE_STATUS_OK')
    throw Error('MANUAL_QUEUE_STATUS_UNAVAILABLE');
   if(!status.busy)return;
   await delay(1000);
  }
  throw Error('MANUAL_OLD_ORDER_TAB_STILL_RUNNING');
 }
 async function recoverDownload(waitForCompletion=false){
  if(!inflightDownload)return true;
  const d=inflightDownload;
  try{
   if(waitForCompletion){
    await waitForChrome(d.after_id,d.byte_length,d.filename);
    await commitConfirmedArchive('Chrome подтвердил завершение ZIP');
    return true;
   }
   const res=await audit('check',{
    after_id:d.after_id,byte_length:d.byte_length,expected_filename:d.filename
   });
   if(res?.status==='RANGE_DOWNLOAD_COMPLETE'){
    await commitConfirmedArchive('Chrome подтвердил завершение ZIP');return true;
   }
   if(res?.status==='RANGE_DOWNLOAD_PENDING')return true;
   throw Error(res?.status||'MANUAL_RANGE_DOWNLOAD_AUDIT_FAILED');
  }catch(error){
   lastError='MANUAL_ZIP_DOWNLOAD_UNCONFIRMED_'+
    String(error?.message||'UNKNOWN').slice(0,50);
   show('ZIP не подтверждён, исходные материалы сохранены.');
   return false;
  }
 }
 async function saveBatch(reason='full'){
  let rows=activePending();
  if(!rows.length)return true;
  if(inflightDownload){
   // Backpressure only when the following 100-order batch is ready.
   if(!await recoverDownload(true))return false;
   rows=activePending();
   if(!rows.length)return true;
  }
  let result;
  try{result=batch.finalize(rows)}
  catch(error){
   lastError=String(error?.message||'MANUAL_BATCH_ZIP_INVALID');
   show('Архив не сформирован, данные остаются в IndexedDB.');
   return false;
  }
  const part=checkpoint.archives_completed+1;
  const filename='vision-ai-range-'+config.start+'-'+config.end+
   '-part-'+String(part).padStart(5,'0')+
   '-'+rows[0].order_number+'-'+rows.at(-1).order_number+'.zip';
  const blobUrl=URL.createObjectURL(result.blob);
  try{
   const before=await audit('baseline');
   if(before?.status!=='RANGE_DOWNLOAD_BASELINE')
    throw Error('MANUAL_RANGE_DOWNLOAD_BASELINE_FAILED');
   inflightDownload={after_id:before.highest_id,
    byte_length:result.blob.size,filename,part,end_cursor:cursor,
    order_numbers:rows.map(x=>x.order_number),
    failed_orders:failedPending.slice()};
   await persistJournal(currentMode());
   const a=create('a');a.href=blobUrl;a.download=filename;
   document.body.append(a);a.click();a.remove();
   show('ZIP №'+part+' загружается; просмотр следующих номеров продолжается.');
   return true;
  }catch(error){
   lastError=String(error?.message||'MANUAL_RANGE_DOWNLOAD_UNCONFIRMED');
   show('ZIP не подтверждён, исходные данные сохранены.');
   return false;
  }finally{setTimeout(()=>URL.revokeObjectURL(blobUrl),125000)}
 }
 async function start(){
  if(running||getBusy()||isClosed())return;
  await initialLoadPromise;
  if(running||getBusy()||isClosed())return;
  try{
   if(restoreBlocked)throw Error('MANUAL_RANGE_JOURNAL_REPAIR_REQUIRED');
   const selected=rangeConfig(startInput.value,endInput.value,rateInput.value);
   if(!storage()||typeof globalThis.__visionLocalTrustedTransport!=='function')
    throw Error('MANUAL_MV3_TRANSPORT_AND_STORAGE_REQUIRED');
   if(config&&!sameRange(config,selected))
    throw Error('MANUAL_RANGE_INPUT_CHANGED_RESET_REQUIRED');
   liveDelayMs=selected.delay_ms;
   if(!checkpoint){
    checkpoint=await loadCheckpoint(selected);
    cursor=checkpoint.committed_next;
   }else if(checkpoint.config.delay_ms!==selected.delay_ms){
    await saveCheckpoint(changeRangeDelay(checkpoint,selected.delay_ms));
   }
   config=selected;
   if(cursor>config.end){show('Весь диапазон проверен');return}
   lastError=null;
  }catch(error){
   lastError=String(error?.message||'MANUAL_RANGE_INPUT_INVALID');
   show();return;
  }
  running=true;paused=false;stopped=false;setBusy(true);
  startBtn.disabled=resetBtn.disabled=saveBtn.disabled=true;
  pauseBtn.disabled=stopBtn.disabled=false;
  let message='';
  try{
   if(inflightDownload&&!await recoverDownload(false))
    throw Error('MANUAL_ZIP_DOWNLOAD_REQUIRES_REVIEW');
   await persistJournal('running');
   if(activePending().length>=RANGE_ARCHIVE_SIZE||activeBytes()>120_000_000)
    if(!await saveBatch('recovered'))throw Error('MANUAL_BATCH_NOT_SAVED');
   while(cursor<=config.end&&!paused&&!stopped&&!isClosed()){
    const order=cursor;
    const inspected=await probeTzForOrder(order);
    let failure=null,orderRecord=null;
    if(inspected.status==='TZ_APPROVED'){
     activeOrder=String(order);
     let collected;
     try{
      await waitForPreviousOrderTab();
      collected=await scanOrder(rangeOrderUrl(order),true);
     }
     catch{collected={status:'MANUAL_NATIVE_APPROVAL_QUEUE_FAILED'}}
     finally{activeOrder=null}
     if(collected?.status!=='COMPLETE'||collected?.final_evidence_saved!==true){
      // The order URL may have disappeared, timed out or closed in its
      // temporary tab. Never block the entire numeric survey for it.
      // Keep a retry record; do not mark it as a verified training case.
      const reason=isRecoverableRangeFailure(collected?.status)?
       collected.status:'MANUAL_APPROVAL_COLLECTION_INCOMPLETE';
      failure={order_number:String(order),reason,phase:'native_approval',
       observed_status:String(collected?.status||'UNKNOWN').slice(0,80)};
     }else{
      const record={
       order_number:String(order),status:'TZ_APPROVED',
       native_status_id:'59',eligible_articles:collected.eligible_articles||0,
       verified_articles:collected.verified_articles||0,
       files:collected.files||0,collected_at:new Date().toISOString()
      };
      // Export only fully received transfers. Commit this order's binaries
      // and cursor in one IndexedDB transaction before moving to the next.
      orderRecord={order_number:String(order),
       transfers:batch.exportOrder(String(order))};
      pending.push(record);pendingRegistry.push(record);
     }
    }else if(inspected.status!=='TZ_NOT_APPROVED'&&
      inspected.status!=='ORDER_NOT_FOUND'){
     // Auth errors and rate-limit responses are global failures, not
     // individual inaccessible pages. Pause to avoid false mass skips.
     if(!isRecoverableRangeFailure(inspected.status)){
      lastError='MANUAL_ORDER_PROBE '+String(inspected.status);
      break;
     }
     failure={order_number:String(order),reason:inspected.status,
      phase:'order_card',
      ...(Number.isInteger(inspected.http_status)?
       {http_status:inspected.http_status}:{})};
    }
    if(failure)failedPending.push(failure);
    if(!orderRecord)batch.discardOrder(String(order));
    cursor++;testedThisSession++;
    await persistJournal(currentMode(),orderRecord);
    if(inflightDownload&&!await recoverDownload(false))break;
    if(activePending().length>=RANGE_ARCHIVE_SIZE||activeBytes()>120_000_000||
      (inflightDownload&&batch.bytesReceived>160_000_000)){
     if(!await saveBatch('100 orders / byte threshold'))break;
    }else if(!pending.length&&!inflightDownload&&cursor-checkpoint.committed_next>=50){
     await saveCheckpoint(commitOnlySkipped(checkpoint,cursor,failedPending));
     failedPending=[];
     await persistJournal(currentMode());
    }
    if(delayDirty){
     await saveCheckpoint(changeRangeDelay(checkpoint,liveDelayMs));
    }
    show('Последняя проверка: '+order+' — '+
     (failure?'недоступна, внесена в реестр ошибок ('+failure.reason+')':
       inspected.status));
    if(!paused&&!stopped)await waitDynamicDelay();
   }
   if((stopped||cursor>config.end)&&pending.length){
    if(activePending().length&&
      !await saveBatch(stopped?'stopped partial':'final partial'))paused=true;
    if(inflightDownload&&!await recoverDownload(true))paused=true;
   }
   if(!pending.length&&!inflightDownload&&(cursor>config.end||stopped||paused)&&
    cursor>checkpoint.committed_next){
    await saveCheckpoint(commitOnlySkipped(checkpoint,cursor,failedPending));
    failedPending=[];
    await persistJournal(currentMode());
   }
   if(delayDirty){
    await saveCheckpoint(changeRangeDelay(checkpoint,liveDelayMs));
   }
   message=lastError?'ОСТАНОВКА: общий сбой авторизации, лимит запросов или сохранения.':
    paused?'ПАУЗА. Можно продолжить; неполная партия остаётся в памяти.':
    stopped?'Остановлено, сохранён частичный архив.':
    cursor>config.end?'Диапазон полностью проверен.':'Сканирование завершено.';
  }catch(error){
   lastError=String(error?.message||'MANUAL_RANGE_SCAN_FAILED');
   message='Остановка по ошибке: '+lastError;
  }finally{
   activeOrder=null;running=false;setBusy(false);
   if(checkpoint){
    try{await persistJournal(stopped||cursor>config.end?'stopped':'paused')}
    catch(error){lastError=String(error?.message||'MANUAL_RANGE_FINAL_JOURNAL_FAILED')}
   }
   startBtn.disabled=resetBtn.disabled=false;
   pauseBtn.disabled=stopBtn.disabled=true;
   saveBtn.disabled=!pending.length;
   refreshControls();show(message);
  }
 }
 if(storage())initialLoadPromise=(async()=>{
  const cp=(await storage().get(KEY))?.[KEY];
  if(cp?.schema!=='printcheck.vision.range-checkpoint.v1')return false;
  checkpoint=cp;config={...cp.config};cursor=cp.committed_next;
  startInput.value=String(cp.config.start);
  endInput.value=String(cp.config.end);
  rateInput.value=String(cp.config.delay_ms);
  liveDelayMs=cp.config.delay_ms;
  let autoResume=false;
  const {journal,orders}=await loadRangeJournal();
  if(journal){
   const same=sameRange(journal.config,cp.config);
   const compatible=same&&journal.archives_completed===cp.archives_completed&&
    journal.cursor>=cp.committed_next&&journal.cursor<=cp.config.end+1;
   autoResume=journal.mode==='running'||journal.mode==='downloading';
   if(compatible){
    if(journal.pending_registry.length!==orders.length||
     journal.pending_registry.length>RANGE_ARCHIVE_SIZE||
     !journal.pending_registry.every(r=>
      orders.some(o=>o.order_number===r.order_number)))
     throw Error('MANUAL_RANGE_JOURNAL_INCOMPLETE');
    const rate=rangeConfig(cp.config.start,cp.config.end,journal.delay_ms);
    liveDelayMs=rate.delay_ms;rateInput.value=String(liveDelayMs);
    pendingRegistry=journal.pending_registry.slice();
    pending=pendingRegistry.slice();
    failedPending=journal.failed_pending.slice();
    cursor=journal.cursor;
    inflightDownload=journal.download||null;
    for(const item of orders)batch.restoreOrder(item.order_number,item.transfers);
   }else{
    // Archive checkpoint is authoritative after a completed download.
    // Discard only an older journal, never the committed archive registry.
    await clearRangeJournal();
    autoResume=autoResume&&same;
   }
  }
  saveBtn.disabled=!pending.length;
  show(journal?'Сканирование восстановлено после обновления страницы.':
   'Найдена сохранённая контрольная точка. Нажмите «Старт / продолжить».');
  return autoResume;
 })().catch(error=>{
  lastError=String(error?.message||'MANUAL_RANGE_RESTORE_FAILED');
  restoreBlocked=true;
  show('Ошибка восстановления; данные не сброшены.');return false;
 });
 initialLoadPromise.then(shouldResume=>{
  if(shouldResume&&!isClosed())void start();
 });
 return {
  element:root,
  get activeOrder(){return activeOrder},
  get running(){return running},
  get pendingCount(){return pending.length},
  receive:(message,expectedOrder)=>batch.receive(message,expectedOrder),
  requestPause:()=>{paused=true},
  requestStop:()=>{stopped=true}
 };
}
