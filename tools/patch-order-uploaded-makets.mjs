// Idempotent bridge for uploaded customer PDFs — native editor import only.
import fs from 'node:fs';
const path=new URL('../assets/index-BpU9kvz8.js',import.meta.url);
const anchor='v("artwork").onchange=c=>Ai(c,"art");';
const marker='window.gwbUploadedMaketNative={getScope:gwbUploadedSelectedScope,apply:gwbUploadedApply}';
const readyMarker='window.gwbReadyPdfNative={snapshot:gwbReadyOrderSnapshot,make:gwbReadyOrderPdf}';
const readyBridge=String.raw\`
/* Ready PDF upload uses the identical PDF composition/preflight as native download. */
function gwbReadyOrderSnapshot(){
 const entry=y.selectedEntry,order=String(v("order").value||"");
 if(y.busy||!y.template||!entry||v("orderEditor").hidden||!/^\\d{5,12}$/.test(order))return null;
 return {order,article:String(entry.article||""),itemId:String(entry.itemId||""),template:y.template,entry};
}
async function gwbReadyOrderPdf(expected){
 const old=gwbReadyOrderSnapshot();
 if(!old||!expected||old.order!==expected.order||old.article!==expected.article||
  old.itemId!==expected.itemId||old.template!==expected.template||old.entry!==expected.entry)
  throw Error("Заказ или артикул изменились. Повторите создание PDF.");
 y.busy=true;X();Q("Готовлю PDF для отправки в заказ…");
 try{
  const selected=Qn();
  const bytes=await hn({template:y.template,placements:selected},PDFLib,Jn);
  const after={order:String(v("order").value||""),entry:y.selectedEntry,template:y.template};
  if(after.order!==expected.order||after.entry!==expected.entry||after.template!==expected.template)
   throw Error("Заказ изменился во время сборки PDF.");
  if(!bytes?.length||bytes.length>40*1024*1024)throw Error("PDF превышает ограничение 40 МБ.");
  const filename=Hn([expected.order,expected.article,"макет"].filter(Boolean).join("_"))+".pdf";
  return new File([bytes],filename,{type:"application/pdf"});
 }finally{y.busy=false;X()}
}
window.gwbReadyPdfNative={snapshot:gwbReadyOrderSnapshot,make:gwbReadyOrderPdf};
\`;
const bridge="\n/* Customer-uploaded PDF reuses the native logo parser and current placement. */\nfunction gwbUploadedSelectedScope(){\n if(y.busy||!y.template||!y.field||!y.view||!y.selectedEntry||\n    v(\"orderEditor\").hidden||y.draw||y.active<0)return null;\n const chosen=y.placements[y.active];\n if(!chosen||chosen.page!==y.page||!chosen.field||chosen.field!==y.field)return null;\n return {\n   order:String(v(\"order\").value||\"\"),\n   article:String(y.selectedEntry.article||\"\"),\n   itemId:String(y.selectedEntry.itemId||\"\"),\n   active:y.active,fieldIndex:chosen.fieldIndex??null,page:y.page,\n   template:y.template,entry:y.selectedEntry,field:chosen.field\n };\n}\nasync function gwbUploadedApply(file,expected){\n const now=gwbUploadedSelectedScope();\n if(!now||!expected||now.order!==expected.order||\n    now.article!==expected.article||now.itemId!==expected.itemId||\n    now.active!==expected.active||now.fieldIndex!==expected.fieldIndex||\n    now.page!==expected.page||now.template!==expected.template||\n    now.entry!==expected.entry||now.field!==expected.field)\n   throw Error(\"Артикул или поле изменились. Повторите загрузку.\");\n if(!/\\.pdf$/i.test(file?.name||\"\")||file.size<5||file.size>40*1024*1024)\n   throw Error(\"Открытие возможно для PDF размером до 40 МБ.\");\n await Ai({target:{files:[file],value:''}},\"art\");\n return true;\n}\nwindow.gwbUploadedMaketNative={getScope:gwbUploadedSelectedScope,apply:gwbUploadedApply};\n";
export function applyUploadedMaketsBridge(){
 let source=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
 if(source.includes(marker)&&!source.includes('function gwbUploadedSelectedScope()'))
  throw Error('Incomplete uploaded maket bridge');
 if(source.includes(readyMarker)&&!source.includes('function gwbReadyOrderPdf('))
  throw Error('Incomplete ready-PDF bridge');
 if(!source.includes(marker)||!source.includes(readyMarker)){
  if(source.split(anchor).length!==2||!source.includes('function Ai(c,t)')||
     !source.includes('window.gwbExplorerLogoDrop={inspect:')||
     !source.includes('async function tr()')||!source.includes('function Qn()'))
    throw Error('Unexpected editor bundle; refusing upload integration');
  const injection=(!source.includes(marker)?bridge+'\n':'')+
   (!source.includes(readyMarker)?readyBridge+'\n':'');
  source=source.replace(anchor,injection+anchor);
  fs.writeFileSync(path,source);
 }
}
