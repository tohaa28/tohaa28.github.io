// Last-stage, idempotent extension of the already-approved editor bundle.
// Preserve the exact patch-artwork-preflight baseline/expected hashes.
import fs from 'node:fs';
const path=new URL('../assets/index-BpU9kvz8.js',import.meta.url);
const anchor='R.type==="page"?b.drawPage(R.data,U):b.drawImage(R.data,U),b.pushOperators(n.popGraphicsState())}return await h.save()}function sr(c){';
const output='R.type==="page"?b.drawPage(R.data,U):b.drawImage(R.data,U),b.pushOperators(n.popGraphicsState())}const ready=await h.save();try{await window.gwbMaketnayaSidecar?.remember(new Uint8Array(ready),o,n,r,{order:document.getElementById("order")?.value,article:document.getElementById("article")?.value,itemId:window.gwbReadyPdfNative?.snapshot?.()?.itemId||""})}catch(error){console.warn("Макетная: не удалось сохранить внешние исходники",error)}return ready}function sr(c){';
export function applyMaketnayaProvenance(){
 const old=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
 if(old.includes(output))return;
 if(old.includes('gwbMaketnayaPdfProvenance.stamp('))
  throw Error('Old internal-PDF origin marker detected; original guarded bundle must be restored');
 if(old.split(anchor).length!==2)throw Error('Provenance PDF export anchor changed');
 fs.writeFileSync(path,old.replace(anchor,output));
}
