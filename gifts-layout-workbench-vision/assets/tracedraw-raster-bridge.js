/* TraceDraw's pinned usvg importer accepts embedded PNGs, not JPEG/WebP.
 * Convert image payloads into PNG before the SVG reaches the Rust engine.
 * Preserve every SVG shape, element order, geometry and transform.
 * Bitmap pixels remain RGB(A), NOT silently coerced to CMYK. */
(function(root){
'use strict';
if(root.gwbTraceDrawRasterBridge)return;
const limit=40*1024*1024;
async function asPng(href){
 const mime=href.match(/^data:image\/([a-z0-9.+-]+)(?:;[^,]*)?,/i)?.[1]?.toLowerCase();
 if(!mime||!['jpeg','jpg','webp','gif','bmp'].includes(mime))
   throw Error('TraceDraw не поддерживает формат встроенного растра; нужен PNG/JPEG/WebP/GIF/BMP');
 if(href.length>limit*1.5)throw Error('Слишком большое встроенное изображение');
 const image=new Image();
 image.src=href;
 try{await image.decode()}catch{throw Error('Не удалось декодировать встроенный растр '+mime)}
 const w=image.naturalWidth,h=image.naturalHeight;
 if(!w||!h||w*h>100000000)throw Error('Неверный или чрезмерный размер растра');
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:false});
 if(!ctx)throw Error('Недоступно преобразование растра в PNG');
 ctx.drawImage(image,0,0);
 const converted=canvas.toDataURL('image/png');
 canvas.width=0;canvas.height=0;
 if(!converted.startsWith('data:image/png;base64,')||converted.length>limit*1.5)
   throw Error('PNG слишком велик для передачи в TraceDraw');
 return converted;
}
async function normalize(prepared){
 if(!prepared?.file||typeof prepared.file.name!=='string')throw Error('Не передан документ для TraceDraw');
 if(!/\.svg$/i.test(prepared.file.name))return prepared; // PDF native path remains intact
 const source=await prepared.file.text();
 if(source.length>limit)throw Error('SVG слишком велик для TraceDraw');
 const xml=new DOMParser().parseFromString(source,'image/svg+xml');
 if(xml.querySelector('parsererror')||xml.documentElement.localName!=='svg')
   throw Error('Повреждён SVG перед отправкой в TraceDraw');
 let converted=0,embedded=0;
 for(const node of xml.querySelectorAll('image')){
   const href=node.getAttribute('href')||node.getAttributeNS('http://www.w3.org/1999/xlink','href')||'';
   if(!href.startsWith('data:image/'))
     throw Error('TraceDraw: внешнее изображение без встроенных байтов не поддерживается');
   embedded++;
   if(/^data:image\/png(?:;[^,]*)?,/i.test(href))continue;
   const uri=await asPng(href);
   node.setAttribute('href',uri);
   node.removeAttributeNS('http://www.w3.org/1999/xlink','href');
   converted++;
 }
 if(!converted)return {...prepared,embeddedRasterCount:embedded,convertedRasterCount:0};
 const xmlText=new XMLSerializer().serializeToString(xml);
 if(xmlText.length>limit)throw Error('Растровый макет после упаковки превышает 40 МБ');
 return {...prepared,file:new File([xmlText],prepared.file.name,{type:'image/svg+xml'}),
   embeddedRasterCount:embedded,convertedRasterCount:converted};
}
root.gwbTraceDrawRasterBridge={normalize};
})(window);
