/* SVG path normalization used by the on-page logo editor.
   Unsupported segment families (notably elliptic arcs) remain untouched. */
(function(root){
  'use strict';
  const re=/[a-zA-Z]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g;
  const arity={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,Z:0};
  function parse(d){
    const src=String(d||'');
    if(/[Aa]/.test(src.replace(/[eE][-+]?\d+/g,'')))return null;
    const tokens=src.match(re)||[];
    if(!tokens.length)return [];
    const out=[];let i=0,op=null,x=0,y=0,sx=0,sy=0,cubic=null,quad=null;
    const isCmd=s=>/^[A-Za-z]$/.test(s);
    function read(n){
      if(i+n>tokens.length||tokens.slice(i,i+n).some(isCmd))throw Error('Недостаточно координат пути');
      const values=tokens.slice(i,i+n).map(Number);
      if(values.some(v=>!Number.isFinite(v)))throw Error('Некорректные координаты');
      i+=n;return values;
    }
    try{
      while(i<tokens.length){
        if(isCmd(tokens[i]))op=tokens[i++];
        if(!op)return null;
        const upper=op.toUpperCase(),rel=op!==upper,n=arity[upper];
        if(n===undefined)return null;
        if(upper==='Z'){
          out.push({cmd:'Z'});x=sx;y=sy;cubic=null;quad=null;op=null;continue;
        }
        if(i>=tokens.length||isCmd(tokens[i]))return null;
        const p=read(n),prev=out[out.length-1]?.cmd;
        const ax=(v)=>v+(rel?x:0),ay=(v)=>v+(rel?y:0);
        let seg;
        if(upper==='M'||upper==='L'){
          seg={cmd:upper,x:ax(p[0]),y:ay(p[1])};
          if(upper==='M'){sx=seg.x;sy=seg.y;op=rel?'l':'L'}
        }else if(upper==='H')seg={cmd:'L',x:ax(p[0]),y};
        else if(upper==='V')seg={cmd:'L',x,y:ay(p[0])};
        else if(upper==='C')seg={cmd:'C',x1:ax(p[0]),y1:ay(p[1]),x2:ax(p[2]),y2:ay(p[3]),x:ax(p[4]),y:ay(p[5])};
        else if(upper==='S')seg={cmd:'C',x1:prev==='C'&&cubic?2*x-cubic.x: x,y1:prev==='C'&&cubic?2*y-cubic.y:y,x2:ax(p[0]),y2:ay(p[1]),x:ax(p[2]),y:ay(p[3])};
        else if(upper==='Q')seg={cmd:'Q',x1:ax(p[0]),y1:ay(p[1]),x:ax(p[2]),y:ay(p[3])};
        else if(upper==='T')seg={cmd:'Q',x1:prev==='Q'&&quad?2*x-quad.x:x,y1:prev==='Q'&&quad?2*y-quad.y:y,x:ax(p[0]),y:ay(p[1])};
        else return null;
        out.push(seg);x=seg.x;y=seg.y;
        cubic=seg.cmd==='C'?{x:seg.x2,y:seg.y2}:null;
        quad=seg.cmd==='Q'?{x:seg.x1,y:seg.y1}:null;
      }
    }catch{return null}
    return out;
  }
  function fmt(n){return String(Number(Number(n).toFixed(3)))}
  function stringify(a){return a.map(v=>{
    if(v.cmd==='Z')return 'Z';
    if(v.cmd==='M'||v.cmd==='L')return v.cmd+' '+fmt(v.x)+' '+fmt(v.y);
    if(v.cmd==='C')return 'C '+[v.x1,v.y1,v.x2,v.y2,v.x,v.y].map(fmt).join(' ');
    if(v.cmd==='Q')return 'Q '+[v.x1,v.y1,v.x,v.y].map(fmt).join(' ');
    return '';
  }).join(' ')}
  function smoothPolyline(value,close=false){
    const coords=String(value||'').match(/[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g)?.map(Number)||[];
    if(coords.length<4||coords.length%2)return null;
    const pts=[];for(let i=0;i<coords.length;i+=2)pts.push({x:coords[i],y:coords[i+1]});
    const result=[{cmd:'M',...pts[0]}];
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
      result.push({cmd:'C',x1:p1.x+(p2.x-p0.x)/6,y1:p1.y+(p2.y-p0.y)/6,x2:p2.x-(p3.x-p1.x)/6,y2:p2.y-(p3.y-p1.y)/6,x:p2.x,y:p2.y});
    }
    if(close)result.push({cmd:'Z'});
    return stringify(result);
  }
  root.gwbLogoPath={parse,stringify,smoothPolyline};
})(window);