import test from 'node:test';
import assert from 'node:assert/strict';
import {crosscheckArtworkPlacement} from '../vision/geometry/placement-context.mjs';

const DIGEST_A='a'.repeat(64),DIGEST_B='b'.repeat(64);
function fixture(){
 const snapshot={
   order_id:'ORDER-SYNTH-1',sku:'SYNTH-ARTICLE',constructor_id:'CTOR-01',
   print_slot_id:'print1',technology_code:'UV1',
   artwork_sha256:DIGEST_A,snapshot_revision:'rev-2026-01',
   source_revision_sha256:DIGEST_B,source_system:'gifts.ru',
   source_document_ref:'synthetic://orders/1/rev-2026-01',
   field_width_mm:120,field_height_mm:80,page_width_units:80,page_height_units:40
 };
 const editor={
   order_id:snapshot.order_id,sku:snapshot.sku,constructor_id:snapshot.constructor_id,
   print_slot_id:snapshot.print_slot_id,technology_code:snapshot.technology_code,
   artwork_sha256:snapshot.artwork_sha256,snapshot_revision:snapshot.snapshot_revision,
   source_revision_sha256:snapshot.source_revision_sha256,
   source_document_ref:snapshot.source_document_ref,
   field_width_mm:120,field_height_mm:80,page_width_units:80,page_height_units:40,
   placement:{x:0.2,y:0.25,width:0.5,height:0.375,rotation_degrees:0}
 };
 return {snapshot,editor};
}
const check=(mutate=()=>{})=>{
  const {snapshot,editor}=fixture();mutate(snapshot,editor);
  return crosscheckArtworkPlacement(snapshot,editor);
};
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-8, 'got '+a+' expected '+b);

test('crosschecked order metadata and mm dimensions produce explicit page->field transform',()=>{
  const v=check();
  assert.equal(v.status,'CONTEXT_CROSSCHECKED_ONLY');
  assert.equal(v.order_context_matches,true);
  assert.equal(v.print_scale_proven,false);
  assert.equal(v.geometry_proven,false);
  const [a,b,c,d,e,f]=v.page_to_field_mm;
  near(a,0.75);near(b,0);near(c,0);near(d,0.75);
  near(e,24);near(f,20);
  assert.equal(v.context.print_slot_id,'print1');
  assert.equal(v.field_size_mm.width,120);
});

test('90 degree rotation has physical footprint inside field',()=>{
  const v=check((s,e)=>{e.placement.rotation_degrees=90});
  assert.equal(v.status,'CONTEXT_CROSSCHECKED_ONLY');
  near(v.page_to_field_mm[0],0);
  near(v.page_to_field_mm[1],0.75);
  near(v.page_to_field_mm[2],-0.75);
  near(v.page_to_field_mm[3],0);
});

test('180 degree rotation keeps the same physical print dimensions',()=>{
  const v=check((s,e)=>{e.placement.rotation_degrees=180});
  assert.equal(v.status,'CONTEXT_CROSSCHECKED_ONLY');
  near(v.page_to_field_mm[0],-0.75);
  near(v.page_to_field_mm[3],-0.75);
});

test('order, SKU, constructor, print slot, technique and source revision must ALL match',()=>{
  for(const key of [
    'order_id','sku','constructor_id','print_slot_id',
    'technology_code','artwork_sha256','snapshot_revision'
  ]){
    const v=check((s,e)=>{e[key]='other';});
    assert.equal(v.status,'MANUAL',key);
    assert.equal(v.reason,'PLACEMENT_IDENTITY_MISMATCH',key);
    assert.equal(v.key,key);
  }
});
test('source document and content SHA are checked independently',()=>{
  assert.equal(check((s,e)=>{e.source_document_ref='synthetic://wrong'}).reason,
    'PLACEMENT_SOURCE_MISMATCH');
  assert.equal(check((s,e)=>{e.source_revision_sha256='c'.repeat(64)}).reason,
    'SOURCE_REVISION_DIGEST_MISMATCH');
  assert.equal(check((s,e)=>{s.source_revision_sha256='invalid';}).status,'MANUAL');
  assert.equal(check((s,e)=>{s.source_system='unverified';}).reason,
    'SOURCE_PROVENANCE_MISSING');
  assert.equal(check((s,e)=>{s.artwork_sha256='bad';e.artwork_sha256='bad'}).reason,
    'ARTWORK_DIGEST_INVALID');
});

test('physical dimensions must be known and reconciled to 0.005 mm',()=>{
  assert.equal(check((s,e)=>{e.field_width_mm=121}).reason,
    'PLACEMENT_DIMENSION_CONFLICT');
  assert.equal(check((s,e)=>{e.field_height_mm=0}).reason,
    'PHYSICAL_DIMENSIONS_REQUIRED');
  assert.equal(check((s,e)=>{e.page_width_units=79.9}).reason,
    'PLACEMENT_DIMENSION_CONFLICT');
});
test('missing placement and out-of-field layout fail closed',()=>{
  assert.equal(check((s,e)=>{delete e.placement}).reason,'PLACEMENT_RECT_REQUIRED');
  assert.equal(check((s,e)=>{e.placement.x=0.9}).reason,'PLACEMENT_OUTSIDE_FIELD');
  assert.equal(check((s,e)=>{e.placement.y=-0.01}).reason,'PLACEMENT_OUTSIDE_FIELD');
  assert.equal(check((s,e)=>{e.placement.width=0}).reason,'PLACEMENT_OUTSIDE_FIELD');
  assert.equal(check((s,e)=>{e.placement.x=NaN}).reason,'PLACEMENT_COORDINATE_INVALID');
});
test('nonuniform scaling is rejected, even when visually similar',()=>{
  assert.equal(check((s,e)=>{e.placement.height=0.3749}).reason,
    'NON_UNIFORM_ARTWORK_SCALING');
});
test('rotation exceeding the physical field is not silently clipped',()=>{
  const result=check((s,e)=>{
    e.placement={x:0.01,y:0.01,width:0.5,height:0.375,rotation_degrees:45};
  });
  assert.equal(result.status,'MANUAL');
  assert.equal(result.reason,'ROTATED_ARTWORK_OUTSIDE_FIELD');
});
test('out-of-range angle and missing IDs are rejected',()=>{
  assert.equal(check((s,e)=>{e.placement.rotation_degrees=450}).reason,
    'PLACEMENT_ROTATION_INVALID');
  assert.equal(check((s,e)=>{s.order_id='';e.order_id='';}).reason,
    'PLACEMENT_IDENTITY_MISMATCH');
});
test('matched CLIENT objects do not create a cryptographic production certificate',()=>{
  const v=check();
  assert.equal(v.status,'CONTEXT_CROSSCHECKED_ONLY');
  assert.equal(v.print_scale_proven,false);
  assert.equal(v.geometry_proven,false);
  assert.ok(v.warning.includes('Untrusted'));
});
