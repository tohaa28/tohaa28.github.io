import os, json, math, time
from collections import defaultdict
import requests
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A3
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

S,N,W,E=59.910,59.962,30.269,30.365
mm=72/25.4
pw,ph=A3
left,bottom=15*mm,17*mm
tw,th=267*mm,381*mm
sx,sy=tw-10*mm,th-10*mm
mw,mh=tw+3*sx,th+2*sy
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
pdfmetrics.registerFont(TTFont('ru',font))
pdfmetrics.registerFont(TTFont('rub',bold))
output='Saint_Petersburg_Center_A3_Map.pdf'

def xy(lon,lat):
    return ((lon-W)/(E-W)*mw,(lat-S)/(N-S)*mh)
def intersects(a,b):
    return a[0]<=b[2] and a[2]>=b[0] and a[1]<=b[3] and a[3]>=b[1]
def drawpath(c,pts,closed=False):
    if len(pts)<2:return
    p=c.beginPath();p.moveTo(*pts[0])
    for xy1 in pts[1:]:p.lineTo(*xy1)
    if closed:p.close()
    c.drawPath(p,fill=int(closed),stroke=1)
def fetch():
    cache='osm_map_data.json'
    if os.path.isfile(cache):return json.load(open(cache,encoding='utf8'))
    servers=['https://overpass-api.de/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass.osm.ch/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass.nchc.org.tw/api/interpreter']
    found={}
    for i in range(4):
      for j in range(4):
        a,b=S+(N-S)*i/4,S+(N-S)*(i+1)/4
        d,e=W+(E-W)*j/4,W+(E-W)*(j+1)/4
        bbox=f'({a},{d},{b},{e})'
        q='[out:json][timeout:180];('+''.join('way["'+x+'"]'+bbox+';' for x in ['highway','building','waterway'])+'way["natural"="water"]'+bbox+';way["leisure"="park"]'+bbox+';node["addr:housenumber"]'+bbox+';);out body geom;'
        error=None
        for url in servers:
          try:
            print('Request',i,j,url,flush=True)
            r=requests.post(url,data={'data':q},timeout=210,headers={'User-Agent':'OSM print atlas (noncommercial map)'});r.raise_for_status()
            records=r.json()['elements']
            if len(records)<100:raise ValueError('Empty Overpass response')
            for el in records:found[str(el['type'])+'/'+str(el['id'])]=el
            print('Received',len(records),flush=True);time.sleep(1)
            error=None;break
          except Exception as ex:
            error=ex;print('Retry:',str(ex)[:160],flush=True);time.sleep(1)
        if error:raise RuntimeError('No OSM data quadrant '+str((i,j))+': '+str(error))
    data=list(found.values());json.dump(data,open(cache,'w',encoding='utf8'),ensure_ascii=False)
    return data
def process(data):
    lyr=defaultdict(list)
    for o in data:
      tags=o.get('tags',{})
      if o['type']=='node':
        if tags.get('addr:housenumber'):lyr['addr'].append((*xy(o['lon'],o['lat']),str(tags['addr:housenumber'])))
        continue
      geom=o.get('geometry',[])
      if len(geom)<2:continue
      pts=[xy(p['lon'],p['lat']) for p in geom]
      xs=[p[0] for p in pts];ys=[p[1] for p in pts]
      box=(min(xs),min(ys),max(xs),max(ys))
      item=(pts,box,tags)
      if tags.get('natural')=='water':lyr['water'].append(item)
      elif tags.get('leisure')=='park':lyr['parks'].append(item)
      elif 'building' in tags:
        lyr['buildings'].append(item)
        if tags.get('addr:housenumber'):lyr['addr'].append(((box[0]+box[2])/2,(box[1]+box[3])/2,str(tags['addr:housenumber'])))
      elif 'highway' in tags:lyr['roads'].append(item)
      elif 'waterway' in tags:lyr['canals'].append(item)
    return lyr
