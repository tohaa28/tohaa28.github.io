import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSvgTree,parseSvgAffineTransform} from '../vision/geometry/svg-dom-vector-bridge.mjs';

const node=(localName,attrs={},children=[])=>({
  localName,children,
  getAttribute(name){return Object.hasOwn(attrs,name)?String(attrs[name]):null;},
  getAttributeNames(){return Object.keys(attrs)}
});
const svg=(children,extra={})=>node('svg',{
  width:'100mm',height:'100mm',viewBox:'0 0 100 100',...extra
},children);
const path=(d,attrs={})=>node('path',{d,fill:'#aa00ee',...attrs});
const evaluate=(root,options={})=>inspectSvgTree({
  root,matrix_document_mm_to_print_mm:[1,0,0,1,0,0],
  ...options
});
const approx=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,
  'actual '+a+' expected '+b);

test('SVG nested groups can inherit fill and apply physical transforms without inventing production approval',()=>{
  const root=svg([
    node('g',{fill:'#aa00ee',transform:'translate(4,0)'},[
      node('g',{transform:'scale(0.5)'},[
        node('path',{d:'M0 0 H10 V0.3 H0 Z'})
      ])
    ])
  ]);
  const r=evaluate(root);
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY',r.reason);
  assert.equal(r.paths_count,1);
  assert.equal(r.groups_count,2);
  const p=r.candidates.find(x=>x.kind==='positive_width_mm');
  assert.ok(p);
  approx(p.measured_mm,0.15);
  assert.equal(r.print_scale_proven,false);
  assert.equal(r.geometry_proven,false);
});

test('SVG group and path transforms compose in declared order, including rotation about center',()=>{
  const m=parseSvgAffineTransform('translate(10 4) rotate(90)');
  approx(m[0],0);approx(m[1],1);approx(m[2],-1);approx(m[3],0);
  approx(m[4],10);approx(m[5],4);
  const c=parseSvgAffineTransform('rotate(90 5 7)');
  approx(c[0]*5+c[2]*7+c[4],5);
  approx(c[1]*5+c[3]*7+c[5],7);
  assert.deepEqual(parseSvgAffineTransform('scale(2)'),[2,0,0,2,0,0]);
  assert.deepEqual(parseSvgAffineTransform(null),[1,0,0,1,0,0]);
});

test('multiple disjoint same-color SVG paths retain the negative gap',()=>{
  const root=svg([
    path('M0 0 H3 V10 H0 Z'),
    node('g',{transform:'translate(4 0)'},[
      path('M0 0 H3 V10 H0 Z')
    ])
  ]);
  const r=evaluate(root,{max_candidate_mm:1.5});
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY',r.reason);
  assert.equal(r.paths_count,2);
  const gaps=r.candidates.filter(x=>x.kind==='negative_gap_mm');
  assert.ok(gaps.length>0);
  approx(Math.min(...gaps.map(g=>g.measured_mm)),1);
});

test('physical document transform is applied before cross-path comparisons',()=>{
  const root=svg([
    path('M0 0 H3 V10 H0 Z'),
    path('M4 0 H7 V10 H4 Z')
  ]);
  const r=evaluate(root,{
    matrix_document_mm_to_print_mm:[0.5,0,0,0.5,2,3],
    max_candidate_mm:1
  });
  const gaps=r.candidates.filter(x=>x.kind==='negative_gap_mm');
  assert.ok(gaps.length>0);
  approx(Math.min(...gaps.map(g=>g.measured_mm)),0.5);
  assert.equal(r.print_scale_proven,false);
});

test('unknown DOM element or attribute aborts entire conversion without a partial pass',()=>{
  const bads=[
    svg([path('M0 0 H3 V1 H0 Z'),node('text',{},[])]),
    svg([node('defs',{},[path('M0 0 H3 V1 H0 Z')])]),
    svg([path('M0 0 H3 V1 H0 Z',{style:'fill:red'})]),
    svg([node('g',{class:'external-rule'},[path('M0 0 H3 V1 H0 Z')])]),
    svg([path('M0 0 H3 V1 H0 Z',{opacity:0.5})]),
  ];
  for(const root of bads)assert.equal(evaluate(root).status,'MANUAL');
});

