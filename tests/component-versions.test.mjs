import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deriveComponentVersions} from '../tools/stamp-component-versions.mjs';

const base=()=>({
 editor:'<span id="maketnayaVersion">old</span><span id="printcheckVersion">old</span>',
 mockup:'<span id="mockupVersion">old</span>',
 directMode:'orders',launcherBuilder:'launcher',editorAssets:['index-bundle'],
 mockupAssets:['mockup-canvas'],detailAssets:["logo-detail-engine.mjs\nreturn {algorithm:'PrintCheck-coverage-swt-v25-multisegment-ink'};"],
 profiles:'profiles',saveProfile:'save'
});
test('Three component version labels are independent',()=>{
 const original=deriveComponentVersions(base());
 assert.match(original.maketnaya,/^Макетная r[0-9a-f]{8}$/);
 assert.match(original.mockup,/^Редактор мокапов r[0-9a-f]{8}$/);
 assert.match(original.printcheck,/^PrintCheck v25 r[0-9a-f]{8}$/);
 const nextMockup=deriveComponentVersions({...base(),mockupAssets:['mockup-canvas-2']});
 assert.equal(nextMockup.maketnaya,original.maketnaya);
 assert.equal(nextMockup.printcheck,original.printcheck);
 assert.notEqual(nextMockup.mockup,original.mockup);
 const nextPrintCheck=deriveComponentVersions({...base(),detailAssets:["logo-detail-engine.mjs\nreturn {algorithm:'PrintCheck-coverage-swt-v26-next'};"]});
 assert.equal(nextPrintCheck.maketnaya,original.maketnaya);
 assert.equal(nextPrintCheck.mockup,original.mockup);
 assert.match(nextPrintCheck.printcheck,/^PrintCheck v26 r[0-9a-f]{8}$/);
});
test('Stamps ignore previously injected labels',()=>{
 const original=deriveComponentVersions(base());
 const rerun=deriveComponentVersions({...base(),
 editor:base().editor.replaceAll('old','build 12345678'),
 mockup:base().mockup.replace('old','build abcd1234')
 });
 assert.deepEqual(rerun,original);
});
test('Only Maketnaya revision changes for editor changes',()=>{
 const original=deriveComponentVersions(base());
 const next=deriveComponentVersions({...base(),directMode:'orders updated'});
 assert.notEqual(next.maketnaya,original.maketnaya);
 assert.equal(next.mockup,original.mockup);
 assert.equal(next.printcheck,original.printcheck);
});
