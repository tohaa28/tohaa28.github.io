/**
 * Offscreen document on chrome-extension://, not an HTTP test origin.
 * The only privilege here is to create and retain Blob object URLs.
 * The service worker (not this DOM page) invokes downloads.download.
 */
(()=>{
 'use strict';
 const MAX_SIZE=200_000_000,MAX_CHUNK=48_000;
 let current=null;
 const active=new Map();
 const okSender=sender=>sender?.id===chrome.runtime.id&&!sender.tab;
 const prefix=()=>chrome.runtime.getURL('');
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(!m||typeof m!=='object'||!String(m.op||'').startsWith('vision-zip-offscreen-'))
   return false;
  if(!okSender(sender)){
   reply({status:'VISION_ZIP_OFFSCREEN_SENDER_DENIED'});return false;
  }
  try{
   const command=m.op.slice('vision-zip-offscreen-'.length);
   if(command==='begin'){
    if(!/^[a-f0-9]{32}$/.test(m.job||''))
     throw Error('VISION_ZIP_OFFSCREEN_JOB_INVALID');
    if(current&&current.job===m.job){
     if(current.filename!==m.filename||current.size!==m.size)
      throw Error('VISION_ZIP_OFFSCREEN_REPLAY_MISMATCH');
     reply({status:'ZIP_READY_FOR_CHUNK'});return false;
    }
    if(current||typeof m.filename!=='string'||
      !/^vision-ai-(?:range-\d{7}-\d{7}-part|list-part)-\d{5}-\d{7}-\d{7}\.zip$/.test(m.filename)||
      !Number.isSafeInteger(m.size)||m.size<100||m.size>MAX_SIZE)
     throw Error('VISION_ZIP_OFFSCREEN_BEGIN_DENIED');
    current={job:m.job,filename:m.filename,size:m.size,chunks:[],seen:0,sequence:0};
    reply({status:'ZIP_READY_FOR_CHUNK'});
   }else if(command==='chunk'){
    if(!current||m.job!==current.job||
      !Number.isSafeInteger(m.sequence)||m.sequence<0||
      typeof m.base64!=='string'||m.base64.length>65_000||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(m.base64))
     throw Error('VISION_ZIP_OFFSCREEN_CHUNK_INVALID');
    const decoded=atob(m.base64);
    if(decoded.length>MAX_CHUNK)
     throw Error('VISION_ZIP_OFFSCREEN_CHUNK_TOO_LARGE');
    const data=Uint8Array.from(decoded,c=>c.charCodeAt(0));
    if(m.sequence<current.sequence){
     const prior=current.chunks[m.sequence];
     if(!prior||prior.length!==data.length||!prior.every((x,i)=>x===data[i]))
      throw Error('VISION_ZIP_OFFSCREEN_CHUNK_REPLAY_MISMATCH');
     reply({status:'ZIP_CHUNK_ACCEPTED'});return false;
    }
    if(m.sequence!==current.sequence||current.seen+decoded.length>current.size)
     throw Error('VISION_ZIP_OFFSCREEN_SIZE_EXCEEDED');
    current.chunks.push(data);current.seen+=data.length;current.sequence++;
    reply({status:'ZIP_CHUNK_ACCEPTED'});
   }else if(command==='finish'){
    if(!current||m.job!==current.job||m.chunks!==current.sequence||current.seen!==current.size)
     throw Error('VISION_ZIP_OFFSCREEN_INCOMPLETE');
    const blob=new Blob(current.chunks,{type:'application/zip'});
    if(blob.size!==current.size)throw Error('VISION_ZIP_OFFSCREEN_BLOB_MISMATCH');
    // Check true ZIP local-file and ending EOCD signature, not the extension
    // of a downloaded file. Chrome still makes its own security verdict.
    (async()=>{
     const start=new Uint8Array(await blob.slice(0,4).arrayBuffer());
     if(start[0]!==0x50||start[1]!==0x4b||start[2]!==3||start[3]!==4)
      throw Error('VISION_ZIP_OFFSCREEN_SIGNATURE_INVALID');
     const tail=new Uint8Array(await blob.slice(-22).arrayBuffer());
     if(tail[0]!==0x50||tail[1]!==0x4b||tail[2]!==5||tail[3]!==6)
      throw Error('VISION_ZIP_OFFSCREEN_EOCD_INVALID');
     const url=URL.createObjectURL(blob);
     const filename=current.filename;
     active.set(url,blob);
     current=null;
     reply({status:'ZIP_EXTENSION_BLOB_READY',url,bytes:blob.size,filename});
    })().catch(error=>{
     current=null;reply({status:String(error?.message||'VISION_ZIP_OFFSCREEN_FAILED')});
    });
    return true;
   }else if(command==='release'){
    const url=m.url;
    if(typeof url==='string'&&url.startsWith('blob:'+prefix())&&active.has(url)){
     URL.revokeObjectURL(url);active.delete(url);
    }
    reply({status:'ZIP_RELEASED'});
   }else if(command==='cancel'){
    if(current?.job===m.job)current=null;
    reply({status:'ZIP_CANCELLED'});
   }else reply({status:'VISION_ZIP_OFFSCREEN_OP_DENIED'});
  }catch(error){
   current=null;
   reply({status:String(error?.message||'VISION_ZIP_OFFSCREEN_FAILED')});
  }
  return false;
 });
})();
