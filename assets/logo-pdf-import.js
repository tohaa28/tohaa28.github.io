/* Maketnaya PDF vector-path importer.
   PDF.js operator-list -> SVG shape objects, never rasterize or silently discard
   unsupported artwork. Requires pdf.js 5.x operator names, no external fetch. */
(function(root){
'use strict';
const paint=new Set(['fill','eoFill','stroke','closeStroke','fillStroke','eoFillStroke','closeFillStroke','closeEOFillStroke']);
const images=/^(paintImage|paintInlineImage|paintJpeg|paintSolidColorImageMask|paintForm)/;
const textOps=new Set(['showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText','showType3Text','setTextMatrix','beginText','setFont','setCharSpacing','setWordSpacing']);
const unsupported=new Set(['shadingFill','setFillColorN','setStrokeColorN','setFillPattern','setStrokePattern','beginGroup','setGState']);
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const fmt=n=>Number(Number(n).toFixed(4));
const rgb=a=>{
 if(typeof a==='string')return a;
 if(!a||typeof a.length!=='number')return '#000000';
 const values=Array.from(a).slice(0,3);
 const ints=values.map(x=>Math.min(255,Math.max(0,Math.round(x<=1?x*255:x))));
 return '#'+ints.map(x=>x.toString(16).padStart(2,'0')).join('');
};
function pathData(raw){
 const data=raw?.[0],parts=[];
 if(!data||!data.length)return '';
 // PDF.js 5.6 compressed drawing operands: opcode 0 M, 1 L,
 // 2 cubic, 3 quadratic, 4 close; include finite-value guard.
 let i=0;const len=data.length;
 while(i<len){
   const op=data[i++];
   let arity,cmd;
   if(op===0){arity=2;cmd='M'}
   else if(op===1){arity=2;cmd='L'}
   else if(op===2){arity=6;cmd='C'}
   else if(op===3){arity=4;cmd='Q'}
   else if(op===4){arity=0;cmd='Z'}
   else return null;
   if(i+arity>len)return null;
   const v=Array.from(data.slice(i,i+arity));i+=arity;
   if(v.some(x=>!Number.isFinite(x)))return null;
   parts.push(cmd+(arity?' '+v.map(fmt).join(' '):''));
 }
 return parts.join(' ');
}
function convert(payload){
 const ops=payload?.ops,width=Number(payload?.width),height=Number(payload?.height);
 const viewport=payload?.transform;
 if(!Array.isArray(ops)||!Array.isArray(viewport)||viewport.length!==6||
   !Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
   throw Error('PDF: нет корректных векторных команд или размеров страницы.');
 if(ops.length>200000)throw Error('PDF: слишком много операций для безопасного редактирования.');
 let current={matrix:viewport.slice(),fill:'#000000',stroke:'#000000',lineWidth:1,lineCap:0,lineJoin:0,dash:[],dashOffset:0};
 const stack=[],shapes=[],warnings=[];let currentPath='';
 function mark(message){if(!warnings.includes(message))warnings.push(message)}
 for(const instruction of ops){
  const op=instruction?.name,a=instruction?.args||[];
  if(op==='save'){stack.push({...current,matrix:current.matrix.slice()});continue}
  if(op==='restore'){current=stack.pop()||current;continue}
  if(op==='transform'){
   if(a.length===6&&a.every(Number.isFinite))current.matrix=mul(current.matrix,a);
   else mark('Преобразования PDF');
   continue;
  }
  if(op==='setFillRGBColor'||op==='setFillGray'||op==='setFillCMYKColor'){
   if(op!=='setFillRGBColor')mark('Цветовые пространства PDF');
   else current.fill=rgb(a[0]?.length?a[0]:a);
   continue;
  }
  if(op==='setStrokeRGBColor'||op==='setStrokeGray'||op==='setStrokeCMYKColor'){
   if(op!=='setStrokeRGBColor')mark('Цветовые пространства PDF');
   else current.stroke=rgb(a[0]?.length?a[0]:a);
   continue;
  }
  if(op==='setLineWidth'){current.lineWidth=Number(a[0])||1;continue}
  if(op==='setLineCap'){current.lineCap=Number(a[0])||0;continue}
  if(op==='setLineJoin'){current.lineJoin=Number(a[0])||0;continue}
  if(op==='setDash'){current.dash=Array.isArray(a[0])?a[0].slice():[];current.dashOffset=Number(a[1])||0;continue}
  if(op==='constructPath'){
   // 5.x: [paintingOperatorNumber, [Float32Array(path-draw-ops)], bbox]
   const p=pathData(a[1]);
   if(p===null)mark('Неподдерживаемая геометрия PDF');
   else currentPath=p;
   continue;
  }
  if(paint.has(op)||op==='rawFillPath'){
   const d=op==='rawFillPath'?pathData(a[1])||'':currentPath;
   const fill=/fill/i.test(op),stroke=/stroke/i.test(op);
   if(d){
     const attrs={d,fill:fill?current.fill:'none',stroke:stroke?current.stroke:'none',
      transform:'matrix('+current.matrix.map(fmt).join(' ')+')'};
     if(stroke){attrs['stroke-width']=fmt(current.lineWidth);attrs['stroke-linecap']=['butt','round','square'][current.lineCap]||'butt';attrs['stroke-linejoin']=['miter','round','bevel'][current.lineJoin]||'miter';}
     if(current.dash.length)attrs['stroke-dasharray']=current.dash.join(' ');
     if(op.toLowerCase().includes('eo'))attrs['fill-rule']='evenodd';
     shapes.push(attrs);
   }
   currentPath='';continue;
  }
  if(op==='endPath'){currentPath='';continue}
  if(op==='clip'||op==='eoClip'){mark('Контуры обрезки PDF');continue}
  if(textOps.has(op)){if(['showText','showSpacedText','showType3Text','nextLineShowText','nextLineSetSpacingShowText'].includes(op))mark('Нередактируемый текст PDF');continue}
  if(unsupported.has(op)||images.test(op)){mark('Сложные эффекты или изображения PDF');continue}
 }
 if(!shapes.length)throw Error('PDF не содержит доступных контуров для редактирования. Исходный файл не изменён.');
 if(warnings.length)throw Error('PDF содержит элементы, которые нельзя достоверно перенести: '+warnings.join(', ')+'. Импорт без потерь отменён; исходник остаётся в шаблоне.');
 return {width,height,shapes};
}
root.gwbImportPdfVector={convert,pathData};
})(window);