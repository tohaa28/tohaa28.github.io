/**
 * Move user-generated ZIP bytes from insecure HTTP portal to a secure
 * chrome-extension:// Blob origin using the standard MV3 offscreen API.
 * This does NOT disable Chrome Safe Browsing or approve dangerous files.
 * Backpressure on the port prevents unbounded worker message queues.
 */
export async function startExtensionZipDownload(blob,filename){
 if(!(blob instanceof Blob)||blob.size<100||blob.size>200_000_000||
  !/^vision-ai-(?:range-\d{7}-\d{7}-part|list-part)-\d{5}-\d{7}-\d{7}\.zip$/.test(filename))
  throw Error('VISION_ZIP_TRANSFER_ARGS_INVALID');
 if(!globalThis.chrome?.runtime?.connect)
  throw Error('VISION_ZIP_EXTENSION_TRANSPORT_REQUIRED');
 const port=chrome.runtime.connect({name:'vision-ai-zip-secure-v1'});
 let onMessage,onDisconnect;
 let sequence=0;
 let resolver=null,done=false;
 const fail=code=>{
  if(resolver){const r=resolver;resolver=null;r.reject(Error(code))}
  try{port.disconnect()}catch{}
 };
 port.onMessage.addListener(message=>{
  if(!resolver)return;
  const r=resolver;resolver=null;
  if(message?.status==='ZIP_READY_FOR_CHUNK'||message?.status==='ZIP_CHUNK_ACCEPTED')
   r.resolve(message);
  else if(message?.status==='ZIP_DOWNLOAD_STARTED'&&
   Number.isSafeInteger(message.download_id)&&message.download_id>=0)
   r.resolve(message);
  else r.reject(Error(message?.status||'VISION_ZIP_TRANSFER_FAILED'));
 });
 port.onDisconnect.addListener(()=>fail('VISION_ZIP_EXTENSION_DISCONNECTED'));
 const send=message=>new Promise((resolve,reject)=>{
  resolver={resolve,reject};
  try{port.postMessage(message)}catch(error){resolver=null;reject(error)}
 });
 try{
  await send({op:'begin',filename,size:blob.size});
  // Uint8Array chunks sent as base64: unlike millions of JSON integers,
  // this remains reasonably bounded for 100-order production archives.
  for(let start=0;start<blob.size;start+=48_000){
   const bytes=new Uint8Array(await blob.slice(start,start+48_000).arrayBuffer());
   let binary='';
   for(let i=0;i<bytes.length;i+=8192)
    binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   await send({op:'chunk',sequence:sequence++,base64:btoa(binary)});
  }
  const result=await send({op:'finish',chunks:sequence});
  done=true;
  return result.download_id;
 }finally{
  if(!done)try{port.postMessage({op:'cancel'})}catch{}
  try{port.disconnect()}catch{}
 }
}
