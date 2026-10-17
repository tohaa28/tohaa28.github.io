import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('Private server authenticates each gifts principal and never mixes article layouts',async()=>{
  const root=await mkdtemp(join(tmpdir(),'gwb-layout-server-'));
  const key=randomBytes(48).toString('hex');
  const port=36000+Math.floor(Math.random()*15000);
  const server=spawn(process.execPath,['server/personal-layouts/index.mjs'],{
    env:{...process.env,GWB_PRIVATE_LAYOUT_ROOT:root,GIFTS_IDENTITY_HMAC_KEY:key,
      GWB_LAYOUTS_PORT:String(port),GWB_LAYOUTS_BIND:'127.0.0.1'},stdio:['ignore','pipe','pipe']
  });
  let stderr='';server.stderr.on('data',b=>stderr+=b);
  const base='http://127.0.0.1:'+port;
  const headers=(id,name,method='GET')=>{
    const t=String(Date.now());
    const encodedName=Buffer.from(name,'utf8').toString('base64url');
    return {'X-Gifts-User-Id':id,'X-Gifts-User-Name-B64':encodedName,
      'X-Gifts-Identity-Time':t,
      'X-Gifts-Identity-Signature':createHmac('sha256',key).update(id+'\n'+encodedName+'\n'+t).digest('hex'),
      ...(method!=='GET'?{'Origin':'https://gifts.ru','Content-Type':'application/json'}:{})};
  };
  const read=async(path,method='GET',id='id-a',name='User A',data)=>{
    const r=await fetch(base+path,{method,headers:headers(id,name,method),body:data?JSON.stringify(data):undefined});
    return {status:r.status,data:await r.json()};
  };
  try{
    let ready=false;
    for(let i=0;i<40;i++){
      if(server.exitCode!==null)throw Error('Private API exited: '+stderr);
      try{const r=await read('/v1/me');if(r.status===200){ready=true;break}}catch{}
      await new Promise(resolve=>setTimeout(resolve,75));
    }
    assert.ok(ready,'Private backend did not start: '+stderr);
    const draft={article:'15637',title:'Variant A',layout:{
      schema:'gwb-personal-layout/v1',article:'15637',fields:[{x:0,y:0,w:100,h:50,page:0}],
      items:[{fieldIndex:0,artwork:{name:'logo.svg',bytes:Buffer.from('<svg/>').toString('base64')}}]}};
    const saved=await read('/v1/layouts?article=15637','POST','id-a','User A',draft);
    assert.equal(saved.status,201,JSON.stringify(saved));
    const id=saved.data.id;assert.ok(id);
    assert.equal((await read('/v1/layouts?article=15637')).data.items.length,1);
    assert.equal((await read('/v1/layouts?article=17488')).data.items.length,0);
    assert.equal((await read('/v1/layouts?article=15637','GET','id-b','User B')).data.items.length,0);
    assert.equal((await read('/v1/layouts/'+id+'?article=15637','GET','id-b','User B')).status,404);
    const loaded=await read('/v1/layouts/'+id+'?article=15637');
    assert.equal(loaded.status,200);assert.equal(loaded.data.layout.items.length,1);
    const forged=await fetch(base+'/v1/me',{headers:{'X-Gifts-User-Id':'id-a',
      'X-Gifts-User-Name-B64':Buffer.from('User A').toString('base64url'),
      'X-Gifts-Identity-Time':String(Date.now()),
      'X-Gifts-Identity-Signature':'0'.repeat(64)}});
    assert.equal(forged.status,401);
    const csrf=await fetch(base+'/v1/layouts/'+id+'?article=15637',{
      method:'DELETE',headers:{...headers('id-a','User A','DELETE'),'Origin':'https://evil.example'}});
    assert.equal(csrf.status,403);
    const unicode=await read('/v1/me','GET','id-c','Иван Иванов');
    assert.equal(unicode.data.name,'Иван Иванов');
    const deleted=await read('/v1/layouts/'+id+'?article=15637','DELETE');
    assert.equal(deleted.status,200);
    assert.equal((await read('/v1/layouts?article=15637')).data.items.length,0);
  }finally{
    server.kill('SIGTERM');
    await rm(root,{recursive:true,force:true});
  }
});
