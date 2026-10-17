// Controlled bridge into the compiled Maketnaya editor state.
// The integration adds only two explicit APIs; original loading, field geometry,
// PrintCheck and export code are left unchanged.
import fs from 'node:fs';
import crypto from 'node:crypto';
const file=new URL('../assets/index-BpU9kvz8.js',import.meta.url);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const original='99b12826b63a21be663dcf4ef78f2717748c84604480fc50b6f9162e86903fcc';
const anchor='v("artwork").onchange=c=>Ai(c,"art");';
const bridge=String.raw`
window.gwbGetActiveLogoForEditor=function(){
  Ft();
  const placement=y.placements?.[y.active],art=placement?.art||null;
  if(!placement||!y.field)return null;
  return {
    token:[y.active,placement.fieldIndex,placement.page,art?.name||""].join("|"),
    fieldIndex:placement.fieldIndex,
    // Both the template field and the artwork placement use real millimetres.
    fieldSizeMm:{w:placement.field.w,h:placement.field.h},
    placementMm:placement.placement?{
      x:placement.placement.x-placement.field.x,
      y:placement.placement.y-placement.field.y,
      w:placement.placement.w,
      h:placement.placement.h,
      rotation:placement.placement.rotation||0,
      clipToField:!!placement.placement.clipToField
    }:null,
    name:art?.name||"",
    ext:art?.ext||"",
    file:art?.bytes?.length?new File([art.bytes],art.name,{type:art.mime||"application/octet-stream"}):null,
    hasArtwork:!!art
  };
};
window.gwbGetPdfLogoVectorOps=async function(token){
  Ft();
  const p=y.placements?.[y.active],art=p?.art;
  const actual=p?[y.active,p.fieldIndex,p.page,art?.name||""].join("|"):null;
  if(!p||!art?.pdfPage||token!==actual)throw new Error("Исходный PDF выбранного поля недоступен");
  const page=art.pdfPage,viewport=page.getViewport({scale:1});
  const list=await page.getOperatorList();
  const names=Object.fromEntries(Object.entries(xt).map(([k,v])=>[v,k]));
  if(list.fnArray.length>200000)throw new Error("Слишком большой PDF для обработки контуров в браузере");
  return {width:viewport.width,height:viewport.height,transform:Array.from(viewport.transform),
    ops:list.fnArray.map((n,i)=>{
      const args=list.argsArray[i];
      return {name:names[n]||String(n),
        args:n===xt.constructPath?[names[args?.[0]]||args?.[0],args?.[1],args?.[2]]:args};
    })
  };
};
window.gwbApplyEditedLogoToActiveField=async function(file,token,options={}){
  if(!(file instanceof File)||file.size<1||file.size>40*1024*1024||!(/\.svg$/i.test(file.name)))throw new Error("Редактор должен передать SVG до 40 МБ");
  if(y.busy)throw new Error("Макетная сейчас занята; повторите сохранение");
  Ft();
  const target=y.placements?.[y.active],art=target?.art||null;
  const actual=target?[y.active,target.fieldIndex,target.page,art?.name||""].join("|"):null;
  if(!target||!y.field||token!==actual)throw new Error("Выбранное поле изменилось; сохранение отменено, чтобы не заменить чужой логотип");
  y.busy=true;X();
  try{
    const next=await Qe(file,"art");
    Ft();
    const still=y.placements?.[y.active];
    if(still!==target||[y.active,still.fieldIndex,still.page,still.art?.name||""].join("|")!==token)
      throw new Error("Во время обработки было выбрано другое поле; старый логотип сохранён");
    let keep=target.placement?{...target.placement}:Ze(target.field,next);
    if(options?.artworkBoundsMm){
      const sourceField=target.field,provided=options.fieldSizeMm;
      const b=options.artworkBoundsMm;
      if(!provided||![provided.w,provided.h].every(Number.isFinite)||
        Math.abs(provided.w-sourceField.w)>0.01||Math.abs(provided.h-sourceField.h)>0.01)
        throw new Error("Поле нанесения изменилось: сохранение отменено");
      if(!["x","y","w","h"].every(k=>Number.isFinite(b[k]))||
        b.w<=0.001||b.h<=0.001||b.w>2000||b.h>2000||
        Math.abs(b.x)>2000||Math.abs(b.y)>2000)
        throw new Error("Редактор передал неверные габариты логотипа");
      if(Math.abs(next.w-b.w)>0.15||Math.abs(next.h-b.h)>0.15)
        throw new Error("Размер SVG не соответствует фактическому рисунку");
      // The SVG has already been cropped and translated to local (0,0)
      // by VectorCraft. Only its bounds, not the old full-page dimensions,
      // determine the placement. Rotation is baked into editable geometry.
      keep={x:sourceField.x+b.x,y:sourceField.y+b.y,
        w:b.w,h:b.h,rotation:0,clipToField:!!keep.clipToField};
    }else if(options?.fieldCanvas===true){
      const actualSize=target.field;
      const provided=options.fieldSizeMm;
      if(!provided||!Number.isFinite(provided.w)||!Number.isFinite(provided.h)||
        Math.abs(provided.w-actualSize.w)>0.01||Math.abs(provided.h-actualSize.h)>0.01)
        throw new Error("Размер поля нанесения изменился; сохранение отменено");
      // The imported SVG now contains the full field-sized artboard with the
      // original placement baked into the editable vector artwork itself.
      // Therefore it must occupy the entire template field exactly once.
      keep={x:actualSize.x,y:actualSize.y,w:actualSize.w,h:actualSize.h,
        rotation:0,clipToField:!!keep.clipToField};
    }
    target.art=next;target.placement=keep;
    y.art=next;y.placement=keep;
    v("artworkName").textContent=file.name;
    _t();X();
    Q(options?.artworkBoundsMm?"Из VectorCraft возвращён только нарисованный логотип с его габаритами и положением.":"Изменённый логотип применён к выбранному полю.");
    window.dispatchEvent(new CustomEvent("gwb-editor-readiness-changed"));
    return {name:file.name,fieldIndex:target.fieldIndex};
  }finally{y.busy=false;X()}
};
// Personal variants are separate from order submissions. Capturing or restoring
// them happens ONLY after an explicit user action; never on basket refresh.
window.gwbCapturePersonalLayout=function(){
  Ft();
  if(y.busy||!y.template||!y.selectedEntry?.article)
    throw Error("Откройте шаблон артикула из заказа");
  const article=String(y.selectedEntry.article).trim();
  const placed=y.placements.filter(p=>p.art?.bytes?.length&&p.placement&&p.field);
  if(!placed.length)throw Error("Нет размещённых логотипов для сохранения");
  const fields=y.template.fieldOptions||[];
  return {schema:"gwb-personal-layout/v1",article,createdAt:new Date().toISOString(),
    fields:fields.map(f=>({page:f.page,w:f.w,h:f.h,x:f.x,y:f.y})),
    items:placed.map(p=>({
      fieldIndex:p.fieldIndex,page:p.page,
      placement:{x:p.placement.x-p.field.x,y:p.placement.y-p.field.y,
        w:p.placement.w,h:p.placement.h,rotation:p.placement.rotation||0,
        clipToField:!!p.placement.clipToField},
      artwork:{name:p.art.name,mime:p.art.mime||"application/octet-stream",
        bytes:new Uint8Array(p.art.bytes)}
    }))};
};
window.gwbRestorePersonalLayout=async function(saved){
  if(!saved||saved.schema!=="gwb-personal-layout/v1"||!Array.isArray(saved.items))
    throw Error("Формат сохранённого макета не поддерживается");
  if(y.busy||!y.selectedEntry?.article||!y.template)
    throw Error("Сначала откройте шаблон артикула");
  const article=String(y.selectedEntry.article).trim(),template=y.template;
  if(saved.article!==article)throw Error("Этот вариант сохранён для другого артикула");
  const fields=template.fieldOptions||[];
  if(saved.fields?.length!==fields.length)throw Error("Количество полей конструктора изменилось");
  const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<0.25;
  for(let i=0;i<fields.length;i++){
    const a=saved.fields[i],b=fields[i];
    if(!a||a.page!==b.page||!near(a.w,b.w)||!near(a.h,b.h)||
       !near(a.x,b.x)||!near(a.y,b.y))
      throw Error("Поля текущего конструктора не совпадают с сохранённым вариантом");
  }
  if(!saved.items.length||saved.items.length>100)throw Error("Пустая или слишком большая запись");
  const seen=new Set();
  for(const p of saved.items){
    const idx=p.fieldIndex,field=fields[idx],pl=p.placement;
    if(!Number.isInteger(idx)||!field||seen.has(idx)||p.page!==field.page||
       !pl||!["x","y","w","h","rotation"].every(k=>Number.isFinite(pl[k]))||
       pl.w<=0||pl.h<=0||pl.w>2000||pl.h>2000||
       !(p.artwork?.bytes instanceof Uint8Array)||!p.artwork.bytes.length||
       p.artwork.bytes.length>40*1024*1024)
      throw Error("Сохранённый вариант содержит неверное поле или логотип");
    seen.add(idx);
  }
  y.busy=true;X();
  try{
    const prepared=[];
    for(const p of saved.items){
      const field={...fields[p.fieldIndex]};
      const file=new File([p.artwork.bytes],String(p.artwork.name||"logo.svg").slice(0,180),{
        type:String(p.artwork.mime||"application/octet-stream").slice(0,80)});
      const art=await Qe(file,"art");
      const pl=p.placement;
      prepared.push({field,fieldIndex:p.fieldIndex,page:field.page,art,
        placement:{x:field.x+pl.x,y:field.y+pl.y,w:pl.w,h:pl.h,
          rotation:pl.rotation,clipToField:!!pl.clipToField}});
    }
    if(y.template!==template||String(y.selectedEntry?.article||"").trim()!==article)
      throw Error("Артикул сменился при восстановлении — текущий макет не затронут");
    y.placements=prepared;
    y.active=-1;y.field=null;y.art=null;y.placement=null;
    _t();X();
  }finally{y.busy=false;X();}
  if(y.placements.length)await zn(0);
  Q("Личный вариант восстановлен. Он не отправлен в заказ.");
  window.dispatchEvent(new CustomEvent("gwb-editor-readiness-changed"));
  return {article,count:y.placements.length};
};

`;
export function applyLogoEditorBridge(){
  const source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  if(source.includes('window.gwbGetActiveLogoForEditor=function()')){
    const prior=source.replace(bridge,'');
    if(prior===source||hash(prior)!==original)throw Error('Logo editor bridge modified unexpectedly');
    return;
  }
  if(hash(source)!==original)throw Error('Refusing to patch unknown compiled editor; hash='+hash(source));
  if(source.split(anchor).length!==2)throw Error('Missing unique artwork handler');
  fs.writeFileSync(file,source.replace(anchor,bridge+anchor));
}
