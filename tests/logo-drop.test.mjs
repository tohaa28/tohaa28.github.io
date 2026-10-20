import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const patch=fs.readFileSync('tools/patch-logo-drop.mjs','utf8');
const ui=fs.readFileSync('assets/logo-drop.js','utf8');
const html=fs.readFileSync('editor.html','utf8');
const match=patch.match(/const bridge=("[^\n]+");\nexport function applyLogoDrop/);
assert.ok(match,'Native drag/drop bridge must be embedded in patcher');
const bridge=JSON.parse(match[1]);

function harness(){
 const a={page:0,x:10,y:5,w:30,h:22};
 const b={page:0,x:50,y:5,w:30,h:22};
 const y={busy:false,drag:null,draw:false,template:{w:100,h:50,fieldOptions:[a,b]},
   page:0,view:null,selectedEntry:{article:'15637',itemId:'order-item'},
   active:0,field:a,placements:[{page:0,field:a,fieldIndex:0,art:null}]};
 const v=id=>({orderEditor:{hidden:false},stageScroll:{hidden:false},
   order:{value:'7920509'},article:{value:'15637'}}[id]||{value:''});
 const pt={getBoundingClientRect:()=>({left:0,top:0,width:400,height:200,right:400,bottom:200})};
 const Wn=e=>({x:e.clientX/4,y:e.clientY/4});
 const inside=(f,x,y)=>x>=f.x&&x<=f.x+f.w&&y>=f.y&&y<=f.y+f.h;
 const calls=[];
 const Vn=async index=>{
   y.active=index;y.field=y.template.fieldOptions[index];
   y.placements[index]??={page:0,field:y.field,fieldIndex:index,art:null};
 };
 const Ai=async (event,kind)=>{
   calls.push({file:event.target.files[0].name,kind,index:y.active});
 };
 const host={};
 const fn=new Function('y','v','pt','window','Wn','gwbPointInField','Vn','Ai',
   bridge+'\nreturn window.gwbExplorerLogoDrop;');
 const api=fn(y,v,pt,host,Wn,inside,Vn,Ai);
 return {api,y,calls};
}

test('Drop extension is wired only after native place/import and history modules',()=>{
 assert.doesNotThrow(()=>new Function(ui));
 assert.match(html,/assets\/logo-drop\.js\?v=20261020-explorer-drop-1/);
 const build=fs.readFileSync('tools/build-launcher.mjs','utf8');
 const history=build.indexOf('applyPlacementHistory();');
 const drop=build.indexOf('applyLogoDrop();');
 assert.ok(history>=0&&drop>history);
 assert.match(ui,/preventDefault\(\)/);
 assert.match(ui,/#gwbFileDropHighlight/);
 assert.match(ui,/accept\(file,e\.clientX,e\.clientY\)/);
 assert.match(bridge,/await Ai\(\{target:\{files:\[file\],value:''\}\},"art"\)/);
});

test('Real field-only hit test chooses destination, rejects outside or stale template',async()=>{
 const h=harness();
 assert.equal(h.api.inspect(80,70).index,0);
 assert.equal(h.api.inspect(240,70).index,1);
 assert.equal(h.api.inspect(390,190),null);
 await h.api.accept({name:'new-cmyk.pdf',size:1200},240,70);
 assert.deepEqual(h.calls,[{file:'new-cmyk.pdf',kind:'art',index:1}]);
 h.y.busy=true;
 assert.equal(h.api.inspect(240,70),null);
 await assert.rejects(()=>h.api.accept({name:'image.svg',size:400},240,70),
   /действительное поле/);
 h.y.busy=false;h.y.draw=true;
 assert.equal(h.api.inspect(240,70),null);
});

test('Unsupported and oversized logos fail before any existing artwork is touched',async()=>{
 const h=harness();
 for(const filename of ['art.cdr','art.eps','art.exe']){
   await assert.rejects(()=>h.api.accept({name:filename,size:1200},80,70),/Поддерживаются/);
 }
 await assert.rejects(()=>h.api.accept({name:'art.svg',size:41*1024*1024},80,70),/40 МБ/);
 await assert.rejects(()=>h.api.accept({name:'art.png',size:0},80,70),/40 МБ/);
 assert.deepEqual(h.calls,[]);
});

test('Manual field works without synthetic field creation or wrong target selection',async()=>{
 const h=harness();
 const field={page:0,x:15,y:12,w:20,h:10};
 h.y.template.fieldOptions=[];
 h.y.placements=[{page:0,field,art:null}];
 h.y.active=0;
 const target=h.api.inspect(80,60);
 assert.equal(target.manual,true);
 await h.api.accept({name:'manual.png',size:900},80,60);
 assert.deepEqual(h.calls,[{file:'manual.png',kind:'art',index:0}]);
});
