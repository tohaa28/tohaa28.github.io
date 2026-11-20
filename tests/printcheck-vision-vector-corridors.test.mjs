import test from 'node:test';
import assert from 'node:assert/strict';
import {parseClosedSvgPath} from '../vision/geometry/svg-path-subset.mjs';
import {inspectVectorCorridors} from '../vision/geometry/vector-corridors.mjs';
import {evaluateMeasurement} from '../vision/rules/resolver.mjs';
import {readFileSync} from 'node:fs';

const passPath=(d,settings={})=>{
  const r=parseClosedSvgPath(d,settings);
  assert.equal(r.status,'CONTOURS_ONLY',JSON.stringify(r));
  return r;
};
const inspect=(d,options={})=>{
  const parsed=passPath(d);
  return inspectVectorCorridors({
    contours:parsed.contours,
    matrix_svg_to_mm:[1,0,0,1,0,0],
    fill_rule:'evenodd',
    ...options
  });
};
const near=(value,expected,tolerance=1e-7)=>assert.ok(Math.abs(value-expected)<=tolerance,
  'expected '+value+' to equal '+expected+' ± '+tolerance);

test('real SVG path-data M/H/V/Z rectangle yields a positive local width in mm',()=>{
  const r=inspect('M0 0 H8 V0.15 H0 Z');
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY');
  assert.equal(r.print_scale_proven,false);
  assert.equal(r.geometry_proven,false);
  const positive=r.candidates.filter(x=>x.kind==='positive_width_mm');
  assert.equal(positive.length,1);
  near(positive[0].measured_mm,0.15);
  near(positive[0].local_support_mm,8);
  assert.equal(positive[0].uncertainty_mm,0);
});

test('actual placement affine scale changes mm, not just SVG document viewBox',()=>{
  const r=inspect('M0 0 H8 V0.3 H0 Z',{matrix_svg_to_mm:[0.5,0,0,0.5,12,18]});
  const x=r.candidates.find(x=>x.kind==='positive_width_mm');
  near(x.measured_mm,0.15);
  near(x.local_support_mm,4);
  near(x.at_mm.x,14);
  near(x.at_mm.y,18.075);
  assert.equal(x.scale_proven,false);
});

test('translation and rotation keep physical width invariant',()=>{
  const r=inspect('M0 0 H5 V0.18 H0 Z',{matrix_svg_to_mm:[0,1,-1,0,10,20]});
  const x=r.candidates.find(x=>x.kind==='positive_width_mm');
  near(x.measured_mm,0.18);
  near(x.local_support_mm,5);
});

test('two nonintersecting ink islands expose a local negative gap candidate',()=>{
  const r=inspect('M0 0 H1 V3 H0 Z M1.2 0 H2.2 V3 H1.2 Z',{
    max_candidate_mm:0.5
  });
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY');
  const negatives=r.candidates.filter(x=>x.kind==='negative_gap_mm');
  assert.ok(negatives.length>0);
  near(Math.min(...negatives.map(x=>x.measured_mm)),0.2);
  assert.equal(r.geometry_proven,false);
});

test('full closed ring with hole: inner negative aperture is NOT a foreground stroke',()=>{
  const r=inspect('M0 0 H6 V5 H0 Z M2.5 2 H3.5 V3 H2.5 Z',{max_candidate_mm:2});
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY');
  assert.ok(r.candidates.some(c=>c.kind==='negative_gap_mm'));
});

test('acute triangular tip has no parallel-wall measurement and is not automatically a defect',()=>{
  const r=inspect('M0 0 L10 0 L0 0.13 Z');
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY');
  assert.equal(r.candidates.filter(c=>c.kind==='positive_width_mm').length,0);
  assert.ok(r.warnings.includes('cannot_mark_artwork_as_passed'));
});

test('genuine angled tapered wall is excluded instead of inventing a fixed width',()=>{
  const r=inspect('M0 0 L8 0 L8 0.50 L0 0.15 Z',{angle_tolerance_degrees:5});
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY');
  assert.ok(r.rejected_tapers>0);
  assert.equal(r.candidates.some(c=>c.kind==='positive_width_mm'&&c.measured_mm<0.5),false);
});

test('overlapping vector contours are refused rather than misread as knockout',()=>{
  const r=inspect('M0 0 H3 V3 H0 Z M2 2 H4 V4 H2 Z');
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'SELF_INTERSECTION_OR_TOUCHING_CONTOURS');
});