def width(cls):
    if cls in ('motorway','trunk','primary'):return 13
    if cls in ('secondary','tertiary'):return 10
    if cls in ('residential','unclassified','living_street'):return 7
    if cls in ('footway','path','steps'):return 1.1
    return 3.5
def drawmap(c,lyr,window):
    for layer,color,border in [('parks','#e6efd8','#cfe4c6'),('water','#cce9f6','#aed6e8'),('buildings','#e5e2de','#c9c6c2')]:
      c.setFillColor(HexColor(color));c.setStrokeColor(HexColor(border));c.setLineWidth(.3)
      for pts,bb,t in lyr[layer]:
        if intersects(bb,window):drawpath(c,pts,True)
    c.setStrokeColor(HexColor('#a4d6eb'))
    for pts,bb,t in lyr['canals']:
      if intersects(bb,window):
        c.setLineWidth(5 if t.get('waterway')=='river' else 3);drawpath(c,pts)
    roads=[(pts,bb,t) for pts,bb,t in lyr['roads'] if intersects(bb,window)]
    for pts,bb,t in roads:
      c.setStrokeColor(HexColor('#bfc2c0'));c.setLineWidth(width(t.get('highway'))+1);drawpath(c,pts)
    for pts,bb,t in roads:
      cl=t.get('highway');c.setStrokeColor(HexColor('#fff6e2') if cl in ('primary','secondary','trunk') else HexColor('#ffffff'))
      c.setLineWidth(width(cl));drawpath(c,pts)
    c.setFillColor(HexColor('#555753'));c.setFont('ru',5.6)
    seen=set()
    for x,y,label in lyr['addr']:
      if window[0]+3<x<window[2]-3 and window[1]+3<y<window[3]-3:
        key=(int(x/13),int(y/9))
        if key in seen:continue
        seen.add(key);c.drawCentredString(x,y,label[:9])
    best={}
    for pts,bb,t in roads:
      name=t.get('name','').strip()
      if not name or t.get('highway') in ('service','footway','steps','path') or len(name)>46:continue
      for a,b in zip(pts,pts[1:]):
        length=math.dist(a,b);x=(a[0]+b[0])/2;y=(a[1]+b[1])/2
        if length<20 or not (window[0]+18<x<window[2]-18 and window[1]+12<y<window[3]-12):continue
        if name not in best or best[name][0]<length:best[name]=(length,x,y,math.degrees(math.atan2(b[1]-a[1],b[0]-a[0])))
    taken=set()
    for name,(length,x,y,angle) in sorted(best.items(),key=lambda v:-v[1][0]):
      fs=7.1 if length>55 else 6.3
      wid=pdfmetrics.stringWidth(name,'ru',fs)
      if wid>max(length*1.6,30):continue
      cell=(int(x/58),int(y/22))
      if cell in taken:continue
      taken.add(cell)
      if angle>90:angle-=180
      if angle< -90:angle+=180
      c.saveState();c.translate(x,y);c.rotate(angle)
      c.setFillColor(HexColor('#ffffff'));c.roundRect(-wid/2-2,-2,wid+4,fs+3,2,stroke=0,fill=1)
      c.setFillColor(HexColor('#2c3841'));c.setFont('ru',fs);c.drawCentredString(0,0,name);c.restoreState()
