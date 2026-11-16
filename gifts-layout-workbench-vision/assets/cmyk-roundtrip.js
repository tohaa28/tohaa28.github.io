/* Preserve the vector editor's ORIGINAL PDF colors, including RGB raster
 * images, RGB vector paths, CMYK, Gray, spot and embedded ICC profiles.
 * Validate size and integrity, report color models; NEVER silently recolor.
 * A CMYK document label does not imply every object is CMYK.
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
 let cmykImage=0,rgbImage=0,iccImage=0,unknownPaint=false,spot=false;
 const name=lib.PDFName.of('ColorSpace');
 for(const [,obj] of pdf.context.enumerateIndirectObjects()){
   if(!obj?.dict||typeof obj.getContentsString!=='function'&&!obj.contents)continue;
   const cs=obj.dict.get(name);
   const csName=cs?.toString?.()||'';
   if(csName.includes('/DeviceRGB')||csName.includes('/CalRGB'))rgbImage++;
   if(csName.includes('/DeviceCMYK'))cmykImage++;
   if(csName.includes('/Separation')||csName.includes('/DeviceN'))spot=true;
   if(csName.includes('/ICCBased'))iccImage++;
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
 if(!texts.length&&!rgbImage&&!cmykImage&&!iccImage&&!spot)
   throw Error('Не удалось прочитать графическое содержимое PDF');
 const colors=scans(texts);
 const hasCMYK=!!(colors.cmyk||cmykImage||spot);
 const hasRGB=!!(colors.rgb||rgbImage);
 const model=hasCMYK&&hasRGB?'Mixed':hasCMYK?models.CMYK:
   hasRGB?models.RGB:models.Gray;
 // The PDF and its original image XObjects are preserved. ICC/unknown
 // streams are reported, not dropped or repainted.
 return {...colors,cmykImage,rgbImage,iccImage,unknownPaint,spot,
   model,widthMm:w,heightMm:h};
}
// TraceDraw's PDF covers the fixed field, while the SVG sends the true art
// bounds. Change only PDF page boxes; keep RGB and CMYK paths and image
// XObjects unchanged. No rasterization or implicit color conversion.
async function cropFieldPdf(bytes,field,bounds){
 const lib=root.PDFLib;
 if(!lib?.PDFDocument)throw Error('Нет модуля сохранения PDF');
 if(!field||!bounds||!['w','h'].every(k=>Number.isFinite(field[k])&&field[k]>0)||
    !['x','y','w','h'].every(k=>Number.isFinite(bounds[k]))||
    bounds.w<=0||bounds.h<=0)throw Error('Поле или границы рисунка не определены');
 const pdf=await lib.PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});
 if(pdf.getPageCount()!==1)throw Error('Должна быть одна страница PDF логотипа');
 const page=pdf.getPage(0),box=page.getMediaBox();
 if(Math.abs(box.width*PT_MM-field.w)>0.15||Math.abs(box.height*PT_MM-field.h)>0.15)
   throw Error('TraceDraw вернул PDF неправильного размера поля');
 const x=box.x+bounds.x/PT_MM;
 const y=box.y+(field.h-bounds.y-bounds.h)/PT_MM;
 const width=bounds.w/PT_MM,height=bounds.h/PT_MM;
 // Bounding rectangle can extend beyond the field. The media box must then
 // grow with the artwork so PDF viewers do not silently clip the imprint.
 page.setMediaBox(x,y,width,height);
 page.setCropBox(x,y,width,height);
 const out=await pdf.save({useObjectStreams:false});
 await verifyPdf(out,bounds);
 return out;
}
root.gwbCmykRoundtrip={verifyPdf,cropFieldPdf,scans};
})(window);