test('open paths, malformed arcs and unknown path commands return MANUAL',()=>{
  for(const [d,reason] of [
    ['M0 0 L2 0 L2 1','UNCLOSED_SUBPATH'],
    ['M0 0 A3 3 0 2 1 6 0 Z','SVG_ARC_PARAMETERS_INVALID'],
    ['M0 0 R1 1 2 2 Z','UNSUPPORTED_SVG_COMMAND'],
    ['M0 0 P1 1 Z','UNSUPPORTED_SVG_COMMAND']
  ])assert.equal(parseClosedSvgPath(d).reason,reason);
});

test('relative and repeated coordinates in path syntax produce closed contours',()=>{
  const r=passPath('m 0,0 l 4,0 0,0.1 -4,0 z');
  assert.equal(r.contours.length,1);
  assert.equal(r.contours[0].points.length,4);
  const measurement=inspectVectorCorridors({
    contours:r.contours,matrix_svg_to_mm:[1,0,0,1,0,0],fill_rule:'evenodd'
  });
  near(measurement.candidates[0].measured_mm,0.1);
});

test('Bezier is adaptively flattened with nonzero uncertainty budget',()=>{
  const p=passPath('M0 0 C2 0.1 4 0.1 6 0 L6 0.3 H0 Z',{flatness_user_units:0.002});
  assert.ok(p.curve_segments>1);
  assert.ok(p.contours[0].points.length>4);
  const r=inspectVectorCorridors({
    contours:p.contours,matrix_svg_to_mm:[1,0,0,1,0,0],
    fill_rule:'evenodd',curve_flatness_mm:0.002
  });
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY');
});

test('collinear cubic overshoot must not disappear during adaptive flattening',()=>{
  const r=passPath('M0 0 C4 0 -2 0 1 0 L1 1 L0 1 Z',
    {flatness_user_units:0.001});
  assert.ok(r.contours[0].points.length>4);
});

test('nested paths are not assumed printed unless caller explicitly certifies evenodd fill',()=>{
  const parsed=passPath('M0 0 H4 V0.1 H0 Z');
  const r=inspectVectorCorridors({
    contours:parsed.contours,matrix_svg_to_mm:[1,0,0,1,0,0]
  });
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'EXPLICIT_EVENODD_FILL_REQUIRED');
});

test('unknown scale, singular transform and nonfinite coordinates fail closed',()=>{
  const parsed=passPath('M0 0 H4 V0.1 H0 Z');
  for(const matrix of [undefined,[0,0,0,0,0,0],[NaN,0,0,1,0,0],[1,0,0,1,0]]){
    const r=inspectVectorCorridors({
      contours:parsed.contours,matrix_svg_to_mm:matrix,fill_rule:'evenodd'
    });
    assert.equal(r.status,'MANUAL');
  }
  assert.equal(inspectVectorCorridors({
    contours:[{points:[{x:0,y:0},{x:1,y:0},{x:NaN,y:1}]}],
    matrix_svg_to_mm:[1,0,0,1,0,0],fill_rule:'evenodd'
  }).reason,'INVALID_COORDINATE');
});

test('unsafe huge input and unresolved component budget fail closed',()=>{
  const r=inspect('M0 0 H4 V0.1 H0 Z',{max_segments:3});
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'EDGE_BUDGET_EXCEEDED');
  const x=inspect('M0 0 H4 V0.1 H0 Z',{max_candidates:0});
  assert.equal(x.status,'MANUAL');
});

test('local candidates cannot be passed as certified geometry into production rules',()=>{
  const registry=JSON.parse(readFileSync(new URL('../vision/rules/technology.v1.json',import.meta.url),'utf8'));
  const candidate=inspect('M0 0 H4 V0.14 H0 Z').candidates[0];
  const result=evaluateMeasurement(registry,{
    technology:'UV1',dimension:'positive_width_mm',
    measured:candidate.measured_mm,
    geometry_proven:candidate.geometry_proven,
    scale_proven:candidate.scale_proven,
    research_mode:true,features:{soft_touch:false}
  });
  assert.equal(result.status,'MANUAL');
  assert.equal(result.reason,'PHYSICAL_SCALE_NOT_PROVEN');
});

test('empty shape data, unsupported tokens, and curve budget return explicit failures',()=>{
  assert.equal(parseClosedSvgPath('').reason,'EMPTY_PATH');
  assert.equal(parseClosedSvgPath('M0 0 L1 foo Z').reason,'MISSING_PATH_ARGUMENT');
  assert.equal(parseClosedSvgPath('M0 0 C2 1 4 1 6 0 L6 1 L0 1 Z',
    {flatness_user_units:0.000001,max_segments:3}).status,'MANUAL');
});


