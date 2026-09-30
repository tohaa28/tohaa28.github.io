import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {splitColors,analyzeLayers,scanPlan} from '../assets/logo-detail-engine.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./printcheck-golden.json',import.meta.url),'utf8'));
for(const f of fixtures)test('PrintCheck alpha63 Java parity: '+f.name,()=>{
 f.rgb=f.runs.flatMap(([v,n])=>Array(n).fill(v));const seed=Uint8Array.from(f.rgb,v=>v!==0xffffff?1:0),split=splitColors(f.rgb,seed,f.width,f.height),result=analyzeLayers(split.layers,split.owner,f.width,f.height,f.ppm,f.rule);
 assert.equal(split.layers.length,f.expected.layers);assert.equal(result.boxes.length,f.expected.boxes.length);
 for(let i=0;i<result.boxes.length;i++)for(const [key,value]of Object.entries(f.expected.boxes[i])){const actual=result.boxes[i][key];if(typeof value==='number')assert.ok(Math.abs(actual-value)<1e-9,`${i}.${key}: ${actual} != ${value}`);else assert.equal(actual,value);}
});
test('Scan budget explicit and single-object-only rules supported',()=>{assert.ok(scanPlan(2000,2000,{positive:.05}).skip);assert.ok(scanPlan(10,10,{isolated:.5}).width>0);});
