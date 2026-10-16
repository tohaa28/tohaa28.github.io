/* Millimetre-exact SVG artboard handoff for Maketnaya -> VectorCraft -> Maketnaya.
   Artwork is placed into the original imprint field (rather than stretching the
   logo to a fictitious artboard); vectors stay vectors and remain independently
   editable in VectorCraft. The template field, not the art bounds, fixes size. */
(function(root){
'use strict';
const NS='http://www.w3.org/2000/svg';
const ratio=72/25.4;
const fmt=v=>String(Number(v.toFixed(5)));
function fieldInfo(selected){
  const f=selected?.fieldSizeMm,p=selected?.placementMm;
  if(!f||![f.w,f.h].every(v=>Number.isFinite(v)&&v>0&&v<=2000))
    throw Error('Неизвестен размер выбранного поля нанесения в миллиметрах');
  if(p&&![p.x,p.y,p.w,p.h,p.rotation].every(Number.isFinite))
    throw Error('Неверные координаты логотипа в выбранном поле');
  return {w:f.w,h:f.h,placement:p||{x:0,y:0,w:f.w,h:f.h,rotation:0,clipToField:false}};
}
function doc(){
  const xml=document.implementation.createDocument(NS,'svg',null);
  const svg=xml.documentElement;
  svg.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
  return {xml,svg};
}
function physicalArtboard(f){
  const {xml,svg}=doc();
  svg.setAttribute('width',fmt(f.w)+'mm');svg.setAttribute('height',fmt(f.h)+'mm');
  svg.setAttribute('viewBox','0 0 '+fmt(f.w)+' '+fmt(f.h));
  svg.setAttribute('data-gwb-imprint-field','true');
  return {xml,svg};
}
function addRotation(el,p){
  if(p.rotation)el.setAttribute('transform',
    'rotate('+fmt(p.rotation)+' '+fmt(p.x+p.w/2)+' '+fmt(p.y+p.h/2)+')');
}
function safeSvg(text){
  const parsed=new DOMParser().parseFromString(text,'image/svg+xml');
  if(parsed.querySelector('parsererror')||parsed.documentElement.localName!=='svg')
    throw Error('Невозможно прочитать исходный SVG');
  for(const node of Array.from(parsed.querySelectorAll('script,foreignObject,iframe,object,embed')))
    node.remove();
  for(const node of [parsed.documentElement,...parsed.querySelectorAll('*')]){
    for(const a of Array.from(node.attributes)){
      if(/^on/i.test(a.name) || /javascript:|vbscript:/i.test(a.value) ||
        ((a.name==='href'||a.name.endsWith(':href'))&&
          a.value&&!a.value.startsWith('#')&&!a.value.startsWith('data:image/')))
        node.removeAttribute(a.name);
    }
  }
  return parsed.documentElement;
}
function importVector(source,svg,p){
  const view=source.getAttribute('viewBox');
  const nums=view?view.trim().split(/[\s,]+/).map(Number):null;
  const natural=nums&&nums.length===4&&nums.every(Number.isFinite)&&nums[2]>0&&nums[3]>0?nums:null;
  if(!natural){
    // Root size without viewBox is interpreted in CSS px / physical units by SVG,
    // but we cannot safely guess the intrinsic design-space coordinates.
    throw Error('У SVG отсутствует корректный viewBox. Добавьте viewBox в исходный вектор.');
  }
  const group=svg.ownerDocument.createElementNS(NS,'g');
  group.setAttribute('data-gwb-logo','imported');
  const scaleX=p.w/natural[2],scaleY=p.h/natural[3];
  group.setAttribute('transform',
    'translate('+fmt(p.x+p.w/2)+' '+fmt(p.y+p.h/2)+') '+
    'rotate('+fmt(p.rotation||0)+') '+
    'translate('+fmt(-p.w/2)+' '+fmt(-p.h/2)+') '+
    'scale('+fmt(scaleX)+' '+fmt(scaleY)+') '+
    'translate('+fmt(-natural[0])+' '+fmt(-natural[1])+')');
  for(const attr of ['fill','stroke','opacity','font-family','font-size','font-weight','style','class']){
    const val=source.getAttribute(attr);if(val)group.setAttribute(attr,val);
  }
  for(const child of Array.from(source.childNodes))
    group.appendChild(svg.ownerDocument.importNode(child,true));
  svg.appendChild(group);
}
async function importRaster(file,svg,p){
  const bytes=new Uint8Array(await file.arrayBuffer());
  let binary='';const size=0x8000;
  for(let i=0;i<bytes.length;i+=size)
    binary+=String.fromCharCode(...bytes.subarray(i,i+size));
  const mime=/\.png$/i.test(file.name)?'image/png':/\.webp$/i.test(file.name)?'image/webp':'image/jpeg';
  const image=svg.ownerDocument.createElementNS(NS,'image');
  for(const [k,v] of Object.entries({x:p.x,y:p.y,width:p.w,height:p.h}))
    image.setAttribute(k,fmt(v));
  image.setAttribute('preserveAspectRatio','none');
  image.setAttribute('href','data:'+mime+';base64,'+btoa(binary));
  addRotation(image,p);svg.appendChild(image);
}
async function prepare(file,selected){
  const {w,h,placement}=fieldInfo(selected);
  if(!file||typeof file.name!=='string')throw Error('Исходный логотип недоступен');
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['svg','png','jpg','jpeg','webp'].includes(ext))
    return {file,fieldSizeMm:{w,h},fieldCanvas:false}; // PDF/AI handled natively by VectorCraft
  const {xml,svg}=physicalArtboard({w,h});
  if(ext==='svg')importVector(safeSvg(await file.text()),svg,placement);
  else await importRaster(file,svg,placement);
  const data=new XMLSerializer().serializeToString(xml);
  return {file:new File([data],file.name.replace(/\.[^.]+$/,'')+'-поле.svg',{type:'image/svg+xml'}),
    fieldSizeMm:{w,h},fieldCanvas:true};
}
function normalizeExport(text,field){
  const {w,h}=fieldInfo({fieldSizeMm:field});
  const input=new DOMParser().parseFromString(text,'image/svg+xml');
  const svg=input.documentElement;
  if(svg.localName!=='svg'||input.querySelector('parsererror'))
    throw Error('VectorCraft вернул повреждённый SVG');
  const view=svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if(!view||view.length!==4||!view.every(Number.isFinite)||view[2]<=0||view[3]<=0)
    throw Error('VectorCraft не передал размер страницы SVG');
  const actualW=view[2]/ratio,actualH=view[3]/ratio;
  // The SVG export from VectorCraft uses numeric coordinates in 72pt/inch.
  // Fail closed if VectorCraft's own page size was changed: never invisibly
  // stretch edited shapes into a differently sized imprint field.
  if(Math.abs(actualW-w)>0.15||Math.abs(actualH-h)>0.15)
    throw Error('Размер страницы VectorCraft '+fmt(actualW)+' × '+fmt(actualH)+
      ' мм отличается от поля нанесения '+fmt(w)+' × '+fmt(h)+' мм. Верните размер монтажной области.');
  svg.setAttribute('width',fmt(w)+'mm');
  svg.setAttribute('height',fmt(h)+'mm');
  svg.setAttribute('data-gwb-imprint-field','true');
  return new XMLSerializer().serializeToString(input);
}
root.gwbVectorcraftField={prepare,normalizeExport,fieldInfo};
})(window);
