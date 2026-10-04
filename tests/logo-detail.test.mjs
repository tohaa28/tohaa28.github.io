import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {splitColors,analyzeLayers,scanPlan} from '../assets/logo-detail-engine.mjs';
import {compactDetailSummary} from '../assets/logo-detail-check.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./printcheck-golden.json',import.meta.url),'utf8'));
for(const f of fixtures)test('PrintCheck alpha63 Java parity: '+f.name,()=>{
 f.rgb=f.runs.flatMap(([v,n])=>Array(n).fill(v));const seed=Uint8Array.from(f.rgb,v=>v!==0xffffff?1:0),split=splitColors(f.rgb,seed,f.width,f.height),result=analyzeLayers(split.layers,split.owner,f.width,f.height,f.ppm,f.rule);
 assert.equal(split.layers.length,f.expected.layers);assert.equal(result.boxes.length,f.expected.boxes.length);
 for(let i=0;i<result.boxes.length;i++)for(const [key,value]of Object.entries(f.expected.boxes[i])){const actual=result.boxes[i][key];if(typeof value==='number')assert.ok(Math.abs(actual-value)<1e-9,`${i}.${key}: ${actual} != ${value}`);else assert.equal(actual,value);}
});
test('Scan budget explicit and single-object-only rules supported',()=>{assert.ok(scanPlan(2000,2000,{positive:.05}).skip);assert.ok(scanPlan(10,10,{isolated:.5}).width>0);});

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
