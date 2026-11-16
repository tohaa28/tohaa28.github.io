import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewTask} from '../vision/dataset/review-task.mjs';
import {compareRegionMethods} from '../vision/dataset/compare-region-methods.mjs';
import {inspectVectorCorridors} from '../vision/geometry/vector-corridors.mjs';
import {inspectCurvedNormalProbes} from '../vision/geometry/curved-normal-probes.mjs';

const h=n=>n.toString(16).padStart(64,'0');
const getTask=()=>createReviewTask({
  image_sha256:h(1),width_px:1000,height_px:1000,
  artwork_sha256:h(2),family_sha256:h(3),technology_code:'UV1',
  annotations:[
    {type:'positive_thin',x:0.1,y:0.1,w:0.2,h:0.2},
    {type:'negative_gap',x:0.6,y:0.6,w:0.2,h:0.2},
    {type:'corner_safe',x:0.35,y:0.4,w:0.1,h:0.1}
  ]
});
const make=(task,overrides={})=>({
  task,
  calibration:{
    state:'research_only',source_image_sha256:task.source.image_sha256,
    artwork_sha256:task.context.artwork_sha256,
    mm_to_image_normalized:[0.01,0,0,0.01,0,0]
  },
  limits_mm:{positive_width_mm:0.15,negative_gap_mm:0.12},
  algorithms:[
    {
      id:'parallel',revision:'C3B2-v1',source_artwork_sha256:h(2),
      report:{status:'RESEARCH_CANDIDATES_ONLY',truncated:false,candidates:[
        {kind:'positive_width_mm',measured_mm:0.10,uncertainty_mm:0.002,at_mm:{x:20,y:20}},
        {kind:'negative_gap_mm',measured_mm:0.14,uncertainty_mm:0.001,at_mm:{x:70,y:70}}
      ]}
    },
    {
      id:'normal',revision:'C3B3D-v1',source_artwork_sha256:h(2),
      report:{status:'RESEARCH_CANDIDATES_ONLY',truncated:false,candidates:[
        {kind:'positive_width_mm',measured_mm:0.14,uncertainty_mm:0.02,at_mm:{x:20,y:20}},
        {kind:'negative_gap_mm',measured_mm:0.09,uncertainty_mm:0.001,at_mm:{x:70,y:70}}
      ]}
    }
  ],
  ...overrides
});

test('two algorithms are compared over identical immutable ROI hashes',async()=>{
  const task=await getTask(),r=compareRegionMethods(make(task));
  assert.equal(r.status,'RESEARCH_PREDICTIONS_ONLY');
  assert.equal(r.production_approved,false);
  assert.equal(r.physical_scale_independently_proven,false);
  const [a,b]=r.results;
  assert.deepEqual(a.predictions.map(x=>x.state),['candidate','none','none']);
  assert.deepEqual(b.predictions.map(x=>x.state),['manual','candidate','none']);
  assert.deepEqual(a.predictions.map(x=>x.region_sha256),
    b.predictions.map(x=>x.region_sha256));
});

test('uncertainty band crossing experimental threshold becomes MANUAL',async()=>{
  const task=await getTask();
  const i=make(task);
  i.algorithms[0].report.candidates[0].measured_mm=0.15;
  i.algorithms[0].report.candidates[0].uncertainty_mm=0.01;
  const r=compareRegionMethods(i);
  assert.equal(r.results[0].predictions[0].state,'manual');
});

test('candidate near the edge of ROI is not silently discarded',async()=>{
  const task=await getTask(),i=make(task);
  // Task region is [0.1,0.3]; 0.1 exactly on the border.
  i.algorithms[0].report.candidates[0].at_mm.x=10;
  const r=compareRegionMethods(i);
  assert.equal(r.results[0].predictions[0].state,'manual');
});

