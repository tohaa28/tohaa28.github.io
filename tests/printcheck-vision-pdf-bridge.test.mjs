import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectConvertedPdfVectors} from '../vision/geometry/pdfjs-vector-bridge.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const PT_MM=25.4/72;
const PDF_VIEW=[2,0,0,-2,0,500];
const shape=(d,extra={})=>({
 d,fill:'#0044cc',stroke:'none',
 transform:'matrix(2 0 0 -2 0 500)',...extra
});
const payload=(d,context={})=>({
 converted:{width:400,height:500,shapes:[shape(d)]},
 viewport_transform:PDF_VIEW,
 page_to_print_mm:[PT_MM,0,0,PT_MM,0,0],
 ...context
});
const near=(actual,expected,tol=1e-8)=>assert.ok(Math.abs(actual-expected)<tol,
  'expected '+actual+' ≈ '+expected);

test('PDF points become exact millimetre local width after viewport inversion',()=>{
  const r=inspectConvertedPdfVectors(payload('M0 0 H36 V0.4 H0 Z'));
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY',r.reason);
  assert.equal(r.origin,'gwbImportPdfVector.convert / PDFjs operator list');
  const c=r.candidates.find(c=>c.kind==='positive_width_mm');
  assert.ok(c);near(c.measured_mm,0.4*PT_MM);
  near(c.local_support_mm,36*PT_MM);
  assert.equal(r.print_scale_proven,false);
  assert.equal(r.geometry_proven,false);
});

test('Placement reduction to half size affects PDF measure',()=>{
  const r=inspectConvertedPdfVectors(payload('M0 0 H36 V0.4 H0 Z',{
    page_to_print_mm:[PT_MM/2,0,0,PT_MM/2,0,0]
  }));
  const c=r.candidates.find(c=>c.kind==='positive_width_mm');
  near(c.measured_mm,0.2*PT_MM);
});

test('PDF viewport rotation and translation are not mistaken for physical scale',()=>{
  const result=inspectConvertedPdfVectors({
    converted:{width:200,height:300,shapes:[shape('M0 0 H36 V0.4 H0 Z',{
      transform:'matrix(0 2 2 0 180 250)'
    })]},
    viewport_transform:[0,2,2,0,180,250],
    page_to_print_mm:[PT_MM,0,0,PT_MM,0,0]
  });
  const c=result.candidates.find(c=>c.kind==='positive_width_mm');
  assert.ok(c);near(c.measured_mm,0.4*PT_MM);
});

test('PDF internal graphics CTM is respected after removal of PDFjs viewport',()=>{
  const result=inspectConvertedPdfVectors({
    converted:{width:100,height:100,shapes:[shape('M0 0 H10 V0.2 H0 Z',{
      transform:'matrix(4 0 0 -4 0 500)'
    })]},
    viewport_transform:PDF_VIEW,
    page_to_print_mm:[PT_MM,0,0,PT_MM,0,0]
  });
  const c=result.candidates.find(c=>c.kind==='positive_width_mm');
  assert.ok(c);near(c.measured_mm,0.4*PT_MM);
});

test('One evenodd painted compound path contains a negative hole corridor',()=>{
  const s=shape('M0 0 H25 V25 H0 Z M10 10 H12 V12 H10 Z',{
    'fill-rule':'evenodd'
  });
  const r=inspectConvertedPdfVectors({
    ...payload('M0 0 H25 V25 H0 Z'),
    converted:{width:400,height:500,shapes:[s]},
    max_candidate_mm:1
  });
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY');
  assert.ok(r.candidates.some(c=>c.kind==='negative_gap_mm'));
});

