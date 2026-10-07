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
 if(width*height>maxPixels)return {skip:'Область слишком велика для проверки мелких элементов в доступном лимите памяти.'};
 if(sourceLimited&&samples<1)return {skip:'Минимально допустимый элемент меньше одного пикселя исходного растра. Геометрию такого размера достоверно проверить нельзя.'};
 if(!sourceLimited&&samples<4)return {skip:'Не удалось получить достаточное разрешение для точной проверки мелких элементов.'};
 return {width,height,dpi,step,lowResolution:samples<4,pixelQuantized:sourceLimited&&samples<3,sourceLimited,samplesPerMinimum:samples};
}
function neighbors(v,w,h,fn){const y=Math.floor(v/w),x=v-y*w;for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++)fn(yy*w+xx);}
function groups(mask,w,h){const labels=new Int32Array(mask.length),q=new Int32Array(mask.length),items=[];let id=0;for(let i=0;i<mask.length;i++)if(mask[i]&&!labels[i]){id++;let a=0,b=1;q[0]=i;labels[i]=id;while(a<b)neighbors(q[a++],w,h,n=>{if(mask[n]&&!labels[n]){labels[n]=id;q[b++]=n;}});items.push(q.slice(0,b));}return {labels,items};}
function chamfer(d,w,h){for(let y=0;y<h;y++)for(let x=0;x<w;x++){let i=y*w+x,v=d[i];if(x)v=Math.min(v,d[i-1]+3);if(y){v=Math.min(v,d[i-w]+3);if(x)v=Math.min(v,d[i-w-1]+4);if(x+1<w)v=Math.min(v,d[i-w+1]+4);}d[i]=v;}for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){let i=y*w+x,v=d[i];if(x+1<w)v=Math.min(v,d[i+1]+3);if(y+1<h){v=Math.min(v,d[i+w]+3);if(x)v=Math.min(v,d[i+w-1]+4);if(x+1<w)v=Math.min(v,d[i+w+1]+4);}d[i]=v;}return d;}
function distance(mask,w,h,toTrue=false){return chamfer(Int32Array.from(mask,v=>(!!v===toTrue)?0:INF),w,h);}
function edt1d(f,n,d,v,z){
 let k=-1;
 for(let q=0;q<n;q++){
  if(!Number.isFinite(f[q]))continue;
  if(k<0){k=0;v[0]=q;z[0]=-Infinity;z[1]=Infinity;continue;}
  let s=0;
  while(true){
   const p=v[k];s=((f[q]+q*q)-(f[p]+p*p))/(2*(q-p));
   if(s>z[k]||k===0)break;
   k--;
  }
  k++;v[k]=q;z[k]=s;z[k+1]=Infinity;
 }
 if(k<0){for(let q=0;q<n;q++)d[q]=Infinity;return;}
 let kk=0;
 for(let q=0;q<n;q++){
  while(kk<k&&z[kk+1]<q)kk++;
  const p=v[kk],dq=q-p;d[q]=dq*dq+f[p];
 }
}
function euclideanDistance(mask,w,h,toTrue=false){
 const out=new Float64Array(mask.length),m=Math.max(w,h),f=new Float64Array(m),d=new Float64Array(m),v=new Int32Array(m),z=new Float64Array(m+1);
 for(let y=0;y<h;y++){
  const off=y*w;
  for(let x=0;x<w;x++)f[x]=((!!mask[off+x])===toTrue)?0:Infinity;
  edt1d(f,w,d,v,z);
  for(let x=0;x<w;x++)out[off+x]=d[x];
 }
 for(let x=0;x<w;x++){
  for(let y=0;y<h;y++)f[y]=out[y*w+x];
  edt1d(f,h,d,v,z);
  for(let y=0;y<h;y++)out[y*w+x]=Math.sqrt(d[y]);
 }
 return out;
}
function maximum(d,w,x,y){let v=d[y*w+x];for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)if(d[yy*w+xx]>v)return false;return true;}
function makeBox(indices,widths,w,h,kind,rule,centerSubset=indices){let x0=w,y0=h,x1=0,y1=0,min=Infinity,max=0,cx=0,cy=0;for(const i of indices){const x=i%w,y=Math.floor(i/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);min=Math.min(min,widths[i]);max=Math.max(max,widths[i]);}for(const i of centerSubset){cx+=i%w;cy+=Math.floor(i/w);}return {x:x0/w,y:y0/h,w:(x1-x0)/w,h:(y1-y0)/h,cx:cx/centerSubset.length/w,cy:cy/centerSubset.length/h,pixels:indices.length,minWidthMm:min,maxWidthMm:max,kind,threshold:rule};}
function components(bad,widths,w,h,ppm,rule,kind){return groups(bad,w,h).items.filter(c=>c.length>=2||c.length/ppm**2>=.0008).map(c=>makeBox(c,widths,w,h,kind,rule));}
function persistent(bad,widths,w,h,ppm,rule,kind,{rejectOneSidedTaper=false,fieldDistance=null,allowOpenChannel=false}={}){
 const result=[],N=bad.length,q=new Int32Array(N),visit=new Int32Array(N),dist=new Int32Array(N),parent=new Int32Array(N),mark=new Int32Array(N);let token=0,comp=0;
 const minPath=Math.max(3,rule*ppm),need=Math.ceil(minPath),band=Math.max(.03,rule*.18),eps=Math.max(.01,.5/ppm);
 const farthest=(start,keep)=>{token++;let a=0,b=1,far=start;q[0]=start;visit[start]=token;dist[start]=0;if(keep)parent[start]=-1;while(a<b){let v=q[a++];neighbors(v,w,h,n=>{if(!bad[n]||visit[n]===token)return;visit[n]=token;dist[n]=dist[v]+1;if(keep)parent[n]=v;q[b++]=n;if(dist[n]>dist[far])far=n;});}return far;};
 const widerNear=v=>{let y=Math.floor(v/w),x=v%w;for(let r=1;r<=3;r++)for(let yy=Math.max(0,y-r);yy<=Math.min(h-1,y+r);yy++)for(let xx=Math.max(0,x-r);xx<=Math.min(w-1,x+r);xx++){const n=yy*w+xx;if(mark[n]!==comp&&Number.isFinite(widths[n])&&widths[n]+.02>=rule)return true;}return false;};
 const widerAhead=(end,inside)=>{const ex=end%w,ey=Math.floor(end/w),vx=ex-inside%w,vy=ey-Math.floor(inside/w),norm=Math.hypot(vx,vy),r=Math.ceil(Math.max(6,minPath*4));if(norm<.5)return false;for(let yy=Math.max(0,ey-r);yy<=Math.min(h-1,ey+r);yy++)for(let xx=Math.max(0,ex-r);xx<=Math.min(w-1,ex+r);xx++){let n=yy*w+xx,dx=xx-ex,dy=yy-ey,dn=Math.hypot(dx,dy);if(dn<1||dn>r||(dx*vx+dy*vy)/(dn*norm)<.2)continue;
   if(fieldDistance){const mm=Math.max(1,2*fieldDistance[n]/3-1)/ppm;if(fieldDistance[n]>0&&mm+.02>=rule)return true;}
   else{const z=widths[n];if(mark[n]!==comp&&Number.isFinite(z)&&z+.02>=rule)return true;}
  }return false;};
 for(const c of groups(bad,w,h).items){
  if(c.length<2){for(const i of c)bad[i]=0;continue;}comp++;for(const i of c)mark[i]=comp;
  const a=farthest(c[0],false),b=farthest(a,true),path=[];let v=b;while(v>=0&&path.length<N){path.push(v);if(v===a)break;v=parent[v];}
  const reject=()=>{for(const i of c)bad[i]=0;};if(path.length<need){reject();continue;}
  let left=0,mh=0,mt=0,xh=0,xt=0,bs=-1,be=-1,bl=0;const mn=new Int32Array(path.length),mx=new Int32Array(path.length);
  for(let right=0;right<path.length;right++){const wr=widths[path[right]];if(!Number.isFinite(wr)){left=right+1;mh=mt=xh=xt=0;continue;}while(mt>mh&&widths[path[mn[mt-1]]]>=wr)mt--;mn[mt++]=right;while(xt>xh&&widths[path[mx[xt-1]]]<=wr)xt--;mx[xt++]=right;while(left<=right&&xh<xt&&mh<mt&&widths[path[mx[xh]]]-widths[path[mn[mh]]]>band){if(mn[mh]===left)mh++;if(mx[xh]===left)xh++;left++;}const len=right-left+1;if(len>bl){bl=len;bs=left;be=right;}}
  if(bl<need){reject();continue;}const occ=bl/path.length;if(!allowOpenChannel&&(bs===0)!==(be===path.length-1)&&occ<.72){reject();continue;}
  const widerA=widerAhead(path[0],path[Math.min(path.length-1,1)]),widerB=widerAhead(path.at(-1),path[Math.max(0,path.length-2)]);
  if(rejectOneSidedTaper&&widerA!==widerB){reject();continue;}
  if(!allowOpenChannel&&!rejectOneSidedTaper&&occ>=.70&&widerA!==widerB&&bl<Math.ceil(Math.max(need,minPath*2.5))){reject();continue;}
  let supported=false;for(let pi=bs;pi<=be;pi++){let degree=0;neighbors(path[pi],w,h,n=>{if(n!==path[pi]&&bad[n])degree++;});if(degree>=3&&widerNear(path[pi])){supported=true;break;}}
  if(supported&&bl<Math.ceil(minPath*2)){reject();continue;}
  const stable=path.slice(bs,be+1),minimum=stable.reduce((m,i)=>Math.min(m,widths[i]),Infinity),center=stable.filter(i=>widths[i]<=minimum+eps);
  result.push(makeBox(stable,widths,w,h,kind,rule,center.length?center:stable));
 }return result;
}
function positive(fg,owner,id,w,h,ppm,rule){
 const d=distance(fg,w,h),other=chamfer(Int32Array.from(owner,v=>v!==0&&v!==id?0:INF),w,h),
  bad=new Uint8Array(fg.length),widths=new Float64Array(fg.length).fill(Infinity),
  guard=Math.max(1.5,rule*ppm*.55),measurementTolerance=Math.max(.02,1/ppm);
 const ridge=(x,y)=>{
  const i=y*w+x,v=d[i];if(!(v>0))return false;
  let lower=false;
  for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++){
   if(xx===x&&yy===y)continue;const n=yy*w+xx;
   if(d[n]>v)return false;
   if(d[n]<v)lower=true;
  }
  return lower;
 };
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x;
  if(!fg[i]||other[i]/3<=guard||!ridge(x,y))continue;
  const mm=Math.max(1,2*d[i]/3-1)/ppm;
  if(mm<=rule*1.75+.05)widths[i]=mm;
  if(mm+measurementTolerance<rule)bad[i]=1;
 }
 return persistent(bad,widths,w,h,ppm,rule,'positive',{rejectOneSidedTaper:true,fieldDistance:d});
}
function negative(fg,owner,id,w,h,ppm,rule,{sameComponentOpenGaps=true}={}){
 const lab=groups(fg,w,h),d=distance(fg,w,h,true),empty=Uint8Array.from(owner,v=>v===0?1:0),enclosed=new Uint8Array(fg.length),holeBad=new Uint8Array(fg.length),holeWidths=new Float64Array(fg.length),result=[];
 for(const c of groups(empty,w,h).items){let border=false,other=false;for(const v of c){let x=v%w,y=Math.floor(v/w);if(!x||!y||x===w-1||y===h-1)border=true;neighbors(v,w,h,n=>{if(owner[n]!==0&&owner[n]!==id)other=true;});}if(border||other)continue;const bad=holeBad,widths=holeWidths;for(const v of c){enclosed[v]=1;let x=v%w,y=Math.floor(v/w);if(!x||!y||x===w-1||y===h-1||!maximum(d,w,x,y))continue;let mm=Math.max(1,2*d[v]/3-1)/ppm;if(mm+.02<rule){bad[v]=1;widths[v]=mm;}}}
 result.push(...components(holeBad,holeWidths,w,h,ppm,rule,'negative'));
 const limit=rule*ppm*1.75,maxRay=Math.ceil(limit+2.5);
 const ray=(x,y,dx,dy,sign)=>{let norm=Math.hypot(dx,dy),ux=sign*dx/norm,uy=sign*dy/norm,lx=x,ly=y;for(let s=1;s<=maxRay;s++){let xx=Math.round(x+ux*s),yy=Math.round(y+uy*s);if(xx===lx&&yy===ly)continue;lx=xx;ly=yy;if(xx<0||xx>=w||yy<0||yy>=h)return null;let i=yy*w+xx;if(owner[i]!==0&&owner[i]!==id)return null;if(fg[i])return [lab.labels[i],s];}return null;};
 for(const same of (sameComponentOpenGaps?[false,true]:[false])){if(!same&&lab.items.length<2)continue;const bad=new Uint8Array(fg.length),widths=new Float64Array(fg.length).fill(Infinity);for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){let i=y*w+x;if(fg[i]||enclosed[i]||owner[i]||d[i]<=0||d[i]/3>limit*.5+1.5)continue;let best=Infinity;for(const [dx,dy]of dirs){let x1=x+dx,y1=y+dy,x2=x-dx,y2=y-dy;if(x1<0||x1>=w||y1<0||y1>=h||x2<0||x2>=w||y2<0||y2>=h)continue;let a=d[y1*w+x1],b=d[y2*w+x2];if(!(d[i]>=a&&d[i]>=b&&(d[i]>a||d[i]>b)))continue;let A=ray(x,y,dx,dy,1),B=ray(x,y,dx,dy,-1);if(!A||!B||(A[0]===B[0])!==same)continue;best=Math.min(best,Math.max(1,A[1]+B[1]-1)/ppm);}if(Number.isFinite(best)&&best<=rule*1.75+.05){widths[i]=best;if(best+.02<rule)bad[i]=1;}}result.push(...persistent(bad,widths,w,h,ppm,rule,'negative'));}return result;
}
function localDiameterMm(d,i,ppm){return Math.max(1,2*d[i]/3-1)/ppm;}
function exactLocalDiameterMm(d,i,ppm){return Math.max(1,2*d[i]-1)/ppm;}
function descendsBeforeRises(d,w,h,x,y,dx,dy,sign,steps,v){
 const norm=Math.hypot(dx,dy),eps=1e-7;let lx=x,ly=y;
 for(let q=1;q<=steps;q++){
  const xx=Math.round(x+sign*dx*q/norm),yy=Math.round(y+sign*dy*q/norm);
  if(xx===lx&&yy===ly)continue;lx=xx;ly=yy;
  if(xx<0||xx>=w||yy<0||yy>=h)return false;
  const z=d[yy*w+xx];
  if(z+eps<v)return true;
  if(z>v+eps)return false;
 }
 return false;
}
function medialAxis(mask,d,w,h,maxDiameterPx=Infinity){
 const out=new Uint8Array(mask.length),steps=Number.isFinite(maxDiameterPx)?Math.max(2,Math.min(8,Math.ceil(maxDiameterPx*.75)+2)):6;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x,v=d[i];if(!mask[i]||v<=0)continue;
  if(Number.isFinite(maxDiameterPx)&&Math.max(1,2*v-1)>maxDiameterPx+2)continue;
  for(const [dx,dy]of dirs)if(descendsBeforeRises(d,w,h,x,y,dx,dy,1,steps,v)&&descendsBeforeRises(d,w,h,x,y,dx,dy,-1,steps,v)){out[i]=1;break;}
 }
 return out;
}
function circleOpening(mask,w,h,diameterPx){
 const radius=Math.max(.5,diameterPx/2),inside=euclideanDistance(mask,w,h),centers=new Uint8Array(mask.length);let hasCenter=false;
 for(let i=0;i<mask.length;i++)if(mask[i]&&inside[i]>=radius){centers[i]=1;hasCenter=true;}
 if(!hasCenter)return {inside,opened:new Uint8Array(mask.length),centers};
 const fromCenter=euclideanDistance(centers,w,h,true),opened=new Uint8Array(mask.length);
 for(let i=0;i<mask.length;i++)if(mask[i]&&fromCenter[i]<=radius+.55)opened[i]=1;
 return {inside,opened,centers};
}
function attachmentGeometry(comp,opened,w,h){
 let cx=0,cy=0;for(const i of comp){cx+=i%w;cy+=Math.floor(i/w);}cx/=comp.length;cy/=comp.length;
 const vectors=[];for(const i of comp){neighbors(i,w,h,n=>{if(!opened[n])return;const dx=n%w-cx,dy=Math.floor(n/w)-cy,m=Math.hypot(dx,dy);if(m>.25)vectors.push([dx/m,dy/m]);});}
 let maxSep=0;for(let i=0;i<vectors.length;i++)for(let j=i+1;j<vectors.length;j++){const dot=Math.max(-1,Math.min(1,vectors[i][0]*vectors[j][0]+vectors[i][1]*vectors[j][1]));maxSep=Math.max(maxSep,Math.acos(dot));}
 return {count:vectors.length,maxSep};
}
function median(values){const a=values.slice().sort((x,y)=>x-y),n=a.length;if(!n)return Infinity;return n&1?a[n>>1]:(a[n/2-1]+a[n/2])/2;}
function oneBodyTaper(medial,fromOpened,inside,w,h,ppm,rule){
 if(medial.length<4)return false;
 const rows=Array.from(medial,i=>[fromOpened[i],exactLocalDiameterMm(inside,i,ppm)]).sort((a,b)=>a[0]-b[0]),q=Math.max(2,Math.floor(rows.length/3)),
  values=rows.map(v=>v[1]),near=median(rows.slice(0,q).map(v=>v[1])),far=median(rows.slice(-q).map(v=>v[1])),lo=Math.min(...values),hi=Math.max(...values),
  trend=Math.max(rule*.12,.45/ppm),sharpSpread=Math.max(rule*.35,1.25/ppm);
 return near-far>trend||(hi-lo>sharpSpread&&lo<rule*.55);
}
function wallOpposition(comp,wall,w,h,radius){
 for(const i of comp){const x=i%w,y=Math.floor(i/w);for(const [dx,dy] of dirs){const norm=Math.hypot(dx,dy);let a=false,b=false;for(let q=1;q<=radius;q++){const x1=Math.round(x+dx*q/norm),y1=Math.round(y+dy*q/norm),x2=Math.round(x-dx*q/norm),y2=Math.round(y-dy*q/norm);if(x1>=0&&x1<w&&y1>=0&&y1<h&&wall[y1*w+x1])a=true;if(x2>=0&&x2<w&&y2>=0&&y2<h&&wall[y2*w+x2])b=true;if(a&&b)return true;}}}
 return false;
}
function controlCircleDefects(mask,w,h,ppm,rule,kind,{wallMask=null,forbiddenMask=null}={}){
 const diameterPx=rule*ppm,{inside,opened}=circleOpening(mask,w,h,diameterPx),missing=new Uint8Array(mask.length),axis=medialAxis(mask,inside,w,h,diameterPx),forbiddenDistance=forbiddenMask?euclideanDistance(forbiddenMask,w,h,true):null;let openedDistance=null;
 for(let i=0;i<mask.length;i++)if(mask[i]&&!opened[i])missing[i]=1;
 const openedLabels=groups(opened,w,h).labels,out=[],extentLimit=Math.max(4,diameterPx*3),wallRadius=Math.max(2,Math.ceil(diameterPx*1.25)),crossGuard=Math.max(1.5,diameterPx*.55);
 for(const comp of groups(missing,w,h).items){
  if(comp.length<2)continue;
  if(forbiddenDistance&&comp.some(i=>forbiddenDistance[i]<=crossGuard))continue;
  if(kind==='negative'&&wallMask&&!wallOpposition(comp,wallMask,w,h,wallRadius))continue;
  let x0=w,y0=h,x1=0,y1=0,cx=0,cy=0;for(const i of comp){const x=i%w,y=Math.floor(i/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);cx+=x;cy+=y;}cx/=comp.length;cy/=comp.length;
  const attach=attachmentGeometry(comp,opened,w,h),extent=Math.max(x1-x0+1,y1-y0+1),oneSided=attach.count>0&&attach.maxSep<Math.PI*.66,adjacentOpened=new Set();
  for(const i of comp)neighbors(i,w,h,n=>{if(openedLabels[n])adjacentOpened.add(openedLabels[n]);});
  const medial=comp.filter(i=>axis[i]);if(!medial.length)continue;
  const widths=new Float64Array(mask.length).fill(Infinity);let min=Infinity;for(const i of medial){widths[i]=exactLocalDiameterMm(inside,i,ppm);min=Math.min(min,widths[i]);}
  const measurementTolerance=Math.max(.015,.45/ppm);
  if(min+measurementTolerance>=rule)continue;
  const taperToOneBody=adjacentOpened.size===1&&oneBodyTaper(medial,openedDistance||(openedDistance=euclideanDistance(opened,w,h,true)),inside,w,h,ppm,rule);
  const compactEndCap=kind==='positive'&&adjacentOpened.size===1&&extent<=Math.max(3,diameterPx*1.25);
  if((oneSided&&extent<=extentLimit)||(kind==='positive'&&taperToOneBody)||compactEndCap)continue;
  const center=medial.reduce((best,i)=>Math.hypot(i%w-cx,Math.floor(i/w)-cy)<Math.hypot(best%w-cx,Math.floor(best/w)-cy)?i:best,medial[0]);
  const box=makeBox(comp,widths,w,h,kind,rule,[center]);box.minWidthMm=min;out.push(box);
 }
 return out;
}
function positiveCircleProbe(fg,owner,id,w,h,ppm,rule){let other=null;for(let i=0;i<owner.length;i++)if(owner[i]!==0&&owner[i]!==id){if(!other)other=new Uint8Array(owner.length);other[i]=1;}return controlCircleDefects(fg,w,h,ppm,rule,'positive',{forbiddenMask:other});}
function wallOppositionAt(i,wall,w,h,radius){
 const x=i%w,y=Math.floor(i/w);
 for(const [dx,dy] of dirs){
  const norm=Math.hypot(dx,dy);let a=false,b=false;
  for(let q=1;q<=radius;q++){
   const x1=Math.round(x+dx*q/norm),y1=Math.round(y+dy*q/norm),x2=Math.round(x-dx*q/norm),y2=Math.round(y-dy*q/norm);
   if(x1>=0&&x1<w&&y1>=0&&y1<h&&wall[y1*w+x1])a=true;
   if(x2>=0&&x2<w&&y2>=0&&y2<h&&wall[y2*w+x2])b=true;
   if(a&&b)return true;
  }
 }
 return false;
}
function negativeCircleProbe(owner,id,w,h,ppm,rule){
 const gap=new Uint8Array(owner.length),wall=new Uint8Array(owner.length);
 for(let i=0;i<owner.length;i++){wall[i]=owner[i]===id?1:0;gap[i]=owner[i]===0?1:0;}
 const d=euclideanDistance(gap,w,h),axis=medialAxis(gap,d,w,h,rule*ppm),bad=new Uint8Array(owner.length),widths=new Float64Array(owner.length).fill(Infinity),
  tol=Math.max(.015,.55/ppm),radius=Math.max(2,Math.ceil(rule*ppm*1.5));
 for(let i=0;i<axis.length;i++)if(axis[i]){
  const mm=exactLocalDiameterMm(d,i,ppm);widths[i]=mm;
  if(mm+tol<rule&&wallOppositionAt(i,wall,w,h,radius))bad[i]=1;
 }
 return persistent(bad,widths,w,h,ppm,rule,'negative',{allowOpenChannel:true});
}
export function analyzeLayers(layers,owner,w,h,ppm,rule,options={}){
 const boxes=[],counts={positive:0,negative:0,isolated:0},isolatedPixels=new Uint8Array(owner.length),isolatedThreshold=rule.isolated;
 if(isolatedThreshold>0){
  const visible=Uint8Array.from(owner,v=>v!==0?1:0),zero=new Float64Array(owner.length);
  for(const c of groups(visible,w,h).items){
   let x0=w,y0=h,x1=0,y1=0;const inkCounts=new Map();
   for(const i of c){const x=i%w,y=Math.floor(i/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);const id=owner[i];if(id>0)inkCounts.set(id,(inkCounts.get(id)||0)+1);}
   const size=Math.max(x1-x0,y1-y0)/ppm;if(size+.02>=isolatedThreshold||!inkCounts.size)continue;
   for(const i of c)isolatedPixels[i]=1;
   const dominant=[...inkCounts].sort((a,b)=>b[1]-a[1])[0][0],layer=layers.find(l=>l.id===dominant),b=makeBox(c,zero,w,h,'isolated',isolatedThreshold);
   b.minWidthMm=size;boxes.push({...b,rgb:layer?.rgb??0,layerId:dominant});counts.isolated++;
  }
 }
 for(const l of layers){
  if(rule.positive>0){
   const found=positiveCircleProbe(l.mask,owner,l.id,w,h,ppm,rule.positive).filter(b=>{
    const x0=Math.max(0,Math.floor(b.x*w)),y0=Math.max(0,Math.floor(b.y*h)),x1=Math.min(w,Math.ceil((b.x+b.w)*w)),y1=Math.min(h,Math.ceil((b.y+b.h)*h));
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(isolatedPixels[y*w+x])return false;
    return true;
   });
   counts.positive+=found.length;for(const b of found)boxes.push({...b,rgb:l.rgb,layerId:l.id});
  }
  if(rule.negative>0){const found=negativeCircleProbe(owner,l.id,w,h,ppm,rule.negative);counts.negative+=found.length;for(const b of found)boxes.push({...b,rgb:l.rgb,layerId:l.id});}
 }
 return {boxes,counts};
}
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
export function inferAutoMask(data,width,height){
 const border=[],push=i=>{const a=data[i*4+3],r=data[i*4],g=data[i*4+1],b=data[i*4+2];border.push({a,r,g,b});};
 const step=Math.max(1,Math.floor(Math.max(width,height)/512));
 for(let x=0;x<width;x+=step){push(x);if(height>1)push((height-1)*width+x);}
 for(let y=1;y<height-1;y+=step){push(y*width);if(width>1)push(y*width+width-1);}
 const transparent=border.filter(p=>p.a<32).length/Math.max(1,border.length);
 if(transparent>=.12)return {kind:'transparent',background:0xffffff,threshold:16,previewMode:'dark'};
 const hist=new Map();
 for(const p of border){const key=(p.r>>4)<<8|(p.g>>4)<<4|(p.b>>4),v=hist.get(key)||{n:0,r:0,g:0,b:0};v.n++;v.r+=p.r;v.g+=p.g;v.b+=p.b;hist.set(key,v);}
 const best=[...hist.values()].sort((a,b)=>b.n-a.n)[0]||{n:1,r:255,g:255,b:255},br=Math.round(best.r/best.n),bg=Math.round(best.g/best.n),bb=Math.round(best.b/best.n),background=br<<16|bg<<8|bb;
 const noise=border.map(p=>Math.hypot(p.r-br,p.g-bg,p.b-bb)).sort((a,b)=>a-b),p95=noise[Math.min(noise.length-1,Math.floor(noise.length*.95))]||0,threshold=Math.max(14,Math.min(46,Math.ceil(p95+8))),lum=.2126*br+.7152*bg+.0722*bb;
 return {kind:'background',background,threshold,previewMode:lum<128?'light':'dark'};
}
export function analyzeDetail({data,width,height,wMm,hMm,rule,mode='auto',threshold=0,palette=[],lowResolution=false,sourceLimited=false,samplesPerMinimum=null}){
 if(width*height>MAX_PIXELS)throw Error('Превышен лимит размера маски.');
 const N=width*height,rgb=new Int32Array(N),seed=new Uint8Array(N),auto=mode==='auto'?inferAutoMask(data,width,height):null,background=auto?.background??(mode==='light'?0:0xffffff),maskThreshold=auto?.threshold??threshold;
 const br=background>>16&255,bg0=background>>8&255,bb=background&255;
 for(let i=0;i<N;i++){
  const a=data[i*4+3]/255,r=Math.round(data[i*4]*a+br*(1-a)),g=Math.round(data[i*4+1]*a+bg0*(1-a)),b=Math.round(data[i*4+2]*a+bb*(1-a));rgb[i]=r<<16|g<<8|b;
  if(auto?.kind==='transparent')seed[i]=+(a>.06);
  else if(auto)seed[i]=+(a>.06&&Math.hypot(r-br,g-bg0,b-bb)>maskThreshold);
  else seed[i]=mode==='alpha'?+(a>.5):mode==='light'?+(Math.max(r,g,b)>255-threshold):+(Math.min(r,g,b)<threshold);
 }
 const separated=mode==='alpha'?{layers:[{id:1,rgb:0,mask:seed}],owner:Int32Array.from(seed),suppressedTransitions:0}:splitColors(rgb,seed,width,height,background,palette),
  split=rule.singleInk?(()=>{const mask=Uint8Array.from(seed,v=>v?1:0),visible=mask.some(Boolean),rgb=separated.layers.slice().sort((a,b)=>(b.pixels||0)-(a.pixels||0))[0]?.rgb??0;return {layers:visible?[{id:1,rgb,mask,pixels:mask.reduce((n,v)=>n+v,0)}]:[],owner:Int32Array.from(mask),suppressedTransitions:separated.suppressedTransitions||0};})():separated,
  step=Math.max(wMm/width,hMm/height),result=analyzeLayers(split.layers,split.owner,width,height,1/step,rule,{sameComponentOpenGaps:false,visualIsolated:true}),notes=[];
 if(!split.layers.length)notes.push('Не найдены видимые элементы. Автоматическая маска не смогла уверенно отделить нанесение от фона.');
 const total=Object.values(result.counts).reduce((a,b)=>a+b,0);if(total>result.boxes.length)notes.push(`Найдено ${total} областей; число отображаемых примеров ограничено.`);
 return {...result,notes,step,width,height,layers:split.layers.length,suppressedTransitions:split.suppressedTransitions||0,autoMask:auto||{kind:mode,background,threshold},lowResolution:!!lowResolution,sourceLimited:!!sourceLimited,samplesPerMinimum:Number(samplesPerMinimum)||null,algorithm:'PrintCheck-control-circle-v19-two-sided-medial',singleInk:!!rule.singleInk,candidateOnly:true};
}