test('unknown page scale or unconfirmed source hashes refuse all comparisons',async()=>{
  const task=await getTask();
  const i=make(task);
  delete i.calibration;
  assert.equal(compareRegionMethods(i).reason,'RESEARCH_COORDINATE_CALIBRATION_REQUIRED');
  const j=make(task);
  j.calibration.source_image_sha256=h(99);
  assert.equal(compareRegionMethods(j).status,'MANUAL');
  const k=make(task);
  k.calibration.mm_to_image_normalized=[0,0,0,0,0,0];
  assert.equal(compareRegionMethods(k).status,'MANUAL');
});
test('same artwork and family provenance is mandatory for paired research',async()=>{
  const task=await getTask(),i=make(task);
  i.algorithms[1].source_artwork_sha256=h(44);
  assert.equal(compareRegionMethods(i).reason,'ALGORITHM_ARTWORK_MISMATCH');
  const missing=await createReviewTask({
    image_sha256:h(1),width_px:1000,height_px:1000,
    annotations:[{type:'other',x:.2,y:.2,w:.1,h:.1}]
  });
  assert.equal(compareRegionMethods(make(missing)).reason,
    'ARTWORK_FAMILY_TECHNOLOGY_CONTEXT_REQUIRED');
});
test('truncation, unsupported algorithms and malformed candidates abstain',async()=>{
  const task=await getTask(),i=make(task);
  i.algorithms[0].report.truncated=true;
  i.algorithms[1].report.candidates[0].at_mm.x=NaN;
  const r=compareRegionMethods(i);
  assert.deepEqual(r.results[0].predictions.map(x=>x.state),
    ['manual','manual','manual']);
  assert.deepEqual(r.results[1].predictions.map(x=>x.state),
    ['manual','manual','manual']);
});
test('only two or more separately named algorithms can be compared',async()=>{
  const task=await getTask(),i=make(task);
  i.algorithms=i.algorithms.slice(0,1);
  assert.equal(compareRegionMethods(i).reason,'AT_LEAST_TWO_DETECTORS_REQUIRED');
  const j=make(task);
  j.algorithms[1].id='parallel';
  assert.equal(compareRegionMethods(j).reason,'ALGORITHM_IDENTITY_INVALID');
});
test('missing or invalid experimental threshold fails closed',async()=>{
  const task=await getTask(),i=make(task);
  i.limits_mm.negative_gap_mm=0;
  assert.equal(compareRegionMethods(i).reason,'EXPERIMENTAL_LIMITS_MM_REQUIRED');
  const j=make(task);
  j.limits_mm.negative_gap_mm=NaN;
  assert.equal(compareRegionMethods(j).reason,'EXPERIMENTAL_LIMITS_MM_REQUIRED');
});
test('measurements equal to threshold are never a confident defect candidate',async()=>{
  const task=await getTask(),i=make(task);
  i.algorithms[0].report.candidates[0].measured_mm=0.15;
  i.algorithms[0].report.candidates[0].uncertainty_mm=0;
  const r=compareRegionMethods(i);
  assert.equal(r.results[0].predictions[0].state,'manual');
});

test('end-to-end real vector engines produce aligned provisional predictions on a synthetic curved ring',async()=>{
  const points=r=>({points:Array.from({length:48},(_,i)=>{
    const t=2*Math.PI*i/48;
    return {x:r*Math.cos(t),y:r*Math.sin(t)};
  })});
  const contours=[points(10),points(9.82)];
  const geometry={
    contours,matrix_svg_to_mm:[1,0,0,1,0,0],
    fill_rule:'evenodd',max_candidate_mm:0.5,
    max_candidates:1000
  };
  const parallel=inspectVectorCorridors(geometry);
  const curved=inspectCurvedNormalProbes(geometry);
  assert.equal(parallel.status,'RESEARCH_CANDIDATES_ONLY');
  assert.equal(curved.status,'RESEARCH_CANDIDATES_ONLY');
  assert.ok(curved.candidates.length>0);
  const task=await createReviewTask({
    image_sha256:h(1),width_px:1200,height_px:1200,
    artwork_sha256:h(2),family_sha256:h(3),technology_code:'UV1',
    annotations:[{type:'positive_thin',x:0.05,y:0.05,w:0.9,h:0.9}]
  });
  const input=make(task,{
    calibration:{
      state:'research_only',
      source_image_sha256:task.source.image_sha256,
      artwork_sha256:task.context.artwork_sha256,
      mm_to_image_normalized:[0.02,0,0,-0.02,0.5,0.5]
    },
    limits_mm:{positive_width_mm:0.25,negative_gap_mm:0.12},
    algorithms:[
      {id:'parallel',revision:'C3B3C',source_artwork_sha256:h(2),report:parallel},
      {id:'normal',revision:'C3B3D',source_artwork_sha256:h(2),report:curved}
    ]
  });
  const result=compareRegionMethods(input);
  assert.equal(result.status,'RESEARCH_PREDICTIONS_ONLY',result.reason);
  assert.equal(result.results.length,2);
  assert.deepEqual(result.results.map(x=>x.predictions[0].region_sha256),
    [task.regions[0].region_sha256,task.regions[0].region_sha256]);
  assert.equal(result.results[1].predictions[0].state,'candidate');
  assert.equal(result.production_approved,false);
});
