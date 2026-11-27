/* Single extension-origin scanner host; no devorders tab or production access. */
import {makeApprovalFileListController} from '../approval-file-controller.mjs';
import {chooseArchiveDirectory,archiveDirectoryStatus,saveOrderToDirectory}
 from './archive-local-files.mjs';
const mount=document.querySelector('#vision-scanner-host');
if(!mount||location.href!==chrome.runtime.getURL('scanner-host.html'))
 throw Error('VISION_ENGINE_HOST_UNTRUSTED');
if(typeof globalThis.__visionLocalTrustedTransport!=='function')
 throw Error('VISION_ENGINE_TRANSPORT_MISSING');
let busy=false,activeOrder=null;
const folderButton=document.querySelector('#vision-choose-archive-folder');
const folderStatus=document.querySelector('#vision-archive-folder-status');
async function updateFolderStatus(){
 const selected=await archiveDirectoryStatus().catch(()=>({ready:false}));
 const config=await chrome.runtime.sendMessage({
  op:'vision-archive-settings-v1',action:'get'
 }).catch(()=>({}));
 const mode=config?.mode||'downloads';
 if(folderStatus)folderStatus.textContent=mode==='directory'?
  'Выбранная папка: '+(selected.name||'не выбрана')+
   ' · '+(selected.ready?'запись разрешена':'ТРЕБУЕТСЯ ВЫБРАТЬ ЗАНОВО'):
  config.configured?
   'Автосохранение: «Загрузки» Chrome / '+config.folder:
   'Место сохранения не задано. Сначала выберите папку.';
}
if(folderButton)folderButton.addEventListener('click',async()=>{
 try{
  // showDirectoryPicker is called directly from the click, without
  // waiting for any remote message or losing user activation.
  const chosen=await chooseArchiveDirectory();
  const result=await chrome.runtime.sendMessage({
   op:'vision-archive-settings-v1',action:'set',
   payload:{mode:'directory',folder:chosen.name}
  });
  if(result?.status!=='VISION_ARCHIVE_SETTINGS_SAVED')
   throw Error(result?.status||'VISION_ARCHIVE_CONFIGURATION_FAILED');
  await updateFolderStatus();
 }catch(error){
  folderStatus.textContent='Папка не выбрана: '+String(error?.message||'UNKNOWN');
 }
});
globalThis.__visionArchiveSettings=async()=>{
 const config=await chrome.runtime.sendMessage({
  op:'vision-archive-settings-v1',action:'get'
 });
 if(config?.configured!==true)
  return {ready:false,reason:'VISION_ARCHIVE_FOLDER_NOT_CONFIGURED'};
 if(config.mode==='downloads')
  return {ready:true,mode:'downloads',folder:config.folder};
 if(config.mode==='directory'){
  const status=await archiveDirectoryStatus();
  return status.ready?
   {ready:true,mode:'directory',folder:status.name}:
   {ready:false,reason:status.reason};
 }
 return {ready:false,reason:'VISION_ARCHIVE_FOLDER_NOT_CONFIGURED'};
};
globalThis.__visionArchiveSave=saveOrderToDirectory;
void updateFolderStatus();

const controller=makeApprovalFileListController({
 getBusy:()=>busy,
 setBusy:value=>{busy=!!value},
 isClosed:()=>false,
 scanOrder:async(url,require_tz_approved)=>{
  activeOrder=new URL(url).pathname.split('/').at(-1);
  try{
   return await chrome.runtime.sendMessage({
    op:'vision-approval-order-queue-v1',order_url:url,
    require_tz_approved:require_tz_approved===true
   });
  }finally{activeOrder=null}
 }
});
mount.append(controller.element);
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender?.id!==chrome.runtime.id||sender?.tab||!message)return false;
 if(message.op==='vision-engine-command-v1'){
  if(message.mode!=='file'||!['status','import','start','pause','stop',
   'reset','save','export','delay'].includes(message.action)){
   respond({status:'VISION_ENGINE_COMMAND_DENIED'});return false;
  }
  controller.remote(message.action,message.payload||{}).then(respond,error=>
   respond({status:'VISION_ENGINE_COMMAND_FAILED',
    reason:String(error?.message||'UNKNOWN').slice(0,120)}));
  return true;
 }
 if(message.op==='vision-approval-batch-accept-v1'){
  if(!activeOrder||String(message.order_number)!==activeOrder){
   respond({status:'MANUAL_BATCH_HOST_ORDER_MISMATCH'});return false;
  }
  respond(controller.receive(message,activeOrder));return false;
 }
 return false;
});
