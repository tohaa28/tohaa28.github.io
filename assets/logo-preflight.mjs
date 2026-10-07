import {configureRule,checkEnabled,detailRule,settingsProblem} from './method-settings.mjs?v=20260930-1';
import {detailFindings} from './logo-detail-check.mjs?v=20261007-1';
import {REQUIREMENTS_VERSION,SOURCES,resolveMethod,effectiveRule,CONDITION_LABELS} from './print-requirements.mjs?v=20260929-2';
import {cssColor,vectorColorEvidence,pixelColorEvidence,colorFindings} from './logo-color.mjs?v=20260929-2';
export {REQUIREMENTS_VERSION,SOURCES,resolveMethod};
export function contextFromOrder(text='') {
  const s=String(text).toLowerCase();
  const context={};
  if(/без\s+подложк/.test(s))context.underbase=false;
  else if(/подложк/.test(s))context.underbase=true;
  if(/soft[ -]?touch|софт[ -]?тач/.test(s))context.softTouch=true;
  if(/пуфф|вспенивающ/.test(s)){context.puff=true;context.foilOrPuff=true;}
  if(/металлизированн.*нит|люминесцентн.*нит|светоотражающ.*нит/.test(s))context.specialThread=true;
  return context;
}
const mm=25.4/72;
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const minScale=m=>{const a=m[0]**2+m[1]**2,b=m[2]**2+m[3]**2,c=m[0]*m[2]+m[1]*m[3];return Math.sqrt(Math.max(0,(a+b-Math.sqrt((a-b)**2+4*c*c))/2));};
const num=n=>Math.round(n*1000)/1000;
const issue=(id,status,text,extra={})=>({id,status,text,source:SOURCES.specifications,...extra});

