/**
 * Vision AI: scan only IDs explicitly imported from a local TXT file.
 * Independent of numeric range mode. Durable state and unarchived bytes are
 * maintained on the devorders origin in IndexedDB across automatic reloads.
 */
import {parseOrderListText,explicitListOrderUrl,ORDER_LIST_MAX_BYTES}
 from './approval-file-list.mjs';
import {probeTzForOrder,isRecoverableRangeFailure} from './approval-range-scanner.mjs';
import {ApprovalBatchSession} from './approval-batch-archive.mjs';
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
  'границ режима диапазона. До 100 утверждённых заказов в ZIP.'));
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
 const stopBtn=button('Стоп и архив списка',()=>{stopped=true;void setMode('stopped');show('Сохраню неполную ZIP-партию после текущего заказа')});
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
   ' · ZIP загружается: '+(state?.download?1:0)+
   ' · ошибок открытия: '+(state?.failed_count||0)+
   (lastError?'\nОшибка: '+lastError:'')+
   (message?'\n'+message:'');
 }
 const activeRows=()=>pending.filter(row=>!state?.download?.order_ids?.includes(row.id));
 const activeBytes=()=>activeRows().reduce((sum,row)=>sum+
  row.transfers.reduce((n,t)=>n+(t.data?.byteLength||0),0),0);
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
   found_committed:state.found_committed+rows.length,mode:currentMode()};
  await write(()=>commitOrderFileArchive(updated,rows));
  state=updated;pending=pending.filter(x=>!selected.has(x.id));
  for(const id of ids)batch.discardOrder(id);
  saveBtn.disabled=running||!activeRows().length;lastError=null;
  show('ZIP №'+state.archive_count+' подтверждён; новая партия сохранена.');
 }
 async function recoverDownload(waitForCompletion=false){
  const info=state?.download;
  if(!info)return true;
  try{
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
   show('Не удалось подтвердить ZIP. Непроверенные записи и вложения сохранены.');
   return false;
  }
 }
 async function saveBatch(reason){
  let rows=activeRows();
  if(!rows.length)return true;
  // At most one downloading ZIP and one following staged batch. Scan
  // continues up to the next full batch; then apply bounded backpressure.
  if(state.download){
   if(!await recoverDownload(true))return false;
   rows=activeRows();
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
  const url=URL.createObjectURL(result.blob);
  try{
   const before=await audit('baseline');
   if(before?.status!=='RANGE_DOWNLOAD_BASELINE')
    throw Error('MANUAL_ORDER_LIST_DOWNLOAD_BASELINE');
   const download={after_id:before.highest_id,bytes:result.blob.size,
    filename,order_ids:rows.map(x=>x.id)};
   const snapshot={...state,download,mode:currentMode()};
   await write(()=>saveOrderFileStatus(snapshot));
   state=snapshot;
   const a=el('a');a.href=url;a.download=filename;
   document.body.append(a);a.click();a.remove();
   // The ZIP blob and IndexedDB retain the old batch. Release its in-memory
   // transfer buffers so the next batch can collect up to 180 MB safely.
   for(const row of rows)batch.discardOrder(row.id);
   show('ZIP загружается ('+reason+'); проверка следующих номеров продолжается.');
   // Confirm asynchronously in subsequent scan iterations or on reload.
   return true;
  }catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_DOWNLOAD_FAILED');
   show('ZIP не подтверждён; данные партии остаются в IndexedDB');
   return false;
  }finally{setTimeout(()=>URL.revokeObjectURL(url),125000)}
 }
 async function manualSave(){
  if(running||!pending.length)return;
  if(state.download&&!await recoverDownload(true))return;
  await saveBatch('вручную');
  if(state.download)await recoverDownload(true);
 }
 async function importFile(file){
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
  if(state&&(state.index>0||pending.length||state.found_committed>0)&&
   typeof globalThis.confirm==='function'&&!globalThis.confirm(
    'Импорт нового файла заменит текущий список и его сохранённый прогресс. '+
    'Сначала экспортируйте реестр и сохраните ZIP. Продолжить?'))return;
  try{
   await writeChain.catch(()=>{});
   const next=await importOrderFileQueue(parsed.numbers,file.name,currentDelay);
   state=next;queue=Uint32Array.from(parsed.numbers);
   pending=[];batch=new ApprovalBatchSession();checkedSession=0;
   lastError=null;restoreBlocked=false;paused=stopped=false;
   saveBtn.disabled=true;
   show('Файл принят. Уникальных номеров: '+parsed.numbers.length+
    '; удалено повторов: '+parsed.duplicates+
    '. Нажмите «Старт / продолжить по списку».');
  }catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_IMPORT_FAILED');show();
  }
 }
 fileInput.addEventListener('change',()=>{
  const file=fileInput.files?.[0];
  fileInput.value='';
  void importFile(file);
 });
 async function reset(){
  await init;
  if(running||getBusy())return;
  if(typeof globalThis.confirm==='function'&&!globalThis.confirm(
   'Удалить весь импортированный список, результаты и контрольную точку? '+
   'Скачанные ZIP останутся на диске.'))return;
  try{
   await writeChain.catch(()=>{});
   await clearOrderFileQueue();
   queue=state=null;pending=[];batch=new ApprovalBatchSession();
   checkedSession=0;lastError=null;restoreBlocked=false;
   paused=stopped=false;saveBtn.disabled=true;show('Список и прогресс очищены');
  }catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_RESET_FAILED');show();
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
  const rate=validateDelay();
  if(rate===null){lastError='MANUAL_ORDER_LIST_DELAY_INVALID';show();return}
  currentDelay=rate;
  if(state.index>=state.total&&!pending.length){
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
   if(activeRows().length>=100||activeBytes()>120_000_000)
    if(!await saveBatch('восстановленная партия'))
     throw Error('MANUAL_ORDER_LIST_ZIP_REQUIRES_REVIEW');
   while(state.index<state.total&&!paused&&!stopped&&!isClosed()){
    const id=queue[state.index],order_number=String(id);
    const inspected=await probeTzForOrder(id,{explicitList:true});
    let record=null,failure=null;
    if(inspected.status==='TZ_APPROVED'){
     activeOrder=order_number;
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
     delay_ms:currentDelay,mode:currentMode()};
    await write(()=>saveOrderFileProgress(next,record,failure));
    state=next;
    if(record)pending.push(record);
    else batch.discardOrder(order_number);
    checkedSession++;
    if(state.download&&!await recoverDownload(false))break;
    if(activeRows().length>=100||activeBytes()>120_000_000){
     if(!await saveBatch('100 заказов / ограничение размера'))break;
    }
    show('Последний проверенный номер: '+order_number+
     ' — '+(failure?failure.reason:inspected.status));
    if(!paused&&!stopped)await dynamicDelay();
   }
   if((stopped||state.index>=state.total)&&pending.length){
    if(activeRows().length&&!await saveBatch(stopped?'остановка':'окончание файла'))
     paused=true;
    if(state.download&&!await recoverDownload(true))paused=true;
   }
   message=lastError?'ОСТАНОВЛЕНО: '+lastError:
    paused?'ПАУЗА. Можно продолжить. Данные партии сохранены.':
    stopped?'Остановлено. Реестр и архив сохранены.':
    state.index>=state.total?'Список полностью проверен.':'Сканирование прервано.';
  }catch(error){
   lastError=String(error?.message||'MANUAL_ORDER_LIST_SCAN_FAILED');
   message='ОСТАНОВКА ПО ОШИБКЕ: '+lastError;
  }finally{
   activeOrder=null;running=false;setBusy(false);
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
  if(saved.pending.some(x=>
   !Array.isArray(x.transfers)||!x.transfers.length))
   throw Error('MANUAL_ORDER_LIST_PENDING_INVALID');
  batch=new ApprovalBatchSession();
  for(const record of saved.pending){
   if(!state.download?.order_ids?.includes(record.id))
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
  requestPause:()=>{paused=true;void setMode('paused')},
  requestStop:()=>{stopped=true;void setMode('stopped')}
 };
}