test('SVG smooth S and T preserve reflected curve controls with explicit and relative syntax',()=>{
  for(const data of [
    'M0 0 C1 2 2 2 3 0 S5 -2 6 0 L6 1 L0 1 Z',
    'M0 0 C1 2 2 2 3 0 s2 -2 3 0 L6 1 L0 1 Z',
    'M0 0 Q1 2 2 0 T4 0 L4 1 L0 1 Z',
    'M0 0 Q1 2 2 0 t2 0 L4 1 L0 1 Z',
  ]){
    const result=parseClosedSvgPath(data);
    assert.equal(result.status,'CONTOURS_ONLY',data);
    assert.ok(result.curve_segments>2,data);
  }
});

test('smooth S after a line resets old cubic reflection',()=>{
  const a=parseClosedSvgPath('M0 0 L1 0 S2 1 3 1 L3 2 L0 2 Z');
  const b=parseClosedSvgPath('M0 0 L1 0 C1 0 2 1 3 1 L3 2 L0 2 Z');
  assert.equal(a.status,'CONTOURS_ONLY');
  assert.deepEqual(a.contours,b.contours);
});
test('smooth T after a line resets old quadratic reflection',()=>{
  const a=parseClosedSvgPath('M0 0 L1 0 T3 1 L3 2 L0 2 Z');
  const b=parseClosedSvgPath('M0 0 L1 0 Q1 0 3 1 L3 2 L0 2 Z');
  assert.equal(a.status,'CONTOURS_ONLY');
  assert.deepEqual(a.contours,b.contours);
});


test('SVG elliptical arcs A/a preserve endpoint and closed path geometry',()=>{
  const abs=parseClosedSvgPath('M0 0 L10 0 A10 10 0 0 1 0 10 Z',{flatness_user_units:0.002});
  const rel=parseClosedSvgPath('m0 0 l10 0 a10 10 0 0 1 -10 10 z',{flatness_user_units:0.002});
  assert.equal(abs.status,'CONTOURS_ONLY',abs.reason);
  assert.equal(rel.status,'CONTOURS_ONLY',rel.reason);
  assert.ok(abs.contours[0].points.length>20);
  assert.deepEqual(abs.contours,rel.contours);
  const pts=abs.contours[0].points;
  assert.deepEqual(pts[0],{x:0,y:0});
  assert.deepEqual(pts[1],{x:10,y:0});
  assert.deepEqual(pts.at(-1),{x:0,y:10});
});
test('SVG circular-arc adaptive flatten stays under requested error budget',()=>{
  const epsilon=0.002,radius=10;
  const result=parseClosedSvgPath('M0 0 L10 0 A10 10 0 0 1 0 10 Z',
    {flatness_user_units:epsilon});
  assert.equal(result.status,'CONTOURS_ONLY');
  const points=result.contours[0].points;
  for(let i=2;i<points.length-1;i++){
    const p=points[i],q=points[i+1];
    const theta=(Math.atan2(p.y,p.x)+Math.atan2(q.y,q.x))/2;
    const midpoint={x:(p.x+q.x)/2,y:(p.y+q.y)/2};
    const ideal={x:radius*Math.cos(theta),y:radius*Math.sin(theta)};
    const err=Math.hypot(midpoint.x-ideal.x,midpoint.y-ideal.y);
    assert.ok(err<=epsilon+1e-8, 'arc deviation exceeded: '+err);
  }
});
test('rotated ellipse, large arc and relative endpoint are not dropped',()=>{
  for(const d of [
    'M0 0 L8 0 A5 3 30 1 1 0 8 Z',
    'm0 0 l8 0 a5 3 30 1 1 -8 8 z'
  ]){
    const r=parseClosedSvgPath(d,{flatness_user_units:0.003});
    assert.equal(r.status,'CONTOURS_ONLY',r.reason);
    assert.ok(r.curve_segments>4);
  }
});
test('degenerate arcs and insufficient resolution explicitly fail closed',()=>{
  for(const d of [
    'M0 0 L10 0 A-10 10 0 0 1 0 10 Z',
    'M0 0 L10 0 A0 10 0 0 1 0 10 Z',
    'M0 0 L10 0 A10 10 0 1 4 0 10 Z',
    'M0 0 L10 0 A10 10 0 1 1 10 0 Z'
  ]){
    const r=parseClosedSvgPath(d);
    assert.equal(r.status,'MANUAL',d);
  }
  const budget=parseClosedSvgPath('M0 0 L1000 0 A1000 1000 0 0 1 0 1000 Z',
    {flatness_user_units:0.00001,max_segments:25});
  assert.equal(budget.status,'MANUAL');
  assert.match(budget.reason,/BUDGET/);
});
