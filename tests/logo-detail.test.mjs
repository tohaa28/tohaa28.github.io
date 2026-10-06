import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {splitColors,analyzeLayers,analyzeDetail,inferAutoMask,scanPlan} from '../assets/logo-detail-engine.mjs';
import {compactDetailSummary,detailSingleInk} from '../assets/logo-detail-check.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./printcheck-golden.json',import.meta.url),'utf8'));
function semanticExpectation(name){
 const parts=name.split('-'),kind=parts[0],limit=Number(parts.at(-1));
 if(kind==='empty'||kind==='solid'||kind==='cross'||kind==='wedge')return {positive:false,negative:false,isolated:false};
 if(name.startsWith('cross-colour'))return {positive:false,negative:false,isolated:false};
 if(kind==='bars')return {positive:limit>.25,negative:limit>.25,isolated:false};
 if(kind==='hole')return {positive:false,negative:limit>.25,isolated:false};
 if(name.startsWith('open-channel'))return {positive:limit>=1,negative:limit>.25,isolated:false};
 if(kind==='isolated')return {positive:limit>.25,negative:false,isolated:true};
 return {positive:false,negative:false,isolated:false};
}
for(const f of fixtures)test('PrintCheck fixture semantics: '+f.name,()=>{
 f.rgb=f.runs.flatMap(([v,n])=>Array(n).fill(v));
 const seed=Uint8Array.from(f.rgb,v=>v!==0xffffff?1:0),split=splitColors(f.rgb,seed,f.width,f.height),result=analyzeLayers(split.layers,split.owner,f.width,f.height,f.ppm,f.rule),want=semanticExpectation(f.name);
 assert.equal(split.layers.length,f.expected.layers,`${f.name}: colour layer count`);
 for(const kind of ['positive','negative','isolated']){
  if(want[kind])assert.ok(result.counts[kind]>0,`${f.name}: expected ${kind} defect`);
  else assert.equal(result.counts[kind],0,`${f.name}: unexpected ${kind} defect`);
 }
});
test('Scan budget explicit and single-object-only rules supported',()=>{assert.ok(scanPlan(2000,2000,{positive:.05}).skip);assert.ok(scanPlan(10,10,{isolated:.5}).width>0);});
test('Raster scan never upsamples beyond source pixels',()=>{
 const plan=scanPlan(100,100,{positive:.25},{sourceWidth:1389,sourceHeight:1389});
 assert.equal(plan.sourceLimited,true);
 assert.ok(plan.width<=1389&&plan.height<=1389);
 assert.ok(plan.dpi<=353);
});
test('Source-limited raster may run at three-plus samples per minimum without inventing pixels',()=>{
 const plan=scanPlan(100,100,{positive:.25},{sourceWidth:1389,sourceHeight:1389});
 assert.ok(!plan.skip);
 assert.ok(plan.samplesPerMinimum>=3);
 assert.equal(plan.lowResolution,true);
});

test('Raster tolerance keeps exact-limit geometry from becoming a false failure',()=>{
 const f=fixtures.find(x=>x.name==='bars-0.25'),rgb=f.runs.flatMap(([v,n])=>Array(n).fill(v)),seed=Uint8Array.from(rgb,v=>v!==0xffffff?1:0),split=splitColors(rgb,seed,f.width,f.height),result=analyzeLayers(split.layers,split.owner,f.width,f.height,f.ppm,f.rule);
 assert.equal(result.counts.positive,0);
 assert.equal(result.counts.negative,0);
});
test('Free wedge convergence is not a positive defect',()=>{
 const f=fixtures.find(x=>x.name==='wedge-0.5'),rgb=f.runs.flatMap(([v,n])=>Array(n).fill(v)),seed=Uint8Array.from(rgb,v=>v!==0xffffff?1:0),split=splitColors(rgb,seed,f.width,f.height),result=analyzeLayers(split.layers,split.owner,f.width,f.height,f.ppm,f.rule);
 assert.equal(result.boxes.filter(b=>b.kind==='positive').length,0);
});

