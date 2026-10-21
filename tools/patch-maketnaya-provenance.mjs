// Last-stage, idempotent extension of the already-approved editor bundle.
// Preserve the exact patch-artwork-preflight baseline/expected hashes.
import fs from 'node:fs';
const path=new URL('../assets/index-BpU9kvz8.js',import.meta.url);
const anchor='R.type==="page"?b.drawPage(R.data,U):b.drawImage(R.data,U),b.pushOperators(n.popGraphicsState())}return await h.save()}function sr(c){';
const output='R.type==="page"?b.drawPage(R.data,U):b.drawImage(R.data,U),b.pushOperators(n.popGraphicsState())}if(!window.gwbMaketnayaPdfProvenance?.stamp)throw Error("Не загрузился модуль сохранения отдельных логотипов в PDF.");await window.gwbMaketnayaPdfProvenance.stamp(h,o,n,r,{order:document.getElementById("order")?.value,article:document.getElementById("article")?.value,itemId:window.gwbUploadedMaketNative?.getScope?.()?.itemId||""});return await h.save()}function sr(c){';
export function applyMaketnayaProvenance(){
 const old=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
 if(old.includes(output))return;
 if(old.split(anchor).length!==2)throw Error('Provenance PDF export anchor changed');
 fs.writeFileSync(path,old.replace(anchor,output));
}
