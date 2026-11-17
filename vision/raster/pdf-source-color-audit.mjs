/**
 * C3B.3.L2 — read-only PDF source color diagnostics.
 *
 * PDF.js may normalize device CMYK and spot paint to RGB; therefore only
 * original bytes are inspected here. This is a deliberately bounded lexer,
 * NOT a PDF validator, CMS, renderer or production color-separation engine.
 * Any unsupported encoding/structure/operator returns MANUAL.
 */
const no=reason=>({schema:'printcheck.vision.pdf-source-colors.v1',
  status:'MANUAL',reason,requires_manual:true,
  source_structure_verified:false,color_equivalence_proven:false,
  production_approved:false});
const ws=c=>/[\u0000-\u0020]/.test(c);
const delim=c=>ws(c)||/[\/\[\]()<>%{}]/.test(c);
const isNum=s=>/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s)&&Number.isFinite(Number(s));
function decodeName(raw){
  if(/#(?![0-9a-fA-F]{2})/.test(raw))return null;
  return raw.replace(/#([0-9a-fA-F]{2})/g,(_,hex)=>
    String.fromCharCode(parseInt(hex,16)));
}
function tokensOf(stream){
  const out=[];
  for(let i=0;i<stream.length;){
    let c=stream[i];
    if(ws(c)){i++;continue}
    if(c==='%'){
      while(i<stream.length&&stream[i]!=='\n'&&stream[i]!=='\r')i++;
      continue;
    }
    if(c==='/'){
      let j=++i;
      while(i<stream.length&&!delim(stream[i]))i++;
      if(i===j)return null;
      const name=decodeName(stream.slice(j,i));
      if(!name||!/^[-A-Za-z0-9_.+]+$/.test(name))return null;
      out.push({kind:'name',value:name});
    }else{
      if(/[<>\[\](){}]/.test(c))return null;
      let j=i;
      while(i<stream.length&&!delim(stream[i]))i++;
      if(i===j)return null;
      const word=stream.slice(j,i);
      if(isNum(word))out.push({kind:'num',value:Number(word)});
      else if(/^[A-Za-z*]+$/.test(word))
        out.push({kind:'op',value:word});
      else return null;
    }
    if(out.length>20000)return null;
  }
  return out;
}
const specs=new Map([
  ['rg',[3,'DeviceRGB']],['RG',[3,'DeviceRGB']],
  ['g',[1,'DeviceGray']],['G',[1,'DeviceGray']],
  ['k',[4,'DeviceCMYK']],['K',[4,'DeviceCMYK']]
]);
const argCounts=new Map([
  ['re',4],['m',2],['l',2],['c',6],['v',4],['y',4],
  ['h',0],['f',0],['f*',0],['S',0],['s',0],
  ['B',0],['B*',0],['b',0],['b*',0],['n',0],
  ['q',0],['Q',0],['cm',6],['w',1],['J',1],['j',1],
  ['M',1],['d',-1]
]);
export function inspectPdfSourceColors(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.length<50||
     bytes.length>16_000_000)return no('PDF_SOURCE_BYTES_INVALID');
  const raw=Buffer.from(bytes).toString('latin1');
  if(!raw.startsWith('%PDF-1.')||!raw.includes('startxref')||
     /[^\x09\x0a\x0d\x20-\x7e]/.test(raw))
    return no('PDF_SOURCE_ENCODING_UNSUPPORTED');
  const streams=[...raw.matchAll(/\bstream\r?\n([\s\S]*?)endstream\b/g)];
  if(streams.length!==1||
     (raw.match(/\bstream\b/g)||[]).length!==1||
     (raw.match(/\bendstream\b/g)||[]).length!==1||
     /\/(?:Filter|Encrypt|ObjStm|XRefStm)\b/.test(raw))
    return no('PDF_CONTENT_STREAM_UNSUPPORTED');
  const tokens=tokensOf(streams[0][1]);
  if(!tokens)return no('PDF_CONTENT_LEXER_UNSUPPORTED');
  const spaces=new Set(),paint=new Set();
  let pending=[],ops=0,requiresManual=false;
  for(const token of tokens){
    if(token.kind!=='op'){pending.push(token);if(pending.length>32)return no('PDF_OPERATOR_OPERANDS_UNSUPPORTED');continue}
    ops++;
    const op=token.value,spec=specs.get(op);
    if(spec){
      if(pending.length!==spec[0]||pending.some(x=>x.kind!=='num'))
        return no('PDF_COLOR_OPERANDS_UNSUPPORTED');
      spaces.add(spec[1]);
    }else if(op==='cs'||op==='CS'){
      if(pending.length!==1||pending[0].kind!=='name')
        return no('PDF_NAMED_COLORSPACE_UNSUPPORTED');
      const name=pending[0].value;
      const space=['DeviceRGB','DeviceGray','DeviceCMYK'].includes(name)?
        name:'NamedColorSpace';
      spaces.add(space);if(space==='NamedColorSpace')requiresManual=true;
    }else if(['sc','SC','scn','SCN'].includes(op)){
      // Color values depend on preceding ColorSpace resource; never infer
      // a printable channel from arbitrary component counts.
      if(!pending.length||pending.some(x=>x.kind!=='num'&&x.kind!=='name'))
        return no('PDF_COMPLEX_COLOR_OPERANDS_UNSUPPORTED');
      requiresManual=true;spaces.add('ExplicitColorSpaceOperands');
    }else if(argCounts.has(op)){
      const count=argCounts.get(op);
      if(count<0||pending.length!==count||
         pending.some(x=>x.kind!=='num'))
        return no('PDF_GEOMETRY_OPERANDS_UNSUPPORTED');
      if(/^(?:f|f\*|S|s|B|B\*|b|b\*)$/.test(op))paint.add(op);
    }else return no('PDF_OPERATOR_UNSUPPORTED');
    pending=[];
  }
  if(pending.length||!paint.size)return no('PDF_PAINT_SEQUENCE_UNSUPPORTED');
  // Inspect declared resource color spaces without exposing custom spot names.
  const names=[...raw.matchAll(/\/([^\s<>[\](){}\/%]+)/g)]
    .map(x=>decodeName(x[1]));
  if(names.some(x=>!x))return no('PDF_NAME_ENCODING_UNSUPPORTED');
  if(names.includes('Separation'))spaces.add('Separation');
  if(names.includes('DeviceN'))spaces.add('DeviceN');
  if(names.includes('ICCBased'))spaces.add('ICCBased');
  if(names.includes('Pattern'))spaces.add('Pattern');
  if(names.includes('DeviceCMYK'))spaces.add('DeviceCMYK');
  if(names.includes('ColorSpace')&&spaces.size===0)requiresManual=true;
  requiresManual=requiresManual||[...spaces].some(s=>s!=='DeviceRGB');
  return {
    schema:'printcheck.vision.pdf-source-colors.v1',
    status:'SOURCE_COLOR_DIAGNOSTIC_ONLY',
    source_spaces:[...spaces].sort(),source_paint_operators:[...paint].sort(),
    operator_count:ops,requires_manual:requiresManual,
    source_structure_verified:false,color_equivalence_proven:false,
    icc_proven:false,spot_separations_proven:false,production_approved:false,
    note:'Raw operator diagnostics only; xref, signed document provenance and physical print colors are not verified'
  };
}
