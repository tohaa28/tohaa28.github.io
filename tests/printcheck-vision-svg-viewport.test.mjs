import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSvgDocumentViewport} from '../vision/geometry/svg-viewport.mjs';

const root=attrs=>({localName:'svg',getAttribute:name=>attrs[name]??null});
test('Explicit mm viewport resolves the SVG coordinate system but not print placement',()=>{
  const r=inspectSvgDocumentViewport(root({width:'100mm',height:'50mm',viewBox:'0 0 100 50'}));
  assert.equal(r.status,'DOCUMENT_COORDINATES_ONLY');
  assert.equal(r.svg_units_to_mm,1);
  assert.equal(r.svg_document_scale_proven,true);
  assert.equal(r.print_scale_proven,false);
  assert.equal(r.width_mm,100);assert.equal(r.height_mm,50);
});
test('cm, inch and pt are explicit physical units',()=>{
  const cm=inspectSvgDocumentViewport(root({width:'10cm',height:'5cm',viewBox:'0 0 100 50'}));
  assert.equal(cm.status,'DOCUMENT_COORDINATES_ONLY');assert.equal(cm.svg_units_to_mm,1);
  const inch=inspectSvgDocumentViewport(root({width:'1in',height:'25.4mm',viewBox:'0 0 72 72'}));
  assert.equal(inch.status,'DOCUMENT_COORDINATES_ONLY');
  assert.ok(Math.abs(inch.svg_units_to_mm-(25.4/72))<1e-10);
  const pt=inspectSvgDocumentViewport(root({width:'72pt',height:'72pt',viewBox:'0 0 72 72'}));
  assert.equal(pt.status,'DOCUMENT_COORDINATES_ONLY');
  assert.ok(Math.abs(pt.svg_units_to_mm-(25.4/72))<1e-10);
});
test('CSS px, unitless and percentage viewports are not physical proof',()=>{
  for(const width of ['100','100px','100%','auto','10ex']){
    const r=inspectSvgDocumentViewport(root({width,height:'50mm',viewBox:'0 0 100 50'}));
    assert.equal(r.status,'MANUAL');
    assert.equal(r.reason,'SVG_EXPLICIT_PHYSICAL_SIZE_REQUIRED');
  }
});
test('Unverified root CSS, transforms and nonuniform scale are blocked',()=>{
  for(const props of [{style:'width:200mm'},{class:'logo'},{transform:'scale(2)'}]){
    const r=inspectSvgDocumentViewport(root({width:'100mm',height:'50mm',viewBox:'0 0 100 50',...props}));
    assert.equal(r.reason,'SVG_ROOT_STYLE_OR_TRANSFORM_UNVERIFIED');
  }
  assert.equal(inspectSvgDocumentViewport(root({width:'100mm',height:'50mm',viewBox:'0 0 300 100'})).reason,
    'SVG_NONUNIFORM_OR_LETTERBOX_SCALE');
});
test('Invalid viewBox, wrong root and unsupported preserveAspectRatio fail closed',()=>{
  assert.equal(inspectSvgDocumentViewport(root({width:'100mm',height:'50mm'})).reason,'SVG_VIEWBOX_REQUIRED');
  assert.equal(inspectSvgDocumentViewport(root({width:'100mm',height:'50mm',viewBox:'0 0 0 1'})).reason,'SVG_VIEWBOX_INVALID');
  assert.equal(inspectSvgDocumentViewport(root({width:'100mm',height:'50mm',viewBox:'oops'})).reason,'SVG_VIEWBOX_INVALID');
  assert.equal(inspectSvgDocumentViewport(root({width:'100mm',height:'50mm',viewBox:'0 0 100 50',preserveAspectRatio:'none'})).reason,
    'SVG_ASPECT_RATIO_UNSUPPORTED');
  assert.equal(inspectSvgDocumentViewport(root({width:'100mm',height:'50mm',viewBox:'0 0 100 50',preserveAspectRatio:'xMidYMid slice'})).reason,
    'SVG_ASPECT_RATIO_SLICE_UNVERIFIED');
  assert.equal(inspectSvgDocumentViewport(null).reason,'VALIDATED_SVG_ROOT_REQUIRED');
  assert.equal(inspectSvgDocumentViewport({localName:'html',getAttribute:()=>null}).reason,'VALIDATED_SVG_ROOT_REQUIRED');
});
test('Negative viewBox origin is preserved for later geometry transform',()=>{
  const r=inspectSvgDocumentViewport(root({width:'50mm',height:'50mm',viewBox:'-100 -100 200 200'}));
  assert.equal(r.status,'DOCUMENT_COORDINATES_ONLY');
  assert.equal(r.viewBox.minX,-100);assert.equal(r.viewBox.minY,-100);
  assert.equal(r.svg_units_to_mm,0.25);
});