def cover(c):
    c.setFillColor(HexColor('#1b3e50'));c.rect(0,ph-115,pw,115,stroke=0,fill=1)
    c.setFillColor(HexColor('#ffffff'));c.setFont('rub',25);c.drawString(48,ph-64,'САНКТ-ПЕТЕРБУРГ')
    c.setFont('ru',12);c.drawString(50,ph-88,'Центр. Карта для печати и сборки')
    c.setFillColor(HexColor('#244557'));c.setFont('rub',15);c.drawString(48,ph-156,'Схема сборки: 12 листов А3')
    for row in range(3):
      for col in range(4):
        x=50+col*139;y=470+(2-row)*161
        c.setFillColor(HexColor('#e9f2f5'));c.setStrokeColor(HexColor('#7099ab'))
        c.roundRect(x,y,129,151,5,stroke=1,fill=1)
        c.setFillColor(HexColor('#22485b'));c.setFont('rub',27)
        c.drawCentredString(x+64,y+78,chr(65+col)+str(row+1))
        c.setFont('ru',9);c.drawCentredString(x+64,y+55,'Лист '+str(row*4+col+1))
    c.setFillColor(HexColor('#333d42'));c.setFont('ru',11)
    for i,txt in enumerate([
      'Печатать на листах А3 вертикально, в масштабе 100%.',
      'Не включать «Вписать в страницу» и автоматическое масштабирование.',
      'Перекрытие соседних листов 10 мм. Совмещайте перекрестия.',
      'Листы A1–D1 сверху, A2–D2 посередине, A3–D3 снизу.',
      'Данные: OpenStreetMap. Номера домов показаны при наличии в базе.']):
      c.drawString(49,405-i*25,txt)
    c.setFont('ru',8);c.setFillColor(HexColor('#627783'))
    c.drawString(49,65,'© OpenStreetMap contributors — openstreetmap.org/copyright')
    c.drawString(49,49,'Область: 59.910–59.962° N, 30.269–30.365° E.')
    c.showPage()
def tile(c,lyr,row,col):
    idx=chr(65+col)+str(row+1)
    dx=col*sx;dy=mh-th-row*sy
    window=(dx,dy,dx+tw,dy+th)
    c.setFillColor(HexColor('#2f5363'));c.setFont('rub',11);c.drawString(left,ph-32,'САНКТ-ПЕТЕРБУРГ / ЦЕНТР')
    c.drawRightString(pw-left,ph-32,idx)
    c.saveState()
    p=c.beginPath();p.rect(left,bottom,tw,th);c.clipPath(p,stroke=0,fill=0)
    c.setFillColor(HexColor('#fafaf7'));c.rect(left,bottom,tw,th,stroke=0,fill=1)
    c.translate(left-dx,bottom-dy)
    drawmap(c,lyr,window)
    c.restoreState()
    c.setStrokeColor(HexColor('#6d8b99'));c.setLineWidth(.7);c.rect(left,bottom,tw,th,stroke=1,fill=0)
    c.setStrokeColor(HexColor('#dd564e'));c.setLineWidth(.6)
    for x in (left,left+tw):
      for y in (bottom,bottom+th):c.line(x-6,y,x+6,y);c.line(x,y-6,x,y+6)
    c.setFillColor(HexColor('#526b74'));c.setFont('ru',7.5)
    if col<3:c.drawRightString(left+tw-4,bottom+th-12,'→ '+chr(66+col)+str(row+1))
    if col>0:c.drawString(left+4,bottom+th-12,'← '+chr(64+col)+str(row+1))
    if row>0:c.drawCentredString(left+tw/2,bottom+th-12,'↑ '+chr(65+col)+str(row))
    if row<2:c.drawCentredString(left+tw/2,bottom+9,'↓ '+chr(65+col)+str(row+2))
    c.setFont('ru',7.5);c.drawString(left,22,'© OpenStreetMap contributors · Нахлёст 10 мм')
    c.drawRightString(pw-left,22,idx+' · '+str(row*4+col+1)+'/12')
    c.showPage()
def main():
    data=fetch();print('OSM objects',len(data),flush=True)
    layers=process(data);print('Counts',[(k,len(v)) for k,v in layers.items()],flush=True)
    assert len(layers['roads'])>200 and len(layers['buildings'])>500,'Map data incomplete'
    c=canvas.Canvas(output,pagesize=A3,pageCompression=1)
    c.setTitle('Санкт-Петербург. Центр. A3, 12 листов + схема');c.setAuthor('OpenStreetMap contributors')
    cover(c)
    for row in range(3):
      for col in range(4):
        tile(c,layers,row,col)
        print('Rendered',chr(65+col)+str(row+1),flush=True)
    c.save();print('READY',output,os.path.getsize(output),flush=True)
if __name__=='__main__':main()
