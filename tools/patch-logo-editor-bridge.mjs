// Controlled bridge into the compiled Maketnaya editor state.
// The integration adds only two explicit APIs; original loading, field geometry,
// PrintCheck and export code are left unchanged.
import fs from 'node:fs';
import crypto from 'node:crypto';
const file=new URL('../assets/index-BpU9kvz8.js',import.meta.url);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const original='99b12826b63a21be663dcf4ef78f2717748c84604480fc50b6f9162e86903fcc';
const anchor='v("artwork").onchange=c=>Ai(c,"art");';
const bridge=String.raw\`
window.gwbGetActiveLogoForEditor=function(){
  Ft();
  const placement=y.placements?.[y.active],art=placement?.art||null;
  if(!placement||!y.field)return null;
  return {
    token:[y.active,placement.fieldIndex,placement.page,art?.name||""].join("|"),
    fieldIndex:placement.fieldIndex,
    name:art?.name||"",
    ext:art?.ext||"",
    file:art?.bytes?.length?new File([art.bytes],art.name,{type:art.mime||"application/octet-stream"}):null,
    hasArtwork:!!art
  };
};
window.gwbApplyEditedLogoToActiveField=async function(file,token){
  if(!(file instanceof File)||file.size<1||file.size>40*1024*1024||!(/\\.svg$/i.test(file.name)))throw new Error("Редактор должен передать SVG до 40 МБ");
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
    const keep=target.placement?{...target.placement}:Ze(target.field,next);
    target.art=next;target.placement=keep;
    y.art=next;y.placement=keep;
    v("artworkName").textContent=file.name;
    _t();X();
    Q("Изменённый логотип применён к выбранному полю без изменения размера и положения.");
    window.dispatchEvent(new CustomEvent("gwb-editor-readiness-changed"));
    return {name:file.name,fieldIndex:target.fieldIndex};
  }finally{y.busy=false;X()}
};
\`;
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
