
export function gwbTakeOpen() {
  const event=window.__gwbTracePending||null;
  window.__gwbTracePending=null;
  return event;
}
export function gwbReport(type,message) {
  if(!window.__gwbTraceToken)return;
  window.parent.postMessage({type,token:window.__gwbTraceToken,message},'*');
}
export function gwbReturnSvg(svg,x,y,w,h,pdfBytes,colorSpace) {
  if(!window.__gwbTraceToken)return;
  window.parent.postMessage({type:'gwb-tracedraw-svg',
    token:window.__gwbTraceToken,svg,pdfBytes,colorSpace,nativePdf:true,logoBoundsMm:{x,y,w,h}},'*');
}
export function gwbTakeApply() {
  const requested=window.__gwbTraceApply===true;
  window.__gwbTraceApply=false;
  return requested;
}
export function gwbQueueApply(){
  window.__gwbTraceApply=true;
}
export function gwbIsEmbedded() {return typeof window.__gwbTraceToken==='string'&&window.__gwbTraceToken.length>20;}
