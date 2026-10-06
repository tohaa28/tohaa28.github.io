import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {splitColors,analyzeLayers,scanPlan} from '../assets/logo-detail-engine.mjs';
import {compactDetailSummary} from '../assets/logo-detail-check.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./printcheck-golden.json',import.meta.url),'utf8'));
function productionExpectedBoxes(f){
 const pixelTolerance=1/f.ppm;
 return f.expected.boxes.filter(box=>{
  if(box.kind!=='positive')return true;
  if(/^wedge-/.test(f.name))return false;
  return box.minWidthMm+pixelTolerance<f.rule.positive;
 });
}
for(const f of fixtures)test('PrintCheck legacy fixture regression: '+f.name,()=>{
 f.rgb=f.runs.flatMap(([v,n])=>Array(n).fill(v));
 const seed=Uint8Array.from(f.rgb,v=>v!==0xffffff?1:0),split=splitColors(f.rgb,seed,f.width,f.height),result=analyzeLayers(split.layers,split.owner,f.width,f.height,f.ppm,f.rule),expected=productionExpectedBoxes(f);
 assert.equal(split.layers.length,f.expected.layers);
 const actualOther=result.boxes.filter(b=>b.kind!=='positive'),expectedOther=expected.filter(b=>b.kind!=='positive');
 assert.equal(actualOther.length,expectedOther.length,`${f.name}: negative/isolated count changed`);
 for(let i=0;i<actualOther.length;i++)for(const [key,value] of Object.entries(expectedOther[i])){
  const actual=actualOther[i][key];
  if(typeof value==='number')assert.ok(Math.abs(actual-value)<1e-9,`${f.name} other ${i}.${key}: ${actual} != ${value}`);
  else assert.equal(actual,value);
 }
 const actualPositive=result.boxes.filter(b=>b.kind==='positive'),expectedPositive=expected.filter(b=>b.kind==='positive');
 assert.equal(actualPositive.length,expectedPositive.length,`${f.name}: production positive count`);
 for(const want of expectedPositive){
  const hit=actualPositive.reduce((best,b)=>!best||Math.hypot(b.cx-want.cx,b.cy-want.cy)<Math.hypot(best.cx-want.cx,best.cy-want.cy)?b:best,null);
  assert.ok(hit&&Math.hypot(hit.cx-want.cx,hit.cy-want.cy)<=.04,`${f.name}: expected positive near ${want.cx},${want.cy}`);
  assert.ok(hit.minWidthMm+1/f.ppm<f.rule.positive,`${f.name}: positive must be smaller than rule beyond raster tolerance`);
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

test('One-pixel measurement tolerance prevents false failure at the exact limit',()=>{
 const f=fixtures.find(x=>x.name==='bars-1'),rgb=f.runs.flatMap(([v,n])=>Array(n).fill(v)),seed=Uint8Array.from(rgb,v=>v!==0xffffff?1:0),split=splitColors(rgb,seed,f.width,f.height),result=analyzeLayers(split.layers,split.owner,f.width,f.height,f.ppm,f.rule);
 const positives=result.boxes.filter(b=>b.kind==='positive');
 assert.equal(positives.length,1);
 assert.ok(positives[0].minWidthMm<.5,'only the genuinely thin 0.3 mm bar should remain');
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


test('Strict negative scan ignores an open channel inside one connected ink object',()=>{
 const w=60,h=45,{rgb,seed}=painted(w,h,set=>{
  set(10,5,20,36,0x0033cc);
  set(23,5,33,36,0x0033cc);
  set(10,31,33,36,0x0033cc);
 });
 const split=splitColors(rgb,seed,w,h,0xffffff,[[0,51,204]]);
 const legacy=analyzeLayers(split.layers,split.owner,w,h,10,{negative:.5});
 const strict=analyzeLayers(split.layers,split.owner,w,h,10,{negative:.5},{sameComponentOpenGaps:false});
 assert.ok(legacy.counts.negative>0,'legacy geometry should demonstrate the former false positive');
 assert.equal(strict.counts.negative,0,'open concavity of one connected object is not a true gap');
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
