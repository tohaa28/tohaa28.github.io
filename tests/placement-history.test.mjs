import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('tools/patch-placement-history.mjs','utf8');
const html=fs.readFileSync('editor.html','utf8');
const tick=String.fromCharCode(96);
const head='const body=String.raw'+tick,tail=tick+';\nexport function applyPlacementHistory';
const begin=source.indexOf(head),end=source.indexOf(tail,begin);
assert.ok(begin>=0&&end>begin,'History instrumentation must be readable');
const body=source.slice(begin+head.length,end);

function setup(){
 const nodes=new Map(),events=new Map(),notices=[];
 const v=id=>{
   if(!nodes.has(id))nodes.set(id,{id,hidden:false,disabled:false,value:'',
     textContent:'',addEventListener(name,fn){this[name]=fn;}});
   return nodes.get(id);
 };
 const document={activeElement:{tagName:'BUTTON',id:''},
   addEventListener(name,fn){events.set(name,fn);},getElementById(){return null;}};
 const field={x:0,y:0,w:40,h:30},art={name:'first.svg'};
 const placed={fieldIndex:0,page:0,field,art,
   placement:{x:2,y:3,w:15,h:10,rotation:0,clipToField:false}};
 const y={template:{id:'templateA'},page:0,view:field,selectedEntry:{article:'111',itemId:'a'},
   placements:[placed],active:0,field,art,placement:placed.placement,busy:false,drag:null};
 const win={dispatchEvent(){}};
 const ctor=new Function('y','v','document','window','CustomEvent','Q','_t','X','queueMicrotask',
   body+'\nreturn {observe:gwbHistoryObserve,history:window.gwbPlacementHistory};');
 const api=ctor(y,v,document,win,function CustomEvent(){},
   s=>notices.push(s),()=>{},()=>{},fn=>fn());
 return {api,y,v,document,events,notices,art};
}

test('Undo/Redo are placed beside the native logo tools',()=>{
 assert.match(html,/id="editorUndo"[^>]*Ctrl\+Z/);
 assert.match(html,/id="editorRedo"[^>]*Ctrl\+Y/);
 assert.equal((html.match(/id="editorUndo"/g)||[]).length,1);
 assert.equal((html.match(/id="editorRedo"/g)||[]).length,1);
 assert.match(source,/gwbHistoryObserve\(\)/);
 assert.match(source,/gwbHistoryControls\(\)/);
});

test('Placement movement, scaling, rotation, clipping and artwork are reversible',()=>{
 const a=setup();a.api.observe();
 a.y.placement.x=9;a.api.observe();
 a.y.placement.w=12;a.api.observe();
 a.y.placement.rotation=90;a.api.observe();
 a.y.placement.clipToField=true;a.api.observe();
 a.y.art={name:'second.svg'};a.y.placements[0].art=a.y.art;a.api.observe();
 assert.deepEqual(a.api.history.getState(),{index:5,length:6});
 for(let i=0;i<5;i++)assert.equal(a.api.history.undo(),true);
 assert.equal(a.y.placement.x,2);
 assert.equal(a.y.placement.w,15);
 assert.equal(a.y.placement.rotation,0);
 assert.equal(a.y.placement.clipToField,false);
 assert.equal(a.y.art,a.art);
 for(let i=0;i<5;i++)assert.equal(a.api.history.redo(),true);
 assert.equal(a.y.art.name,'second.svg');
 assert.equal(a.y.placement.rotation,90);
});

test('Drag contributes exactly one history step; redo branch invalidates after editing',()=>{
 const a=setup();a.api.observe();
 a.y.drag={mode:'move'};
 for(let i=0;i<20;i++){a.y.placement.x++;a.api.observe();}
 assert.deepEqual(a.api.history.getState(),{index:0,length:1});
 a.y.drag=null;a.api.observe();
 assert.deepEqual(a.api.history.getState(),{index:1,length:2});
 a.api.history.undo();
 assert.equal(a.y.placement.x,2);
 a.y.placement.x=20;a.api.observe();
 assert.equal(a.api.history.redo(),false);
});

test('Delete restores source art; switching article clears history and busy prevents actions',()=>{
 const a=setup();a.api.observe();
 a.y.placements[0].art=null;a.y.placements[0].placement=null;
 a.y.art=null;a.y.placement=null;a.api.observe();
 assert.equal(a.api.history.undo(),true);
 assert.equal(a.y.art,a.art);
 a.y.busy=true;assert.equal(a.api.history.redo(),false);
 a.y.busy=false;a.y.template={id:'B'};a.y.selectedEntry.article='222';a.api.observe();
 assert.deepEqual(a.api.history.getState(),{index:0,length:1});
 assert.equal(a.api.history.undo(),false);
});

test('Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z do not capture form input editing',()=>{
 const a=setup();a.api.observe();a.y.placement.x=8;a.api.observe();
 const fn=a.events.get('keydown');let prevented=0;
 const key=(k,shift=false)=>({key:k,shiftKey:shift,ctrlKey:true,altKey:false,
   metaKey:false,repeat:false,isComposing:false,preventDefault(){prevented++;}});
 a.document.activeElement={tagName:'INPUT',id:'editorAngle'};
 fn(key('z'));assert.equal(a.y.placement.x,8);
 a.document.activeElement={tagName:'BUTTON',id:''};
 fn(key('z'));assert.equal(a.y.placement.x,2);
 fn(key('z',true));assert.equal(a.y.placement.x,8);
 fn(key('y'));assert.equal(a.y.placement.x,8);
 assert.equal(prevented,2);
});
