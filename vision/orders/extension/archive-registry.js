/* Vision AI v0.2.0 — Chrome-managed archive destinations and verified history.
 * Only downloads completed by Chrome are listed as SAVED. No client data is
 * uploaded. The registry uses extension-origin IndexedDB (not 10 MB sync storage).
 */
'use strict';
const VisionArchives=(()=>{
 const DB='vision-ai-archive-registry-v2', STORE='downloads';
 const PREF='vision-ai-archive-save-preferences-v2';
 const NAME=/^vision-ai-list-part-\d{5}-\d{7}-\d{7}\.zip$/;
 const modeSafe=x=>x==='ask'||x==='directory'?x:'downloads';
 const folderSafe=x=>typeof x==='string'&&/^[a-zA-Z0-9 _.-]{1,60}$/.test(x)&&
  x!=='.'&&x!=='..'&&!x.startsWith('.')&&!x.endsWith('.')&&!x.includes('..');
 const displayFolderSafe=x=>typeof x==='string'&&x.length>0&&x.length<=120&&
  !/[\\/\x00-\x1f\x7f]/.test(x)&&x!=='.'&&x!=='..';
 const defaults={mode:'downloads',folder:'VisionAI'};
 async function config(){
  const result=await chrome.storage.local.get(PREF),raw=result[PREF]||{};
  return {mode:modeSafe(raw.mode),
   folder:modeSafe(raw.mode)==='directory'?
    (displayFolderSafe(raw.folder)?raw.folder:defaults.folder):
    (folderSafe(raw.folder)?raw.folder:defaults.folder),
   configured:typeof raw.configured_at==='string'&&raw.configured_at.length>0};
 }
 async function setConfig(input){
  if(!input||!['ask','downloads','directory'].includes(input.mode)||
   !(input.mode==='directory'?displayFolderSafe(input.folder):
     folderSafe(input.folder)))return {status:'VISION_ARCHIVE_SETTINGS_INVALID'};
  const value={mode:input.mode,folder:input.folder,
   configured_at:new Date().toISOString()};
  await chrome.storage.local.set({[PREF]:value});
  return {status:'VISION_ARCHIVE_SETTINGS_SAVED',...value};
 }
 function db(){
  return new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB,1);
   req.onupgradeneeded=()=>{
    if(!req.result.objectStoreNames.contains(STORE))
      req.result.createObjectStore(STORE,{keyPath:'download_id'});
   };
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(Error('VISION_ARCHIVE_DB_OPEN_FAILED'));
   req.onblocked=()=>reject(Error('VISION_ARCHIVE_DB_BLOCKED'));
  });
 }
 async function tx(mode,action){
  const handle=await db();
  try{
   return await new Promise((resolve,reject)=>{
    const transaction=handle.transaction(STORE,mode);
    const request=action(transaction.objectStore(STORE));
    transaction.oncomplete=()=>resolve(request?.result);
    transaction.onerror=()=>reject(Error('VISION_ARCHIVE_DB_WRITE_FAILED'));
    transaction.onabort=()=>reject(Error('VISION_ARCHIVE_DB_ABORTED'));
   });
  }finally{handle.close()}
 }
 const get=id=>tx('readonly',store=>store.get(id));
 const put=row=>tx('readwrite',store=>store.put(row));
 async function begin(id,filename,bytes,location){
  if(!Number.isSafeInteger(id)||id<0||!NAME.test(filename)||
   !Number.isSafeInteger(bytes)||bytes<100)
   throw Error('VISION_ARCHIVE_RECORD_INVALID');
  await put({download_id:id,expected_name:filename,expected_bytes:bytes,
   destination_mode:location.mode,destination_folder:location.folder,
   state:'pending',created_at:new Date().toISOString()});
  await reconcile(id);
 }
 async function reconcile(id){
  const prior=await get(id);
  if(!prior)return null;
  if(prior.destination_mode==='directory'||typeof id!=='number')
   return prior;
  const files=await chrome.downloads.search({id}),found=files[0];
  if(!found)return prior;
  const safe=found.danger==='safe'||found.danger==='accepted';
  const complete=found.state==='complete';
  const exactSize=found.fileSize===prior.expected_bytes||
   found.totalBytes===prior.expected_bytes;
  let state=found.state==='interrupted'?'interrupted':'pending';
  if(found.danger&&!safe)state='security_review';
  else if(complete&&exactSize&&found.exists!==false)state='saved';
  else if(complete)state='verification_failed';
  const next={...prior,state,
   actual_bytes:Number.isSafeInteger(found.fileSize)?found.fileSize:null,
   local_path:String(found.filename||'').slice(0,1024),
   danger:String(found.danger||'unknown').slice(0,70),
   file_exists:found.exists!==false,
   checked_at:new Date().toISOString(),
   ...(state==='saved'?{saved_at:new Date(found.endTime||Date.now()).toISOString()}:{})};
  await put(next);return next;
 }
 async function list(limit=100){
  if(!Number.isSafeInteger(limit)||limit<1||limit>10000)limit=100;
  const handle=await db();
  try{
   return await new Promise((resolve,reject)=>{
    const out=[],transaction=handle.transaction(STORE,'readonly');
    const cursor=transaction.objectStore(STORE).openCursor(null,'prev');
    cursor.onsuccess=()=>{
     if(!cursor.result||out.length>=limit)return;
     out.push(cursor.result.value);cursor.result.continue();
    };
    transaction.oncomplete=()=>resolve(out);
    transaction.onerror=()=>reject(Error('VISION_ARCHIVE_DB_READ_FAILED'));
   });
  }finally{handle.close()}
 }
 async function recordLocal({filename,bytes,sha256,folder}){
  if(typeof filename!=='string'||!/^(?:vision-ai-list-part-\d{5}-\d{7}-\d{7})(?:\.copy-\d+)?\.zip$/.test(filename)||
   !Number.isSafeInteger(bytes)||bytes<100||
   !/^[a-f0-9]{64}$/.test(sha256||'')||!displayFolderSafe(folder))
   throw Error('VISION_LOCAL_ARCHIVE_RECORD_INVALID');
  const now=new Date().toISOString();
  const row={download_id:'directory:'+folder+'/'+filename,
   expected_name:filename,expected_bytes:bytes,actual_bytes:bytes,
   destination_mode:'directory',destination_folder:folder,
   state:'saved',local_path:folder+'/'+filename,sha256,
   file_exists:true,danger:'not_applicable',
   saved_at:now,checked_at:now,created_at:now};
  await put(row);return row;
 }
 async function inspect(limit=100){
  const entries=await list(limit);
  const result=[];
  for(const row of entries)result.push(row.state==='pending'||
   row.state==='saved'?await reconcile(row.download_id)||row:row);
  return result;
 }
 return {config,setConfig,begin,reconcile,list,inspect,recordLocal,NAME,folderSafe};
})();
globalThis.VisionArchives=VisionArchives;
