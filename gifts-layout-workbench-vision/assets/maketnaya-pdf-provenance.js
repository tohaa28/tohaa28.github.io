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
const V2='e0002.dat',ART_PREFIX='e0',SCHEMA=2;
const MAX_META=512*1024;
async function gzip(bytes){
 if(typeof CompressionStream!=='function')throw Error('В браузере недоступна упаковка исходников PDF');
 const st=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
 return new Uint8Array(await new Response(st).arrayBuffer());
}
async function ungzip(bytes){
 if(typeof DecompressionStream!=='function')throw Error('В браузере недоступно распознавание PDF Макетной');
 const st=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
 const reader=st.getReader(),chunks=[];let total=0;
 try{
   while(true){
     const {done,value}=await reader.read();if(done)break;
     total+=value.length;
     if(total>MAX_META)throw Error('Повреждены служебные данные PDF');
     chunks.push(value);
   }
 }finally{reader.releaseLock()}
 const out=new Uint8Array(total);let n=0;
 for(const part of chunks){out.set(part,n);n+=part.length}
 return out;
}
async function sha256(bytes){
 if(!root.crypto?.subtle)throw Error('Не удаётся проверить целостность исходника PDF');
 return [...new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes))]
   .map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function stamp(doc,placements,lib,svgToPdf,identity={}){
 if(!doc||typeof doc.attach!=='function')throw Error('PDF не поддерживает вложенные исходники');
 if(!Array.isArray(placements)||!placements.length||placements.length>64)throw Error('Недопустимое число нанесений');
 const manifest={v:SCHEMA,o:String(identity.order||''),a:String(identity.article||''),
   i:String(identity.itemId||''),p:[],f:[]};
 const files=new Map();
 for(const entry of placements){
   if(!entry.art||!finiteBox(entry.field)||!finiteBox(entry.placement)||
      !Number.isInteger(entry.page))throw Error('Некорректная геометрия логотипа');
   let id=files.get(entry.art);
   if(!id){
     id=ART_PREFIX+String(files.size+1).padStart(3,'0')+'.bin';
     const bytes=await pdfSource(entry.art,lib,svgToPdf);
     if(bytes.length>max)throw Error('Исходный логотип больше 40 МБ');
     await doc.attach(bytes,id,{mimeType:'application/octet-stream'});
     manifest.f.push({n:id,h:await sha256(bytes)});
     files.set(entry.art,id);
   }
   manifest.p.push({n:id,j:entry.fieldIndex??null,g:entry.page,
     b:[entry.field.x,entry.field.y,entry.field.w,entry.field.h],
     q:[entry.placement.x,entry.placement.y,entry.placement.w,entry.placement.h,
        entry.placement.rotation||0,entry.placement.clipToField?1:0]});
 }
 const plain=enc.encode(JSON.stringify(manifest));
 if(plain.length>MAX_META)throw Error('Превышен размер служебного блока PDF');
 const binary=await gzip(plain);
 if(binary.length>128*1024)throw Error('Превышен размер служебного блока PDF');
 await doc.attach(binary,V2,{mimeType:'application/octet-stream'});
 // Deliberately no human-readable Maketnaya producer/subject/JSON filename:
 // self-contained portable envelope, not encryption or an origin signature.
}
function boxFrom(a){return Array.isArray(a)&&a.length===4?
 {x:a[0],y:a[1],w:a[2],h:a[3]}:null}
async function unpack(attachments){
 const packet=attachments?.[V2]?.content;
 if(!packet)return null;
 if(packet.length<10||packet.length>128*1024)
   throw Error('Неверный размер служебного блока');
 let m;
 try{m=JSON.parse(dec.decode(await ungzip(packet)))}catch(e){
   throw Error('Не удалось прочитать двоичные данные PDF: '+String(e?.message||e));
 }
 if(m?.v!==SCHEMA||!Array.isArray(m.p)||m.p.length<1||m.p.length>64||
   !Array.isArray(m.f)||m.f.length<1||m.f.length>64)
   throw Error('Неподдерживаемая версия данных PDF');
 for(const f of m.f){
   if(!/^e0\d{3}\.bin$/.test(f.n)||!/^[0-9a-f]{64}$/.test(f.h))throw Error('Повреждён список исходников');
   const b=attachments[f.n]?.content;
   if(!b||b.length<5||b.length>max||dec.decode(b.slice(0,5))!=='%PDF-'||
      await sha256(b)!==f.h)throw Error('Повреждён PDF исходного логотипа');
 }
 for(const p of m.p){
   if(!m.f.some(f=>f.n===p.n)||!Number.isInteger(p.g)||p.g<0||
      !(p.j==null||Number.isInteger(p.j)&&p.j>=0)||
      !finiteBox(boxFrom(p.b))||!Array.isArray(p.q)||p.q.length!==6||
      !finiteBox(boxFrom(p.q.slice(0,4)))||
      !Number.isFinite(p.q[4])||![0,1].includes(p.q[5]))
     throw Error('Некорректные координаты в служебном блоке');
 }
 return m;
}
function inspectLegacy(attachments,selection){
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
 const found=info.placements.filter(p=>
   (selection.fieldIndex==null||p.fieldIndex===selection.fieldIndex)&&
   (selection.page==null||p.page===selection.page));
 if(found.length!==1)return {kind:'invalid',error:'Нет однозначного логотипа в выбранном поле'};
 const p=found[0],bytes=attachments[p.art]?.content;
 if(!finiteBox(p.field)||!finiteBox(p.placement)||!bytes||bytes.length<5||
    bytes.length>max||dec.decode(bytes.slice(0,5))!=='%PDF-')
   return {kind:'invalid',error:'Исходный PDF логотипа повреждён'};
 return {kind:'maketnaya',bytes:new Uint8Array(bytes),placement:p.placement,
   sourceField:p.field,page:p.page,fieldIndex:p.fieldIndex,format:1};
}
async function inspectAttachments(attachments,selection={}){
 if(!attachments?.[V2])return inspectLegacy(attachments,selection);
 try{
   const m=await unpack(attachments);
   if(m.o&&selection.order&&m.o!==String(selection.order))
     throw Error('PDF подготовлен для другого заказа');
   if(m.a&&selection.article&&m.a!==String(selection.article))
     throw Error('PDF относится к другому артикулу');
   const found=m.p.filter(p=>
     (selection.fieldIndex==null||p.j===selection.fieldIndex)&&
     (selection.page==null||p.g===selection.page));
   if(found.length!==1)throw Error('Нет однозначного логотипа выбранного поля');
   const p=found[0];
   return {kind:'maketnaya',format:2,bytes:new Uint8Array(attachments[p.n].content),
     sourceField:boxFrom(p.b),placement:{...boxFrom(p.q.slice(0,4)),
        rotation:p.q[4],clipToField:!!p.q[5]},page:p.g,fieldIndex:p.j};
 }catch(e){return {kind:'invalid',error:String(e?.message||e)}}
}
async function identifyAttachments(attachments){
 if(!attachments)return {kind:'external'};
 if(attachments[V2]){
   try{
     await unpack(attachments);
     return {kind:'maketnaya',format:2};
   }catch(e){return {kind:'invalid',error:String(e?.message||e)}}
 }
 const l=inspectLegacy(attachments,{});
 return l.kind==='maketnaya' ? {kind:'maketnaya',format:1}:
   (attachments[NAME]?{kind:'invalid',error:l.error}:{kind:'external'});
}
root.gwbMaketnayaPdfProvenance={stamp,pdfSource,inspectAttachments,identifyAttachments,marker:MARK};
})(window);