function denseGrid(kind,cols=20,rows=20){const w=cols*20+4,h=rows*20+4,mask=new Uint8Array(w*h);if(kind==='negative')mask.fill(1);for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)for(let y=0;y<(kind==='isolated'?2:14);y++)for(let x=0;x<(kind==='isolated'?2:3);x++)mask[(row*20+4+y)*w+col*20+4+x]=kind==='negative'?0:1;return {w,h,mask,owner:Int32Array.from(mask)};}
for(const kind of ['positive','negative','isolated'])test('Whole-logo coverage beyond old result caps: '+kind,()=>{const {w,h,mask,owner}=denseGrid(kind,kind==='isolated'?30:20,kind==='isolated'?30:20),expected=kind==='isolated'?900:400,result=analyzeLayers([{id:1,rgb:0,mask}],owner,w,h,10,{[kind]:.5});assert.equal(result.counts[kind],expected);assert.equal(result.boxes.length,expected);assert.ok(result.boxes.some(b=>b.cx>.9&&b.cy>.9));assert.ok(result.boxes.some(b=>b.cx<.1&&b.cy<.1));});


test('Compact PrintCheck summary is suitable for workspace overlay',()=>{
 const result={boxes:[
  {kind:'positive',minWidthMm:.08,threshold:.12},
  {kind:'positive',minWidthMm:.1,threshold:.12},
  {kind:'negative',minWidthMm:.11,threshold:.15},
  {kind:'isolated',minWidthMm:.2,threshold:.3}
 ],counts:{positive:2,negative:1,isolated:1}};
 assert.equal(compactDetailSummary(result,{positive:.12,negative:.15,isolated:.3}),'PrintCheck · мелкие элементы: 4 — линии 2 (0,08<0,12 мм), пробелы 1 (0,11<0,15 мм), отдельные 1 (0,2<0,3 мм).');
 assert.equal(compactDetailSummary({boxes:[],counts:{positive:0,negative:0,isolated:0}},{positive:.12}),'PrintCheck · мелкие элементы: не найдены.');
});


