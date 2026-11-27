import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectBinaryMask} from '../vision/geometry/mask-components.mjs';

function bitmap(...rows) {
  const width=rows[0].length,height=rows.length;
  assert.ok(rows.every(row=>row.length===width));
  return {width,height,data:Uint8Array.from(rows.join('').split('').map(x=>x==='#'?1:0))};
}
test('One solid filled square is a component, not a manufactured quality verdict',()=>{
  const r=inspectBinaryMask(bitmap('###','###','###'));
  assert.equal(r.status,'CANDIDATES_ONLY');assert.equal(r.components.length,1);
  assert.equal(r.holes.length,0);assert.equal(r.geometry_proven,false);
  assert.equal(r.components[0].pixels,9);
  assert.deepEqual(r.components[0].bbox_px,{x:0,y:0,width:3,height:3});
});
test('Enclosed unprinted gap is reported as a topology hole, not automatically a defect',()=>{
  const r=inspectBinaryMask(bitmap('#####','#...#','#...#','#...#','#####'));
  assert.equal(r.components.length,1);
  assert.equal(r.holes.length,1);
  assert.equal(r.holes[0].pixels,9);
  assert.equal(r.holes[0].kind,'enclosed_background');
  assert.equal(r.holes[0].touches_edge,false);
});
test('Diagonal foreground touching is one component using 8-connectivity',()=>{
  const r=inspectBinaryMask(bitmap('#.','.#'));
  assert.equal(r.components.length,1);
  assert.equal(r.components[0].pixels,2);
  assert.equal(r.holes.length,0);
});
test('Two detached glyphs remain two separate candidates, not two automatic errors',()=>{
  const r=inspectBinaryMask(bitmap('##..##','##..##'));
  assert.equal(r.components.length,2);
  assert.equal(r.holes.length,0);
  assert.ok(r.warnings.includes('isolated_letters_and_internal_holes_may_be_valid'));
});
test('Physical bounding-box sizes only with proven calibration, never infer stroke width',()=>{
  const b=bitmap('##','##');
  const noScale=inspectBinaryMask(b);
  assert.equal(noScale.components[0].bbox_mm,null);
  const yes=inspectBinaryMask({...b,scale_proven:true,pixel_pitch_x_mm:0.2,pixel_pitch_y_mm:0.15});
  assert.equal(yes.components[0].bbox_mm.width,0.4);
  assert.equal(yes.components[0].bbox_mm.height,0.3);
  assert.equal(yes.components[0].area_mm2,0.12);
  assert.equal(yes.geometry_proven,false);
  assert.ok(yes.warnings.includes('component_bbox_is_not_min_stroke_width'));
});
test('Pixel budget and nonbinary data return MANUAL, never a silent blank result',()=>{
  assert.equal(inspectBinaryMask({width:10,height:10,data:new Uint8Array(100),max_pixels:50}).reason,'PIXEL_BUDGET_EXCEEDED');
  assert.equal(inspectBinaryMask({width:1,height:1,data:new Uint8Array([255])}).reason,'NOT_BINARY');
  assert.equal(inspectBinaryMask({width:1,height:1,data:new Uint8Array([])}).reason,'BINARY_MASK_DIMENSIONS_MISMATCH');
  assert.equal(inspectBinaryMask({width:-1,height:1,data:[1]}).reason,'INVALID_DIMENSIONS');
});
test('Too many components returns INCOMPLETE and never drops a component silently',()=>{
  const r=inspectBinaryMask({...bitmap('#.#.#'),max_components:2});
  assert.equal(r.status,'INCOMPLETE');
  assert.equal(r.components.length,2);
  assert.ok(r.warnings.includes('component_budget_exceeded_incomplete_result'));
});
test('Empty bitmap contains no foreground and no enclosed holes',()=>{
  const r=inspectBinaryMask(bitmap('....','....'));
  assert.equal(r.status,'CANDIDATES_ONLY');assert.equal(r.components.length,0);
  assert.equal(r.holes.length,0);
});
