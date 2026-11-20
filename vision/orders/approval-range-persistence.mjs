/**
 * Vision range scanner crash journal.
 * The content script runs on the dedicated test-list origin; IndexedDB keeps
 * unarchived evidence as binary records across page reloads. No remote writes.
 * A small Chrome storage checkpoint remains the authority for completed ZIPs.
 */
const DB_NAME='vision-ai-approved-range-pending-v1';
const DB_VERSION=1;
const JOURNAL='journal';
const ORDERS='orders';
const ACTIVE='active';
const STATUS_SCHEMA='printcheck.vision.range-journal.v1';
export const RANGE_JOURNAL_SCHEMA=STATUS_SCHEMA;

function openDb(factory=globalThis.indexedDB){
 if(!factory?.open)throw Error('MANUAL_RANGE_INDEXEDDB_UNAVAILABLE');
 return new Promise((resolve,reject)=>{
  const req=factory.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(JOURNAL))db.createObjectStore(JOURNAL,{keyPath:'id'});
   if(!db.objectStoreNames.contains(ORDERS))db.createObjectStore(ORDERS,{keyPath:'order_number'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(Error('MANUAL_RANGE_INDEXEDDB_OPEN_FAILED'));
  req.onblocked=()=>reject(Error('MANUAL_RANGE_INDEXEDDB_BLOCKED'));
 });
}
function request(req){
 return new Promise((resolve,reject)=>{
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(Error('MANUAL_RANGE_INDEXEDDB_REQUEST_FAILED'));
 });
}
function complete(tx){
 return new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onabort=()=>reject(Error('MANUAL_RANGE_INDEXEDDB_TRANSACTION_ABORTED'));
  tx.onerror=()=>reject(Error('MANUAL_RANGE_INDEXEDDB_TRANSACTION_FAILED'));
 });
}
async function transaction(mode,handler,factory){
 const db=await openDb(factory);
 try{
  const tx=db.transaction([JOURNAL,ORDERS],mode),done=complete(tx);
  const result=handler(tx);
  await done;
  return await result;
 }finally{db.close()}
}
function verifyJournal(state){
 if(state?.schema!==STATUS_SCHEMA||
  !Number.isSafeInteger(state.cursor)||
  !Number.isSafeInteger(state.archives_completed)||
  !['running','paused','stopped','downloading'].includes(state.mode)||
  !Array.isArray(state.pending_registry)||!Array.isArray(state.failed_pending))
  throw Error('MANUAL_RANGE_JOURNAL_CORRUPTED');
}
export async function loadRangeJournal(factory){
 return transaction('readonly',async tx=>{
  const journal=await request(tx.objectStore(JOURNAL).get(ACTIVE));
  if(!journal)return {journal:null,orders:[]};
  verifyJournal(journal);
  const orders=await request(tx.objectStore(ORDERS).getAll());
  return {journal,orders};
 },factory);
}
/** Write a fully processed order and the new cursor in ONE atomic transaction. */
export async function saveRangeJournal(state,orderRecord=null,factory){
 verifyJournal(state);
 if(orderRecord&&(!/^\d{5,12}$/.test(orderRecord.order_number)||
   !Array.isArray(orderRecord.transfers)))
  throw Error('MANUAL_RANGE_JOURNAL_ORDER_INVALID');
 return transaction('readwrite',tx=>{
  if(orderRecord)tx.objectStore(ORDERS).put(orderRecord);
  tx.objectStore(JOURNAL).put({...state,id:ACTIVE});
 },factory);
}
/** Mode and live delay changes may not overwrite the committed cursor. */
export async function setRangeJournalMode(mode,delayMs=null,factory){
 if(!['running','paused','stopped','downloading'].includes(mode))
  throw Error('MANUAL_RANGE_JOURNAL_MODE');
 if(delayMs!==null&&(!Number.isSafeInteger(delayMs)||delayMs<100||delayMs>60000))
  throw Error('MANUAL_RANGE_JOURNAL_DELAY');
 return transaction('readwrite',async tx=>{
  const store=tx.objectStore(JOURNAL),state=await request(store.get(ACTIVE));
  if(!state)return;
  verifyJournal(state);
  store.put({...state,mode,delay_ms:delayMs??state.delay_ms,
   updated_at:new Date().toISOString()});
 },factory);
}
/** Commit a fresh empty journal while deleting the previous batch atomically. */
export async function replaceRangeJournal(state,factory){
 verifyJournal(state);
 return transaction('readwrite',tx=>{
  tx.objectStore(ORDERS).clear();
  tx.objectStore(JOURNAL).put({...state,id:ACTIVE});
 },factory);
}
export async function clearRangeJournal(factory){
 return transaction('readwrite',tx=>{
  tx.objectStore(JOURNAL).clear();
  tx.objectStore(ORDERS).clear();
 },factory);
}

/** Commit one confirmed ZIP's evidence, preserving any following batch that
 * was scanned while Chrome was still downloading the preceding archive.
 * This is a single IDB transaction with the new range journal.
 */
export async function pruneRangeJournalOrders(state,orderNumbers,factory){
 verifyJournal(state);
 if(!Array.isArray(orderNumbers)||orderNumbers.length<1||
  orderNumbers.length>100||orderNumbers.some(n=>!/^\d{7}$/.test(n)))
  throw Error('MANUAL_RANGE_PRUNE_INVALID');
 return transaction('readwrite',tx=>{
  const store=tx.objectStore(ORDERS);
  for(const id of orderNumbers)store.delete(id);
  tx.objectStore(JOURNAL).put({...state,id:ACTIVE});
 },factory);
}
