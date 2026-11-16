/**
 * Non-gating CPU benchmark: PrintCheck Vision spatial index versus exact
 * O(N²) reference, on deterministic synthetic artwork only.
 *
 * Prints reproducible run metadata + structural pair counts + wall clock
 * medians. Wallclock is intentionally NOT an assertion: CI hosts vary.
 */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {inspectVectorCorridors} from '../vision/geometry/vector-corridors.mjs';

const rect=(x,y,w,h)=>({points:[
  {x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}
]});
function sparse(n=80){
  const result=[];
  for(let r=0;r<8;r++)for(let c=0;c<10;c++)result.push(rect(c*6,r*4,2,0.15));
  return result.slice(0,n);
}
function dense(){
  const result=[];
  for(let r=0;r<5;r++)for(let c=0;c<12;c++)result.push(
    rect(c*1.0,r*6,0.45,0.2));
  return result;
}
function measure(contours,mode){
  return inspectVectorCorridors({
    contours,matrix_svg_to_mm:[1,0,0,1,0,0],
    fill_rule:'evenodd',max_segments:768,max_candidates:1000,
    max_candidate_mm:0.65,pair_index:mode
  });
}
function median(values){
  const sorted=values.slice().sort((a,b)=>a-b);
  return sorted[Math.floor(sorted.length/2)];
}
function bench(label,contours){
  for(let k=0;k<2;k++){measure(contours,'reference');measure(contours,'grid');}
  const runs=8,refs=[],grids=[];
  // Alternate order to avoid systematic warmup or thermal effects.
  for(let k=0;k<runs;k++){
    const modes=k%2?['grid','reference']:['reference','grid'];
    for(const mode of modes){
      const start=performance.now();
      const result=measure(contours,mode);
      const elapsed=performance.now()-start;
      if(mode==='reference')refs.push(elapsed);else grids.push(elapsed);
      assert.equal(result.status,'RESEARCH_CANDIDATES_ONLY',result.reason);
    }
  }
  const base=measure(contours,'reference'),indexed=measure(contours,'grid');
  assert.deepEqual(indexed.candidates,base.candidates);
  const original=median(refs),optimized=median(grids);
  const summary={
    scenario:label,shapes:contours.length,
    segments:indexed.pair_search.edges,
    reference_median_ms:Number(original.toFixed(3)),
    spatial_median_ms:Number(optimized.toFixed(3)),
    observed_speedup:Number((original/Math.max(optimized,0.001)).toFixed(2)),
    exhaustive_pairs:indexed.pair_search.exhaustive_pair_count,
    reference_collision_checks:base.pair_search.intersection_pair_checks,
    indexed_collision_checks:indexed.pair_search.intersection_pair_checks,
    reference_corridor_checks:base.pair_search.corridor_pair_checks,
    indexed_corridor_checks:indexed.pair_search.corridor_pair_checks,
    index_mode:indexed.pair_search.mode,
    note:'This benchmark is a synthetic microbenchmark, not real PDF/print throughput.'
  };
  console.log(JSON.stringify(summary));
}
bench('80-separated-strokes',sparse());
bench('60-small-ink-islands',dense());
