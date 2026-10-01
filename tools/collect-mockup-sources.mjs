// collector-version: 9
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
const browser=await chromium.launch({headless:true,channel:"chrome"});
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
function upgradeProductPhotoUrl(raw){
  try{
    const u=new URL(raw);
    u.pathname=u.pathname.replace(/^\/size\/\d+\//,"/").replace(/_200x200(?=\.)/i,"_500");
    return u.href;
  }catch{return raw}
}
function photoStem(raw){
  try{return decodeURIComponent(new URL(raw).pathname.split("/").pop()||"").replace(/_(?:200x200|300x300|400|500)(?=\.)/i,"").replace(/\.[^.]+$/,"").toLowerCase();}
  catch{return String(raw||"").toLowerCase();}
}
function unionBoxes(boxes){
  if(!boxes.length)return null;
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  const x2=Math.max(...boxes.map(b=>b.x+b.w)),y2=Math.max(...boxes.map(b=>b.y+b.h));
  return{x,y,w:x2-x,h:y2-y};
}
function parsePlaceFields(text){
  const flat=String(text||"").replace(/\s+/g," ").trim(),out=[];
  const re=/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s+(.+?)(?=(?:\d+(?:[.,]\d+)?)\s*[×x]|Кастомизация|Расчет|Предложений|$)/gi;
  for(const m of flat.matchAll(re)){
    const place=m[3].replace(/(?:по виду нанесения|Предложений нет).*$/i,"").trim();
    if(place&&place.length<100)out.push({sizeCm:[Number(m[1].replace(",",".")),Number(m[2].replace(",","."))],place});
  }
  return out;
}
function svgPrintGeometry(probes,fieldMeta=[]){
  const prints=probes.filter(z=>/(^|\s)print(\s|$)/.test(z.class||""));
  const mains=probes.filter(z=>/(^|\s)main(\s|$)/.test(z.class||""));
  return prints.map((p,i)=>{
    const pc=p.box.x+p.box.w/2;
    const nearby=mains.filter(m=>{
      const mc=m.box.x+m.box.w/2;
      const overlap=Math.min(p.box.x+p.box.w,m.box.x+m.box.w)-Math.max(p.box.x,m.box.x);
      return overlap>0||Math.abs(mc-pc)<Math.max(120,p.box.w*.9);
    });
    const objectBox=unionBoxes(nearby.map(x=>x.box));
    let normalized=null;
    if(objectBox&&objectBox.w>0&&objectBox.h>0){
      normalized={
        x:(p.box.x-objectBox.x)/objectBox.w,
        y:(p.box.y-objectBox.y)/objectBox.h,
        w:p.box.w/objectBox.w,
        h:p.box.h/objectBox.h
      };
    }
    return {index:i,printBox:p.box,objectBox,normalized,meta:fieldMeta[i]||null,raw:p};
  }).filter(x=>x.objectBox&&x.normalized);
}
async function detectProductObject(ctx,url){
  let chosen=upgradeProductPhotoUrl(url),buf;
  try{buf=await download(ctx,chosen)}catch{chosen=url;buf=await download(ctx,url)}
  const img=sharp(buf,{failOn:"none"}).rotate().flatten({background:"#ffffff"}).removeAlpha();
  const meta=await img.metadata(),ow=meta.width||1,oh=meta.height||1;
  const scale=Math.min(1,700/Math.max(ow,oh)),w=Math.max(1,Math.round(ow*scale)),h=Math.max(1,Math.round(oh*scale));
  const data=await img.resize(w,h,{fit:"fill"}).raw().toBuffer();
  const sample=[];
  const add=(x,y)=>{const i=(y*w+x)*3;sample.push([data[i],data[i+1],data[i+2]])};
  const band=Math.max(2,Math.round(Math.min(w,h)*.04));
  for(let y=0;y<band;y++)for(let x=0;x<band;x++){add(x,y);add(w-1-x,y);add(x,h-1-y);add(w-1-x,h-1-y)}
  const bg=[0,1,2].map(c=>sample.map(v=>v[c]).sort((a,b)=>a-b)[Math.floor(sample.length/2)]||255);
  let minX=w,minY=h,maxX=-1,maxY=-1,count=0;
  const threshold=28;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*3;
    const d=(Math.abs(data[i]-bg[0])+Math.abs(data[i+1]-bg[1])+Math.abs(data[i+2]-bg[2]))/3;
    if(d>threshold){count++;if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y}
  }
  if(maxX<0)return null;
  const box={x:minX/w,y:minY/h,w:(maxX-minX+1)/w,h:(maxY-minY+1)/h};
  const ratio=count/(w*h),borderPenalty=(minX===0||minY===0||maxX===w-1||maxY===h-1)?.75:1;
  const confidence=Math.max(0,Math.min(1,(ratio>.04&&ratio<.85?1:.65)*borderPenalty));
  return{url:chosen,sourceUrl:url,stem:photoStem(chosen),width:ow,height:oh,box,pixelRatio:Number(ratio.toFixed(4)),background:bg,confidence};
}
function clamp01(v){return Math.max(0,Math.min(1,v))}
function transferField(norm,photoBox){
  const b={x:photoBox.x+norm.x*photoBox.w,y:photoBox.y+norm.y*photoBox.h,w:norm.w*photoBox.w,h:norm.h*photoBox.h};
  b.x=clamp01(b.x);b.y=clamp01(b.y);b.w=Math.max(0,Math.min(1-b.x,b.w));b.h=Math.max(0,Math.min(1-b.y,b.h));
  return b;
}
function groupSvgFields(fields){
  const groups=[];
  for(const f of fields){
    const cx=f.objectBox.x+f.objectBox.w/2;
    let g=groups.find(x=>Math.abs(x.cx-cx)<Math.max(40,f.objectBox.w*.25));
    if(!g){g={cx,objectBox:f.objectBox,fields:[]};groups.push(g)}
    g.fields.push(f);
  }
  return groups.sort((a,b)=>a.cx-b.cx);
}
async function buildSvgSilhouetteBindings(ctx,article,photoUrls,probes,fieldMeta,specPlaces){
  const fields=svgPrintGeometry(probes,fieldMeta),groups=groupSvgFields(fields);
  const analyses=[];
  for(const url of [...new Set(photoUrls.map(upgradeProductPhotoUrl))]){
    try{const a=await detectProductObject(ctx,url);if(a)analyses.push(a)}catch{}
  }
  const used=new Set(),groupPhoto=new Map();
  for(const g of groups){
    const ar=g.objectBox.w/g.objectBox.h;
    let best=null;
    for(const p of analyses){
      if(used.has(p.stem)&&analyses.length>=groups.length)continue;
      const par=p.box.w/p.box.h,aspectScore=Math.exp(-Math.abs(Math.log(Math.max(.01,par/ar))));
      const areaScore=Math.min(1,(p.box.w*p.box.h)/.22);
      const score=aspectScore*.75+areaScore*.15+p.confidence*.10;
      if(!best||score>best.score)best={p,score};
    }
    if(best){used.add(best.p.stem);groupPhoto.set(g,best)}
  }
  const out=[];
  for(const g of groups){
    const match=groupPhoto.get(g);if(!match)continue;
    for(const f of g.fields){
      const meta=f.meta||{},expected=(specPlaces||[]).find(x=>x.place&&meta.place&&String(x.place).toLocaleLowerCase("ru-RU")===String(meta.place).toLocaleLowerCase("ru-RU"))||(specPlaces||[])[f.index]||{};
      const rect=transferField(f.normalized,match.p.box),q=quadFromBbox(rect);
      const inside=f.normalized.x>=-.05&&f.normalized.y>=-.05&&f.normalized.x+f.normalized.w<=1.05&&f.normalized.y+f.normalized.h<=1.05;
      const confidence=Math.max(0,Math.min(1,match.score*(inside?1:.7)*match.p.confidence));
      out.push({
        schema:"gifts-mockup-profile/v1",
        article:String(article),variant:"",
        place:meta.place||expected.place||"",method:"",
        photo:{id:match.p.stem,name:"Фото gifts.ru",url:match.p.url,sourceUrl:match.p.sourceUrl},
        field:{id:expected.printId||("field-"+(f.index+1)),printId:expected.printId||"",applicationId:"",place:meta.place||expected.place||"",sizeCm:meta.sizeCm||expected.fieldSizeCm||null},
        targetQuad:q,surface:/по периметру|слева от ручки|напротив ручки|справа от ручки/i.test(String(meta.place||expected.place||""))?"cylinder":"perspective",render:{opacity:.9,blend:"source-over",mesh:18},
        status:confidence>=.82?"candidate-high":"candidate",
        confidence:Number(confidence.toFixed(4)),
        generatedBy:"github-actions-svg-silhouette-v1",
        evidence:{svgPrintBox:f.printBox,svgObjectBox:f.objectBox,normalizedField:f.normalized,photoObjectBox:match.p.box,photoPixelRatio:match.p.pixelRatio,photoScore:Number(match.score.toFixed(4))}
      });
    }
  }
  return{bindings:out,photoAnalyses:analyses,svgFields:fields.map(({raw,...x})=>x)};
}

