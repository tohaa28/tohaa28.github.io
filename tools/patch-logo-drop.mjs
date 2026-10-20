// Fail-closed, idempotent bridge patch for dropping a logo on its real imprint field.
import fs from 'node:fs';
const path=new URL('../assets/index-BpU9kvz8.js',import.meta.url);
const anchor='v("artwork").onchange=c=>Ai(c,"art");';
const marker='window.gwbExplorerLogoDrop={inspect:gwbDropInspect,accept:gwbDropAccept}';
const bridge="\n/* Field-aware external file drag/drop. Browser controller: assets/logo-drop.js. */\nfunction gwbDropInspect(clientX,clientY){\n if(y.busy||y.drag||y.draw||!y.template||!Number.isFinite(clientX)||!Number.isFinite(clientY))return null;\n if(v(\"orderEditor\")?.hidden||v(\"stageScroll\")?.hidden)return null;\n const box=pt.getBoundingClientRect();\n if(box.width<20||box.height<20||clientX<box.left||clientX>box.right||clientY<box.top||clientY>box.bottom)return null;\n const point=Wn({clientX,clientY});\n const fields=y.template.fieldOptions||[];\n let idx=fields.findIndex(f=>f.page===y.page&&gwbPointInField(f,point.x,point.y));\n let field=idx>=0?fields[idx]:null;\n const selected=y.placements[y.active];\n const manual=idx<0&&selected&&selected.page===y.page&&\n   (selected.fieldIndex===undefined||selected.fieldIndex===null)&&\n   selected.field&&gwbPointInField(selected.field,point.x,point.y);\n if(manual){field=selected.field;idx=-1;}\n if(!field)return null;\n const view=y.view||{x:0,y:0,w:y.template.w,h:y.template.h};\n return {index:idx,manual:!!manual,page:y.page,\n   article:String(y.selectedEntry?.article||v(\"article\").value||''),\n   field:{x:field.x,y:field.y,w:field.w,h:field.h},\n   view:{x:view.x,y:view.y,w:view.w,h:view.h}};\n}\nasync function gwbDropAccept(file,clientX,clientY){\n const target=gwbDropInspect(clientX,clientY);\n if(!target)throw Error(\"Отпустите файл на действительное поле нанесения.\");\n if(!file||typeof file.name!=='string'||typeof file.size!=='number'||\n    !/\\.(?:pdf|ai|svg|png|jpe?g)$/i.test(file.name))\n   throw Error(\"Поддерживаются PDF, AI с PDF-данными, SVG, PNG и JPG.\");\n if(file.size<1||file.size>40*1024*1024)\n   throw Error(\"Размер логотипа должен быть от 1 байта до 40 МБ.\");\n const scope={template:y.template,entry:y.selectedEntry,page:y.page,order:String(v(\"order\").value)};\n if(target.index>=0){\n   await Vn(target.index);\n }else if(!target.manual)throw Error(\"Поле нанесения не выбрано.\");\n if(y.busy||y.template!==scope.template||y.selectedEntry!==scope.entry||\n    y.page!==scope.page||String(v(\"order\").value)!==scope.order)\n   throw Error(\"Заказ или поле изменились. Перенос отменён.\");\n const selected=y.placements[y.active];\n if(!selected||selected.page!==scope.page||\n    (target.index>=0&&selected.fieldIndex!==target.index)||\n    (target.manual&&!gwbPointInField(selected.field,\n       target.field.x+target.field.w/2,target.field.y+target.field.h/2)))\n   throw Error(\"Текущее поле не совпадает с выбранным при перетаскивании.\");\n // Reuse EXACT same parser, checks and default placement as the Add Logo button.\n // Ai catches import errors and leaves other fields untouched.\n await Ai({target:{files:[file],value:''}},\"art\");\n return true;\n}\nwindow.gwbExplorerLogoDrop={inspect:gwbDropInspect,accept:gwbDropAccept};\n";
export function applyLogoDrop(){
  let source=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
  if(source.includes(marker)){
    if(!source.includes('function gwbDropInspect(clientX,clientY)')||
       !source.includes(anchor))throw Error('Incomplete Explorer drop injection');
    return;
  }
  if(source.split(anchor).length!==2||
     !source.includes('function Vn(c)')||
     !source.includes('function Wn(c)')||
     !source.includes('function Ai(c,t)'))
    throw Error('Unrecognized bundled editor; refusing drag/drop patch');
  source=source.replace(anchor,bridge+'\n'+anchor);
  fs.writeFileSync(path,source);
}
