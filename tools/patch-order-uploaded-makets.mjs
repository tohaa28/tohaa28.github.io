// Idempotent bridge for uploaded customer PDFs — native editor import only.
import fs from 'node:fs';
const path=new URL('../assets/index-BpU9kvz8.js',import.meta.url);
const anchor='v("artwork").onchange=c=>Ai(c,"art");';
const marker='window.gwbUploadedMaketNative={getScope:gwbUploadedSelectedScope,apply:gwbUploadedApply}';
const bridge="\n/* Customer-uploaded PDF reuses the native logo parser and current placement. */\nfunction gwbUploadedSelectedScope(){\n if(y.busy||!y.template||!y.field||!y.selectedEntry||\n    v(\"orderEditor\").hidden||y.draw||y.active<0)return null;\n const chosen=y.placements[y.active];\n if(!chosen||chosen.page!==y.page||!chosen.field||chosen.field!==y.field)return null;\n return {\n   order:String(v(\"order\").value||\"\"),\n   article:String(y.selectedEntry.article||\"\"),\n   itemId:String(y.selectedEntry.itemId||\"\"),\n   active:y.active,fieldIndex:chosen.fieldIndex??null,page:y.page,\n   template:y.template,entry:y.selectedEntry,field:chosen.field\n };\n}\nasync function gwbUploadedApply(file,expected){\n const now=gwbUploadedSelectedScope();\n if(!now||!expected||now.order!==expected.order||\n    now.article!==expected.article||now.itemId!==expected.itemId||\n    now.active!==expected.active||now.fieldIndex!==expected.fieldIndex||\n    now.page!==expected.page||now.template!==expected.template||\n    now.entry!==expected.entry||now.field!==expected.field)\n   throw Error(\"Артикул или поле изменились. Повторите загрузку.\");\n if(!/\\.pdf$/i.test(file?.name||\"\")||file.size<5||file.size>40*1024*1024)\n   throw Error(\"Открытие возможно для PDF размером до 40 МБ.\");\n await Ai({target:{files:[file],value:''}},\"art\");\n return true;\n}\nwindow.gwbUploadedMaketNative={getScope:gwbUploadedSelectedScope,apply:gwbUploadedApply};\n";
export function applyUploadedMaketsBridge(){
 let source=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
 if(source.includes(marker)){if(!source.includes('function gwbUploadedSelectedScope()'))throw Error('Incomplete uploaded maket bridge');return;}
 if(source.split(anchor).length!==2||!source.includes('function Ai(c,t)')||
    !source.includes('window.gwbExplorerLogoDrop={inspect:'))throw Error('Unexpected editor bundle; refusing upload integration');
 source=source.replace(anchor,bridge+'\n'+anchor);
 fs.writeFileSync(path,source);
}
