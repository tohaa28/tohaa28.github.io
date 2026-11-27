/**
 * Synthetic PDF 1.4, deterministic correct xref and one opaque path.
 * Only for independent raster integration tests; NOT a PDF producer.
 */
export function makeSyntheticBlackPdf({
  width=72,height=36,paint='0 0 0 rg'
}={}){
  const content=paint+'\n0 0 '+width+' '+height+' re\nf\n';
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+width+' '+height+'] /Contents 4 0 R /Resources << >> >>',
    '<< /Length '+Buffer.byteLength(content)+' >>\nstream\n'+content+'endstream'
  ];
  let body='%PDF-1.4\n',positions=[0];
  for(let i=0;i<objects.length;i++){
    positions.push(Buffer.byteLength(body));
    body+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
  }
  const xref=Buffer.byteLength(body);
  body+='xref\n0 5\n0000000000 65535 f \n';
  for(let i=1;i<=4;i++)
    body+=String(positions[i]).padStart(10,'0')+' 00000 n \n';
  body+='trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return Buffer.from(body,'utf8');
}
