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
 const startBtn=button('Старт / продолжить',()=>{void start()});
 const pauseBtn=button('Пауза',()=>{paused=true;show('Пауза после текущего запроса')});
 const stopBtn=button('Стоп и архив',()=>{stopped=true;show('Остановка после текущего запроса')});
 const saveBtn=button('Сохранить неполную партию ZIP',()=>{
  if(!running&&pending.length)void saveBatch('partial manual');
 });
 const registryBtn=button('Экспорт реестра JSON',()=>{void exportRegistry()});
 const resetBtn=button('Сбросить контрольную точку',()=>{void reset()});
 controls.append(startBtn,pauseBtn,stopBtn,saveBtn,registryBtn,resetBtn);
 root.append(controls,progress);
 pauseBtn.disabled=stopBtn.disabled=saveBtn.disabled=true;
 const storage=()=>globalThis.chrome?.storage?.local;
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
   ' · ещё не архивировано: '+pending.length+
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
  // During a scan, persist at the next safe checkpoint or at pause/stop.
  // Outside a scan, persist immediately without clearing scan progress.
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
   await storage().remove(KEY);
   config=checkpoint=null;cursor=null;
   pending=[];pendingRegistry=[];failedPending=[];testedThisSession=0;
   batch=new ApprovalBatchSession();lastError=null;
   saveBtn.disabled=true;show('Сброшено');
  }catch{show('MANUAL_CHECKPOINT_RESET_FAILED')}
 }
 function audit(phase,rest={}){
  return chrome.runtime.sendMessage({op:'vision-range-download-audit-v1',phase,...rest});
 }
 async function waitForChrome(id,size){
  for(let i=0;i<240;i++){
   const data=await audit('check',{after_id:id,byte_length:size});
   if(data?.status==='RANGE_DOWNLOAD_COMPLETE')return true;
   if(data?.status!=='RANGE_DOWNLOAD_PENDING')
    throw Error(data?.status||'MANUAL_RANGE_DOWNLOAD_FAILED');
   await delay(500);
  }
  throw Error('MANUAL_RANGE_DOWNLOAD_TIMEOUT');
 }
 async function saveBatch(reason='full'){
  if(!pending.length)return true;
  let result;
  try{result=batch.finalize(pending)}
  catch(error){
   lastError=String(error?.message||'MANUAL_BATCH_ZIP_INVALID');
   show('Архив не сформирован, все текущие данные остаются в памяти.');
   return false;
  }
  const part=checkpoint.archives_completed+1;
  const filename='vision-ai-range-'+config.start+'-'+config.end+
   '-part-'+String(part).padStart(5,'0')+
   '-'+pending[0].order_number+'-'+pending.at(-1).order_number+'.zip';
  const blobUrl=URL.createObjectURL(result.blob);
  try{
   const before=await audit('baseline');
   if(before?.status!=='RANGE_DOWNLOAD_BASELINE')
    throw Error('MANUAL_RANGE_DOWNLOAD_BASELINE_FAILED');
   const anchor=create('a');anchor.href=blobUrl;anchor.download=filename;
   document.body.append(anchor);anchor.click();anchor.remove();
   show('Скачивание ZIP №'+part+' ('+pending.length+
    ' заказов). Ожидание подтверждения Chrome...');
   await waitForChrome(before.highest_id,result.blob.size);
   const next=commitRangeArchive(checkpoint,{next:cursor,found:pendingRegistry,
    failed_orders:failedPending});
   await saveCheckpoint(next);
   pending=[];pendingRegistry=[];failedPending=[];batch=new ApprovalBatchSession();
   saveBtn.disabled=true;lastError=null;
   show('ZIP №'+part+' сохранён: '+reason+'. Контрольная точка записана.');
   return true;
  }catch(error){
   lastError=String(error?.message||'MANUAL_RANGE_DOWNLOAD_UNCONFIRMED');
   saveBtn.disabled=false;
   show('Архив НЕ подтверждён; сканирование остановлено. '+
    'Проверьте загрузки Chrome, повторите сохранение кнопкой.');
   return false;
  }finally{
   setTimeout(()=>URL.revokeObjectURL(blobUrl),125000);
  }
 }
 async function start(){
  if(running||getBusy()||isClosed())return;
  try{
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
   if(pending.length>=RANGE_ARCHIVE_SIZE||batch.bytesReceived>120_000_000)
    if(!await saveBatch('recovered'))throw Error('MANUAL_BATCH_NOT_SAVED');
   while(cursor<=config.end&&!paused&&!stopped&&!isClosed()){
    const order=cursor;
    const inspected=await probeTzForOrder(order);
    let failure=null;
    if(inspected.status==='TZ_APPROVED'){
     activeOrder=String(order);
     let collected;
     try{collected=await scanOrder(rangeOrderUrl(order),true)}
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
    cursor++;testedThisSession++;
    if(pending.length>=RANGE_ARCHIVE_SIZE||batch.bytesReceived>120_000_000){
     if(!await saveBatch('100 orders / byte threshold'))break;
    }else if(!pending.length&&cursor-checkpoint.committed_next>=50){
     await saveCheckpoint(commitOnlySkipped(checkpoint,cursor,failedPending));
     failedPending=[];
    }
    if(delayDirty){
     await saveCheckpoint(changeRangeDelay(checkpoint,liveDelayMs));
    }
    show('Последняя проверка: '+order+' — '+
     (failure?'недоступна, внесена в реестр ошибок ('+failure.reason+')':
       inspected.status));
    if(!paused&&!stopped)await waitDynamicDelay();
   }
   if((stopped||cursor>config.end)&&pending.length)
    if(!await saveBatch(stopped?'stopped partial':'final partial'))paused=true;
   if(!pending.length&&(cursor>config.end||stopped||paused)&&
    cursor>checkpoint.committed_next){
    await saveCheckpoint(commitOnlySkipped(checkpoint,cursor,failedPending));
    failedPending=[];
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
   startBtn.disabled=resetBtn.disabled=false;
   pauseBtn.disabled=stopBtn.disabled=true;
   saveBtn.disabled=!pending.length;
   refreshControls();show(message);
  }
 }
 if(storage())void storage().get(KEY).then(data=>{
  const cp=data?.[KEY];
  if(cp?.schema==='printcheck.vision.range-checkpoint.v1'&&!running){
   startInput.value=String(cp.config.start);
   endInput.value=String(cp.config.end);
   rateInput.value=String(cp.config.delay_ms);
   liveDelayMs=cp.config.delay_ms;
   progress.textContent='Сохранённая контрольная точка: '+
    cp.committed_next+', архивов '+cp.archives_completed+
    '. Нажмите «Старт / продолжить» для восстановления.';
  }
 },()=>{});
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
