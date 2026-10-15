import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchMethodSettings,commitMethodSettings,METHOD_SETTINGS_SOURCE,METHOD_SETTINGS_API} from '../assets/method-settings-server.mjs';
import {validateSettings} from '../assets/method-settings.mjs';
const original={version:1,methods:{}};
const changed={version:1,methods:{F1:{artworkPolicy:'vector-only',values:{maxColors:2}}}};
const body=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});
const utf8=value=>Buffer.from(JSON.stringify(value),'utf8').toString('base64');
test('all browsers fetch central settings instead of any locally cached browser copy',async()=>{
 const called=[];
 const value=await fetchMethodSettings({fetcher:async(url,options)=>{called.push({url,options});return body(changed);}});
 assert.deepEqual(value,changed);assert.ok(called[0].url.startsWith(METHOD_SETTINGS_SOURCE));assert.equal(called[0].options.cache,'no-store');
});
test('GitHub save is authenticated, UTF-8-safe, and detects another admin edit before overwriting',async()=>{
 let state=original,sha='sha1',writes=0;
 const fetcher=async(url,options)=>{
   if(!url.startsWith(METHOD_SETTINGS_API))throw Error('Unexpected endpoint '+url);
   assert.equal(options.headers.Authorization,'Bearer valid-fine-grained-token');
   if(options.method==='PUT'){
     const request=JSON.parse(options.body);
     assert.equal(request.sha,sha);assert.equal(request.branch,'gifts-layout-workbench-mockups-source');
     state=JSON.parse(Buffer.from(request.content,'base64').toString('utf8'));writes++;sha='sha'+(writes+1);
     return body({commit:{sha}});
   }
   return body({sha,content:utf8(state)});
 };
 await assert.rejects(commitMethodSettings(changed,{token:'',previous:original,validate:validateSettings,fetcher}),/token/);
 const saved=await commitMethodSettings(changed,{token:'valid-fine-grained-token',previous:original,validate:validateSettings,fetcher});
 assert.equal(saved.commit,'sha2');assert.equal(state.methods.F1.values.maxColors,2);
 await assert.rejects(commitMethodSettings(original,{token:'valid-fine-grained-token',previous:original,validate:validateSettings,fetcher}),/другим администратором/);
 assert.equal(writes,1);
});
test('failed GitHub writes never falsely report success',async()=>{
 const fetcher=async(_url,options)=>options.method==='PUT'?body({},409):body({sha:'before',content:utf8(original)});
 await assert.rejects(commitMethodSettings(changed,{token:'valid',previous:original,validate:validateSettings,fetcher}),/Конфликт версий/);
});