for(const spec of specs){
  const page=await context.newPage();
  const result={article:String(spec.article),product:spec.product||"",productUrl:spec.productUrl,scannedAt:new Date().toISOString(),tabs:{},constructors:[],places:[],autoBindings:[],errors:[]};
  try{
    await page.goto(spec.productUrl,{waitUntil:"domcontentloaded",timeout:60000});
    await page.waitForTimeout(1200);
    result.finalUrl=page.url();
    result.title=await page.title();
    result.constructors=await page.locator("a[href]").evaluateAll(nodes=>nodes.map(a=>({text:(a.textContent||"").replace(/\s+/g," ").trim(),context:(a.parentElement?.textContent||"").replace(/\s+/g," ").trim().slice(0,500),href:a.href})).filter(x=>/конструктор/i.test(x.text+" "+x.context)&&/\.(?:pdf|cdr)(?:$|[?#])/i.test(x.href)));
    result.places=(await page.locator("select option").allTextContents()).map(x=>x.replace(/\s+/g," ").trim()).filter(x=>x&&x.length<120);
    result.placeHostText="";
    const shotDir=path.join(OUTDIR,"screenshots"); fs.mkdirSync(shotDir,{recursive:true});
    for(const label of ["Фото","Нанесение","Примеры"]){
      const clicked=await clickExact(page,label);
      const images=await visibleArticleImages(page,spec.article);
      const probes=await page.locator("[class*='print'],[class*='draw'],[class*='place'],[class*='maket'],[class*='logo'],svg rect,svg polygon,svg path").evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>2&&r.height>2&&s.display!=="none"&&s.visibility!=="hidden"}).slice(0,250).map(n=>{const r=n.getBoundingClientRect();return{tag:n.tagName,class:String(n.className?.baseVal??n.className??"").slice(0,200),id:n.id||"",text:(n.textContent||"").replace(/\s+/g," ").trim().slice(0,200),attrs:[...n.attributes].filter(a=>/^data-|^(x|y|width|height|points|d|fill|stroke)$/i.test(a.name)).slice(0,20).map(a=>[a.name,a.value]),box:{x:r.x,y:r.y,w:r.width,h:r.height}}}));
      result.tabs[label]={clicked,images,probes};
      if(label==="Нанесение") result.placeHostText=(await page.locator("#j_dc_places_host").textContent().catch(()=>""))||"";
      try{await page.screenshot({path:path.join(shotDir,String(spec.article).replace(/[^A-Za-z0-9._-]+/g,"_")+"-"+label+".png"),fullPage:false});}catch{}
    }
    const allPhotoTab=[...new Set((result.tabs["Фото"]?.images||[]).map(x=>cleanUrl(x.url)).filter(Boolean))];
    const photoUrls=allPhotoTab.filter(u=>/\/reviewer\/webp\//i.test(u));
    const exampleUrls=[...new Set((result.tabs["Примеры"]?.images||[]).map(x=>cleanUrl(x.url)).filter(u=>/\/reviewer\/tb\//i.test(u)))];
    const known=new Set([...photoUrls,...exampleUrls]);
    const applicationUrls=[...new Set((result.tabs["Нанесение"]?.images||[]).map(x=>cleanUrl(x.url)).filter(u=>u&&!known.has(u)))];
    result.photoUrls=photoUrls.map(upgradeProductPhotoUrl);
    result.applicationUrls=applicationUrls;
    result.matches=applicationUrls.length?await bestDiff(context,result.photoUrls,applicationUrls):[];
    const fieldMeta=parsePlaceFields(result.placeHostText);
    result.fieldMeta=fieldMeta;
    const mapped=await buildSvgSilhouetteBindings(context,spec.article,result.photoUrls,result.tabs["Нанесение"]?.probes||[],fieldMeta,spec.places||[]);
    result.svgFields=mapped.svgFields;
    result.photoAnalyses=mapped.photoAnalyses;
    result.autoBindings=mapped.bindings;
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
