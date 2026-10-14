import {test} from 'node:test';
import assert from 'node:assert/strict';
import {vectorColorEvidence,pixelColorEvidence,colorFindings} from '../assets/logo-color.mjs';
import {normalizeRotation,rotationDelta,rotationGeometry} from '../assets/logo-rotation.mjs';
import {PRINT_REQUIREMENTS as rules,effectiveRule} from '../assets/print-requirements.mjs';
const findings=(code,colors)=>colorFindings(rules[code],{vectorColors:vectorColorEvidence(colors)});
test('rotation crosses zero continuously and keeps its center at zoom',()=>{
 assert.equal(rotationDelta(179,-179),2);assert.equal(rotationDelta(-179,179),-2);assert.equal(normalizeRotation(-15),345);
 const p={x:10,y:20,w:30,h:40,rotation:90},v={x:0,y:0,w:100,h:100};
 const g=rotationGeometry(p,v,500,500);assert.deepEqual(g.center,{x:125,y:200});assert.equal(g.handle.x,253);assert.equal(g.handle.y,200);
 assert.equal(rotationGeometry(p,v,1000,1000).center.x,250);
});
test('all laser families require black/white; gray and color cannot pass',()=>{
 for(const code of ['LM1','LB4','LRM','LSM','LC3','LRC','LSP','LSC','LUV3','LRUV']){
  assert.equal(findings(code,['rgb(0, 0, 0)','rgb(255, 255, 255)'])[0].status,'ok');
  for(const color of ['rgb(255, 0, 0)','rgb(128, 128, 128)','rgba(0, 0, 0, 0.5)'])assert.equal(findings(code,[color])[0].status,'bad');
 }
});
test('one-color separations, full color and metal stickers use different policies',()=>{
 for(const code of ['F1','SH1','RP1','T1'])assert.equal(findings(code,['rgb(255, 0, 0)','rgb(0, 0, 255)'])[0].status,'bad');
 assert.equal(findings('F1',['rgb(255, 0, 0)'])[0].status,'ok');assert.deepEqual(findings('D1',['rgb(255, 0, 0)','rgb(0, 0, 255)']),[]);
 assert.equal(findings('MS1',['rgb(128, 128, 128)'])[0].status,'manual');assert.equal(findings('MS1',['rgb(255, 0, 0)'])[0].status,'bad');
 assert.equal(colorFindings(effectiveRule(rules.B4,{puff:true}),{vectorColors:vectorColorEvidence(['rgb(255, 0, 0)','rgb(0, 0, 255)'])})[0].status,'bad');
});
const pixels=(fn)=>{const d=new Uint8ClampedArray(20*20*4);for(let y=0;y<20;y++)for(let x=0;x<20;x++)d.set(fn(x,y),(y*20+x)*4);return pixelColorEvidence(d,20,20);};
test('antialiased raster boundaries and transparent RGB do not become gray ink',()=>{
 const p=pixels(x=>x<9?[0,0,0,255]:x===9?[128,128,128,255]:[255,255,255,255]);assert.equal(p.gray,false);assert.equal(p.colored,false);
 const invisible=pixels(()=>[255,0,0,0]);assert.equal(invisible.colored,false);assert.equal(invisible.visible,0);
 assert.equal(pixels(()=>[0,0,0,128]).partialAlpha,true);
 const gray=pixels(()=>[128,128,128,255]);assert.equal(gray.gray,true);
 const mixed=pixels(x=>x<10?[255,0,0,255]:[0,0,255,255]);assert.equal(mixed.distinctHues,true);
 assert.equal(colorFindings(rules.F1,{pixelColors:mixed})[0].status,'bad');
});
test('incomplete vector and mixed raster evidence never certify separations',()=>{
 const vectorColors=vectorColorEvidence(['rgb(0, 0, 0)'],{complete:false});const pixelColors=pixels(x=>x<10?[255,0,0,255]:[0,0,255,255]);
 assert.equal(colorFindings(rules.LM1,{vectorColors,pixelColors})[0].status,'bad');assert.equal(colorFindings(rules.F1,{vectorColors,pixelColors})[0].status,'bad');
 assert.equal(colorFindings(rules.LM1,{vectorColors})[0].status,'manual');
 assert.equal(colorFindings(rules.LM1,{vectorColors:vectorColorEvidence([],{complete:false}),pixelColors})[0].status,'bad');
});

test('per-method two- and three-spot limits use real vector paints, including white',()=>{
 const vector=vectorColorEvidence(['rgb(255, 0, 0)','rgb(0, 0, 255)','rgb(255, 255, 255)']);
 const limit2={...rules.D1,maxColors:2,colorPolicy:'single-color'};
 const limit3={...rules.D1,maxColors:3,colorPolicy:'single-color'};
 assert.deepEqual([vector.count,vector.complete],[3,true]);
 assert.deepEqual(colorFindings(limit2,{vectorColors:vector}).map(f=>f.status),['bad']);
 assert.deepEqual(colorFindings(limit3,{vectorColors:vector}).map(f=>f.status),['ok']);
 assert.equal(colorFindings({...rules.D1,maxColors:1},{vectorColors:vector})[0].required,1);
 assert.deepEqual(colorFindings({...rules.LM1,maxColors:2},{vectorColors:vector}).map(f=>f.id),['monochrome','colors']);
 assert.equal(colorFindings({...rules.D1,maxColors:2,colorPolicy:'black-gray'},{vectorColors:vector}).find(f=>f.id==='colors').status,'bad');
});
test('raster antialiasing and same-hue shading cannot create false extra spot inks',()=>{
 const width=90,height=24,colors=[[255,0,0],[0,255,0],[0,0,255]];
 const data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set([...colors[Math.floor(x/30)],255],(y*width+x)*4);
 const raster=pixelColorEvidence(data,width,height);
 assert.ok(raster.provenInkCount>=3,JSON.stringify(raster));
 assert.equal(colorFindings({...rules.D1,maxColors:2},{pixelColors:raster,artworkType:'raster'})[0].status,'bad');
 assert.equal(colorFindings({...rules.D1,maxColors:3},{pixelColors:raster,artworkType:'raster'})[0].status,'manual',
   'Pixel classification is a lower bound, never a certified 3-ink separation');
 const monochromeData=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const shade=x<30?[150,0,0]:x<60?[200,0,0]:[255,0,0];
   monochromeData.set([...shade,255],(y*width+x)*4);
 }
 const monochrome=pixelColorEvidence(monochromeData,width,height);
 assert.ok(monochrome.provenInkCount<=1,JSON.stringify(monochrome));
 assert.notEqual(colorFindings({...rules.D1,maxColors:1},{pixelColors:monochrome,artworkType:'raster'})[0].status,'bad');
});
test('PDF preview never certifies number of spot separations',()=>{
 const rgb=vectorColorEvidence(['rgb(30, 40, 50)','rgb(90, 100, 110)']);
 const pdf={vectorColors:{...rgb,separationsComplete:false},artworkType:'vector'};
 assert.equal(colorFindings({...rules.D1,maxColors:2},pdf)[0].status,'manual');
});