test('Strokes, gradients, blend effects and PDF multiple paints never silently disappear',()=>{
  for(const item of [
    shape('M0 0 H10 V0.4 H0 Z',{stroke:'#000000'}),
    shape('M0 0 H10 V0.4 H0 Z',{fill:'none'}),
    shape('M0 0 H10 V0.4 H0 Z',{fill:'url(#grad)'}),
    shape('M0 0 H10 V0.4 H0 Z',{opacity:0.5}),
    shape('M0 0 H10 V0.4 H0 Z',{'clip-path':'url(#c)'})
  ]){
    const r=inspectConvertedPdfVectors(payload('M0 0 H10 V0.4 H0 Z',{
      converted:{width:400,height:500,shapes:[item]}
    }));
    assert.equal(r.status,'MANUAL');
  }
  const multi=inspectConvertedPdfVectors(payload('M0 0 H10 V0.4 H0 Z',{
    converted:{width:400,height:500,shapes:[
      shape('M0 0 H10 V0.4 H0 Z'),shape('M1 2 H10 V2.4 H1 Z')
    ]}
  }));
  assert.equal(multi.status,'RESEARCH_CANDIDATES_ONLY',multi.reason);
  assert.equal(multi.painted_shapes_count,2);
});

test('Unvalidated nonzero compound fill must not be reinterpreted as evenodd',()=>{
  const r=inspectConvertedPdfVectors(payload('M0 0 H10 V10 H0 Z M2 2 H8 V8 H2 Z'));
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'PDF_COMPLEX_FILL_RULE_UNSUPPORTED');
});

test('Missing page matrix or degenerate viewport must reject PDF scale',()=>{
  for(const change of [
    {viewport_transform:[0,0,0,0,0,0]},
    {viewport_transform:undefined},
    {page_to_print_mm:undefined},
    {page_to_print_mm:[0,0,0,0,0,0]}
  ]){
    const r=inspectConvertedPdfVectors(payload('M0 0 H10 V0.4 H0 Z',change));
    assert.equal(r.status,'MANUAL');
  }
});

test('Malformed and unsupported PDF shape path is not converted to empty geometry',()=>{
  for(const d of ['M0 0 A1 1 0 0 1 4 4 Z','M0 0 L4 0','M0 0 C12 10']){
    const r=inspectConvertedPdfVectors(payload(d));
    assert.equal(r.status,'MANUAL');
    assert.equal(r.reason,'PDF_VECTOR_PATH_UNSUPPORTED');
  }
});

test('PDF shape has to carry a finite affine transformation',()=>{
  for(const transform of [
    undefined,'matrix(1 0 0 0 0 0)', 'translate(5 7)', 'matrix(1 0 0 bad 0 0)'
  ]){
    const r=inspectConvertedPdfVectors(payload('M0 0 H10 V0.4 H0 Z',{
      converted:{width:400,height:500,shapes:[shape('M0 0 H10 V0.4 H0 Z',{transform})]}
    }));
    assert.equal(r.status,'MANUAL');
  }
});


test('integration: existing Maketnaya PDF.js 5.x operator converter produces genuine vector path data for bridge',()=>{
  const script=readFileSync(new URL('../assets/logo-pdf-import.js',import.meta.url),'utf8');
  const sandbox={window:{}};
  runInNewContext(script,sandbox);
  const converter=sandbox.window.gwbImportPdfVector;
  assert.equal(typeof converter.convert,'function');
  // Compressed PDF.js shape commands: 0 move, 1 line, 4 close.
  const ops=[{name:'constructPath',
    args:['fill',[Float32Array.from([
      0,0,0, 1,36,0, 1,36,0.4, 1,0,0.4, 4
    ])]]
  }];
  const converted=converter.convert({
    width:400,height:500,transform:PDF_VIEW,ops
  });
  assert.equal(converted.shapes.length,1);
  assert.match(converted.shapes[0].d,/^M/);
  const r=inspectConvertedPdfVectors({
    converted,viewport_transform:PDF_VIEW,
    page_to_print_mm:[PT_MM,0,0,PT_MM,0,0]
  });
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY',r.reason);
  const item=r.candidates.find(c=>c.kind==='positive_width_mm');
  assert.ok(item);
  near(item.measured_mm,0.4*PT_MM,0.0001);
});

test('integration: existing importer refuses PDF text/effects instead of providing incomplete trace',()=>{
  const script=readFileSync(new URL('../assets/logo-pdf-import.js',import.meta.url),'utf8');
  const sandbox={window:{}};
  runInNewContext(script,sandbox);
  const converter=sandbox.window.gwbImportPdfVector;
  const ops=[
    {name:'constructPath',args:['fill',[Float32Array.from([
      0,0,0, 1,36,0, 1,36,0.4, 1,0,0.4, 4
    ])]]},
    {name:'showText',args:[['not-converted-to-curves']]}
  ];
  assert.throws(()=>converter.convert({
    width:400,height:500,transform:PDF_VIEW,ops
  }),/Нередактируемый текст PDF/);
});


