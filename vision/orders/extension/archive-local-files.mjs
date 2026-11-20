/**
 * Vision AI 0.2.1: one-time directory selection from a trusted extension tab.
 * The File System Access directory handle is kept in local IndexedDB and
 * never transferred to testgifts, GitHub or the service worker.
 */
const DB_NAME='vision-ai-selected-archive-folder-v1';
const STORE_NAME='directory';
function storeDirectory(handle){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{
   if(!req.result.objectStoreNames.contains(STORE_NAME))
    req.result.createObjectStore(STORE_NAME);
  };
  req.onerror=()=>reject(Error('VISION_FOLDER_DATABASE_OPEN_FAILED'));
  req.onsuccess=()=>{
   const db=req.result;
   const tx=db.transaction(STORE_NAME,'readwrite');
   tx.objectStore(STORE_NAME).put(handle,'selected');
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{db.close();reject(Error('VISION_FOLDER_STORE_FAILED'))};
  };
 });
}
function readDirectory(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{
   if(!req.result.objectStoreNames.contains(STORE_NAME))
    req.result.createObjectStore(STORE_NAME);
  };
  req.onerror=()=>reject(Error('VISION_FOLDER_DATABASE_OPEN_FAILED'));
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(STORE_NAME,'readonly');
   const request=tx.objectStore(STORE_NAME).get('selected');
   tx.oncomplete=()=>{db.close();resolve(request.result||null)};
   tx.onerror=()=>{db.close();reject(Error('VISION_FOLDER_READ_FAILED'))};
  };
 });
}
/** Invoked directly inside the user's click handler: activation is required. */
export async function chooseArchiveDirectory(){
 if(typeof globalThis.showDirectoryPicker!=='function')
  throw Error('VISION_DIRECTORY_PICKER_UNAVAILABLE');
 const handle=await globalThis.showDirectoryPicker({mode:'readwrite'});
 if(!handle||handle.kind!=='directory')
  throw Error('VISION_DIRECTORY_SELECTION_INVALID');
 const permission=await handle.queryPermission({mode:'readwrite'});
 if(permission!=='granted'){
  const granted=await handle.requestPermission({mode:'readwrite'});
  if(granted!=='granted')throw Error('VISION_DIRECTORY_PERMISSION_DENIED');
 }
 await storeDirectory(handle);
 return {name:handle.name,permission:'granted'};
}
export async function archiveDirectoryStatus(){
 const handle=await readDirectory();
 if(!handle||handle.kind!=='directory')
  return {ready:false,name:null,reason:'VISION_DIRECTORY_NOT_SELECTED'};
 const permission=await handle.queryPermission({mode:'readwrite'});
 return {ready:permission==='granted',name:handle.name,
  reason:permission==='granted'?null:'VISION_DIRECTORY_PERMISSION_REQUIRED'};
}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const sha=async blob=>hex(new Uint8Array(await crypto.subtle.digest(
 'SHA-256',await blob.arrayBuffer())));
async function matchingFile(directory,name,blob){
 try{
  const file=await (await directory.getFileHandle(name)).getFile();
  if(file.size!==blob.size)return false;
  // A crash immediately after the file is written must not create
  // another copy when the exact expected bytes are already present.
  return (await sha(file))===(await sha(blob));
 }catch{return false}
}
export async function saveOrderToDirectory(blob,filename){
 if(!(blob instanceof Blob)||blob.size<100||blob.size>200_000_000||
  !/^vision-ai-list-part-\d{5}-\d{7}-\d{7}\.zip$/.test(filename))
  throw Error('VISION_LOCAL_ARCHIVE_ARGS_INVALID');
 const handle=await readDirectory();
 if(!handle||await handle.queryPermission({mode:'readwrite'})!=='granted')
  throw Error('VISION_DIRECTORY_PERMISSION_REQUIRED');
 let selected=filename,previouslySaved=false;
 for(let i=0;i<10000;i++){
  selected=i===0?filename:filename.replace(/\.zip$/,'.copy-'+i+'.zip');
  if(await matchingFile(handle,selected,blob)){
   previouslySaved=true;break;
  }
  try{await handle.getFileHandle(selected)}catch{break}
  if(i===9999)throw Error('VISION_DIRECTORY_NAME_EXHAUSTED');
 }
 if(!previouslySaved){
  const entry=await handle.getFileHandle(selected,{create:true});
  const writer=await entry.createWritable({keepExistingData:false});
  try{await writer.write(blob);await writer.close()}
  catch(error){try{await writer.abort()}catch{}throw error}
 }
 const result=await (await handle.getFileHandle(selected)).getFile();
 if(result.size!==blob.size||(await sha(result))!==(await sha(blob)))
  throw Error('VISION_DIRECTORY_ARCHIVE_VERIFY_FAILED');
 const hash=await sha(blob);
 if(typeof globalThis.VisionArchives?.recordLocal==='function'){
  await globalThis.VisionArchives.recordLocal({
   filename:selected,bytes:blob.size,sha256:hash,folder:handle.name
  });
 }
 return {status:'VISION_LOCAL_ARCHIVE_VERIFIED',filename:selected,
  bytes:blob.size,sha256:hash,folder:handle.name};
}
