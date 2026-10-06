// PrintCheck Android 3.4.0-alpha63, SmallElementAnalyzer.java and ArtworkColorLayerLogic.java.
// Source: tohaa28/helpdesk f1c8d622add113eeeccc7c85fe086e37f85a9648.
// Browser port; physical dimensions come from the placed logo, never screen zoom.
export const MAX_PIXELS=4_000_000;
const INF=1<<27, dirs=[[1,0],[0,1],[1,1],[1,-1],[2,1],[1,2],[2,-1],[1,-2]];
export function scanPlan(wMm,hMm,rule,{maxPixels=MAX_PIXELS,sourceWidth=0,sourceHeight=0}={}){
 const ts=[rule.positive,rule.negative,rule.isolated].filter(x=>x>0);
 if(!(wMm>0&&hMm>0)||!ts.length)return {skip:'Для нанесения не определены пороги мелких элементов.'};
 const minimum=Math.min(...ts),preferred=Math.min(2400,Math.max(720,25.4*6/minimum)),budgetDpi=25.4*Math.sqrt(maxPixels/(wMm*hMm))*.995;
 const sourceLimited=sourceWidth>0&&sourceHeight>0;
 const sourceDpi=sourceLimited?25.4*Math.min(sourceWidth/wMm,sourceHeight/hMm):Infinity;
 const dpi=Math.min(preferred,budgetDpi,sourceDpi),width=Math.max(1,Math.min(sourceLimited?sourceWidth:Infinity,Math.ceil(wMm*dpi/25.4))),height=Math.max(1,Math.min(sourceLimited?sourceHeight:Infinity,Math.ceil(hMm*dpi/25.4))),step=Math.max(wMm/width,hMm/height),samples=minimum/step;
 if(width*height>maxPixels||samples<(sourceLimited?3:4))return {skip:'Область слишком велика или исходный растр недостаточно детален для точной фоновой проверки. Мелкие элементы не проверены.'};
 return {width,height,dpi,step,lowResolution:samples<4,sourceLimited,samplesPerMinimum:samples};
}
function neighbors(v,w,h,fn){const y=Math.floor(v/w),x=v-y*w;for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++)fn(yy*w+xx);}
function groups(mask,w,h){const labels=new Int32Array(mask.length),q=new Int32Array(mask.length),items=[];let id=0;for(let i=0;i<mask.length;i++)if(mask[i]&&!labels[i]){id++;let a=0,b=1;q[0]=i;labels[i]=id;while(a<b)neighbors(q[a++],w,h,n=>{if(mask[n]&&!labels[n]){labels[n]=id;q[b++]=n;}});items.push(q.slice(0,b));}return {labels,items};}
function chamfer(d,w,h){for(let y=0;y<h;y++)for(let x=0;x<w;x++){let i=y*w+x,v=d[i];if(x)v=Math.min(v,d[i-1]+3);if(y){v=Math.min(v,d[i-w]+3);if(x)v=Math.min(v,d[i-w-1]+4);if(x+1<w)v=Math.min(v,d[i-w+1]+4);}d[i]=v;}for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){let i=y*w+x,v=d[i];if(x+1<w)v=Math.min(v,d[i+1]+3);if(y+1<h){v=Math.min(v,d[i+w]+3);if(x)v=Math.min(v,d[i+w-1]+4);if(x+1<w)v=Math.min(v,d[i+w+1]+4);}d[i]=v;}return d;}
function distance(mask,w,h,toTrue=false){return chamfer(Int32Array.from(mask,v=>(!!v===toTrue)?0:INF),w,h);}
function maximum(d,w,x,y){let v=d[y*w+x];for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)if(d[yy*w+xx]>v)return false;return true;}
function makeBox(indices,widths,w,h,kind,rule,centerSubset=indices){let x0=w,y0=h,x1=0,y1=0,min=Infinity,max=0,cx=0,cy=0;for(const i of indices){const x=i%w,y=Math.floor(i/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);min=Math.min(min,widths[i]);max=Math.max(max,widths[i]);}for(const i of centerSubset){cx+=i%w;cy+=Math.floor(i/w);}return {x:x0/w,y:y0/h,w:(x1-x0)/w,h:(y1-y0)/h,cx:cx/centerSubset.length/w,cy:cy/centerSubset.length/h,pixels:indices.length,minWidthMm:min,maxWidthMm:max,kind,threshold:rule};}
function components(bad,widths,w,h,ppm,rule,kind){return groups(bad,w,h).items.filter(c=>c.length>=2||c.length/ppm**2>=.0008).map(c=>makeBox(c,widths,w,h,kind,rule));}
function persistent(bad,widths,w,h,ppm,rule,kind){
 const result=[],N=bad.length,q=new Int32Array(N),visit=new Int32Array(N),dist=new Int32Array(N),parent=new Int32Array(N),mark=new Int32Array(N);let token=0,comp=0;
 const minPath=Math.max(3,rule*ppm),need=Math.ceil(minPath),band=Math.max(.03,rule*.18),eps=Math.max(.01,.5/ppm);
 const farthest=(start,keep)=>{token++;let a=0,b=1,far=start;q[0]=start;visit[start]=token;dist[start]=0;if(keep)parent[start]=-1;while(a<b){let v=q[a++];neighbors(v,w,h,n=>{if(!bad[n]||visit[n]===token)return;visit[n]=token;dist[n]=dist[v]+1;if(keep)parent[n]=v;q[b++]=n;if(dist[n]>dist[far])far=n;});}return far;};
 const widerNear=v=>{let y=Math.floor(v/w),x=v%w;for(let r=1;r<=3;r++)for(let yy=Math.max(0,y-r);yy<=Math.min(h-1,y+r);yy++)for(let xx=Math.max(0,x-r);xx<=Math.min(w-1,x+r);xx++){const n=yy*w+xx;if(mark[n]!==comp&&Number.isFinite(widths[n])&&widths[n]+.02>=rule)return true;}return false;};
 const widerAhead=(end,inside)=>{const ex=end%w,ey=Math.floor(end/w),vx=ex-inside%w,vy=ey-Math.floor(inside/w),norm=Math.hypot(vx,vy),r=Math.ceil(Math.max(4,minPath*2));if(norm<.5)return false;for(let yy=Math.max(0,ey-r);yy<=Math.min(h-1,ey+r);yy++)for(let xx=Math.max(0,ex-r);xx<=Math.min(w-1,ex+r);xx++){let n=yy*w+xx,z=widths[n];if(mark[n]===comp||!Number.isFinite(z)||z+.02<rule)continue;let dx=xx-ex,dy=yy-ey,dn=Math.hypot(dx,dy);if(dn>=1&&dn<=r&&(dx*vx+dy*vy)/(dn*norm)>=.35)return true;}return false;};
 for(const c of groups(bad,w,h).items){
  if(c.length<2){for(const i of c)bad[i]=0;continue;}comp++;for(const i of c)mark[i]=comp;
  const a=farthest(c[0],false),b=farthest(a,true),path=[];let v=b;while(v>=0&&path.length<N){path.push(v);if(v===a)break;v=parent[v];}
  const reject=()=>{for(const i of c)bad[i]=0;};if(path.length<need){reject();continue;}
  let left=0,mh=0,mt=0,xh=0,xt=0,bs=-1,be=-1,bl=0;const mn=new Int32Array(path.length),mx=new Int32Array(path.length);
  for(let right=0;right<path.length;right++){const wr=widths[path[right]];if(!Number.isFinite(wr)){left=right+1;mh=mt=xh=xt=0;continue;}while(mt>mh&&widths[path[mn[mt-1]]]>=wr)mt--;mn[mt++]=right;while(xt>xh&&widths[path[mx[xt-1]]]<=wr)xt--;mx[xt++]=right;while(left<=right&&xh<xt&&mh<mt&&widths[path[mx[xh]]]-widths[path[mn[mh]]]>band){if(mn[mh]===left)mh++;if(mx[xh]===left)xh++;left++;}const len=right-left+1;if(len>bl){bl=len;bs=left;be=right;}}
  if(bl<need){reject();continue;}const occ=bl/path.length;if((bs===0)!==(be===path.length-1)&&occ<.72){reject();continue;}
  if(occ>=.70&&widerAhead(path[0],path[Math.min(path.length-1,1)])!==widerAhead(path.at(-1),path[Math.max(0,path.length-2)])&&bl<Math.ceil(Math.max(need,minPath*2.5))){reject();continue;}
  let supported=false;for(let pi=bs;pi<=be;pi++){let degree=0;neighbors(path[pi],w,h,n=>{if(n!==path[pi]&&bad[n])degree++;});if(degree>=3&&widerNear(path[pi])){supported=true;break;}}
  if(supported&&bl<Math.ceil(minPath*2)){reject();continue;}
  const stable=path.slice(bs,be+1),minimum=stable.reduce((m,i)=>Math.min(m,widths[i]),Infinity),center=stable.filter(i=>widths[i]<=minimum+eps);
  result.push(makeBox(stable,widths,w,h,kind,rule,center.length?center:stable));
 }return result;
}
function positive(fg,owner,id,w,h,ppm,rule){
 const other=chamfer(Int32Array.from(owner,v=>v!==0&&v!==id?0:INF),w,h),bad=new Uint8Array(fg.length),widths=new Float64Array(fg.length).fill(Infinity),guard=Math.max(1.5,rule*ppm*.55),maxRay=Math.ceil(rule*ppm*2.4+6);
 const exitDistance=(x,y,dx,dy,sign)=>{
  const norm=Math.hypot(dx,dy),ux=sign*dx/norm,uy=sign*dy/norm;let lx=x,ly=y;
  for(let step=1;step<=maxRay;step++){
   const xx=Math.round(x+ux*step),yy=Math.round(y+uy*step);if(xx===lx&&yy===ly)continue;lx=xx;ly=yy;
   if(xx<0||xx>=w||yy<0||yy>=h)return null;
   const n=yy*w+xx;
   if(owner[n]!==0&&owner[n]!==id)return null;
   if(!fg[n])return step;
  }
  return Infinity;
 };
 const crossSection=(x,y)=>{
  const spans=[];let maxBalance=0;
  for(const [dx,dy] of dirs){
   const a=exitDistance(x,y,dx,dy,1),b=exitDistance(x,y,dx,dy,-1);
   if(a===null||b===null||!Number.isFinite(a)||!Number.isFinite(b))continue;
   const balance=Math.min(a,b)/Math.max(a,b),span=Math.max(1,a+b-1)/ppm;
   spans.push({balance,span});maxBalance=Math.max(maxBalance,balance);
  }
  if(maxBalance<.42)return Infinity;
  const floor=Math.max(.42,maxBalance-.08);let best=Infinity;
  for(const item of spans)if(item.balance>=floor)best=Math.min(best,item.span);
  return best;
 };
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x;if(!fg[i]||other[i]/3<=guard)continue;
  const mm=crossSection(x,y);if(!Number.isFinite(mm))continue;
  if(mm<=rule*1.75+.05)widths[i]=mm;if(mm+.02<rule)bad[i]=1;
 }
 return persistent(bad,widths,w,h,ppm,rule,'positive');
}
function negative(fg,owner,id,w,h,ppm,rule,{sameComponentOpenGaps=true}={}){
 const lab=groups(fg,w,h),d=distance(fg,w,h,true),empty=Uint8Array.from(owner,v=>v===0?1:0),enclosed=new Uint8Array(fg.length),holeBad=new Uint8Array(fg.length),holeWidths=new Float64Array(fg.length),result=[];
 for(const c of groups(empty,w,h).items){let border=false,other=false;for(const v of c){let x=v%w,y=Math.floor(v/w);if(!x||!y||x===w-1||y===h-1)border=true;neighbors(v,w,h,n=>{if(owner[n]!==0&&owner[n]!==id)other=true;});}if(border||other)continue;const bad=holeBad,widths=holeWidths;for(const v of c){enclosed[v]=1;let x=v%w,y=Math.floor(v/w);if(!x||!y||x===w-1||y===h-1||!maximum(d,w,x,y))continue;let mm=Math.max(1,2*d[v]/3-1)/ppm;if(mm+.02<rule){bad[v]=1;widths[v]=mm;}}}
 result.push(...components(holeBad,holeWidths,w,h,ppm,rule,'negative'));
 const limit=rule*ppm*1.75,maxRay=Math.ceil(limit+2.5);
 const ray=(x,y,dx,dy,sign)=>{let norm=Math.hypot(dx,dy),ux=sign*dx/norm,uy=sign*dy/norm,lx=x,ly=y;for(let s=1;s<=maxRay;s++){let xx=Math.round(x+ux*s),yy=Math.round(y+uy*s);if(xx===lx&&yy===ly)continue;lx=xx;ly=yy;if(xx<0||xx>=w||yy<0||yy>=h)return null;let i=yy*w+xx;if(owner[i]!==0&&owner[i]!==id)return null;if(fg[i])return [lab.labels[i],s];}return null;};
 for(const same of (sameComponentOpenGaps?[false,true]:[false])){if(!same&&lab.items.length<2)continue;const bad=new Uint8Array(fg.length),widths=new Float64Array(fg.length).fill(Infinity);for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){let i=y*w+x;if(fg[i]||enclosed[i]||owner[i]||d[i]<=0||d[i]/3>limit*.5+1.5)continue;let best=Infinity;for(const [dx,dy]of dirs){let x1=x+dx,y1=y+dy,x2=x-dx,y2=y-dy;if(x1<0||x1>=w||y1<0||y1>=h||x2<0||x2>=w||y2<0||y2>=h)continue;let a=d[y1*w+x1],b=d[y2*w+x2];if(!(d[i]>=a&&d[i]>=b&&(d[i]>a||d[i]>b)))continue;let A=ray(x,y,dx,dy,1),B=ray(x,y,dx,dy,-1);if(!A||!B||(A[0]===B[0])!==same)continue;best=Math.min(best,Math.max(1,A[1]+B[1]-1)/ppm);}if(Number.isFinite(best)&&best<=rule*1.75+.05){widths[i]=best;if(best+.02<rule)bad[i]=1;}}result.push(...persistent(bad,widths,w,h,ppm,rule,'negative'));}return result;
}
export function analyzeLayers(layers,owner,w,h,ppm,rule,options={}){const boxes=[],counts={positive:0,negative:0,isolated:0};for(const l of layers){for(const kind of ['positive','negative','isolated']){const threshold=rule[kind];if(!(threshold>0))continue;let found=[];if(kind==='positive')found=positive(l.mask,owner,l.id,w,h,ppm,threshold);else if(kind==='negative')found=negative(l.mask,owner,l.id,w,h,ppm,threshold,options);else {const zero=new Float64Array(l.mask.length);for(const c of groups(l.mask,w,h).items){const b=makeBox(c,zero,w,h,kind,threshold),size=Math.max(b.w*w,b.h*h)/ppm;if(size+.02<threshold){b.minWidthMm=size;found.push(b);}}}counts[kind]+=found.length;for(const b of found)boxes.push({...b,rgb:l.rgb,layerId:l.id});}}return {boxes,counts};}
// Colour directions and seeded connected solids from ArtworkColorLayerLogic (alpha26).
// v7 keeps real inks separate but suppresses antialias-only transition bands at colour boundaries.
function rgbParts(c){return [c>>16&255,c>>8&255,c&255];}
function rgbDistance(a,b){const A=rgbParts(a),B=rgbParts(b);return Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2]);}
function mixError(c,a,b){
 const C=rgbParts(c),A=rgbParts(a),B=rgbParts(b),vx=A[0]-B[0],vy=A[1]-B[1],vz=A[2]-B[2],den=vx*vx+vy*vy+vz*vz;
 if(den<1)return Infinity;
 const t=((C[0]-B[0])*vx+(C[1]-B[1])*vy+(C[2]-B[2])*vz)/den;
 if(t<.08||t>.92)return Infinity;
 return Math.hypot(C[0]-(B[0]+vx*t),C[1]-(B[1]+vy*t),C[2]-(B[2]+vz*t));
}
function transitionLayer(layer,layers,owner,w,h,palette){
 if(palette.some(c=>rgbDistance(layer.rgb,c)<=24))return false;
 const d=distance(layer.mask,w,h);let maxRadius=0;
 for(let i=0;i<layer.mask.length;i++)if(layer.mask[i])maxRadius=Math.max(maxRadius,d[i]/3);
 if(maxRadius>2.25)return false;
 const contacts=new Map(),radius=3;
 for(let i=0;i<layer.mask.length;i++)if(layer.mask[i]){
  const x=i%w,y=Math.floor(i/w),seen=new Set();
  for(let yy=Math.max(0,y-radius);yy<=Math.min(h-1,y+radius);yy++)for(let xx=Math.max(0,x-radius);xx<=Math.min(w-1,x+radius);xx++){
   const id=owner[yy*w+xx];if(id>0&&id!==layer.id)seen.add(id);
  }
  for(const id of seen)contacts.set(id,(contacts.get(id)||0)+1);
 }
 const ranked=[...contacts].sort((a,b)=>b[1]-a[1]);if(ranked.length<2)return false;
 const support=Math.max(3,Math.ceil(layer.pixels*.12));
 if(ranked[0][1]<support||ranked[1][1]<support)return false;
 const a=layers.find(l=>l.id===ranked[0][0]),b=layers.find(l=>l.id===ranked[1][0]);
 return !!a&&!!b&&mixError(layer.rgb,a.rgb,b.rgb)<=30;
}
export function splitColors(rgb,seed,w,h,background=0xffffff,palette=[]){
 const br=background>>16&255,bg=background>>8&255,bb=background&255,hist=new Map(),layers=[];
 const direction=c=>{const r=(c>>16&255)-br,g=(c>>8&255)-bg,b=(c&255)-bb,m=Math.hypot(r,g,b);return {r:r/m,g:g/m,b:b/m,m};};
 for(let i=0;i<seed.length;i++)if(seed[i]){let c=rgb[i],d=direction(c);if(d.m<9)continue;let r=c>>16&255,g=c>>8&255,b=c&255,key=(r>>4)<<8|(g>>4)<<4|(b>>4),v=hist.get(key);if(!v){v={key,count:0,sr:0,sg:0,sb:0,coreMag:0,coreRgb:0};hist.set(key,v);}v.count++;v.sr+=r;v.sg+=g;v.sb+=b;if(d.m>v.coreMag){v.coreMag=d.m;v.coreRgb=c;}}
 const bins=[...hist.values()].sort((a,b)=>b.count-a.count||b.coreMag-a.coreMag||a.key-b.key),best=(d,min)=>{let hit=null;for(const l of layers){let c=d.r*l.r+d.g*l.g+d.b*l.b;if(c>min){min=c;hit=l;}}return hit;};
 const color=v=>v.coreRgb||((Math.floor(v.sr/v.count)&255)<<16|(Math.floor(v.sg/v.count)&255)<<8|Math.floor(v.sb/v.count)&255);
 const add=v=>{const c=color(v),d=direction(c);if(!(d.m>0))return;layers.push({id:layers.length+1,rgb:c,...d,coreMagnitude:v.coreMag,histCount:v.count});};
 for(const v of bins){if(v.coreMag<48)continue;let c=color(v),d=direction(c),l=best(d,.985);if(l){if(v.coreMag>l.coreMagnitude){l.coreMagnitude=v.coreMag;l.rgb=c;}l.histCount=(l.histCount||0)+v.count;continue;}if(v.count<2)continue;if(layers.length>=16)break;add(v);}
 if(!layers.length&&bins.length)add(bins.reduce((a,b)=>b.coreMag>a.coreMag?b:a));
 const provisional=new Int32Array(seed.length);for(let i=0;i<rgb.length;i++){const d=direction(rgb[i]);if(d.m<9)continue;provisional[i]=best(d,.90)?.id||0;}
 const kept=[];for(const l of layers){const candidate=Uint8Array.from(provisional,v=>v===l.id?1:0);l.mask=new Uint8Array(seed.length);l.pixels=0;for(const c of groups(candidate,w,h).items){let supported=false;for(const v of c){if(seed[v]&&provisional[v]===l.id){supported=true;break;}neighbors(v,w,h,n=>{if(seed[n]&&provisional[n]===l.id)supported=true;});if(supported)break;}if(supported){for(const v of c)l.mask[v]=1;l.pixels+=c.length;}}if(l.pixels){l.id=kept.length+1;kept.push(l);}}
 const rawOwner=new Int32Array(seed.length);for(const l of kept)for(let i=0;i<rawOwner.length;i++)if(l.mask[i])rawOwner[i]=l.id;
 const sourcePalette=(Array.isArray(palette)?palette:[]).map(c=>Array.isArray(c)?((Math.round(c[0])&255)<<16|(Math.round(c[1])&255)<<8|(Math.round(c[2])&255)):Number(c)).filter(Number.isFinite);
 const suppressed=new Set();for(const l of kept)if(transitionLayer(l,kept,rawOwner,w,h,sourcePalette))suppressed.add(l.id);
 const finalLayers=[],idMap=new Map();for(const l of kept)if(!suppressed.has(l.id)){const old=l.id;l.id=finalLayers.length+1;idMap.set(old,l.id);finalLayers.push(l);}
 const owner=new Int32Array(seed.length);for(let i=0;i<owner.length;i++){
  if(!seed[i])continue;
  const old=rawOwner[i],mapped=idMap.get(old);
  owner[i]=mapped||-1; // visible but not a proven ink layer: block gap detection at colour transitions.
 }
 return {layers:finalLayers,owner,suppressedTransitions:suppressed.size};
}
export function analyzeDetail({data,width,height,wMm,hMm,rule,mode='dark',threshold=245,palette=[],lowResolution=false,sourceLimited=false,samplesPerMinimum=null}){
 if(width*height>MAX_PIXELS)throw Error('Превышен лимит размера маски.');const N=width*height,rgb=new Int32Array(N),seed=new Uint8Array(N),background=mode==='light'?0:0xffffff;
 for(let i=0;i<N;i++){const a=data[i*4+3]/255,bg=background?255:0,r=Math.round(data[i*4]*a+bg*(1-a)),g=Math.round(data[i*4+1]*a+bg*(1-a)),b=Math.round(data[i*4+2]*a+bg*(1-a));rgb[i]=r<<16|g<<8|b;seed[i]=mode==='alpha'?+(a>.5):mode==='light'?+(Math.max(r,g,b)>255-threshold):+(Math.min(r,g,b)<threshold);}
 const split=mode==='alpha'?{layers:[{id:1,rgb:0,mask:seed}],owner:Int32Array.from(seed),suppressedTransitions:0}:splitColors(rgb,seed,width,height,background,palette),step=Math.max(wMm/width,hMm/height),result=analyzeLayers(split.layers,split.owner,width,height,1/step,rule,{sameComponentOpenGaps:false}),notes=[];
 if(mode==='alpha')notes.push('Режим прозрачности объединяет цвета. Для проверки по цветам выберите светлый или тёмный фон.');
 if(!split.layers.length)notes.push('Не найдены видимые элементы. Проверьте режим фона и прозрачность логотипа.');
 const total=Object.values(result.counts).reduce((a,b)=>a+b,0);if(total>result.boxes.length)notes.push(`Найдено ${total} областей; число отображаемых примеров ограничено.`);
 return {...result,notes,step,width,height,layers:split.layers.length,suppressedTransitions:split.suppressedTransitions||0,lowResolution:!!lowResolution,sourceLimited:!!sourceLimited,samplesPerMinimum:Number(samplesPerMinimum)||null,algorithm:'PrintCheck-cross-section-v9-true-gaps-only',candidateOnly:true};
}
