import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:750,height:520}});
 const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
 await page.setContent('<!doctype html><html><head><style>#stageScroll{width:480px;height:280px}#stage{position:relative;width:400px;height:200px}#overlay{width:400px;height:200px;position:absolute;inset:0}</style></head><body><div id="status"></div><div id="stageScroll"><div id="stage"><canvas id="overlay" width="400" height="200"></canvas></div></div><div id="outside">Outside</div></body></html>');
 await page.evaluate(()=>{
   window.__dropCalls=[];
   window.gwbExplorerLogoDrop={
     inspect(x,y){
       const b=document.getElementById('overlay').getBoundingClientRect();
       if(x<b.left+200||x>b.left+320||y<b.top+20||y>b.top+160)return null;
       return {index:1,field:{x:50,y:5,w:30,h:22},view:{x:0,y:0,w:100,h:50}};
     },
     async accept(file,x,y){
       window.__dropCalls.push({file:file.name,x,y});
     }
   };
 });
 await page.addScriptTag({path:'assets/logo-drop.js'});
 const box=await page.locator('#overlay').boundingBox();
 const point={x:box.x+245,y:box.y+75};
 const dispatch=async(filename,target='overlay')=>page.evaluate(({filename,target,x,y})=>{
   const data=new DataTransfer();
   data.items.add(new File(['test contents'],filename,{type:'application/octet-stream'}));
   const element=document.getElementById(target);
   const over=new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:data,clientX:x,clientY:y});
   element.dispatchEvent(over);
   const state={
     prevented:over.defaultPrevented,
     highlighted:document.getElementById('gwbFileDropHighlight')?.classList.contains('active'),
     dropEffect:data.dropEffect
   };
   const drop=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data,clientX:x,clientY:y});
   element.dispatchEvent(drop);
   return {...state,dropPrevented:drop.defaultPrevented};
 },{filename,target,x:point.x,y:point.y});
 const first=await dispatch('company-logo.svg');
 assert.equal(first.prevented,true);
 assert.equal(first.highlighted,true,'Actual field displays target highlight');
 assert.equal(first.dropPrevented,true,'OS drops do not navigate browser');
 await page.waitForFunction(()=>window.__dropCalls.length===1);
 assert.equal((await page.evaluate(()=>window.__dropCalls))[0].file,'company-logo.svg');
 const second=await dispatch('unsupported.cdr');
 assert.equal(second.dropPrevented,true);
 assert.equal(await page.evaluate(()=>window.__dropCalls.length),1,'Unsupported format never called importer');
 assert.match(await page.locator('#status').textContent(),/CDR\/EPS/);
 const outside=await dispatch('off-field.pdf','outside');
 assert.equal(outside.dropPrevented,true);
 assert.equal(await page.evaluate(()=>window.__dropCalls.length),1);
 assert.match(await page.locator('#status').textContent(),/поле нанесения/);
 assert.deepEqual(exceptions,[]);
 console.log('Explorer -> correct field drop, visual highlight, unsupported file and outside drops: PASS');
}finally{await browser.close()}