// Read once at upload. This never inspects or modifies the product template.
export async function inspectArtwork(art, OPS) {
  const facts={version:REQUIREMENTS_VERSION,format:art.ext,text:false,gradients:false,transparency:false,effects:false,hidden:false,strokes:[],rasters:[],colors:[],geometryComplete:false,limitations:[]};
  try {
    if(art.svg) await inspectSvg(art,facts);
    else if(art.pdfPage) {await inspectPdf(art,facts,OPS);await inspectPdfColors(art,facts);}
    else if(art.pixelW) {
      facts.rasters.push({pixelW:art.pixelW,pixelH:art.pixelH,w:art.w,h:art.h});
      facts.colorModel=rasterColorModel(art.bytes,art.ext);
      facts.limitations.push('Растр: шрифты и векторные эффекты уже сведены; исходные объекты недоступны.');
    }
    if(art.image) {
      // Morphological analysis runs asynchronously after editing pauses.
      const width=art.image.naturalWidth||art.image.width,height=art.image.naturalHeight||art.image.height;
      const scale=Math.min(1,2048/Math.max(width,height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(art.image,0,0,canvas.width,canvas.height);
      facts.pixelColors=pixelColorEvidence(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{complete:scale===1&&!art.pdf&&!art.svg});
      if(facts.vectorColors&&!facts.vectorColors.complete){facts.vectorColors.colored ||=facts.pixelColors.colored;facts.vectorColors.gray ||=facts.pixelColors.gray;}
    }
  } catch(error) {facts.limitations.push('Неполный анализ: '+String(error?.message||error));}
  return facts;
}

export function rasterColorModel(bytes,ext) {
  if(!bytes)return 'unknown';
  if(ext==='png'&&bytes.length>25)return [0,4].includes(bytes[25])?'Gray':[2,3,6].includes(bytes[25])?'RGB':'unknown';
  if(['jpg','jpeg'].includes(ext)) {
    for(let i=2;i+8<bytes.length;) {
      if(bytes[i]!==255){i++;continue;}
      const marker=bytes[i+1];if(marker===0xda||marker===0xd9)break;
      if(marker===0xff){i++;continue;}
      const length=bytes[i+2]*256+bytes[i+3];if(length<2)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return ({1:'Gray',3:'RGB',4:'CMYK'}[bytes[i+9]])||'unknown';
      i+=length+2;
    }
  }
  return 'unknown';
}

async function inspectSvg(art,facts) {
  const holder=document.createElement('div');
  holder.style.cssText='position:fixed;left:-100000px;top:0;pointer-events:none;';
  const root=art.svg.root.cloneNode(true);holder.append(root);document.body.append(holder);
  try {
    root.style.width=art.w+'mm';root.style.height=art.h+'mm';
    const rootRect=root.getBoundingClientRect(), ux=art.w/rootRect.width, uy=art.h/rootRect.height;
    facts.colorModel='RGB';facts.geometryComplete=true;
    facts.text=!!root.querySelector('text,tspan,textPath');
    facts.gradients=!!root.querySelector('linearGradient,radialGradient');
    facts.effects=!!root.querySelector('filter,mask');
    facts.hasClips=!!root.querySelector('clipPath');
    facts.hasOpenPaths=false;
    facts.elements=[];
    const colors=new Set();
    for(const element of [root,...root.querySelectorAll('*')]) {
      const style=getComputedStyle(element);
      if(style.display==='none'||style.visibility==='hidden')facts.hidden=true;
      if([style.opacity,style.fillOpacity,style.strokeOpacity].some(v=>v!==''&&Number(v)<1))facts.transparency=true;
      if(style.filter!=='none'||style.maskImage&&style.maskImage!=='none')facts.effects=true;
      if(!element.matches('path,rect,circle,ellipse,line,polyline,polygon,text,image,use'))continue;
      if(element.closest('defs,clipPath,mask,pattern,marker'))continue;
      if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)continue;
      const rect=element.getBoundingClientRect();
      const box={x:(rect.x-rootRect.x)*ux,y:(rect.y-rootRect.y)*uy,w:rect.width*ux,h:rect.height*uy};
      if(!Number.isFinite(box.x+box.y+box.w+box.h))continue;
      const ctm=element.getScreenCTM();
      const matrix=ctm?[ctm.a*ux,ctm.b*uy,ctm.c*ux,ctm.d*uy,0,0]:null;
      const uniform=matrix&&Math.abs(Math.hypot(matrix[0],matrix[1])-Math.hypot(matrix[2],matrix[3]))<1e-6&&Math.abs(matrix[0]*matrix[2]+matrix[1]*matrix[3])<1e-6;
      if(style.stroke!=='none'&&Number.parseFloat(style.strokeWidth)>0&&matrix) {
        const width=Number.parseFloat(style.strokeWidth)*minScale(matrix);
        facts.strokes.push({width,box,uncertain:!uniform||style.vectorEffect==='non-scaling-stroke'||facts.hasClips});
      }
      let opacity=1,visible=true;
      for(let node=element;node&&holder.contains(node);node=node.parentElement){const s=getComputedStyle(node);opacity*=Number(s.opacity);if(s.display==='none'||s.visibility==='hidden')visible=false;}
      if(visible)for(const [color,alpha] of [[element.matches('line,image')?'none':style.fill,Number(style.fillOpacity)],[Number.parseFloat(style.strokeWidth)>0?style.stroke:'none',Number(style.strokeOpacity)]]){
        if(color==='none'||color.startsWith('url(')||opacity*alpha===0)continue;
        const paint=cssColor(color);colors.add(paint?`rgba(${paint.rgb.join(',')},${paint.alpha*opacity*alpha})`:color);
      }
      if(element.localName==='path'&&!/[zZ]\s*$/.test(element.getAttribute('d')||''))facts.hasOpenPaths=true;
      if(element.matches('line,polyline'))facts.hasOpenPaths=true;
      if(element.matches('path,use,text,image')||element.getAttribute('transform')||facts.hasClips)facts.geometryComplete=false;
      // Simple filled primitives provide exact lower-bound evidence. Curves/outlined text
      // remain a visual estimate; bounding boxes are not treated as stroke thickness.
      if(element.matches('rect,circle,ellipse')&&style.fill!=='none'&&matrix&&!facts.hasClips) {
        let width;
        if(element.localName==='rect') width=Math.min(element.width.baseVal.value,element.height.baseVal.value);
        else if(element.localName==='circle') width=2*element.r.baseVal.value;
        else width=2*Math.min(element.rx.baseVal.value,element.ry.baseVal.value);
        facts.elements.push({width:width*minScale(matrix),box,uncertain:!uniform});
      }
      if(element.localName==='image') {
        facts.geometryComplete=false;
        const href=element.getAttribute('href')||element.getAttribute('xlink:href');
        if(href?.startsWith('data:image/')) {
          try {const img=new Image();img.src=href;await img.decode();facts.rasters.push({pixelW:img.naturalWidth,pixelH:img.naturalHeight,w:box.w,h:box.h,box});}
          catch {facts.limitations.push('Не удалось измерить встроенное изображение SVG.');}
        }
      }
    }
    facts.colors=[...colors];
    facts.vectorColors=vectorColorEvidence(facts.colors,{complete:!facts.gradients&&!facts.effects&&!facts.transparency&&!facts.hasClips&&!facts.rasters.length&&!root.querySelector('use,image')});
    // Overlap may merge thin primitives into a thick visible silhouette.
    for(const a of [...facts.elements,...facts.strokes])if([...facts.elements,...facts.strokes].some(b=>b!==a&&b.box&&a.box&&a.box.x<b.box.x+b.box.w&&a.box.x+a.box.w>b.box.x&&a.box.y<b.box.y+b.box.h&&a.box.y+a.box.h>b.box.y))a.uncertain=true;
    facts.colorCountComplete=facts.geometryComplete&&!facts.gradients&&!facts.effects&&!facts.transparency&&!facts.rasters.length;
    facts.limitations.push('SVG использует RGB; плашечные краски и цветоделение проверяются в исходнике.');
  } finally {holder.remove();}
}

async function inspectPdf(art,facts,OPS) {
  const list=await art.pdfPage.getOperatorList();
  const names=Object.fromEntries(Object.entries(OPS).map(([name,id])=>[id,name]));
  let state={matrix:[1,0,0,1,0,0],lineWidth:1,fill:'#000000',stroke:'#000000'},stack=[];const painted=new Set();let colorIncomplete=false;
  for(let i=0;i<list.fnArray.length;i++) {
    const name=names[list.fnArray[i]],args=list.argsArray[i]||[];
    if(name==='save')stack.push({...state,matrix:[...state.matrix]});
    if(name==='restore')state=stack.pop()||state;
    if(name==='transform')state.matrix=multiply(state.matrix,args);
    if(name==='paintFormXObjectBegin'){stack.push({...state,matrix:[...state.matrix]});if(args[0])state.matrix=multiply(state.matrix,args[0]);}
    if(name==='paintFormXObjectEnd')state=stack.pop()||state;
    if(name==='setLineWidth')state.lineWidth=args[0];
    if(name==='setFillRGBColor')state.fill=args[0];
    if(name==='setStrokeRGBColor')state.stroke=args[0];
    if(name==='setFillColorN'||name==='setStrokeColorN')colorIncomplete=true;
    if(/showText|showSpacedText|nextLine.*ShowText/.test(name||''))facts.text=true;
    if(name==='shadingFill')facts.gradients=true;
    if(name==='setFillColorN'||name==='setStrokeColorN')facts.limitations.push('Паттерн или специальная краска PDF: проверьте заливку в исходнике.');
    if(name==='beginGroup'&&args[0]?.smask)facts.transparency=true;
    if(name==='setGState') {
      const visit=a=>{if(!Array.isArray(a))return;if(typeof a[0]==='string') {
        if(['ca','CA'].includes(a[0])&&Number(a[1])<1)facts.transparency=true;
        if(a[0]==='SMask'&&a[1]&&a[1]!=='None')facts.transparency=true;
        if(a[0]==='BM'&&a[1]&&a[1]!=='Normal')facts.effects=true;
        if(a[0]==='LW')state.lineWidth=a[1];
      }else a.forEach(visit);};visit(args);
    }
    const paint=name==='constructPath'?names[args[0]]:name;
    if(/^(fill|eoFill|fillStroke|eoFillStroke|closeFillStroke|closeEOFillStroke)$/.test(paint||'')||/showText|showSpacedText|nextLine.*ShowText/.test(name||''))painted.add(state.fill);
    if(/^(stroke|closeStroke|fillStroke|eoFillStroke|closeFillStroke|closeEOFillStroke)$/.test(paint||''))painted.add(state.stroke);
    if(/paint.*Image/.test(name||''))colorIncomplete=true;
    if(/^(stroke|closeStroke|fillStroke|eoFillStroke|closeFillStroke|closeEOFillStroke)$/.test(paint||''))facts.strokes.push({width:Math.abs(state.lineWidth)*minScale(state.matrix)*mm,uncertain:true});
    if(name==='paintImageXObject'||name==='paintInlineImageXObject') {
      const img=name==='paintInlineImageXObject'?args[0]:{width:args[1],height:args[2]};
      const w=Math.hypot(state.matrix[0],state.matrix[1])*mm,h=Math.hypot(state.matrix[2],state.matrix[3])*mm;
      if(img?.width>0&&img?.height>0&&w>0&&h>0)facts.rasters.push({pixelW:img.width,pixelH:img.height,w,h});
      else facts.limitations.push('Не определено разрешение одного из встроенных изображений PDF.');
    } else if(/paint.*Image/.test(name||'')&&!/Mask/.test(name)) facts.limitations.push('Групповой растр PDF: разрешение требует проверки в исходнике.');
    if(name==='beginMarkedContentProps')facts.hidden=true; // Optional content may be omitted by the renderer.
  }
  const css=[...painted].map(c=>typeof c==='string'&&/^#[a-f\d]{6}$/i.test(c)?`rgb(${[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)).join(', ')})`:c);
  facts.vectorColors=vectorColorEvidence(css,{complete:!colorIncomplete&&!facts.effects&&!facts.transparency&&!facts.gradients&&css.length>0});
  facts.vectorColors.separationsComplete=false; // Screen RGB cannot certify PDF spot-color separations.
  facts.limitations.push('PDF.js преобразует цвета для экрана: исходные CMYK, Pantone, профили, число красок и сумма красок требуют проверки цветоделений.');
  facts.limitations.push('Замкнутость и пересечения контуров PDF, скрытые слои и минимальная высота букв в кривых не подтверждаются рендерером.');
  if(art.pages>1)facts.limitations.push('Проверена только первая страница логотипа — именно она размещается и экспортируется.');
}

// Original PDF color operators, before PDF.js converts everything to screen RGB.
// Strings/comments are removed so text saying "1 0 0 rg" cannot become evidence.
export function pdfColorOperators(source) {
  let cleaned='',depth=0;
  for(let i=0;i<source.length;i++) {
    const c=source[i];
    if(depth){if(c==='\\'){i++;continue;}if(c==='(')depth++;if(c===')')depth--;continue;}
    if(c==='('){depth=1;cleaned+=' ';continue;}
    if(c==='%'){while(i<source.length&&!/[\r\n]/.test(source[i]))i++;cleaned+=' ';continue;}
    if(c==='<'&&source[i+1]!=='<'){while(i<source.length&&source[i]!=='>')i++;cleaned+=' ';continue;}
    cleaned+=c;
  }
  // Inline image byte streams are intentionally excluded, not interpreted as operators.
  cleaned=cleaned.replace(/\bBI\b[\s\S]*?\bEI\b/g,' ');
  const number='[-+]?(?:\\d+\\.?\\d*|\\.\\d+)';
  const re=new RegExp(`(?:^|\\s)((?:${number}\\s+){1,4})(rg|RG|k|K|g|G)(?=\\s|$)`,'g');
  return [...cleaned.matchAll(re)].map(m=>({model:/k/i.test(m[2])?'CMYK':/rg/i.test(m[2])?'RGB':'Gray',values:m[1].trim().split(/\s+/).map(Number)})).filter(c=>c.values.length===({CMYK:4,RGB:3,Gray:1}[c.model])&&c.values.every(v=>v>=0&&v<=1));
}
async function inspectPdfColors(art,facts) {
  const lib=globalThis.PDFLib;
  if(!art.bytes||!lib?.decodePDFRawStream)return;
  const pdf=await lib.PDFDocument.load(art.bytes.slice(),{updateMetadata:false});
  const seen=new Set(),colors=[],models=new Set();let unsupported=false;
  const visit=(value)=>{
    const object=pdf.context.lookup(value);if(!object||seen.has(object))return;seen.add(object);
    if(object instanceof lib.PDFArray){object.asArray().forEach(visit);return;}
    if(!(object instanceof lib.PDFRawStream))return;
    const subtype=String(object.dict.get(lib.PDFName.of('Subtype'))||'');
    if(subtype==='/Image') {
      const cs=String(pdf.context.lookup(object.dict.get(lib.PDFName.of('ColorSpace')))||'');
      if(cs==='/DeviceRGB')models.add('RGB');else if(cs==='/DeviceCMYK')models.add('CMYK');else if(cs==='/DeviceGray')models.add('Gray');else unsupported=true;
      return;
    }
    try {const text=new TextDecoder('latin1').decode(lib.decodePDFRawStream(object).decode());const found=pdfColorOperators(text);colors.push(...found);found.forEach(c=>models.add(c.model));if(/\b(?:cs|CS|scn|SCN|BI)\b/.test(text))unsupported=true;}catch{unsupported=true;}
    const resources=pdf.context.lookup(object.dict.get(lib.PDFName.of('Resources')));
    const xobjects=resources?.lookup?.(lib.PDFName.of('XObject'));
    if(xobjects instanceof lib.PDFDict)for(const [,x]of xobjects.entries())visit(x);
  };
  const page=pdf.getPages()[0];visit(page.node.Contents());
  const xobjects=page.node.Resources()?.lookup(lib.PDFName.of('XObject'));
  if(xobjects instanceof lib.PDFDict)for(const [,x]of xobjects.entries())visit(x);
  facts.originalColors=colors;facts.originalColorModels=[...models];facts.colorModel=[...models].join(', ')||'unknown';
  if(unsupported)facts.limitations.push('ICC, плашечные краски, паттерны или inline-растр: цветоделения проверяются отдельно.');
}

// Screen-space evidence only. Never use this to certify minimum vector thickness.
export function sampleArtwork(image) {
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  const scale=Math.min(1,768/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const {data}=ctx.getImageData(0,0,canvas.width,canvas.height),w=canvas.width,h=canvas.height;
  let transparent=0,semi=0;
  for(let i=3;i<data.length;i+=4){if(data[i]<16)transparent++;else if(data[i]<240)semi++;}
  // With an opaque background white cannot reliably be distinguished from substrate.
  const alphaBackground=transparent>data.length/4*.01;
  const mask=new Uint8Array(w*h);
  for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>128&&(alphaBackground||Math.min(data[i*4],data[i*4+1],data[i*4+2])<220)?1:0;
  const features=[],seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);
  for(let start=0;start<mask.length;start++) {
    if(!mask[start]||seen[start])continue;
    let head=0,tail=1,minX=w,minY=h,maxX=0,maxY=0;queue[0]=start;seen[start]=1;
    while(head<tail){const at=queue[head++],x=at%w,y=Math.floor(at/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){const nx=x+dx,ny=y+dy,next=ny*w+nx;if(nx>=0&&nx<w&&ny>=0&&ny<h&&mask[next]&&!seen[next]){seen[next]=1;queue[tail++]=next;}}
    }
    if(tail>=3&&features.length<300)features.push({x:minX/w,y:minY/h,w:(maxX-minX+1)/w,h:(maxY-minY+1)/h,pixels:tail});
  }
  // Interior runs on three scan directions flag narrow positive/negative areas.
  const narrow=[];
  for(const axis of [0,1]) {
    const outer=axis?w:h,inner=axis?h:w;
    for(let j=1;j<outer-1;j+=3){let start=0,value=axis?mask[j]:mask[j*w];
      for(let k=1;k<=inner;k++){const next=k<inner?(axis?mask[k*w+j]:mask[j*w+k]):-1;
        if(next===value)continue;
        if(start>0&&k<inner&&k-start>=2&&k-start<16&&narrow.length<1500)narrow.push({kind:value?'positive':'negative',axis,pixels:k-start,x:axis?j/w:start/w,y:axis?start/h:j/h,w:axis?1/w:(k-start)/w,h:axis?(k-start)/h:1/h});
        start=k;value=next;
      }
    }
  }
  return {w,h,alphaBackground,semiTransparent:semi>mask.length*.01,features,narrow};
}

export function checkLogo({art,placement,field,method,context={},margin,minDpi}) {
  const match=resolveMethod(method),rule=configureRule(effectiveRule(match.rule,context)),facts=art.preflight||{};
  let findings=[];const scale=Number(field?.templateScale)||1,w=placement.w*scale,h=placement.h*scale;
  const sx=w/art.w,sy=h/art.h,sizeScale=Math.min(sx,sy);
  findings.push(issue('method',rule?'ok':'manual',rule?`${rule.code}: ${rule.name}.`:'Метод не определён однозначно: укажите код выбранного нанесения.',{method:method||'',reason:match.reason}));
  if(!art.preflight)findings.push(issue('analysis','manual','Анализ исходного логотипа недоступен.'));
  if(facts.text)findings.push(issue('outlined-text','bad','В логотипе есть текст: переведите шрифты в кривые.'));
  if(facts.gradients||facts.transparency||facts.effects)findings.push(issue('effects','bad','Есть несведённые градиенты, прозрачность или эффекты: подготовьте их по требованиям нанесения.'));
  if(facts.hidden)findings.push(issue('hidden-content','manual','Проверьте скрытые объекты и слои исходного файла.'));
  if(facts.visual?.semiTransparent&&art.pixelW)findings.push(issue('raster-alpha','manual','Растр содержит полупрозрачные пиксели: проверьте края и эффект прозрачности.'));
  if(!rule)detailFindings({art,placement,field,rule:null});
  if(rule) {
    for(const raster of facts.rasters||[]) {
      const dpi=Math.min(raster.pixelW/(raster.w*sx),raster.pixelH/(raster.h*sy))*25.4;
      const required=Math.max(rule.minDpi,Number(minDpi)||0);
      findings.push(issue('raster-dpi',dpi+1e-7>=required?'ok':'bad',`Разрешение растра ${Math.round(dpi)} dpi; требуется от ${required} dpi.`,{actual:num(dpi),required,unit:'dpi'}));
    }
    if(rule.palette)findings.push(issue('palette','manual',`Палитра: ${rule.palette}. Сверьте цветоделения и цвета заказа; экранные RGB не подтверждают соответствие.`,{observedColorModel:facts.colorModel||'unknown'}));
    if(/^CMYK/.test(rule.palette||'')&&(facts.colorModel==='RGB'||facts.originalColorModels?.includes('RGB')))findings.push(issue('rgb-color-model','bad','В исходнике обнаружен RGB, а выбранное нанесение требует CMYK. Подготовьте CMYK-файл в векторном редакторе.'));
    if(rule.inkMax){const sums=(facts.originalColors||[]).filter(c=>c.model==='CMYK').map(c=>c.values.reduce((a,b)=>a+b,0)*100);const maximum=Math.max(0,...sums);if(maximum>rule.inkMax+.01)findings.push(issue('ink-limit','bad',`Сумма CMYK в заливке ${num(maximum)}%; предел ${rule.inkMax}%.`,{actual:num(maximum),required:rule.inkMax}));}
    findings.push(...colorFindings(rule,facts));
    const thin=[...(facts.strokes||[]),...(facts.elements||[])].filter(item=>item.width*sizeScale+1e-7<rule.positive);
    for(const item of thin.slice(0,12)) {const uncertain=item.uncertain||Math.abs(sx-sy)>1e-6;findings.push(issue('positive',uncertain?'manual':'bad',`${uncertain?'Возможна малая толщина; оценка':'Толщина элемента'} ${num(item.width*sizeScale)} мм; минимум ${rule.positive} мм.`,{actual:num(item.width*sizeScale),required:rule.positive,unit:'mm',box:item.box?{x:item.box.x/art.w,y:item.box.y/art.h,w:item.box.w/art.w,h:item.box.h/art.h}:null}));}
    // Even measured SVG primitives may overlap or be clipped. Full shape compliance is
    // explicitly unresolved; approximate silhouette analysis produces review requests.
    if(rule.positive)findings.push(issue('positive-coverage','manual',`Проверьте все позитивные элементы: от ${rule.positive} мм. Измерения обводок и простых фигур не заменяют проверку всех контуров.`));
    if(rule.negative)findings.push(issue('negative','manual',`Минимальный пробел ${rule.negativeRange?rule.negativeRange.join('–'):rule.negative} мм. Проверьте выворотку и расстояния между контурами.`));
    findings.push(...detailFindings({art,placement,field,rule:detailRule(rule)}));
    if(rule.guard>0)findings.push(issue('guard',Number.isFinite(margin)?(margin*scale+1e-7>=rule.guard?'ok':'bad'):'manual',`Охранное поле: отступ от границы нанесения ${Number.isFinite(margin)?num(margin*scale)+' мм':'не определён'}; требуется ${rule.guard} мм.`,{actual:Number.isFinite(margin)?num(margin*scale):null,required:rule.guard,unit:'mm'}));
    if(rule.letter)findings.push(issue('letter','manual',`Проверьте высоту букв: не менее ${rule.letter} мм.`));
    if(rule.bleed)findings.push(issue('bleed','manual',`При печати в край нужен вылет ${rule.bleed} мм за линию реза. Обрезка по полю не подтверждает вылет.`));
    if(rule.noStrokes&&(facts.strokes||[]).length)findings.push(issue('strokes','bad','Для тиснения переведите обводки в замкнутые контуры.'));
    if(rule.closedContours)findings.push(issue('closed-contours',facts.hasOpenPaths?'bad':'manual',facts.hasOpenPaths?'Есть незамкнутые SVG-контуры.':'Проверьте замкнутость каждого контура.'));
    if(rule.noIntersections)findings.push(issue('intersections','manual','Не допускаются пересечения и наложения элементов. Проверьте исходные контуры.'));
    if(rule.tintMin||rule.tintMax||rule.inkMax)findings.push(issue('ink','manual',`Проверьте цветоделения:${rule.tintMin?' минимальная плотность '+rule.tintMin+'%;':''}${rule.tintMax?' максимальная плотность '+rule.tintMax+'%;':''}${rule.inkMax?' сумма CMYK не более '+rule.inkMax+'%.':''}`));
    for(const condition of rule.unresolvedConditions)findings.push(issue('condition-'+condition.when,'manual',`Уточните условие «${CONDITION_LABELS[condition.when]}»: ${Object.entries(condition).filter(([k])=>k!=='when').map(([k,v])=>({positive:'позитив от',negative:'пробел от',letter:'буквы от',minDpi:'dpi от',maxColors:'цветов не более',foilOutline:'обводка фольги'}[k]||k)+' '+v).join('; ')}.`,{condition}));
    for(const note of rule.notes||[])findings.push(issue('method-note','manual',note));
  }
  if(Number.isFinite(margin))findings.push(issue('field-boundary',margin>-.001?'ok':'bad',margin>-.001?'Логотип расположен в выбранном поле.':`Выход за поле${field?.pathPoints?.length&&margin===-.001?": логотип пересекает контур":" "+num(-margin*scale)+" мм"}${placement.clipToField?'; выступающая часть будет обрезана':''}.`,{actual:num(margin*scale),unit:'mm'}));
  findings.push(issue('article-specific','manual','Сверьте дополнительные требования конструктора артикула, материал, подложку, белый цвет и цвета выбранного места заказа.',{source:SOURCES.problems}));
  for(const text of facts.limitations||[])findings.push(issue('coverage','manual',text));
  findings=findings.filter(f=>checkEnabled(rule,f.id));
  if(rule?.settings.enabled===false)findings.push(issue("settings-disabled","manual","Проверки этого нанесения отключены администратором."));
  else if(rule?.settings.custom)findings.push(issue("settings-custom","manual","Применены пользовательские настройки нанесения."));
  if(settingsProblem())findings.push(issue("settings-storage","manual",settingsProblem()));
  return {version:REQUIREMENTS_VERSION,method:match.code,methodInput:method||'',rule,dimensionsMm:{w:num(w),h:num(h)},templateScale:scale,format:art.ext,findings,status:findings.some(f=>f.status==='bad')?'bad':findings.some(f=>f.status==='manual')?'manual':'ok',productionApproved:false};
}

export function renderDiagnostics(reports) {
  let details=document.getElementById('logoPreflight');
  if(!details){details=document.createElement('details');details.id='logoPreflight';details.className='logo-preflight';const summary=document.createElement('summary');summary.textContent='Проверка логотипов по требованиям';details.append(summary);document.getElementById('step4Box')?.append(details);}
  const key=JSON.stringify(reports);
  if(details.dataset.report===key)return;details.dataset.report=key;
  details.querySelectorAll(':scope > section').forEach(el=>el.remove());
  for(const report of reports){const section=document.createElement('section');const title=document.createElement('strong');title.textContent=`${report.label} · ${report.method||'метод не определён'}`;section.append(title);
    for(const f of report.findings){const p=document.createElement('p');p.className=f.status;p.textContent=({ok:'✓ ',bad:'! ',manual:'· '}[f.status])+f.text;section.append(p);}details.append(section);}
  let download=details.querySelector('button');if(!download){download=document.createElement('button');download.type='button';download.textContent='Скачать диагностику JSON';download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:REQUIREMENTS_VERSION,reports:JSON.parse(details.dataset.report),detail:window.gwbDetailCheck},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='logo-preflight.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};details.append(download);
  for(const [label,url] of [['Требования gifts.ru',SOURCES.specifications],['Проблемы макетов',SOURCES.problems]]){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener';details.append(a);}}
  window.gwbLogoPreflight=JSON.parse(key); // Read-only snapshot; no state-changing test API.
}

export function drawPreflightMarkers(ctx,report,placement,lineWidth) {
  if(!report)return;
  const boxes=report.findings.flatMap(f=>f.box?[f.box]:f.boxes||[]).slice(0,60);
  if(!boxes.length)return;
  ctx.save();ctx.translate(placement.x+placement.w/2,placement.y+placement.h/2);ctx.rotate((placement.rotation||0)*Math.PI/180);
  ctx.strokeStyle='#c22c58';ctx.lineWidth=lineWidth;ctx.setLineDash([lineWidth*3,lineWidth*2]);
  for(const b of boxes)ctx.strokeRect((b.x-.5)*placement.w,(b.y-.5)*placement.h,Math.max(b.w*placement.w,lineWidth*2),Math.max(b.h*placement.h,lineWidth*2));
  ctx.restore();
}

// The same findings drive export validation and the compact workspace notice.
export function renderErrorOverlay(checks) {
 const workspace=document.querySelector('.workspace'),stage=document.getElementById('stageScroll');
 if(!workspace||!stage)return;
 let panel=document.getElementById('logoErrorOverlay');
 if(!panel){
  panel=document.createElement('aside');panel.id='logoErrorOverlay';panel.className='logo-error-overlay';panel.hidden=true;
  panel.setAttribute('aria-label','Результаты проверки');panel.setAttribute('aria-live','polite');panel.setAttribute('aria-atomic','true');
  workspace.append(panel);
  const position=()=>{const area=workspace.getBoundingClientRect(),view=stage.getBoundingClientRect();panel.style.top=Math.max(0,view.top-area.top+workspace.scrollTop+12)+'px';panel.style.maxHeight=Math.max(80,view.height*.45)+'px';};
  new ResizeObserver(position).observe(workspace);new ResizeObserver(position).observe(stage);position();
 }
 const errors=checks.filter(f=>f.active!==false&&(f.status==='bad'||f.status==='ok'&&!f.hidden&&f.id!=='method'||f.overlay===true)).map(f=>({status:f.status,text:f.displayText||f.text})).sort((a,b)=>({bad:0,manual:1,ok:2}[a.status]??3)-({bad:0,manual:1,ok:2}[b.status]??3)),key=JSON.stringify(errors);
 if(panel.dataset.errors===key)return;panel.dataset.errors=key;panel.replaceChildren();panel.hidden=!errors.length;
 if(!errors.length)return;
 const bad=errors.filter(f=>f.status==='bad').length,manual=errors.filter(f=>f.status==='manual').length,ok=errors.filter(f=>f.status==='ok').length;
 const title=document.createElement('strong');title.textContent='Проверки · ошибок: '+bad+(manual?' · проверить: '+manual:'')+' · успешно: '+ok;panel.append(title);
 const list=document.createElement('ul');
 for(const finding of errors){const row=document.createElement('li');row.className=finding.status;row.textContent=(finding.status==='ok'?'✓ ':finding.status==='manual'?'⚠ ':'! ')+finding.text;list.append(row);}
 panel.append(list);
}
