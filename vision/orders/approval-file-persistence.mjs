/**
 * File-list scanner durable journal (site-origin IndexedDB, no uploads).
 * Keep the potentially 1,000,000-item queue in a separate immutable object:
 * advancing each cursor updates a small status record, not 3 MB of IDs.
 * The order and cursor are committed in one IDB transaction.
 */
export const LIST_DB_NAME='vision-ai-approved-file-list-v1';
export const LIST_STATUS_SCHEMA='printcheck.vision.order-file-list.v1';
const STORE_QUEUE='queue',STORE_STATE='state',STORE_PENDING='pending';
const STORE_SUCCESS='success',STORE_FAILURES='failures';
const STORES=[STORE_QUEUE,STORE_STATE,STORE_PENDING,STORE_SUCCESS,STORE_FAILURES];
const KEY='active';
const checkState=s=>{
 if(s?.schema!==LIST_STATUS_SCHEMA||
  !Number.isSafeInteger(s.index)||s.index<0||
  !Number.isSafeInteger(s.total)||s.total<1||
  !Number.isSafeInteger(s.archive_count)||s.archive_count<0||
  !Number.isSafeInteger(s.found_committed)||s.found_committed<0||
  !Number.isSafeInteger(s.delay_ms)||s.delay_ms<100||s.delay_ms>60000||
  !['running','paused','stopped','downloading'].includes(s.mode))
  throw Error('MANUAL_ORDER_LIST_STATE_INVALID');
};
async function openDb(factory=globalThis.indexedDB){
 if(!factory?.open)throw Error('MANUAL_ORDER_LIST_INDEXEDDB_UNAVAILABLE');
 return new Promise((resolve,reject)=>{
  const req=factory.open(LIST_DB_NAME,1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   for(const store of STORES)
    if(!db.objectStoreNames.contains(store))
     db.createObjectStore(store,{keyPath:'id'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(Error('MANUAL_ORDER_LIST_DB_OPEN_FAILED'));
  req.onblocked=()=>reject(Error('MANUAL_ORDER_LIST_DB_BLOCKED'));
 });
}
/** Do not await promises inside an active IDB transaction. */
async function transact(stores,mode,build,factory){
 const db=await openDb(factory);
 try{
  return await new Promise((resolve,reject)=>{
   let tx,extract;
   try{
    tx=db.transaction(stores,mode);
    extract=build(tx);
   }catch(error){reject(error);return}
   tx.oncomplete=()=>{
    try{resolve(typeof extract==='function'?extract():undefined)}
    catch(error){reject(error)}
   };
   tx.onabort=()=>reject(Error('MANUAL_ORDER_LIST_DB_TRANSACTION_ABORTED'));
   tx.onerror=()=>reject(Error('MANUAL_ORDER_LIST_DB_TRANSACTION_FAILED'));
  });
 }finally{db.close()}
}
export async function loadOrderFileState(factory){
 return transact([STORE_QUEUE,STORE_STATE,STORE_PENDING],'readonly',tx=>{
  const queue=tx.objectStore(STORE_QUEUE).get(KEY);
  const state=tx.objectStore(STORE_STATE).get(KEY);
  const pending=tx.objectStore(STORE_PENDING).getAll();
  return ()=>{
   if(!queue.result&&!state.result)return null;
   if(!queue.result||!state.result)
    throw Error('MANUAL_ORDER_LIST_INCOMPLETE_STATE');
   checkState(state.result);
   if(!(queue.result.numbers instanceof Uint32Array)||
    queue.result.numbers.length!==state.result.total||
    state.result.index>state.result.total)
    throw Error('MANUAL_ORDER_LIST_QUEUE_CORRUPTED');
   const orders=pending.result||[];
   if(orders.length>100||orders.some(x=>!/^[0-9]{7}$/.test(x.id)||
    !Array.isArray(x.transfers)))
    throw Error('MANUAL_ORDER_LIST_PENDING_CORRUPTED');
   return {queue:queue.result.numbers,state:state.result,pending:orders};
  };
 },factory);
}
export async function importOrderFileQueue(numbers,filename,delayMs=1200,factory){
 if(!Array.isArray(numbers)||!numbers.length||numbers.length>1_000_000||
   numbers.some(n=>!Number.isSafeInteger(n)||n<1_000_000||n>9_999_999)||
   new Set(numbers).size!==numbers.length)
  throw Error('MANUAL_ORDER_LIST_IMPORT_INVALID');
 if(!Number.isSafeInteger(delayMs)||delayMs<100||delayMs>60000)
  throw Error('MANUAL_ORDER_LIST_DELAY_INVALID');
 const state={id:KEY,schema:LIST_STATUS_SCHEMA,mode:'paused',
  filename:String(filename||'orders.txt').slice(0,120),
  total:numbers.length,index:0,archive_count:0,found_committed:0,
  failed_count:0,delay_ms:delayMs,download:null,
  imported_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 await transact(STORES,'readwrite',tx=>{
  for(const store of STORES)tx.objectStore(store).clear();
  tx.objectStore(STORE_QUEUE).put({id:KEY,numbers:Uint32Array.from(numbers)});
  tx.objectStore(STORE_STATE).put(state);
 },factory);
 return state;
}
export async function saveOrderFileProgress(state,order=null,failure=null,factory){
 checkState(state);
 if(order&&(!/^[0-9]{7}$/.test(order.id)||
  !Array.isArray(order.transfers)))throw Error('MANUAL_ORDER_LIST_RECORD_INVALID');
 if(failure&&!/^[0-9]{7}$/.test(failure.id))
  throw Error('MANUAL_ORDER_LIST_FAILURE_INVALID');
 return transact([STORE_STATE,STORE_PENDING,STORE_FAILURES],'readwrite',tx=>{
  tx.objectStore(STORE_STATE).put({...state,updated_at:new Date().toISOString()});
  if(order)tx.objectStore(STORE_PENDING).put(order);
  if(failure)tx.objectStore(STORE_FAILURES).put(failure);
 },factory);
}
export async function saveOrderFileStatus(state,factory){
 checkState(state);
 return transact([STORE_STATE],'readwrite',tx=>
  tx.objectStore(STORE_STATE).put({...state,updated_at:new Date().toISOString()}),factory);
}
/** Download confirmed by Chrome; move exactly this pending ZIP to successes. */
export async function commitOrderFileArchive(state,records,factory){
 checkState(state);
 if(!Array.isArray(records)||records.length<1||records.length>100||
  records.some(x=>!/^[0-9]{7}$/.test(x.id)))throw Error('MANUAL_ORDER_LIST_COMMIT_INVALID');
 if(state.download!==null)throw Error('MANUAL_ORDER_LIST_DOWNLOAD_NOT_CLEARED');
 return transact([STORE_STATE,STORE_PENDING,STORE_SUCCESS],'readwrite',tx=>{
  tx.objectStore(STORE_STATE).put({...state,updated_at:new Date().toISOString()});
  tx.objectStore(STORE_PENDING).clear();
  for(const row of records)tx.objectStore(STORE_SUCCESS).put({
   id:row.id,order_number:row.id,collection_status:'TZ_APPROVED',
   collected_at:row.collected_at,files:row.files,
   eligible_articles:row.eligible_articles,verified_articles:row.verified_articles
  });
 },factory);
}
export async function exportOrderFileRegistry(factory){
 return transact([STORE_STATE,STORE_SUCCESS,STORE_FAILURES],'readonly',tx=>{
  const status=tx.objectStore(STORE_STATE).get(KEY);
  const found=tx.objectStore(STORE_SUCCESS).getAll();
  const failed=tx.objectStore(STORE_FAILURES).getAll();
  return ()=>({
   state:status.result,found_archived:found.result||[],
   failed_orders:failed.result||[]
  });
 },factory);
}
export async function clearOrderFileQueue(factory){
 return transact(STORES,'readwrite',tx=>{
  for(const store of STORES)tx.objectStore(store).clear();
 },factory);
}
