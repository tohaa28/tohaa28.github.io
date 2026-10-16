import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restorePlacement,vectorEditable,BRIDGE_URL} from '../assets/vector-external-editor.mjs';
test('only source vector artwork can be sent to CorelDRAW/Illustrator',()=>{
 for(const ext of ['svg','pdf','ai'])assert.equal(vectorEditable({ext,bytes:new Uint8Array([1])}),true);
 for(const ext of ['png','jpg','jpeg','cdr','eps',''])assert.equal(vectorEditable({ext,bytes:new Uint8Array([1])}),false);
 assert.equal(vectorEditable(null),false);
 assert.equal(vectorEditable({ext:'svg',bytes:new Uint8Array()}),false);
 assert.equal(BRIDGE_URL,'http://127.0.0.1:14762');
});
test('retains artwork placement, rotation, clipping and geometry on unchanged artboard',()=>{
 const old={x:100,y:200,w:60,h:30,rotation:37,clipToField:true};
 const result=restorePlacement(old,{w:100,h:50},{w:200,h:100});
 assert.deepEqual(result,old);assert.notEqual(result,old);
});
test('new artboard aspect ratio fits inside previous physical footprint without distortion',()=>{
 const original={x:10,y:20,w:60,h:30,rotation:90,clipToField:true};
 const result=restorePlacement(original,{w:120,h:60},{w:50,h:100});
 assert.ok(Math.abs(result.w/result.h-.5)<1e-9);
 assert.ok(result.w<=60&&result.h<=30);
 assert.ok(Math.abs(result.x+result.w/2-40)<1e-9);
 assert.ok(Math.abs(result.y+result.h/2-35)<1e-9);
 assert.equal(result.rotation,90);assert.equal(result.clipToField,true);
 assert.deepEqual(original,{x:10,y:20,w:60,h:30,rotation:90,clipToField:true});
});
test('rejects missing active placement instead of silently changing another field',()=>{
 assert.throws(()=>restorePlacement(null,{w:1,h:1},{w:2,h:2}),/размещение/);
});
