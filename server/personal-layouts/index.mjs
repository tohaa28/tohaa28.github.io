// Private personal-layout API. Deploy BEHIND a gifts.ru first-party reverse proxy
// that validates the gifts session and signs user identity with a shared key.
// Never expose this process or its storage directory on public GitHub Pages.
// Node.js >=22, no third-party packages. Fail-closed until identity bridge is set.
import http from 'node:http';
import {createHash,createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,readdir,unlink,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const root=resolve(process.env.GWB_PRIVATE_LAYOUT_ROOT||'/var/lib/maketnaya-personal-layouts');
const key=process.env.GIFTS_IDENTITY_HMAC_KEY||'';
const port=Number(process.env.GWB_LAYOUTS_PORT||8787);
const addr=process.env.GWB_LAYOUTS_BIND||'127.0.0.1';
const maxBody=145*1024*1024,pdfLimit=45*1024*1024;
const hash=x=>createHash('sha256').update(x).digest('hex');
const validArticle=x=>typeof x==='string'&&/^[\w.\-]{2,48}$/.test(x);
function response(res,code,data){
  const body=JSON.stringify(data);
  res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin'});
  res.end(body);
}
function principal(req){
  if(!key||key.length<32)throw Object.assign(Error('Не настроена проверка сеанса gifts.ru'),{status:503});
  const id=req.headers['x-gifts-user-id'],encodedName=req.headers['x-gifts-user-name-b64'];
  const stamp=req.headers['x-gifts-identity-time'],sig=req.headers['x-gifts-identity-signature'];
  if(typeof id!=='string'||typeof encodedName!=='string'||typeof stamp!=='string'||typeof sig!=='string'
    ||!id||id.length>128||!encodedName||encodedName.length>300||
    !/^[A-Za-z0-9_-]+$/.test(encodedName)||!/^\d{10,13}$/.test(stamp))
    throw Object.assign(Error('Нет подтверждённой авторизации gifts.ru'),{status:401});
  const name=Buffer.from(encodedName,'base64url').toString('utf8').trim();
  if(!name||name.length>160)throw Object.assign(Error('Неизвестный пользователь'),{status:401});
  const ms=Number(stamp);if(Math.abs(Date.now()-ms)>60_000)
    throw Object.assign(Error('Сеанс авторизации устарел'),{status:401});
  const expected=createHmac('sha256',key).update(id+'\n'+encodedName+'\n'+stamp).digest('hex');
  const a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))
    throw Object.assign(Error('Недействительная подпись gifts.ru'),{status:401});
  return {id,name};
}
function dirFor(p,a){return join(root,hash(p.id),hash(a))}
function pdfPath(p,a,id){return pathFor(p,a,id).replace(/\.json$/,'.pdf')}
function pathFor(p,a,id){if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id))
 throw Object.assign(Error('Недопустимый идентификатор макета'),{status:400});
 return join(dirFor(p,a),id+'.json')}
async function bodyJSON(req){
  const chunks=[];let sum=0;
  for await(const c of req){sum+=c.length;if(sum>maxBody)
    throw Object.assign(Error('Слишком большой макет'),{status:413});
    chunks.push(c)}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
  catch{throw Object.assign(Error('Некорректный JSON'),{status:400})}
}
function checkDraft(d,article){
  if(!d||d.article!==article||d.layout?.schema!=='gwb-personal-layout/v1'||
    d.layout?.article!==article||!Array.isArray(d.layout.items)||
    d.layout.items.length<1||d.layout.items.length>100||typeof d.title!=='string'||
    !d.title.trim()||d.title.length>128)
    throw Object.assign(Error('Некорректный личный макет'),{status:400});
  let total=0;
  for(const item of d.layout.items){
    if(!Number.isInteger(item.fieldIndex)||item.fieldIndex<0||
       typeof item.artwork?.bytes!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(item.artwork.bytes))
      throw Object.assign(Error('Некорректный исходный файл'),{status:400});
    total+=item.artwork.bytes.length;
  }
  if(total>maxBody)throw Object.assign(Error('Макет превышает лимит'),{status:413});
  if(typeof d.pdf!=='string'||d.pdf.length<12||
     d.pdf.length>Math.ceil(pdfLimit*4/3)+8||!/^[A-Za-z0-9+/]*={0,2}$/.test(d.pdf))
     throw Object.assign(Error('Нужен настоящий PDF макета'),{status:400});
  const pdf=Buffer.from(d.pdf,'base64');
  if(pdf.byteLength<8||pdf.byteLength>pdfLimit||pdf.toString('ascii',0,5)!=='%PDF-')
     throw Object.assign(Error('Файл макета не является PDF'),{status:400});
  return pdf;
}
function meta(doc){return{id:doc.id,article:doc.article,title:doc.title,
   savedAt:doc.savedAt,preview:doc.preview||'',itemCount:doc.layout?.items?.length||0,
   status:'personal-draft',orderId:null,hasPdf:!!doc.pdfName}}
