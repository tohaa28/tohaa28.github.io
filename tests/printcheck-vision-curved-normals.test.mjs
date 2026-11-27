import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCurvedNormalProbes} from '../vision/geometry/curved-normal-probes.mjs';

const defaultArgs={matrix_svg_to_mm:[1,0,0,1,0,0],fill_rule:'evenodd'};
const probe=(contours,other={})=>inspectCurvedNormalProbes({contours,...defaultArgs,...other});
function circle(radius,centerX=0,centerY=0,count=64){
  return {points:Array.from({length:count},(_,i)=>{
    const t=Math.PI*2*i/count;
    return {x:centerX+radius*Math.cos(t),y:centerY+radius*Math.sin(t)};
  })};
}
function curvedRibbon(w=0.16,offsetY=1,count=22){
  const pts=[];
  for(let i=0;i<count;i++){
    const x=i*0.4, y=offsetY+0.18*Math.sin(x/2);
    pts.push({x,y});
  }
  for(let i=count-1;i>=0;i--){
    const x=i*0.4,y=offsetY+0.18*Math.sin(x/2)+w;
    pts.push({x,y});
  }
  return {points:pts};
}
test('concentric annulus has stable nonzero local curved positive width in mm',()=>{
  const r=probe([circle(10),circle(9.82)],{
    max_candidate_mm:0.5,min_support_mm:0.3
  });
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY',r.reason);
  const widths=r.candidates.filter(c=>c.kind==='positive_width_mm');
  assert.ok(widths.length>=8,'expected multiple supported curved edges');
  assert.ok(widths.some(c=>Math.abs(c.measured_mm-0.18)<0.03));
  assert.equal(r.geometry_proven,false);
  assert.equal(r.print_scale_proven,false);
  assert.ok(r.warnings.some(s=>s.includes('not_exact_medial_axis')));
});
test('physical scale transforms curved width before any candidate is produced',()=>{
  const r=probe([circle(10),circle(9.82)],{
    matrix_svg_to_mm:[0.5,0,0,0.5,5,9],
    max_candidate_mm:0.3,min_support_mm:0.2
  });
  const positives=r.candidates.filter(c=>c.kind==='positive_width_mm');
  assert.ok(positives.length>0);
  assert.ok(positives.some(c=>Math.abs(c.measured_mm-0.09)<0.02));
  assert.ok(positives.every(c=>c.scale_proven===false));
});
test('curved sine ribbon reveals thin stable printed region',()=>{
  const r=probe([curvedRibbon()],{
    max_candidate_mm:0.4,min_support_mm:0.4
  });
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY',r.reason);
  const good=r.candidates.filter(c=>c.kind==='positive_width_mm');
  assert.ok(good.length>3,'expected stable supported curved wall');
  assert.ok(good.some(c=>Math.abs(c.measured_mm-0.16)<0.025));
});
test('normal probes can also identify empty space separating curved ink ribbons',()=>{
  const contours=[curvedRibbon(0.17,1),curvedRibbon(0.17,1.4)];
  const r=probe(contours,{max_candidate_mm:0.6,min_support_mm:0.4});
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY',r.reason);
  const empty=r.candidates.filter(c=>c.kind==='negative_gap_mm');
  assert.ok(empty.length>2,'expected negative gap between parallel curved objects');
  assert.ok(empty.some(c=>Math.abs(c.measured_mm-0.23)<0.04));
});
test('a thin acute triangular serif tip is NOT automatically flagged',()=>{
  const tri={points:[{x:0,y:0},{x:12,y:0},{x:0,y:0.11}]};
  const r=probe([tri],{max_candidate_mm:0.3});
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY',r.reason);
  assert.equal(r.candidates.length,0);
});
test('sharp polygon corners do not meet support window angle',()=>{
  const sq={points:[{x:0,y:0},{x:5,y:0},{x:5,y:0.16},{x:0,y:0.16}]};
  const r=probe([sq]);
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY');
  assert.equal(r.candidates.length,0);
});
test('curved candidates never authorize a production technology verdict',()=>{
  const r=probe([circle(10),circle(9.82)],{max_candidate_mm:0.4});
  assert.equal(r.print_scale_proven,false);
  assert.ok(r.candidates.every(c=>c.geometry_proven===false));
  assert.ok(r.candidates.every(c=>c.warning.includes('not medial axis')));
});
test('self intersecting, touching contours must fail-closed before normal probes',()=>{
  const a={points:[{x:0,y:0},{x:5,y:5},{x:5,y:0},{x:0,y:5}]};
  const r=probe([a]);
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'NORMAL_PROBE_CONTOUR_PREFLIGHT_FAILED');
});
test('untrusted matrix, unknown fill and impossible budget return MANUAL',()=>{
  const ribbon=curvedRibbon();
  for(const options of [
    {matrix_svg_to_mm:undefined},{matrix_svg_to_mm:[0,0,0,0,0,0]},
    {fill_rule:'nonzero'},{max_segments:5},{max_candidate_mm:0},
    {min_support_mm:-1},{max_turn_degrees:100},{curve_flatness_mm:1}
  ]){
    assert.equal(probe([ribbon],options).status,'MANUAL');
  }
});
test('no global acceptance even if the candidate budget truncates a rich annulus',()=>{
  const r=probe([circle(10),circle(9.82)],{
    max_candidate_mm:0.4,max_candidates:2
  });
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY');
  assert.equal(r.candidates.length,2);
  assert.equal(r.truncated,true);
  assert.ok(r.total_candidate_count>2);
  assert.ok(r.warnings.includes('truncated_candidates_require_manual_review'));
});