test('SVG mixed inks and unsupported stroke/CSS mask cannot be merged',()=>{
  const colors=svg([
    path('M0 0 H3 V1 H0 Z',{fill:'#aa00ee'}),
    path('M4 0 H7 V1 H4 Z',{fill:'#00aaff'})
  ]);
  assert.equal(evaluate(colors).reason,'SVG_DIFFERENT_INKS_REQUIRE_SEPARATION');
  assert.equal(evaluate(svg([
    path('M0 0 H3 V1 H0 Z',{stroke:'#000000'})
  ])).reason,'SVG_STROKE_UNSUPPORTED');
  assert.equal(evaluate(svg([
    path('M0 0 H3 V1 H0 Z',{filter:'url(#fx)'})
  ])).status,'MANUAL');
});

test('overlaps or touching SVG paths are blocked instead of applying wrong global evenodd',()=>{
  const touching=svg([path('M0 0 H3 V3 H0 Z'),path('M3 0 H6 V3 H3 Z')]);
  assert.equal(evaluate(touching).reason,'SVG_PATHS_OVERLAP_OR_PROXIMITY_UNVERIFIED');
  const overlapping=svg([path('M0 0 H4 V4 H0 Z'),path('M3 3 H7 V7 H3 Z')]);
  assert.equal(evaluate(overlapping).status,'MANUAL');
});
test('unsupported SVG transforms, unvalidated documents and absent inks fail closed',()=>{
  assert.equal(parseSvgAffineTransform('skewX(20)'),null);
  assert.equal(parseSvgAffineTransform('translate(NaN 0)'),null);
  assert.equal(parseSvgAffineTransform('scale(0)'),null);
  assert.equal(evaluate(svg([path('M0 0 H3 V1 H0 Z')]),{
    matrix_document_mm_to_print_mm:[0,0,0,0,0,0]
  }).reason,'SVG_EXPLICIT_PRINT_MATRIX_REQUIRED');
  assert.equal(evaluate(svg([node('path',{d:'M0 0 H3 V1 H0 Z'})]))
    .reason,'SVG_EXPLICIT_SOLID_FILL_REQUIRED');
  assert.equal(evaluate(svg([path('M0 0 H3 V1 H0 Z')],{
    width:'100px'
  })).status,'MANUAL');
});
test('viewBox offset is used correctly, without guessing size from CSS pixels',()=>{
  const root=svg([
    path('M-40 -40 H-30 V-39.8 H-40 Z')
  ],{viewBox:'-50 -50 100 100'});
  const r=evaluate(root);
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY');
  const c=r.candidates.find(x=>x.kind==='positive_width_mm');
  assert.ok(c);approx(c.measured_mm,0.2);
  assert.ok(c.at_mm.x>10);
});
test('closed SVG elliptical arcs and smooth curves are accepted inside nested groups',()=>{
  const root=svg([node('g',{fill:'#ff3366',transform:'translate(10,10)'},[
    node('path',{d:'M0 0 L10 0 A10 10 0 0 1 0 10 Z'})
  ])]);
  const r=evaluate(root);
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY',r.reason);
  assert.ok(r.curve_segments>10);
});

test('opt-in curved SVG analysis reports research candidates without changing default production state',()=>{
  const ring=radius=>{
    const points=Array.from({length:48},(_,i)=>{
      const t=i*2*Math.PI/48;
      return [10+radius*Math.cos(t),10+radius*Math.sin(t)];
    });
    return 'M'+points.map((p,i)=>i===0?p.join(' '):'L'+p.join(' ')).join(' ')+' Z';
  };
  const root=svg([path(ring(6)+' '+ring(5.82),{'fill-rule':'evenodd'})]);
  const normal=evaluate(root,{include_curved_probes:true,max_candidate_mm:0.4});
  assert.equal(normal.status,'RESEARCH_CANDIDATES_ONLY',normal.reason);
  assert.equal(normal.curved_probes.status,'RESEARCH_CANDIDATES_ONLY');
  assert.ok(normal.curved_probes.candidates.some(c=>
    c.kind==='positive_width_mm'&&Math.abs(c.measured_mm-0.18)<0.03));
  assert.equal(normal.print_scale_proven,false);
  assert.equal(normal.curved_probes.geometry_proven,false);
  const defaultResult=evaluate(root,{max_candidate_mm:0.4});
  assert.ok(!Object.hasOwn(defaultResult,'curved_probes'),
    'curve analysis must remain strictly opt-in');
});
