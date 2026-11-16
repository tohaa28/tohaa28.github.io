import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveRequirement,evaluateMeasurement} from '../vision/rules/resolver.mjs';

const registry=JSON.parse(readFileSync(new URL('../vision/rules/technology.v1.json',import.meta.url),'utf8'));
const problems=JSON.parse(readFileSync(new URL('../vision/rules/problems.v1.json',import.meta.url),'utf8'));
const research=(query={})=>({
  research_mode:true,technology:'UV1',dimension:'positive_width_mm',
  scale_proven:true,geometry_proven:true,measured:0.15,
  features:{soft_touch:false},...query
});
const check=(query={})=>evaluateMeasurement(registry,research(query));
const sha='a'.repeat(64);

test('Gifts problem catalog is complete, uniquely mapped and marked not implemented',()=>{
  assert.equal(problems.problems.length,30);
  assert.equal(new Set(problems.problems.map(p=>p.code)).size,30);
  assert.equal(new Set(problems.problems.map(p=>p.gifts_id)).size,30);
  assert.ok(problems.problems.every(p=>p.implementation==='planned'));
  assert.ok(problems.problems.every(p=>p.source_url.startsWith('https://gifts.ru/maket-problems/')));
});
test('Rule registry has unique rule IDs, documented provenance and finite dimensions',()=>{
  assert.equal(new Set(registry.rules.map(r=>r.id)).size,registry.rules.length);
  assert.ok(registry.rules.length>=30);
  for(const r of registry.rules){
    assert.ok(r.provenance?.url?.startsWith('https://gifts.ru/'));
    assert.match(r.provenance.reviewed_at,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(r.technologies.length);
    for(const v of Object.values(r.measurements)) assert.ok(Number.isFinite(v) && v>=0);
  }
});
test('Official UV threshold: below, exact and above boundary',()=>{
  for(const [measured,status] of [[0.149,'ERROR'],[0.15,'OK'],[0.151,'OK'],[0.04,'ERROR']])
    assert.equal(check({measured}).status,status,'UV '+measured);
});
test('Independent geometry prevents neural safe predictions suppressing a violation',()=>{
  const r=check({measured:0.14,model_score:1,model_prediction:'safe'});
  assert.equal(r.status,'ERROR');assert.equal(r.rule_id,'GFT-UV');
  assert.equal(r.threshold,0.15);assert.equal(r.unit,'mm');
  assert.equal(r.provenance.url,'https://gifts.ru/nanesenie-logotipa/specifications');
});
test('UV Soft Touch applies 0.5 mm and exact thresholds',()=>{
  assert.equal(check({measured:0.2}).status,'OK');
  const soft=check({measured:0.2,features:{soft_touch:true}});
  assert.equal(soft.status,'ERROR');assert.equal(soft.threshold,0.5);
  assert.equal(soft.rule_id,'GFT-UV-SOFT');
  assert.equal(check({measured:0.5,features:{soft_touch:true}}).status,'OK');
  assert.equal(check({measured:0.499,features:{soft_touch:true}}).status,'ERROR');
});
test('Unknown Soft Touch status cannot silently accept generic UV rule',()=>{
  assert.equal(check({measured:0.2,features:{}}).reason,'CONDITIONAL_FEATURE_UNKNOWN');
});
test('DTF generic 0.6 and cardboard exception 1.5',()=>{
  const q={technology:'DTF1',features:{material:'cotton'},measured:0.6};
  assert.equal(check(q).status,'OK');
  assert.equal(check({...q,measured:0.599}).status,'ERROR');
  const p={...q,features:{material:'cardboard'},measured:0.7};
  assert.equal(check(p).status,'ERROR');assert.equal(check(p).threshold,1.5);
  assert.equal(check({...p,measured:1.5}).status,'OK');
  assert.equal(check({...q,features:{},measured:0.7}).status,'MANUAL');
});
test('DTF negative gap not affected by material positive-only exception',()=>{
  const q={technology:'DTF3',dimension:'negative_gap_mm',features:{},measured:0.6};
  assert.equal(check(q).status,'OK');assert.equal(check({...q,measured:0.599}).status,'ERROR');
});
test('B1 positive width depends on underbase state',()=>{
  const q={technology:'B1',measured:0.35};
  assert.equal(check({...q,features:{underbase:false}}).status,'OK');
  assert.equal(check({...q,features:{underbase:true}}).status,'ERROR');
  assert.equal(check({...q,features:{}}).status,'MANUAL');
  assert.equal(check({...q,features:{underbase:true},measured:0.4}).status,'OK');
});
test('Geometric and physical scale proof mandatory',()=>{
  assert.equal(check({measured:1,scale_proven:false}).reason,'PHYSICAL_SCALE_NOT_PROVEN');
  assert.equal(check({measured:1,geometry_proven:false}).reason,'GEOMETRY_NOT_PROVEN');
  assert.equal(check({measured:NaN}).reason,'MEASUREMENT_NOT_AVAILABLE');
});
test('Borderline with measurement uncertainty requires manual',()=>{
  assert.equal(check({measured:0.15,uncertainty:0.001}).reason,'MEASUREMENT_OVERLAPS_THRESHOLD');
  assert.equal(check({measured:0.148,uncertainty:0.001}).status,'ERROR');
  assert.equal(check({measured:0.152,uncertainty:0.001}).status,'OK');
});
test('Experimental rules cannot be presented as production OK',()=>{
  const r=evaluateMeasurement(registry,{technology:'UV1',dimension:'positive_width_mm',
    measured:1,scale_proven:true,geometry_proven:true,features:{soft_touch:false}});
  assert.equal(r.status,'MANUAL');assert.equal(r.reason,'RULESET_NOT_APPROVED');
});
test('Unknown technologies and measurements fail closed',()=>{
  assert.equal(check({technology:'UNKNOWN'}).status,'MANUAL');
  assert.equal(check({dimension:'pretend_mm'}).status,'MANUAL');
  assert.equal(check({technology:'UV PRINT'}).status,'MANUAL');
  assert.equal(check({technology:'uv1'}).status,'OK');
});
test('Verified order-specific rule overrides technology',()=>{
  const overrides=[{tier:'order',technology:'UV1',dimension:'positive_width_mm',
    threshold:0.3,scope_id:'ORDER-SYNTH',id:'CUSTOM-001',
    approved:true,approved_by:'test-specialist',approved_at:'2026-11-16',
    source_ref:'internal://verified-order-requirement',source_sha256:sha}];
  const r=check({measured:0.2,order_id:'ORDER-SYNTH',
    features:{soft_touch:false},overrides});
  assert.equal(r.status,'ERROR');assert.equal(r.threshold,0.3);
  assert.equal(r.rule_id,'CUSTOM-001');assert.equal(r.source_tier,'order');
});
test('Unverified order override blocks automatic OK',()=>{
  const overrides=[{tier:'order',technology:'UV1',dimension:'positive_width_mm',
    threshold:0.1,scope_id:'ORDER-SYNTH',id:'UNSIGNED'}];
  const r=check({measured:0.3,order_id:'ORDER-SYNTH',overrides});
  assert.equal(r.status,'MANUAL');assert.equal(r.reason,'UNVERIFIED_OVERRIDE');
});
test('Wrongly scoped order rule cannot affect another order',()=>{
  const overrides=[{tier:'order',technology:'UV1',dimension:'positive_width_mm',
    threshold:1,scope_id:'OTHER',approved:true,approved_by:'expert',
    source_ref:'internal://wrong-order',source_sha256:sha}];
  const r=check({measured:0.3,order_id:'ORDER-SYNTH',
    features:{soft_touch:false},overrides});
  assert.equal(r.status,'OK');assert.equal(r.threshold,0.15);
});
test('Conflicting equal-tier verified order rules return MANUAL',()=>{
  const base={tier:'order',technology:'UV1',dimension:'positive_width_mm',
    scope_id:'ORDER-SYNTH',approved:true,approved_by:'expert',
    source_ref:'internal://synthetic',source_sha256:sha};
  const r=check({measured:0.4,order_id:'ORDER-SYNTH',
    features:{soft_touch:false},overrides:[{...base,id:'A',threshold:0.2},
      {...base,id:'B',threshold:0.7}]});
  assert.equal(r.status,'MANUAL');assert.equal(r.reason,'RULE_SOURCE_CONFLICT');
  assert.equal(r.candidates.length,2);
});
test('Order rule outranks verified constructor requirement',()=>{
  const base={technology:'UV1',dimension:'positive_width_mm',
    approved:true,approved_by:'expert',source_ref:'internal://synthetic',source_sha256:sha};
  const r=check({measured:0.3,order_id:'O',constructor_id:'C',
    features:{soft_touch:false},overrides:[
      {...base,id:'CTOR',tier:'constructor',scope_id:'C',threshold:0.2},
      {...base,id:'ORDER',tier:'order',scope_id:'O',threshold:0.4}
    ]});
  assert.equal(r.rule_id,'ORDER');assert.equal(r.status,'ERROR');
});
test('Documented decal Pantone conflict cannot be classified as OK',()=>{
  const r=resolveRequirement(registry,{technology:'H1',dimension:'max_pantone_deviation_percent'});
  assert.equal(r.status,'MANUAL');
});
test('Invalid registry and physical measurements cannot pass',()=>{
  assert.equal(evaluateMeasurement({},research()).status,'MANUAL');
  assert.equal(check({measured:-1}).status,'MANUAL');
  assert.equal(check({uncertainty:-0.1}).status,'MANUAL');
});
