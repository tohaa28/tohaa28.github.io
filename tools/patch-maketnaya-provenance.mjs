// Last-stage, idempotent extension of the already-approved editor bundle.
// Preserve the exact patch-artwork-preflight baseline/expected hashes.
import fs from 'node:fs';
const path=new URL('../assets/index-BpU9kvz8.js',import.meta.url);
const anchor='R.type==="page"?b.drawPage(R.data,U):b.drawImage(R.data,U),b.pushOperators(n.popGraphicsState())}return await h.save()}function sr(c){';
const output='R.type==="page"?b.drawPage(R.data,U):b.drawImage(R.data,U),b.pushOperators(n.popGraphicsState())}if(!window.gwbMaketnayaPdfProvenance?.stamp)throw Error("Не доступна запись служебного блока PDF");await window.gwbMaketnayaPdfProvenance.stamp(h,o,n,r,{order:document.getElementById("order")?.value,article:document.getElementById("article")?.value,itemId:window.gwbReadyPdfNative?.snapshot?.()?.itemId||""});return await h.save()}function sr(c){';
// Native state is the authority for artwork-control enablement after
// the template -> field transition; never restore stale disabled snapshots.
const refreshAnchor='function X(){';
const refreshPatched='window.gwbRefreshEditorState=()=>X();function X(){';
export function applyMaketnayaProvenance(){
 let source=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
 if(!source.includes(output)){
  if(source.includes('gwbMaketnayaPdfProvenance.stamp('))
   throw Error('Old internal-PDF origin marker detected; original guarded bundle must be restored');
  if(source.split(anchor).length!==2)throw Error('Provenance PDF export anchor changed');
  source=source.replace(anchor,output);
 }
 if(!source.includes(refreshPatched)){
  if(source.split(refreshAnchor).length!==2)throw Error('Native logo refresh hook anchor changed');
  source=source.replace(refreshAnchor,refreshPatched);
 }
 fs.writeFileSync(path,source);
}
