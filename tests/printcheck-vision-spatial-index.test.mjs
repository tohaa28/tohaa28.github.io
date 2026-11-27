import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVectorCorridors} from '../vision/geometry/vector-corridors.mjs';

const rectangle=(x,y,w,h)=>({points:[
  {x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}
]});
const options=(contours,more={})=>({
  contours,matrix_svg_to_mm:[1,0,0,1,0,0],
  fill_rule:'evenodd',max_segments:768,max_candidates:1000,
  max_candidate_mm:0.6,...more
});
function equivalent(contours,more={}){
  const reference=inspectVectorCorridors(options(contours,{...more,pair_index:'reference'}));
  const indexed=inspectVectorCorridors(options(contours,{...more,pair_index:'grid'}));
  assert.equal(indexed.status,reference.status);
  assert.equal(indexed.geometry_proven,reference.geometry_proven);
  assert.equal(indexed.print_scale_proven,reference.print_scale_proven);
  if(reference.status==='RESEARCH_CANDIDATES_ONLY'){
    assert.deepEqual(indexed.candidates,reference.candidates,
      'index must preserve exact measurements, source wall indices and uncertainty');
    for(const key of ['candidate_count','rejected_tapers','rejected_ambiguous',
                      'possible_pairs','truncated']){
      assert.deepEqual(indexed[key],reference[key],key);
    }
  }else assert.equal(indexed.reason,reference.reason);
  return {reference,indexed};
}
test('spatial index preserves 80 separated thin printing strokes, skipping most pairs',()=>{
  const contours=[];
  for(let row=0;row<8;row++)for(let col=0;col<10;col++)
    contours.push(rectangle(col*6,row*4,2,0.15));
  const {reference,indexed}=equivalent(contours);
  assert.equal(indexed.status,'RESEARCH_CANDIDATES_ONLY');
  assert.equal(indexed.pair_search.mode,'grid');
  assert.equal(reference.pair_search.mode,'reference');
  assert.equal(indexed.pair_search.edges,320);
  assert.equal(indexed.candidates.filter(x=>x.kind==='positive_width_mm').length,80);
  assert.ok(indexed.pair_search.intersection_pair_checks<
    reference.pair_search.intersection_pair_checks*0.15,
    'geometry checks should drop by at least 85% in isolated multi-shape artwork');
  assert.ok(indexed.pair_search.corridor_pair_checks<
    reference.pair_search.corridor_pair_checks*0.2,
    'candidate pairs should drop by at least 80%');
});

test('indexed and exhaustive modes identify identical positive lines and fine negative gaps',()=>{
  const contours=[
    rectangle(0,0,0.2,5),
    rectangle(0.31,0,0.2,5),
    rectangle(1.1,0,0.18,5),
    rectangle(2.7,0,0.15,5),
    rectangle(3,0,0.14,5)
  ];
  const {indexed}=equivalent(contours,{max_candidate_mm:0.3});
  const gaps=indexed.candidates.filter(x=>x.kind==='negative_gap_mm');
  assert.ok(gaps.some(x=>Math.abs(x.measured_mm-0.11)<1e-8));
  assert.ok(gaps.some(x=>Math.abs(x.measured_mm-0.15)<1e-8));
  assert.ok(indexed.candidates.filter(x=>x.kind==='positive_width_mm').length>=4);
});

test('bbox index keeps identical results after rotation, reflection and nonuniform scaling',()=>{
  const shapes=[
    rectangle(0,0,7,0.2),rectangle(0,1.3,7,0.3),
    rectangle(9,0,1.2,6),rectangle(11,0,1.5,6)
  ];
  for(const matrix of [
    [0,1,-1,0,15,15],[-1,0,0,1,15,0],[0.6,0,0,1.4,2,-3],
    [0.8,0.3,-0.3,0.8,5,5]
  ])equivalent(shapes,{matrix_svg_to_mm:matrix,max_candidate_mm:2.5});
});

test('all crossing and touching contours are refused in both modes',()=>{
  for(const contours of [
    [rectangle(0,0,4,4),rectangle(3,3,4,4)],
    [rectangle(0,0,4,4),rectangle(4,0,3,3)],
    [rectangle(0,0,4,4),rectangle(2,0,2,2)],
    [rectangle(0,0,4,4),rectangle(1,1,2,2),rectangle(2,2,2,2)]
  ]){
    const {indexed}=equivalent(contours);
    assert.equal(indexed.status,'MANUAL');
    assert.equal(indexed.reason,'SELF_INTERSECTION_OR_TOUCHING_CONTOURS');
  }
});

test('near-contact even at very small positive distance is not silently omitted',()=>{
  for(const gap of [0,1e-10,1e-8,0.0001,0.01,0.15]){
    const contours=[rectangle(0,0,1,3),rectangle(1+gap,0,1,3)];
    const {indexed}=equivalent(contours);
    if(gap===0)assert.equal(indexed.reason,'SELF_INTERSECTION_OR_TOUCHING_CONTOURS');
  }
});

test('spatial broad phase falls back to exhaustive on pathological index budget',()=>{
  const contours=[rectangle(0,0,10,0.15),rectangle(0,4,10,0.15)];
  const reference=inspectVectorCorridors(options(contours,{pair_index:'reference'}));
  const fallback=inspectVectorCorridors(options(contours,{pair_index:'grid',max_index_links:1}));
  assert.equal(fallback.status,'RESEARCH_CANDIDATES_ONLY');
  assert.equal(fallback.pair_search.mode,'reference_fallback');
  assert.deepEqual(fallback.candidates,reference.candidates);
  assert.equal(fallback.pair_search.intersection_pair_checks,
    reference.pair_search.intersection_pair_checks);
});

test('unrecognized indexing options and unreasonable link budget fail closed',()=>{
  const contours=[rectangle(0,0,10,0.15)];
  assert.equal(inspectVectorCorridors(options(contours,{pair_index:'nearest-k'})).reason,
    'PAIR_INDEX_MODE_INVALID');
  assert.equal(inspectVectorCorridors(options(contours,{max_index_links:0})).reason,
    'SPATIAL_INDEX_BUDGET_INVALID');
  assert.equal(inspectVectorCorridors(options(contours,{max_index_links:Infinity})).reason,
    'SPATIAL_INDEX_BUDGET_INVALID');
});

test('large, deterministic generated artwork preserves every candidate across both algorithms',()=>{
  const contours=[];
  let state=0x6f7a3d;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32};
  for(let row=0;row<5;row++)for(let col=0;col<12;col++){
    const x=col*7+(random()-0.5)*0.2;
    const y=row*5+(random()-0.5)*0.2;
    contours.push(rectangle(x,y,2+random(),0.08+random()*0.5));
  }
  const {indexed}=equivalent(contours,{max_candidate_mm:0.8});
  assert.equal(indexed.candidates.length,60);
  assert.ok(indexed.pair_search.intersection_pair_checks<
    indexed.pair_search.exhaustive_pair_count*0.25);
});
