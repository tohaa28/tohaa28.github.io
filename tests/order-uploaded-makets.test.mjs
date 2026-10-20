import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tool=fs.readFileSync('tools/patch-order-uploaded-makets.mjs','utf8');
const match=tool.match(/const bridge=("[^\n]+");\nexport function applyUploadedMaketsBridge/);
assert.ok(match,'Native importer bridge must be present');
const source=JSON.parse(match[1]);
function setup(){
 const item={article:'77700.60',itemId:'49428451'};
 const field={x:10,y:20,w:40,h:30};
 const y={busy:false,template:{id:'A'},field,selectedEntry:item,draw:false,
   page:0,active:0,placements:[{field,page:0,fieldIndex:0,art:null}]};
 const v=id=>id==='order'?{value:'8006776'}:id==='orderEditor'?{hidden:false}:{};
 const calls=[];
 const Ai=async(evt,type)=>{
   calls.push({filename:evt.target.files[0]?.name,type,active:y.active});
 };
 const root={};
 const api=new Function('y','v','window','Ai',
   source+'\nreturn window.gwbUploadedMaketNative;')(y,v,root,Ai);
 return {api,y,v,item,field,calls};
}
const pdf={name:'8006776_maket_2_201026_143328.pdf',size:400};

test('Uploaded PDF opens through native logo importer only in selected real field',async()=>{
 const {api,calls}=setup();
 const selected=api.getScope();
 assert.equal(selected.order,'8006776');
 assert.equal(selected.itemId,'49428451');
 assert.equal(selected.fieldIndex,0);
 await api.apply(pdf,selected);
 assert.deepEqual(calls,[{filename:pdf.name,type:'art',active:0}]);
});

test('Changing order, article, field or page during download blocks wrong attachment',async()=>{
 for(const change of [
   t=>t.v('order').value='different',
   t=>{t.y.selectedEntry={article:'other',itemId:'x'};},
   t=>{t.y.field={x:0};t.y.placements[0].field=t.y.field;},
   t=>{t.y.page=1;},
   t=>{t.y.active=1;},
   t=>{t.y.busy=true;}
 ]){
   const s=setup();const scope=s.api.getScope();change(s);
   await assert.rejects(()=>s.api.apply(pdf,scope),/изменились/);
   assert.equal(s.calls.length,0,'Original artwork must remain untouched');
 }
});

test('Incorrect format or excess size rejected before invoking native importer',async()=>{
 const s=setup(),scope=s.api.getScope();
 await assert.rejects(()=>s.api.apply({name:'layout.cdr',size:999},scope),/PDF/);
 await assert.rejects(()=>s.api.apply({name:'layout.pdf',size:50*1024*1024},scope),/PDF/);
 assert.deepEqual(s.calls,[]);
});

test('No implicit placement on templates without active field',()=>{
 const s=setup();s.y.field=null;
 assert.equal(s.api.getScope(),null);
 s.y.field=s.field;s.y.active=-1;
 assert.equal(s.api.getScope(),null);
});
