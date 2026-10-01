import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const ROOT=process.cwd();
const REGISTRY=path.join(ROOT,"mockup-profiles.json");
const OUTDIR=path.join(ROOT,"mockup-discovery");
const registry=JSON.parse(fs.readFileSync(REGISTRY,"utf8"));
fs.mkdirSync(OUTDIR,{recursive:true});

const specs=(registry.articleSources||[]).filter(x=>x.productUrl);
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1200},userAgent:"Mozilla/5.0 MockupCollector/1.0"});

const cleanUrl=u=>{try{return new URL(u).href}catch{return""}};
const sameArticle=(url,article)=>{
  try{
    const n=decodeURIComponent(new URL(url).pathname.split("/").pop()||"").toLowerCase();
    const full=String(article).toLowerCase(),base=full.split(".")[0];
    return n.startsWith(full+"_")||n.startsWith(full+".")||n.startsWith(base+"_")||n.startsWith(base+".");
  }catch{return false}
};
async function clickExact(page,label){
  const loc=page.getByText(label,{exact:true});
  const n=await loc.count();
  for(let i=0;i<n;i++){
    const el=loc.nth(i);
    if(await el.isVisible().catch(()=>false)){
      await el.click({timeout:3000}).catch(()=>{});
      await page.waitForTimeout(450);
      return true;
    }
  }
  return false;
}
async function visibleArticleImages(page,article){
  return await page.locator("img").evaluateAll((nodes,article)=>{
    const full=String(article).toLowerCase(),base=full.split(".")[0];
    const out=[];
    for(const img of nodes){
      const r=img.getBoundingClientRect(),cs=getComputedStyle(img);
      if(r.width<60||r.height<60||cs.display==="none"||cs.visibility==="hidden"||Number(cs.opacity)===0)continue;
      const url=img.currentSrc||img.src||"";
      let name="";
      try{name=decodeURIComponent(new URL(url,location.href).pathname.split("/").pop()||"").toLowerCase()}catch{}
      if(!(name.startsWith(full+"_")||name.startsWith(full+".")||name.startsWith(base+"_")||name.startsWith(base+".")))continue;
      out.push({url:new URL(url,location.href).href,alt:img.alt||"",width:img.naturalWidth||0,height:img.naturalHeight||0,box:{x:r.x,y:r.y,w:r.width,h:r.height}});
    }
    return out;
  },article);
}
async function download(ctx,url){
  const res=await ctx.request.get(url,{timeout:30000,failOnStatusCode:false});
  if(!res.ok())throw Error("HTTP "+res.status()+" "+url);
  return Buffer.from(await res.body());
}
async function rawImage(buf,size=420){
  const image=sharp(buf,{failOn:"none"}).rotate().removeAlpha();
  const meta=await image.metadata();
  const w=meta.width||1,h=meta.height||1;
  const scale=Math.min(1,size/Math.max(w,h));
  const rw=Math.max(1,Math.round(w*scale)),rh=Math.max(1,Math.round(h*scale));
  const {data,info}=await image.resize(rw,rh,{fit:"fill"}).raw().toBuffer({resolveWithObject:true});
  return {data,w:info.width,h:info.height,originalW:w,originalH:h};
}
async function compareBuffers(aBuf,bBuf){
  const a=await rawImage(aBuf),b0=await rawImage(bBuf);
  const w=Math.min(a.w,b0.w),h=Math.min(a.h,b0.h);
  const A=await sharp(aBuf).rotate().removeAlpha().resize(w,h,{fit:"fill"}).raw().toBuffer();
  const B=await sharp(bBuf).rotate().removeAlpha().resize(w,h,{fit:"fill"}).raw().toBuffer();
  let sum=0,changed=0,minX=w,minY=h,maxX=-1,maxY=-1;
  const threshold=24;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*3;
    const d=(Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]))/3;
    sum+=d;
    if(d>=threshold){changed++;if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}
  }
  const pixels=w*h,mean=sum/pixels,ratio=changed/pixels;
  const bbox=changed?{x:minX/w,y:minY/h,w:(maxX-minX+1)/w,h:(maxY-minY+1)/h}:null;
  const similarity=Math.max(0,1-mean/80);
  const compact=bbox?Math.min(1,ratio/Math.max(1e-6,bbox.w*bbox.h)):0;
  const confidence=Math.max(0,Math.min(1,similarity*(0.65+0.35*compact)*(ratio>0.0005&&ratio<0.35?1:0.6)));
  return {meanDiff:Number(mean.toFixed(3)),changedRatio:Number(ratio.toFixed(5)),bbox,confidence:Number(confidence.toFixed(4)),size:[w,h]};
}
async function bestDiff(ctx,photoUrls,applicationUrls){
  const photos=[];
  for(const url of photoUrls){try{photos.push({url,buf:await download(ctx,url)})}catch{}}
  const apps=[];
  for(const url of applicationUrls){try{apps.push({url,buf:await download(ctx,url)})}catch{}}
  const matches=[];
  for(const app of apps){
    let best=null;
    for(const photo of photos){
      try{
        const diff=await compareBuffers(photo.buf,app.buf);
        const score=diff.meanDiff;
        if(!best||score<best.diff.meanDiff)best={photoUrl:photo.url,applicationUrl:app.url,diff};
      }catch{}
    }
    if(best)matches.push(best);
  }
  return matches;
}
function quadFromBbox(b){
  if(!b)return null;
  return [
    {x:b.x,y:b.y},
    {x:b.x+b.w,y:b.y},
    {x:b.x+b.w,y:b.y+b.h},
    {x:b.x,y:b.y+b.h}
  ];
}

