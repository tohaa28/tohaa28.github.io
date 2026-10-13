import test from 'node:test';
import assert from 'node:assert/strict';
import {currentMethodCode} from '../assets/method-admin.mjs';

test('settings choose the selected field rather than a previous filled logo or article method',()=>{
 const fields=[{page:1,x:0,y:0,w:30,h:20},{page:1,x:40,y:0,w:30,h:20}];
 const state={template:{fieldOptions:fields},field:{...fields[1]},active:0,placements:[{fieldIndex:0,art:{}}],selectedEntry:{method:'D1'}};
 const meta=i=>({method:i===0?'D1':'F1: Флекс'});
 assert.equal(currentMethodCode(state,meta,'B4'),'F1');
 state.field=fields[0];assert.equal(currentMethodCode(state,meta,'B4'),'D1');
});
test('settings resolve manual method and exact codes without guessing ambiguous bindings',()=>{
 assert.equal(currentMethodCode({},undefined,'UV-DTF1: УФ-DTF печать'),'UV-DTF1');
 assert.equal(currentMethodCode({field:{orderMethod:'LM2'}},undefined,'B4'),'LM2');
 assert.equal(currentMethodCode({selectedEntry:{method:'B4 / D1'}}),null);
 assert.equal(currentMethodCode({selectedEntry:{fieldLabelAudit:{ok:false},method:'B4'}},undefined,'B4'),null);
 assert.equal(currentMethodCode({},undefined,''),null);
});
