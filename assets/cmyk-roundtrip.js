/* Strict verification of vector-editor PDF color handoff.
   A working-space label (CMYK) does NOT prove that painted objects are CMYK.
   Refuse RGB process paint and require real CMYK process operators/4-channel images.
   No conversion, no upload, no modification of the PDF bytes.
*/
(function(root){
'use strict';
if(root.gwbCmykRoundtrip)return;
const PT_MM=25.4/72;
const models=Object.freeze({RGB:'RGB',CMYK:'CMYK',Gray:'Gray'});
const op=/((?:\d*\.?\d+|[+-]\d*\.?\d+)(?:\s+(?:\d*\.?\d+|[+-]\d*\.?\d+)){0,3})\s+(rg|RG|k|K|g|G)(?=\s|$)/gm;
function scans(contents){
 const found={cmyk:0,rgb:0,gray:0,cmykValues:[],rgbValues:[]};
 for(const input of contents){
   for(const m of String(input).matchAll(op)){
     const values=m[1].trim().split(/\s+/).map(Number);
     const tag=m[2],count=/^[kK]$/.test(tag)?4:/^[rR]g$/.test(tag)?3:1;
     if(values.length!==count||!values.every(n=>Number.isFinite(n)&&n>=0&&n<=1))continue;
     const model=count===4?'cmyk':count===3?'rgb':'gray';
     found[model]++;
     if(model==='cmyk'&&found.cmykValues.length<2000)found.cmykValues.push(values);
     if(model==='rgb'&&found.rgbValues.length<100)found.rgbValues.push(values);
   }
 }
 return found;
}
async function verifyPdf(bytes,bounds){
 const lib=root.PDFLib;
 if(!lib?.PDFDocument||!lib.decodePDFRawStream||!lib.PDFName)
  throw Error('Библиотека анализа PDF не загружена — CMYK не проверен');
 if(!(bytes instanceof Uint8Array)||bytes.length<100||
    String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')
  throw Error('Получены некорректные данные PDF');
 if(!bounds||!['x','y','w','h'].every(k=>Number.isFinite(bounds[k]))||
    bounds.w<=0||bounds.h<=0)throw Error('Габариты нанесения не переданы');
 const pdf=await lib.PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});
 if(pdf.getPageCount()!==1)throw Error('Ожидалась одна страница PDF логотипа');
 const page=pdf.getPage(0);
 if(((page.getRotation().angle%360)+360)%360!==0)
   throw Error('Некорректный поворот PDF логотипа');
 const box=page.getCropBox(),w=box.width*PT_MM,h=box.height*PT_MM;
 if(!Number.isFinite(w)||!Number.isFinite(h)||Math.abs(w-bounds.w)>0.15||Math.abs(h-bounds.h)>0.15)
   throw Error('PDF не соответствует габаритам нарисованного логотипа: '+w.toFixed(3)+' × '+h.toFixed(3)+' мм');
 const texts=[];
 let cmykImage=0,rgbImage=0,unknownPaint=false,spot=false;
 const name=lib.PDFName.of('ColorSpace');
 for(const [,obj] of pdf.context.enumerateIndirectObjects()){
   if(!obj?.dict||typeof obj.getContentsString!=='function'&&!obj.contents)continue;
   const cs=obj.dict.get(name);
   const csName=cs?.toString?.()||'';
   if(csName.includes('/DeviceRGB')||csName.includes('/CalRGB'))rgbImage++;
   if(csName.includes('/DeviceCMYK'))cmykImage++;
   if(csName.includes('/Separation')||csName.includes('/DeviceN'))spot=true;
   if(csName.includes('/ICCBased'))unknownPaint=true;
   try{
     const decoded=lib.decodePDFRawStream(obj).decode();
     if(decoded.length>24*1024*1024)throw Error('Слишком большой поток PDF для контроля цветности');
     texts.push(new TextDecoder('latin1').decode(decoded));
   }catch(e){
     // Compressed/ciphered or externally dependent paint must not be marked CMYK.
     if(e?.message?.includes('Слишком большой'))throw e;
     unknownPaint=true;
   }
 }
 if(!texts.length)throw Error('Невозможно проверить цветовые операторы PDF');
 const colors=scans(texts);
 if(colors.rgb||rgbImage)
  throw Error('В экспортированном PDF обнаружены RGB-краски. Цвета не перенесены в CMYK — логотип оставлен без изменений.');
 if(unknownPaint)
  throw Error('В PDF имеются цветовые пространства, требующие дополнительной проверки. Перенос остановлен.');
 if(!colors.cmyk&&!cmykImage&&!spot)
  throw Error('В PDF не подтверждены исходные CMYK или плашечные краски — перенос остановлен.');
 return {...colors,cmykImage,rgbImage,spot,model:models.CMYK,widthMm:w,heightMm:h};
}
root.gwbCmykRoundtrip={verifyPdf,scans};
})(window);