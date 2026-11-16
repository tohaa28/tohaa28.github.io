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

test('open paths, SVG arcs and unsupported smooth curves return MANUAL',()=>{
  for(const [d,reason] of [
    ['M0 0 L2 0 L2 1','UNCLOSED_SUBPATH'],
    ['M0 0 A3 3 0 0 1 6 0 Z','UNSUPPORTED_SVG_COMMAND'],
    ['M0 0 S1 1 2 2 Z','UNSUPPORTED_SVG_COMMAND'],
    ['M0 0 T1 1 Z','UNSUPPORTED_SVG_COMMAND']
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
  assert.equal(parseClosedSvgPath('M0 0 L1 foo Z').reason,'UNSUPPORTED_SVG_COMMAND');
  assert.equal(parseClosedSvgPath('M0 0 C2 1 4 1 6 0 L6 1 L0 1 Z',
    {flatness_user_units:0.000001,max_segments:3}).status,'MANUAL');
});