async function handle(req,res){
  try{
    if(!['GET','POST','DELETE'].includes(req.method))return response(res,405,{error:'Method not allowed'});
    if(req.method!=='GET'&&req.headers.origin!=='https://gifts.ru')
      return response(res,403,{error:'Разрешены только запросы с gifts.ru'});
    if(req.method==='POST'&&!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))
      return response(res,415,{error:'Нужен application/json'});
    const p=principal(req); // principal is signed by gifts.ru trusted server, NEVER from browser login field
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/v1/me'&&req.method==='GET')
      return response(res,200,{authenticated:true,id:p.id,name:p.name});
    const article=url.searchParams.get('article');
    if(!validArticle(article))return response(res,400,{error:'Укажите артикул'});
    const match=url.pathname.match(/^\/v1\/layouts(?:\/([0-9a-f-]+)(\/pdf)?)?$/i);
    if(!match)return response(res,404,{error:'Not found'});
    const id=match[1],isPdf=match[2]==='/pdf';
    if(!id&&req.method==='GET'){
      let names=[];try{names=(await readdir(dirFor(p,article))).filter(x=>x.endsWith('.json'))}
      catch(e){if(e.code!=='ENOENT')throw e}
      const all=[];
      for(const file of names.slice(0,1000))try{
        const d=JSON.parse(await readFile(join(dirFor(p,article),file),'utf8'));
        if(d.article===article&&d.principalId===p.id)all.push(meta(d));
      }catch{}
      return response(res,200,{items:all.sort((a,b)=>b.savedAt.localeCompare(a.savedAt))});
    }
    if(!id&&req.method==='POST'){
      const input=await bodyJSON(req);const pdfBytes=checkDraft(input,article);
      const id=randomUUID(),dir=dirFor(p,article);
      const document={id,article,principalId:p.id,title:input.title,savedAt:new Date().toISOString(),
        preview:typeof input.preview==='string'&&input.preview.length<130000&&
          /^data:image\/jpeg;base64,/.test(input.preview)?input.preview:'',
        pdfName:'art_'+article+'_layout.pdf',layout:input.layout};
      await mkdir(dir,{recursive:true,mode:0o700});
      const tmp=join(dir,'.'+id+'.'+randomUUID()+'.tmp');
      const pdfTmp=join(dir,'.'+id+'.'+randomUUID()+'.pdf.tmp');
      try{
        await writeFile(pdfTmp,pdfBytes,{mode:0o600,flag:'wx'});
        await rename(pdfTmp,pdfPath(p,article,id));
        await writeFile(tmp,JSON.stringify(document),{mode:0o600,flag:'wx'});
        await rename(tmp,pathFor(p,article,id));
      }catch(error){
        await Promise.allSettled([unlink(tmp),unlink(pdfTmp),unlink(pdfPath(p,article,id))]);
        throw error;
      }
      return response(res,201,meta(document));
    }
    if(!id)return response(res,405,{error:'Method not allowed'});
    const file=pathFor(p,article,id);
    let saved;
    try{saved=JSON.parse(await readFile(file,'utf8'))}
    catch(e){if(e.code==='ENOENT')return response(res,404,{error:'Макет не найден'});throw e}
    if(saved.principalId!==p.id||saved.article!==article)return response(res,404,{error:'Макет не найден'});
    if(req.method==='GET'&&isPdf){
      if(!saved.pdfName)return response(res,404,{error:'PDF отсутствует в старом варианте'});
      let pdf;
      try{pdf=await readFile(pdfPath(p,article,id))}
      catch(e){if(e.code==='ENOENT')return response(res,404,{error:'PDF отсутствует'});throw e}
      if(pdf.toString('ascii',0,5)!=='%PDF-')
        return response(res,500,{error:'Хранимый PDF повреждён'});
      res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':pdf.length,
        'Content-Disposition':'attachment; filename="art_'+article+'_layout.pdf"',
        'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
        'Cross-Origin-Resource-Policy':'same-origin'});
      return res.end(pdf);
    }
    if(req.method==='GET')return response(res,200,{...meta(saved),layout:saved.layout});
    if(req.method==='DELETE'){
      if(isPdf)return response(res,405,{error:'Method not allowed'});
      await unlink(file);
      if(saved.pdfName)try{await unlink(pdfPath(p,article,id))}
        catch(e){if(e.code!=='ENOENT')throw e}
      return response(res,200,{deleted:true});
    }
    return response(res,405,{error:'Method not allowed'});
  }catch(e){return response(res,e.status||500,{error:e.status?e.message:'Ошибка сервера'})}
}
if(!process.env.GIFTS_IDENTITY_HMAC_KEY||process.env.GIFTS_IDENTITY_HMAC_KEY.length<32){
  console.error('GWB private layout API disabled: GIFTS_IDENTITY_HMAC_KEY missing/too short');
  process.exitCode=1;
}else{
  http.createServer(handle).listen(port,addr,()=>console.log('Private layouts listening on '+addr+':'+port));
}
