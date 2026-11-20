/**
 * Curved boundary research benchmark. Results are measurements, not assertions
 * about performance on real user PDFs. No private files are opened or sent.
 */
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {inspectCurvedNormalProbes} from '../vision/geometry/curved-normal-probes.mjs';

const ring=(r,n)=>({points:Array.from({length:n},(_,i)=>({
  x:r*Math.cos(i*Math.PI*2/n),y:r*Math.sin(i*Math.PI*2/n)
}))});
const median=list=>list.slice().sort((a,b)=>a-b)[Math.floor(list.length/2)];
for(const segmentsPerRing of [24,48,96,192]){
  const contours=[ring(10,segmentsPerRing),ring(9.82,segmentsPerRing)];
  const evaluate=()=>inspectCurvedNormalProbes({
    contours,matrix_svg_to_mm:[1,0,0,1,0,0],
    fill_rule:'evenodd',max_candidate_mm:0.5,
    max_candidates:1000
  });
  const first=evaluate();
  assert.equal(first.status,'RESEARCH_CANDIDATES_ONLY',first.reason);
  for(let i=0;i<2;i++)evaluate();
  const times=[];
  for(let i=0;i<6;i++){
    const start=performance.now(),r=evaluate();
    times.push(performance.now()-start);
    assert.equal(r.candidate_count,first.candidate_count);
  }
  console.log(JSON.stringify({
    benchmark:'curved-normal-probes',
    shape:'synthetic-concentric-circles',
    segment_count:segmentsPerRing*2,
    candidates:first.candidate_count,
    support_windows:first.examined_windows,
    median_ms:Number(median(times).toFixed(3)),
    gates:'local-only; geometry_proven=false; no production verdict'
  }));
}