function painted(width,height,paint){
 const rgb=Array(width*height).fill(0xffffff);
 const set=(x0,y0,x1,y1,color)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)rgb[y*width+x]=color;};
 paint(set,rgb);return {rgb,seed:Uint8Array.from(rgb,c=>c!==0xffffff?1:0)};
}
test('Antialias colour boundary is blocked, not treated as a thin ink or gap',()=>{
 const w=70,h=40,{rgb,seed}=painted(w,h,set=>{set(5,5,32,35,0xff0000);set(32,5,33,35,0x800080);set(33,5,60,35,0x0000ff);});
 const split=splitColors(rgb,seed,w,h,0xffffff,[[255,0,0],[0,0,255]]);
 assert.equal(split.layers.length,2);
 assert.equal(split.suppressedTransitions,1);
 assert.equal(split.owner[20*w+32],-1,'transition pixels must block same-colour gap rays');
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{positive:.5,negative:.5});
 assert.equal(result.boxes.length,0);
});
test('A real third source colour is preserved but not flagged at a multi-colour boundary',()=>{
 const w=70,h=40,{rgb,seed}=painted(w,h,set=>{set(5,5,32,35,0xff0000);set(32,5,33,35,0x800080);set(33,5,60,35,0x0000ff);});
 const split=splitColors(rgb,seed,w,h,0xffffff,[[255,0,0],[128,0,128],[0,0,255]]);
 assert.equal(split.layers.length,3);
 assert.equal(split.suppressedTransitions,0);
 assert.ok(split.layers.some(l=>l.rgb===0x800080),'explicit source purple must stay a distinct ink layer');
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{positive:.5});
 assert.equal(result.boxes.filter(b=>b.kind==='positive'&&b.rgb===0x800080).length,0,'a colour boundary/intersection must not be reported as a thin element');
});
test('Different ink between same-colour objects is never a negative gap',()=>{
 const w=70,h=40,{rgb,seed}=painted(w,h,set=>{set(5,5,27,35,0xff0000);set(27,5,30,35,0x0000ff);set(30,5,52,35,0xff0000);});
 const split=splitColors(rgb,seed,w,h,0xffffff,[[255,0,0],[0,0,255]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{negative:.5});
 assert.equal(result.counts.negative,0);
});
test('A true empty gap inside one ink remains detectable',()=>{
 const w=70,h=40,{rgb,seed}=painted(w,h,set=>{set(5,5,27,35,0xff0000);set(30,5,52,35,0xff0000);});
 const split=splitColors(rgb,seed,w,h,0xffffff,[[255,0,0]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{negative:.5});
 assert.ok(result.counts.negative>0,'real same-colour gap must still be found');
});


test('Circle probe finds a real narrow white channel even when the ink is one connected object',()=>{
 const w=60,h=45,{rgb,seed}=painted(w,h,set=>{
  set(10,5,20,36,0x0033cc);
  set(23,5,33,36,0x0033cc);
  set(10,31,33,36,0x0033cc);
 });
 const split=splitColors(rgb,seed,w,h,0xffffff,[[0,51,204]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{negative:.5});
 assert.ok(result.counts.negative>0,'a 0.3 mm white channel must fail a 0.5 mm control circle');
});

test('Strict negative scan still finds a narrow gap between separate objects of the same colour',()=>{
 const w=60,h=45,{rgb,seed}=painted(w,h,set=>{
  set(10,5,20,36,0x0033cc);
  set(23,5,33,36,0x0033cc);
 });
 const split=splitColors(rgb,seed,w,h,0xffffff,[[0,51,204]]);
 const strict=analyzeLayers(split.layers,split.owner,w,h,10,{negative:.5},{sameComponentOpenGaps:false});
 assert.ok(strict.counts.negative>0,'clearance between separate same-colour objects must be checked');
});

test('Strict negative scan still finds an enclosed knockout inside one colour',()=>{
 const w=60,h=45,{rgb,seed}=painted(w,h,(set,rgb)=>{
  set(8,4,42,38,0x0033cc);
  for(let y=10;y<32;y++)for(let x=23;x<26;x++)rgb[y*w+x]=0xffffff;
 });
 const localSeed=Uint8Array.from(rgb,c=>c!==0xffffff?1:0);
 const split=splitColors(rgb,localSeed,w,h,0xffffff,[[0,51,204]]);
 const strict=analyzeLayers(split.layers,split.owner,w,h,10,{negative:.5},{sameComponentOpenGaps:false});
 assert.ok(strict.counts.negative>0,'enclosed same-colour knockout must still be checked');
});


test('Positive scan does not flag the cap of a thick stroke',()=>{
 const w=80,h=60,{rgb,seed}=painted(w,h,set=>{
  set(30,8,48,50,0x1234c0);
 });
 const split=splitColors(rgb,seed,w,h,0xffffff,[[18,52,192]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{positive:.5});
 assert.equal(result.counts.positive,0,'flat cap of a thick element is not a thin positive');
});

test('Positive scan still finds a genuinely thin persistent line',()=>{
 const w=80,h=60,{rgb,seed}=painted(w,h,set=>{
  set(34,8,37,50,0x1234c0);
 });
 const split=splitColors(rgb,seed,w,h,0xffffff,[[18,52,192]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{positive:.5});
 assert.ok(result.counts.positive>0,'long 0.3 mm line must be detected against a 0.5 mm rule');
 assert.ok(result.boxes.some(b=>b.kind==='positive'&&b.minWidthMm<.5));
});

test('Positive scan ignores thick rounded/convex ends but keeps a narrow neck',()=>{
 const w=100,h=70,{rgb,seed}=painted(w,h,set=>{
  set(10,20,38,50,0x1234c0);
  set(62,20,90,50,0x1234c0);
  set(38,31,62,39,0x1234c0);
 });
 const split=splitColors(rgb,seed,w,h,0xffffff,[[18,52,192]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{positive:1});
 assert.ok(result.counts.positive>0,'real narrow connecting neck must still be detected');
 const neck=result.boxes.filter(b=>b.kind==='positive');
 assert.ok(neck.some(b=>b.cx>.35&&b.cx<.65),'marker should land on the narrow neck, not on the thick block caps');
});


test('Positive scan ignores ordinary edges of a thick same-colour object',()=>{
 const w=80,h=50,{rgb,seed}=painted(w,h,set=>set(10,10,70,40,0x0033cc));
 const split=splitColors(rgb,seed,w,h,0xffffff,[[0,51,204]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{positive:.5},{sameComponentOpenGaps:false});
 assert.equal(result.counts.positive,0,'thick object edges must not create positive markers');
});

test('Positive scan finds a genuinely thin stroke on its medial axis',()=>{
 const w=80,h=50,{rgb,seed}=painted(w,h,set=>{
  set(8,8,28,42,0x0033cc);
  set(28,23,64,25,0x0033cc);
  set(64,8,72,42,0x0033cc);
 });
 const split=splitColors(rgb,seed,w,h,0xffffff,[[0,51,204]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{positive:.5},{sameComponentOpenGaps:false});
 assert.ok(result.counts.positive>0,'thin same-colour bridge must be detected');
 const bridge=result.boxes.filter(b=>b.kind==='positive'&&b.cx>.32&&b.cx<.8);
 assert.ok(bridge.length>0,'marker must be centered on the thin bridge, not on the outer edge');
});

test('Control-circle keeps a long uniform thin spur attached to thick artwork',()=>{
 const w=120,h=70,{rgb,seed}=painted(w,h,set=>{
  set(10,15,45,55,0x163dc5);
  set(45,33,105,36,0x163dc5);
 });
 const split=splitColors(rgb,seed,w,h,0xffffff,[[22,61,197]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{positive:.5});
 const hit=result.boxes.find(b=>b.kind==='positive');
 assert.ok(hit,'a long 0.3 mm spur must fail a 0.5 mm control circle');
 assert.ok(hit.cx>.35,'marker must stay on the uniform thin spur');
});

test('Positive scan ignores a narrow corner convergence shorter than the persistence rule',()=>{
 const w=70,h=50,{rgb,seed}=painted(w,h,(set,rgb)=>{
  set(10,10,22,40,0x0033cc);
  for(let y=10;y<26;y++){const x0=22+(y-10);for(let x=x0;x<x0+Math.max(1,6-Math.floor((y-10)/3));x++)rgb[y*w+x]=0x0033cc;}
 });
 const localSeed=Uint8Array.from(rgb,c=>c!==0xffffff?1:0);
 const split=splitColors(rgb,localSeed,w,h,0xffffff,[[0,51,204]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{positive:.5},{sameComponentOpenGaps:false});
 assert.equal(result.counts.positive,0,'short taper/corner convergence must not become a defect');
});


function rgbaImage(width,height,pixel){
 const data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const [r,g,b,a=255]=pixel(x,y),i=(y*width+x)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=a;}
 return data;
}
test('Single-ink technology is derived from the print colour policy',()=>{
 assert.equal(detailSingleInk({colorPolicy:'black-white'}),true);
 assert.equal(detailSingleInk({colorPolicy:'single-color'}),true);
 assert.equal(detailSingleInk({maxColors:1}),true);
 assert.equal(detailSingleInk({colorPolicy:'black-gray'}),false);
 assert.equal(detailSingleInk({maxColors:2}),false);
});
test('Single-ink geometry merges source colours before measuring thin elements',()=>{
 const w=100,h=50,data=rgbaImage(w,h,(x,y)=>{
  if(x<10||x>=90||y<20||y>=29)return [255,255,255,255];
  if(y<23)return [230,30,40,255];
  if(y<26)return [25,175,75,255];
  return [25,70,220,255];
 });
 const separated=analyzeDetail({data,width:w,height:h,wMm:10,hMm:5,rule:{positive:.5,negative:0,isolated:0},mode:'auto'});
 const merged=analyzeDetail({data,width:w,height:h,wMm:10,hMm:5,rule:{positive:.5,negative:0,isolated:0,singleInk:true},mode:'auto'});
 assert.ok(separated.layers>=2,'multi-colour source must remain separable when the method allows several inks');
 assert.equal(merged.layers,1,'single-ink process must use one physical foreground phase');
 assert.equal(merged.singleInk,true);
 assert.equal(merged.counts.positive,0,'three colour bands forming one 0.9 mm stroke must not become three 0.3 mm defects');
});
test('Single-ink merge still detects a true white gap',()=>{
 const w=100,h=60,data=rgbaImage(w,h,(x,y)=>{
  const ink=x>=15&&x<85&&y>=10&&y<50&&!(x>=49&&x<52);
  return ink?[20,65,210,255]:[255,255,255,255];
 });
 const merged=analyzeDetail({data,width:w,height:h,wMm:10,hMm:6,rule:{positive:0,negative:.5,isolated:0,singleInk:true},mode:'auto'});
 assert.equal(merged.layers,1);
 assert.ok(merged.counts.negative>0,'0.3 mm white clearance must remain a negative defect after shade merging');
});

test('Automatic mask detects light opaque background without user settings',()=>{
 const w=40,h=20,data=rgbaImage(w,h,(x,y)=>x>=10&&x<30&&y>=5&&y<15?[20,50,200,255]:[250,250,250,255]),auto=inferAutoMask(data,w,h);
 assert.equal(auto.kind,'background');
 assert.equal(auto.previewMode,'dark');
 const r=analyzeDetail({data,width:w,height:h,wMm:4,hMm:2,rule:{positive:.5,negative:.5,isolated:.5},mode:'auto'});
 assert.equal(r.autoMask.kind,'background');
 assert.ok(r.layers>=1);
});
test('Automatic mask detects dark opaque background without user settings',()=>{
 const w=40,h=20,data=rgbaImage(w,h,(x,y)=>x>=10&&x<30&&y>=5&&y<15?[245,245,245,255]:[10,10,10,255]),auto=inferAutoMask(data,w,h);
 assert.equal(auto.kind,'background');
 assert.equal(auto.previewMode,'light');
 const r=analyzeDetail({data,width:w,height:h,wMm:4,hMm:2,rule:{positive:.5,negative:.5,isolated:.5},mode:'auto'});
 assert.ok(r.layers>=1);
});
test('Automatic mask detects transparent artwork without user settings',()=>{
 const w=40,h=20,data=rgbaImage(w,h,(x,y)=>x>=10&&x<30&&y>=5&&y<15?[20,50,200,255]:[0,0,0,0]),auto=inferAutoMask(data,w,h);
 assert.equal(auto.kind,'transparent');
 const r=analyzeDetail({data,width:w,height:h,wMm:4,hMm:2,rule:{positive:.5,negative:.5,isolated:.5},mode:'auto'});
 assert.equal(r.autoMask.kind,'transparent');
 assert.ok(r.layers>=1);
});
test('Isolated detection does not split one multicolour visible object into colour fragments',()=>{
 const w=80,h=30,owner=new Int32Array(w*h),a=new Uint8Array(w*h),b=new Uint8Array(w*h);
 for(let y=13;y<17;y++)for(let x=10;x<70;x++){const i=y*w+x,id=Math.floor((x-10)/4)%2?2:1;owner[i]=id;(id===1?a:b)[i]=1;}
 const layers=[{id:1,rgb:0xff0000,mask:a},{id:2,rgb:0x0000ff,mask:b}];
 const visual=analyzeLayers(layers,owner,w,h,10,{isolated:1});
 assert.equal(visual.counts.isolated,0,'one connected visible drawing is not many isolated objects');
});
test('Visual isolated detection still finds a truly detached small object',()=>{
 const w=80,h=40,owner=new Int32Array(w*h),mask=new Uint8Array(w*h);
 for(let y=8;y<28;y++)for(let x=8;x<45;x++){const i=y*w+x;owner[i]=1;mask[i]=1;}
 for(let y=12;y<15;y++)for(let x=65;x<68;x++){const i=y*w+x;owner[i]=1;mask[i]=1;}
 const layers=[{id:1,rgb:0x0033cc,mask}],visual=analyzeLayers(layers,owner,w,h,10,{isolated:.5},{visualIsolated:true});
 assert.equal(visual.counts.isolated,1);
 const box=visual.boxes.find(b=>b.kind==='isolated');assert.ok(box&&box.cx>.75);
});

test('Control-circle positive scan ignores a line wider than the allowed diameter',()=>{
 const w=90,h=40,{rgb,seed}=painted(w,h,set=>set(10,15,80,25,0x163dc5));
 const split=splitColors(rgb,seed,w,h,0xffffff,[[22,61,197]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{positive:.5});
 assert.equal(result.counts.positive,0,'1.0 mm line must accept a 0.5 mm control circle');
});
test('Control-circle positive scan marks the centre of a line narrower than the allowed diameter',()=>{
 const w=90,h=40,{rgb,seed}=painted(w,h,set=>set(10,18,80,21,0x163dc5));
 const split=splitColors(rgb,seed,w,h,0xffffff,[[22,61,197]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{positive:.5});
 const hit=result.boxes.find(b=>b.kind==='positive');
 assert.ok(hit,'0.3 mm line must fail a 0.5 mm control circle');
 assert.ok(hit.cy>.35&&hit.cy<.65,'marker must sit near the centreline');
});
function diagonalBridgeFixture(widthPx){
 const w=110,h=80,ppm=10,mask=new Uint8Array(w*h),owner=new Int32Array(w*h),set=(x,y)=>{if(x>=0&&x<w&&y>=0&&y<h){const i=y*w+x;mask[i]=1;owner[i]=1;}};
 for(let y=10;y<70;y++)for(let x=10;x<30;x++)set(x,y);
 for(let y=10;y<70;y++)for(let x=80;x<100;x++)set(x,y);
 const ax=29,ay=24,bx=80,by=54,vx=bx-ax,vy=by-ay,len2=vx*vx+vy*vy;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const t=((x-ax)*vx+(y-ay)*vy)/len2;if(t<0||t>1)continue;
  const px=ax+t*vx,py=ay+t*vy;
  if(Math.hypot(x-px,y-py)<=widthPx/2)set(x,y);
 }
 return {w,h,ppm,layers:[{id:1,rgb:0x163dc5,mask}],owner};
}
test('Euclidean control-circle is rotation-stable for a thick diagonal bridge',()=>{
 const f=diagonalBridgeFixture(8),result=analyzeLayers(f.layers,f.owner,f.w,f.h,f.ppm,{positive:.5});
 assert.equal(result.counts.positive,0,'0.8 mm diagonal bridge must accept a 0.5 mm control circle');
});
test('Euclidean control-circle finds a thin diagonal bridge on its medial axis',()=>{
 const f=diagonalBridgeFixture(3),result=analyzeLayers(f.layers,f.owner,f.w,f.h,f.ppm,{positive:.5});
 const hit=result.boxes.find(b=>b.kind==='positive');
 assert.ok(hit,'0.3 mm diagonal bridge must fail a 0.5 mm control circle');
 assert.ok(hit.cx>.2&&hit.cx<.8&&hit.cy>.2&&hit.cy<.8,'marker must stay on the diagonal bridge, not on a block edge');
});
function polylineStrokeFixture(points,widthPx,{w=150,h=100,ppm=10}={}){
 const mask=new Uint8Array(w*h),owner=new Int32Array(w*h),radius=widthPx/2;
 const distanceToSegment=(x,y,a,b)=>{
  const vx=b[0]-a[0],vy=b[1]-a[1],den=vx*vx+vy*vy;
  const t=den?Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/den)):0;
  return Math.hypot(x-(a[0]+t*vx),y-(a[1]+t*vy));
 };
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let d=Infinity;
  for(let j=1;j<points.length;j++)d=Math.min(d,distanceToSegment(x,y,points[j-1],points[j]));
  if(d<=radius){const i=y*w+x;mask[i]=1;owner[i]=1;}
 }
 return {w,h,ppm,layers:[{id:1,rgb:0x163dc5,mask}],owner};
}
test('Real-logo-like thick zigzag contour does not create positive edge noise',()=>{
 const f=polylineStrokeFixture([[12,78],[35,18],[55,73],[78,22],[99,70],[126,16],[140,75]],8);
 const result=analyzeLayers(f.layers,f.owner,f.w,f.h,f.ppm,{positive:.5});
 assert.equal(result.counts.positive,0,'0.8 mm zigzag line art must not create markers along ordinary contour bends');
});
test('Real-logo-like thin zigzag contour is still detected',()=>{
 const f=polylineStrokeFixture([[12,78],[35,18],[55,73],[78,22],[99,70],[126,16],[140,75]],3);
 const result=analyzeLayers(f.layers,f.owner,f.w,f.h,f.ppm,{positive:.5});
 assert.ok(result.counts.positive>0,'0.3 mm persistent zigzag line art must fail a 0.5 mm rule');
 assert.ok(result.boxes.some(b=>b.kind==='positive'&&b.minWidthMm<.5));
});

test('Control-circle negative scan ignores open background beside a single ink wall',()=>{
 const w=90,h=50,{rgb,seed}=painted(w,h,set=>set(35,5,45,45,0x163dc5));
 const split=splitColors(rgb,seed,w,h,0xffffff,[[22,61,197]]);
 const result=analyzeLayers(split.layers,split.owner,w,h,10,{negative:.5});
 assert.equal(result.counts.negative,0,'outside background next to one edge is not a printable gap');
});