test('multiple same-ink PDF paint operations retain a measurable negative gap',()=>{
  const r=inspectConvertedPdfVectors(payload('M0 0 H3 V10 H0 Z',{
    converted:{width:400,height:500,shapes:[
      shape('M0 0 H3 V10 H0 Z'),
      shape('M4 0 H7 V10 H4 Z',{fill:'#0044CC'})
    ]},
    max_candidate_mm:0.6
  }));
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY',r.reason);
  assert.equal(r.painted_shapes_count,2);
  const gap=r.candidates.filter(x=>x.kind==='negative_gap_mm');
  assert.ok(gap.length>=1,'missing gap between separate printed areas');
  near(Math.min(...gap.map(x=>x.measured_mm)),PT_MM,0.00001);
  assert.equal(r.print_scale_proven,false);
});
test('overlapping bounding boxes force MANUAL even for same ink and disjoint true shapes',()=>{
  const r=inspectConvertedPdfVectors(payload('M0 0 H5 V5 H0 Z',{
    converted:{width:400,height:500,shapes:[
      shape('M0 0 H5 V5 H0 Z'),shape('M4 4 H10 V10 H4 Z')
    ]}
  }));
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'PDF_PAINTS_OVERLAP_OR_PROXIMITY_UNVERIFIED');
});
test('different PDF paint colors need color separation: never combine by odd/even parity',()=>{
  const r=inspectConvertedPdfVectors(payload('M0 0 H3 V5 H0 Z',{
    converted:{width:400,height:500,shapes:[
      shape('M0 0 H3 V5 H0 Z',{fill:'#ff0000'}),
      shape('M5 0 H8 V5 H5 Z',{fill:'#0000ff'})
    ]}
  }));
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'PDF_DIFFERENT_INKS_REQUIRE_SEPARATION');
});
test('multi-paint PDF shape opacity or unsupported shape property is blocked',()=>{
  const r=inspectConvertedPdfVectors(payload('M0 0 H3 V5 H0 Z',{
    converted:{width:400,height:500,shapes:[
      shape('M0 0 H3 V5 H0 Z'),shape('M5 0 H8 V5 H5 Z',{'fill-opacity':0.5})
    ]}
  }));
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'PDF_EFFECTS_OR_CLIPPING_UNSUPPORTED');
});
test('zero-distance touching contours are not treated as safe separate paint operations',()=>{
  const r=inspectConvertedPdfVectors(payload('M0 0 H3 V5 H0 Z',{
    converted:{width:400,height:500,shapes:[
      shape('M0 0 H3 V5 H0 Z'),shape('M3 0 H6 V5 H3 Z')
    ]}
  }));
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'PDF_PAINTS_OVERLAP_OR_PROXIMITY_UNVERIFIED');
});
test('integration: legacy PDF converter emits separate fill operations with same ink',()=>{
  const script=readFileSync(new URL('../assets/logo-pdf-import.js',import.meta.url),'utf8');
  const sandbox={window:{}};
  runInNewContext(script,sandbox);
  const draw=(x)=>({
    name:'constructPath',
    args:['fill',[Float32Array.from([
      0,x,0, 1,x+3,0, 1,x+3,10, 1,x,10, 4
    ])]]
  });
  const converter=sandbox.window.gwbImportPdfVector;
  const converted=converter.convert({
    width:400,height:500,transform:PDF_VIEW,
    ops:[draw(0),draw(4)]
  });
  assert.equal(converted.shapes.length,2);
  const r=inspectConvertedPdfVectors({
    converted,viewport_transform:PDF_VIEW,
    page_to_print_mm:[PT_MM,0,0,PT_MM,0,0],max_candidate_mm:0.6
  });
  assert.equal(r.status,'RESEARCH_CANDIDATES_ONLY',r.reason);
  assert.equal(r.painted_shapes_count,2);
  assert.ok(r.candidates.some(x=>x.kind==='negative_gap_mm'));
});
