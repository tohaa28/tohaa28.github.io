/* Editable origin capsule inside exported Maketnaya PDFs.
 * Stores the original logo as a separate PDF attachment, not a snapshot of
 * the constructor. The composite page remains print-ready and unmodified. */
(function(root){
'use strict';
const MARK='gwb-maketnaya-layout-v1';
const NAME='gwb-maketnaya-source.json';
const PT=72/25.4;
const max=40*1024*1024;
const enc=new TextEncoder(),dec=new TextDecoder();
const finiteBox=x=>x&&['x','y','w','h'].every(k=>Number.isFinite(x[k]))&&x.w>0&&x.h>0;
async function pdfSource(art,lib,svgToPdf){
 if(art.pdfCompatible||art.ext==='svg'){
   const bytes=art.pdfCompatible?art.bytes:await svgToPdf(art);
   if(dec.decode(bytes.slice(0,5))!=='%PDF-')throw Error('Источник логотипа не является PDF');
   return bytes;
 }
 if(!['png','jpg','jpeg'].includes(art.ext)||!Number.isFinite(art.w)||!Number.isFinite(art.h)||
    art.w<=0||art.h<=0)throw Error('Неподдерживаемый источник логотипа');
 const doc=await lib.PDFDocument.create();
 const image=art.ext==='png'?await doc.embedPng(art.bytes):await doc.embedJpg(art.bytes);
 const w=art.w*PT,h=art.h*PT;
 doc.addPage([w,h]).drawImage(image,{x:0,y:0,width:w,height:h});
 return doc.save();
}
async function stamp(doc,placements,lib,svgToPdf,identity={}){
 if(!doc||typeof doc.attach!=='function')throw Error('PDF не поддерживает вложения исходников');
 if(!Array.isArray(placements)||!placements.length)throw Error('Не заданы нанесения');
 const manifest={marker:MARK,version:1,order:String(identity.order||''),
   article:String(identity.article||''),itemId:String(identity.itemId||''),placements:[]};
 const files=new Map();
 for(const entry of placements){
   if(!entry.art||!finiteBox(entry.field)||!finiteBox(entry.placement)||
      !Number.isInteger(entry.page))throw Error('Некорректные координаты печатного поля');
   let key=files.get(entry.art);
   if(!key){
     key='gwb-art-'+String(files.size+1).padStart(3,'0')+'.pdf';
     const pdf=await pdfSource(entry.art,lib,svgToPdf);
     if(pdf.byteLength>max)throw Error('Исходный логотип превышает 40 МБ');
     await doc.attach(pdf,key,{mimeType:'application/pdf',description:'Editable original logo only'});
     files.set(entry.art,key);
   }
   manifest.placements.push({art:key,fieldIndex:entry.fieldIndex??null,page:entry.page,
     field:{x:entry.field.x,y:entry.field.y,w:entry.field.w,h:entry.field.h},
     placement:{x:entry.placement.x,y:entry.placement.y,w:entry.placement.w,
                h:entry.placement.h,rotation:entry.placement.rotation||0,
                clipToField:!!entry.placement.clipToField}});
 }
 if(manifest.placements.length>64)throw Error('Слишком много полей для записи исходников');
 await doc.attach(enc.encode(JSON.stringify(manifest)),NAME,
   {mimeType:'application/json',description:MARK});
 doc.setProducer('Maketnaya / '+MARK);
 doc.setSubject('Maketnaya editable logo capsule; print-ready layout includes original constructor');
}
function inspectAttachments(attachments,selection={}){
 const source=attachments?.[NAME]?.content;
 if(!source)return {kind:'external'};
 if(!source.length||source.length>128*1024)
   return {kind:'invalid',error:'Повреждён служебный блок Макетной'};
 let info;
 try{info=JSON.parse(dec.decode(source))}catch{
   return {kind:'invalid',error:'Не удалось прочитать служебные данные Макетной'};
 }
 if(info?.marker!==MARK||info.version!==1||!Array.isArray(info.placements)||
    info.placements.length>64)
   return {kind:'invalid',error:'Неподдерживаемый формат исходников Макетной'};
 if(info.order&&selection.order&&info.order!==String(selection.order))
   return {kind:'invalid',error:'PDF был подготовлен для другого заказа'};
 if(info.article&&selection.article&&info.article!==String(selection.article))
   return {kind:'invalid',error:'PDF относится к другому артикулу'};
 const index=selection.fieldIndex;
 const found=info.placements.filter(p=>
   (index==null || p.fieldIndex===index) &&
   (selection.page==null || p.page===selection.page));
 if(found.length!==1)
   return {kind:'invalid',error:'В PDF нет однозначного логотипа выбранного поля'};
 const p=found[0];
 if(!finiteBox(p.field)||!finiteBox(p.placement)||!Number.isFinite(p.placement.rotation||0))
   return {kind:'invalid',error:'Недостоверная геометрия сохранённого логотипа'};
 const bytes=attachments[p.art]?.content;
 if(!/^[\w.-]{1,80}\.pdf$/.test(p.art)||!bytes||bytes.length<5||bytes.length>max||
    dec.decode(bytes.slice(0,5))!=='%PDF-')
   return {kind:'invalid',error:'Не найден отдельный PDF логотипа'};
 return {kind:'maketnaya',bytes:new Uint8Array(bytes),placement:p.placement,
   sourceField:p.field,page:p.page,fieldIndex:p.fieldIndex};
}
root.gwbMaketnayaPdfProvenance={stamp,inspectAttachments,marker:MARK};
})(window);
