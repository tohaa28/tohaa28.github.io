// Source paints and raster colors are distinct evidence. White is explicitly
// allowed in engraving masks; it is not silently removed from vector ink counts.
export function cssColor(value){
  const match=String(value).match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  if(!match)return null;
  return {rgb:match.slice(1,4).map(Number),alpha:match[4]===undefined?1:Number(match[4])};
}
const spread=rgb=>Math.max(...rgb)-Math.min(...rgb);
const white=rgb=>Math.min(...rgb)>=250;
const black=rgb=>Math.max(...rgb)<=5;
const key=rgb=>rgb.map(x=>Math.round(x)).join(',');
export function vectorColorEvidence(values,{complete=true}={}){
  const paints=values.map(cssColor);const valid=paints.filter(p=>p&&p.alpha>0);
  return {source:'vector-paints',complete:complete&&paints.every(Boolean),count:new Set(valid.map(p=>key(p.rgb))).size,
    colored:valid.some(p=>spread(p.rgb)>2),gray:valid.some(p=>!black(p.rgb)&&!white(p.rgb)&&spread(p.rgb)<=2),
    partialAlpha:valid.some(p=>p.alpha<1),rgb:valid.map(p=>p.rgb)};
}

export function pixelColorEvidence(data,width,height,{complete=true}={}){
  const counts=new Map();let colored=0,gray=0,opaque=0,visible=0,partialAlpha=false;
  // Ignore translucent antialiased edges for ink counting. Neutral gray near a
  // real black/white boundary is antialiasing, but flat gray regions are halftones.
  const stable=(x,y)=>{const i=(y*width+x)*4;const base=[data[i],data[i+1],data[i+2]];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const j=(ny*width+nx)*4;if(data[j+3]<245||Math.abs(base[0]-data[j])>12||Math.abs(base[1]-data[j+1])>12||Math.abs(base[2]-data[j+2])>12)return false;}return true;};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4,alpha=data[i+3];if(alpha<16)continue;visible++;
    if(alpha<245){
      if(!partialAlpha&&x>0&&y>0&&x<width-1&&y<height-1){let flat=true;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(Math.abs(data[((y+dy)*width+x+dx)*4+3]-alpha)>3)flat=false;
        partialAlpha=flat;
      }
      continue;
    }opaque++;
    const rgb=[data[i],data[i+1],data[i+2]];
    const flat=stable(x,y);
    if(spread(rgb)>12){colored++;}
    else if(!black(rgb)&&!white(rgb)&&flat)gray++;
    if(flat){const bucket=rgb.map(v=>Math.round(v/12)*12).join(',');counts.set(bucket,(counts.get(bucket)||0)+1);}
  }
  // In raster artwork, an opaque white exterior is normally substrate, but not
  // enough evidence to certify separation count. Report estimated colors only.
  const swatches=[];
  for(const [s,n]of counts){if(n<3)continue;const rgb=s.split(',').map(Number);if(!swatches.some(c=>Math.hypot(...c.map((v,i)=>v-rgb[i]))<40))swatches.push(rgb);}
  const inks=swatches.filter(rgb=>Math.min(...rgb)<245);
  const hue=rgb=>{const max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;if(d<24)return null;const [r,g,b]=rgb;return ((max===r?(g-b)/d:max===g?2+(b-r)/d:4+(r-g)/d)*60+360)%360;};
  const hues=inks.map(hue).filter(v=>v!==null);
  const distinctHues=hues.some((a,i)=>hues.slice(i+1).some(b=>Math.min(Math.abs(a-b),360-Math.abs(a-b))>25));
  return {source:'rendered-pixels',complete,visible,opaque,partialAlpha,colored:colored>0,gray:gray>0,coloredPixels:colored,grayPixels:gray,
    count:inks.length,distinctHues,whiteBackgroundPossible:swatches.some(rgb=>Math.min(...rgb)>=245)};
}

export function colorFindings(rule,facts){
  const policy=rule.colorPolicy||(rule.maxColors?'single-color':null);if(!policy)return [];
  const source=rule.colorPolicySource||'https://gifts.ru/nanesenie-logotipa/specifications';
  const vector=facts.vectorColors,pixels=facts.pixelColors;
  const evidence=vector?.count?{...vector,...(!vector.complete&&pixels?{colored:vector.colored||pixels.colored,gray:vector.gray||pixels.gray,distinctHues:pixels.distinctHues}: {})}:pixels;
  const results=[];
  const add=(id,status,text,extra={})=>results.push({id,status,text,source,...extra});
  if(policy==='black-white'){
    if(!evidence||(evidence.source==='vector-paints'?evidence.count===0:evidence.visible===0)){add('monochrome','manual','Для лазерной гравировки нужен чёрно-белый логотип без цветных заливок и полутонов; цветность файла не определена.');return results;}
    const bad=evidence.colored||evidence.gray||evidence.partialAlpha;
    add('monochrome',bad?'bad':evidence.complete?'ok':'manual',bad?
      'Для лазерной гравировки нужен чёрно-белый логотип без полутонов. Обнаружены '+[evidence.colored?'цветные элементы':'',evidence.gray?'серые полутона':'',evidence.partialAlpha?'полупрозрачные краски':''].filter(Boolean).join(', ')+'.':
      evidence.complete?'Цветность: чёрно-белый логотип без цветных элементов и серых полутонов.':'В проверенной части логотипа цветных элементов не найдено; полный анализ цветности недоступен.',{evidence:evidence.source,actual:{colored:!!evidence.colored,gray:!!evidence.gray}});
    // Rich black is a four-ink value even when the rendered preview is neutral.
    if((facts.originalColors||[]).some(c=>c.model==='CMYK'&&c.values.slice(0,3).some(v=>v>.001)))add('engraving-cmyk','bad','В PDF есть составной чёрный или цветные каналы CMY. Для лазера подготовьте чистый чёрный K/Gray и белый.');
  }else if(policy==='single-color'||rule.maxColors){
    const limit=rule.maxColors||1;
    if(!evidence)add('colors','manual',`Цветность не определена: допустимо не более ${limit} цвета нанесения.`);
    else if(evidence.source==='vector-paints'&&evidence.complete&&evidence.separationsComplete!==false)add('colors',evidence.count>limit?'bad':'ok',`В логотипе ${evidence.count} цвета; допустимо не более ${limit}.`,{actual:evidence.count,required:limit,evidence:evidence.source});
    else if(limit===1&&evidence.distinctHues)add('colors','bad','В логотипе обнаружены участки разных цветов, а для выбранного нанесения допустим только один цвет.',{actual:evidence.count,required:limit,evidence:evidence.source});
    else add('colors','manual',`Допустимо не более ${limit} цвета нанесения. По изображению найдено около ${evidence.count} цветов; проверьте цветоделения и белый фон.`,{actual:evidence.count,required:limit,evidence:evidence.source});
  }else if(policy==='black-gray'){
    add('metalsticker-colors',evidence?.colored?'bad':'manual',evidence?.colored?'Металстикер: цветные элементы недопустимы. Чёрный обозначает глянец, серый — матовую поверхность.':'Металстикер: проверьте обозначения — чёрный для глянца, серый для матовой поверхности.');
  }
  return results;
}