for(const spec of specs){
  const page=await context.newPage();
  const result={article:String(spec.article),product:spec.product||"",productUrl:spec.productUrl,scannedAt:new Date().toISOString(),tabs:{},constructors:[],places:[],autoBindings:[],errors:[]};
  try{
    await page.goto(spec.productUrl,{waitUntil:"domcontentloaded",timeout:60000});
    await page.waitForTimeout(1200);
    result.finalUrl=page.url();
    result.title=await page.title();
    result.constructors=await page.locator("a[href]").evaluateAll(nodes=>nodes.map(a=>({text:(a.textContent||"").replace(/\s+/g," ").trim(),href:a.href})).filter(x=>/конструктор/i.test(x.text)&&/\.(?:pdf|cdr)(?:$|[?#])/i.test(x.href)));
    result.places=(await page.locator("select option").allTextContents()).map(x=>x.replace(/\s+/g," ").trim()).filter(x=>x&&x.length<120);
    for(const label of ["Фото","Нанесение","Примеры"]){
      const clicked=await clickExact(page,label);
      result.tabs[label]={clicked,images:await visibleArticleImages(page,spec.article)};
    }
    const photoUrls=[...new Set((result.tabs["Фото"]?.images||[]).map(x=>cleanUrl(x.url)).filter(Boolean))];
    const applicationUrls=[...new Set((result.tabs["Нанесение"]?.images||[]).map(x=>cleanUrl(x.url)).filter(Boolean))];
    result.photoUrls=photoUrls;
    result.applicationUrls=applicationUrls;
    result.matches=await bestDiff(context,photoUrls,applicationUrls);
    const expectedPlaces=(spec.places||[]);
    result.autoBindings=result.matches.map((m,i)=>{
      const place=expectedPlaces[i]||{};
      const q=quadFromBbox(m.diff.bbox);
      const status=m.diff.confidence>=0.92&&q?"candidate-high":"candidate";
      return {
        schema:"gifts-mockup-profile/v1",
        article:String(spec.article),
        variant:"",
        place:place.place||"",
        method:"",
        photo:{id:(m.photoUrl.match(/\/([^/?#]+)(?:\?|$)/)||[])[1]||m.photoUrl,name:"Фото gifts.ru",url:m.photoUrl},
        field:{id:place.printId||("field-"+(i+1)),printId:place.printId||"",applicationId:"",place:place.place||""},
        targetQuad:q,
        surface:"perspective",
        render:{opacity:.9,blend:"source-over",mesh:18},
        status,
        confidence:m.diff.confidence,
        generatedBy:"github-actions-image-diff-v1",
        evidence:{applicationUrl:m.applicationUrl,meanDiff:m.diff.meanDiff,changedRatio:m.diff.changedRatio,bbox:m.diff.bbox}
      };
    });
  }catch(err){result.errors.push(err?.stack||String(err));}
  finally{await page.close();}
  fs.writeFileSync(path.join(OUTDIR,String(spec.article).replace(/[^A-Za-z0-9._-]+/g,"_")+".json"),JSON.stringify(result,null,2)+"\n");
}

await browser.close();

const discoveries=fs.readdirSync(OUTDIR).filter(x=>x.endsWith(".json")).map(x=>JSON.parse(fs.readFileSync(path.join(OUTDIR,x),"utf8")));
const candidates=[];
for(const d of discoveries)for(const p of d.autoBindings||[])candidates.push(p);
registry.candidates=candidates;
registry.updatedAt=new Date().toISOString();
fs.writeFileSync(REGISTRY,JSON.stringify(registry,null,2)+"\n");
console.log(JSON.stringify({articles:discoveries.map(x=>({article:x.article,photos:x.photoUrls?.length||0,applications:x.applicationUrls?.length||0,constructors:x.constructors?.length||0,bindings:x.autoBindings?.length||0,errors:x.errors?.length||0})),candidates:candidates.length},null,2));
