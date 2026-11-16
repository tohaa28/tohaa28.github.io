import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyCandidate, assessCandidate} from '../runtime/printcheck-micro.mjs';
const model = JSON.parse(readFileSync(new URL('../runtime/weights.json', import.meta.url),'utf-8'));
const patch = new Uint8Array(441);
patch.fill(1);
const out = classifyCandidate(patch, model);
assert.equal(out.probabilities.length, 5);
assert.ok(Math.abs(out.probabilities.reduce((a,b)=>a+b,0)-1)<1e-7);
assert.equal(assessCandidate({needsReview:false},model,{}).state,'skipped');
assert.throws(()=>assessCandidate({needsReview:true,measuredMm:0.2,patch},model,{}), /Invalid rule/);
assert.throws(()=>assessCandidate({needsReview:true,measuredMm:NaN,patch},model,{positiveMm:.2,negativeMm:.2}),/Missing/);
assert.ok(['review','ok','defect'].includes(assessCandidate(
 {needsReview:true,measuredMm:.2,patch},model,{positiveMm:.3,negativeMm:.2,islandMm:.4,version:'test'}
 ).state));
console.log('JS runtime tests passed');
