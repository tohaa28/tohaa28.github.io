/**
 * Backpressured ZIP transport via individual MV3 runtime messages, not a
 * long-lived Port. Each message is a service-worker event and can recover
 * from worker idle restarts. A secure extension offscreen document owns Blob.
 * Chrome's danger checks remain enabled and authoritative.
 */
export async function startExtensionZipDownload(blob,filename){
 if(!(blob instanceof Blob)||blob.size<100||blob.size>200_000_000||
  !/^vision-ai-(?:range-\d{7}-\d{7}-part|list-part)-\d{5}-\d{7}-\d{7}\.zip$/.test(filename))
  throw Error('VISION_ZIP_TRANSFER_ARGS_INVALID');
 if(!globalThis.chrome?.runtime?.sendMessage)
  throw Error('VISION_ZIP_EXTENSION_TRANSPORT_REQUIRED');
 const random=new Uint8Array(16);crypto.getRandomValues(random);
 const job=Array.from(random,b=>b.toString(16).padStart(2,'0')).join('');
 const command=(op,extra={})=>
  chrome.runtime.sendMessage({op:'vision-zip-secure-message-v1',action:op,
   job,...extra});
 const begin=await command('begin',{filename,size:blob.size});
 if(begin?.status!=='ZIP_READY_FOR_CHUNK')
  throw Error(begin?.status||'VISION_ZIP_BEGIN_FAILED');
 let finished=false;
 try{
  let sequence=0;
  for(let offset=0;offset<blob.size;offset+=48_000){
   const part=new Uint8Array(await blob.slice(offset,offset+48_000).arrayBuffer());
   let binary='';
   for(let i=0;i<part.length;i+=8192)
    binary+=String.fromCharCode(...part.subarray(i,i+8192));
   const result=await command('chunk',{sequence,base64:btoa(binary)});
   if(result?.status!=='ZIP_CHUNK_ACCEPTED')
    throw Error(result?.status||'VISION_ZIP_CHUNK_FAILED');
   sequence++;
  }
  const result=await command('finish',{chunks:sequence});
  if(result?.status!=='ZIP_DOWNLOAD_STARTED'||
   !Number.isSafeInteger(result.download_id)||result.download_id<0)
   throw Error(result?.status||'VISION_ZIP_FINISH_FAILED');
  finished=true;return result.download_id;
 }finally{
  if(!finished)void command('cancel').catch(()=>{});
 }
}
