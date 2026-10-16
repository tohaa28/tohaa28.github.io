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
  let natural=nums&&nums.length===4&&nums.every(Number.isFinite)&&nums[2]>0&&nums[3]>0?nums:null;
  if(!natural){
    // SVG without viewBox uses CSS user units. Physical root lengths therefore
    // determine the native viewport in CSS pixels at exactly 96 dpi.
    const px=value=>{
      const m=String(value||'').trim().match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+))(mm|cm|in|pt|px)?$/i);
      if(!m)return NaN;
      const factors={mm:96/25.4,cm:96/2.54,in:96,pt:96/72,px:1};
      return Number(m[1])*factors[(m[2]||'px').toLowerCase()];
    };
    const w=px(source.getAttribute('width')),h=px(source.getAttribute('height'));
    if(Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0)natural=[0,0,w,h];
    else throw Error('SVG без viewBox должен содержать корректные физические ширину и высоту.');
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
function normalizeExport(text,field,logoBoundsMm){
  const {w:fieldW,h:fieldH}=fieldInfo({fieldSizeMm:field});
  const b=logoBoundsMm;
  if(!b||!['x','y','w','h'].every(key=>typeof b[key]==='number'&&Number.isFinite(b[key])))
    throw Error('VectorCraft не передал реальные границы рисунка');
  if(b.w<=0.001||b.h<=0.001||b.w>2000||b.h>2000||
    Math.abs(b.x)>2000||Math.abs(b.y)>2000)
    throw Error('Неверные размеры или координаты нарисованного логотипа');
  const input=new DOMParser().parseFromString(text,'image/svg+xml');
  const svg=input.documentElement;
  if(svg.localName!=='svg'||input.querySelector('parsererror'))
    throw Error('VectorCraft вернул повреждённый SVG');
  const view=svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if(!view||view.length!==4||!view.every(Number.isFinite)||view[2]<=0||view[3]<=0)
    throw Error('VectorCraft не передал габарит рисунка в SVG');
  const actualW=view[2]/ratio,actualH=view[3]/ratio;
  // Match independently measured bounds from the Rust engine. Do not accept
  // the entire print field as a fake logo or silently stretch the artwork.
  if(Math.abs(actualW-b.w)>0.15||Math.abs(actualH-b.h)>0.15)
    throw Error('Размер SVG '+fmt(actualW)+' × '+fmt(actualH)+
      ' мм не соответствует нарисованному логотипу '+fmt(b.w)+' × '+fmt(b.h)+' мм');
  if(b.w>fieldW*10||b.h>fieldH*10)
    throw Error('Габарит рисунка значительно превышает выбранное поле');
  svg.setAttribute('width',fmt(b.w)+'mm');
  svg.setAttribute('height',fmt(b.h)+'mm');
  svg.removeAttribute('data-gwb-imprint-field');
  return {svg:new XMLSerializer().serializeToString(input),
    boundsMm:{x:b.x,y:b.y,w:b.w,h:b.h}};
}

root.gwbVectorcraftField={prepare,normalizeExport,fieldInfo};
})(window);
