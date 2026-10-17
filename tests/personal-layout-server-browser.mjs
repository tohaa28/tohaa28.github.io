import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:850}});
 const base='https://gifts.ru/__personal_layout_server_test';
 const api='https://gifts.ru/private/maketnaya-layouts/v1/';
 const saved=new Map();let uploaded=0;
 await page.route(api+'**',async route=>{
   const r=route.request(),url=new URL(r.url()),name=url.pathname.split('/').pop();
   let status=200,data={};
   if(url.pathname.endsWith('/me'))data={authenticated:true,id:'gifts-user-1001',name:'Иван Иванов'};
   else if(r.method()==='POST'&&url.pathname.endsWith('/layouts')){
     const body=r.postDataJSON();
     assert.equal(body.article,'15637');
     assert.equal(body.layout.schema,'gwb-personal-layout/v1');
     assert.equal(typeof body.layout.items[0].artwork.bytes,'string');
     const id='10000000-0000-4000-8000-'+String(++uploaded).padStart(12,'0');
     const row={id,article:body.article,title:body.title,savedAt:new Date().toISOString(),
       itemCount:body.layout.items.length,status:'personal-draft',orderId:null,layout:body.layout};
     saved.set(id,row);status=201;data=row;
   }else if(r.method()==='GET'&&url.pathname.endsWith('/layouts')){
     data={items:[...saved.values()].map(({layout,...meta})=>meta)};
   }else if(saved.has(name)&&r.method()==='GET')data=saved.get(name);
   else{status=404;data={error:'Not found'}}
   await route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(data)});
 });
 await page.route(base,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',
   body:'<!doctype html><html><head><meta charset="utf-8"></head><body><header><g-droper><a href="/private/cabinet">Кабинет</a><g-drop><div class="drop--padding"><span class="opacity-half">Иван Иванов</span></div></g-drop></g-droper></header><div id="orderEditor"><div id="orderFieldChoiceBox"></div><canvas id="templateCanvas" width="100" height="100"></canvas><canvas id="overlay" width="100" height="100"></canvas></div></body></html>'}));
 await page.goto(base);
 const initialize=async()=>{
   await page.evaluate(()=>{
      window.__article='15637';window.__restored=[];
      window.gwbCurrentLibraryArticle=()=>window.__article;
      window.gwbCapturePersonalLayout=()=>({schema:'gwb-personal-layout/v1',article:'15637',
        fields:[{page:0,x:0,y:0,w:80,h:40}],items:[{
          fieldIndex:0,page:0,placement:{x:5,y:5,w:10,h:6,rotation:0,clipToField:false},
          artwork:{name:'logo.svg',mime:'image/svg+xml',bytes:new TextEncoder().encode('<svg/>')}
        }]});
      window.gwbRestorePersonalLayout=async layout=>{
        window.__restored.push(layout);return {article:'15637',count:layout.items.length}
      };
      window.prompt=()=> 'Серверный вариант';window.confirm=()=>true;
   });
   await page.addScriptTag({path:'assets/personal-layout-library.js'});
 };
 await initialize();
 const lib=page.locator('#gwbPersonalLibrary');
 await lib.getByRole('button',{name:'Сохранить на сервер'}).waitFor({timeout:9000});
 assert.match(await lib.locator('#gwbLibAuthenticatedUser').textContent(),/Иван Иванов/);
 await lib.getByRole('button',{name:'Сохранить на сервер'}).click();
 await lib.getByRole('button',{name:'Восстановить'}).waitFor();
 assert.equal(saved.size,1);
 assert.equal(await page.evaluate(()=>window.__restored.length),0,'Saving on server must not apply to active order');
 await page.reload();
 await initialize();
 const fresh=page.locator('#gwbPersonalLibrary');
 await fresh.getByRole('button',{name:'Восстановить'}).waitFor();
 assert.equal(await page.evaluate(()=>window.__restored.length),0,'Loading server history must never import artwork automatically');
 await fresh.getByRole('button',{name:'Восстановить'}).click();
 await page.waitForFunction(()=>window.__restored.length===1);
 assert.equal(await page.evaluate(()=>new TextDecoder().decode(window.__restored[0].items[0].artwork.bytes)),'<svg/>');
 console.log('Authenticated server library: owner, persistence, manual restoration and original bytes passed');
}finally{await browser.close()}
