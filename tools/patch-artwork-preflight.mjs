// Reproducible integration patch for the existing compiled editor.
// The bundled PDF.js and all field/printN/clip algorithms remain byte-identical.
// Fail closed if either the baseline or resulting application changes.
import fs from 'node:fs';
import crypto from 'node:crypto';
const file=new URL('../assets/index-BpU9kvz8.js',import.meta.url);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const baseline="b998f2eea9db87da364a288a71bd2701978142bdf6e3e7d2802574b934f432b3";
const expected="c4460e0e1c41075c3c8969c6dce8b1bc3c90c8599756f4076772e5b33438f929";
const edits=[
  [
    "",
    "import {inspectArtwork,checkLogo,renderDiagnostics,contextFromOrder,drawPreflightMarkers} from \"./logo-preflight.mjs?v=20260929-1\";\n"
  ],
  [
    "return i}async function fs(c,t)",
    "if(t===\"art\")i.preflight=await inspectArtwork(i,xt);return i}async function fs(c,t)"
  ],
  [
    "function Ze(c,t){const e=t.w/t.h;let s=c.w*.8,i=s/e;i>c.h*.8&&(i=c.h*.8,s=i*e);",
    "function Ze(c,t){const e=t.w/t.h;let s=c.w*.95,i=s/e;i>c.h*.95&&(i=c.h*.95,s=i*e);"
  ],
  [
    "function X(){const c=y.template;if(H.clearRect(0,0,pt.width,pt.height),!c)return;const t=y.view||{x:0,y:0,w:c.w,h:c.h},e=pt.width/t.w,s=pt.height/t.h,i=pt.width/Math.max(1,pt.clientWidth);Ft(),H.save(),H.scale(e,s),H.translate(-t.x,-t.y);const n=y.placement,r=y.field;for(const[u,p]of(c.fieldOptions||[]).entries())p.page===y.page&&(H.strokeStyle=\"#17838b\",H.lineWidth=2*i/e,H.setLineDash([5*i/e,4*i/e]),gwbCanvasFieldPath(H,p)?H.stroke():H.strokeRect(p.x,p.y,p.w,p.h),H.setLineDash([]),H.fillStyle=\"#126b70\",H.font=`bold ${12*i/e}px system-ui`,H.fillText(String(u+1),p.x+4*i/e,p.y+16*i/e));for(const[u,p]of y.placements.entries())if(p.page===y.page&&p.placement&&p.art){const f=p.placement;H.save(),f.clipToField&&p.field&&(gwbCanvasFieldPath(H,p.field)?H.clip(p.field.evenOdd?\"evenodd\":\"nonzero\"):(H.beginPath(),H.rect(p.field.x,p.field.y,p.field.w,p.field.h),H.clip())),H.translate(f.x+f.w/2,f.y+f.h/2),H.rotate((f.rotation||0)*Math.PI/180),H.drawImage(p.art.image,-f.w/2,-f.h/2,f.w,f.h),H.strokeStyle=u===y.active?\"#f07832\":\"#12808a\",H.lineWidth=(u===y.active?2:1)*i/e,H.strokeRect(-f.w/2,-f.h/2,f.w,f.h),H.restore()}n&&y.art&&(H.strokeStyle=\"#f07832\",H.fillStyle=\"white\",H.beginPath(),H.arc(n.x+n.w,n.y+n.h,6*i/e,0,Math.PI*2),H.fill(),H.stroke()),r&&(H.strokeStyle=\"#007d88\",H.lineWidth=2*i/e,H.setLineDash([7*i/e,4*i/e]),gwbCanvasFieldPath(H,r)?H.stroke():H.strokeRect(r.x,r.y,r.w,r.h),H.setLineDash([])),H.restore();const a=(c.fieldOptions||[]).findIndex(u=>r&&u.page===y.page&&Math.abs(u.x-r.x)+Math.abs(u.y-r.y)+Math.abs(u.w-r.w)+Math.abs(u.h-r.h)<.3);v(\"fieldSize\").textContent=r?`${a>=0?\"Поле \"+(a+1)+\" · \":\"\"}${ft(r.nominalW||r.w)} × ${ft(r.nominalH||r.h)} мм · ${r.source===\"pdf-vector\"?\"из векторного шаблона\":r.source===\"pdf-opacity-98-fill\"?\"по прозрачной заливке\":\"выделено вручную\"}`:\"Поле не выбрано\",n?(document.activeElement!==v(\"width\")&&(v(\"width\").value=ft(n.w)),document.activeElement!==v(\"height\")&&(v(\"height\").value=ft(n.h)),v(\"position\").textContent=`X ${ft(n.x-(r?.x||0))} · Y ${ft(n.y-(r?.y||0))} мм ${r?\"от поля\":\"от страницы\"}`):(v(\"width\").value=\"\",v(\"height\").value=\"\",v(\"position\").textContent=y.field?\"Загрузите логотип для этого поля\":\"Выберите поле\"),v(\"rotateLeft\").disabled=v(\"rotateRight\").disabled=v(\"rotation\").disabled=v(\"clipToField\").disabled=!n;const E=y.active>=0&&y.placements[y.active]?.art&&y.placements[y.active]?.placement;v(\"zoomPage\").hidden=!y.view,v(\"templatePickHint\").hidden=!!y.view,v(\"editorStep3\").hidden=!(y.view&&y.field),v(\"fieldLogoTools\").hidden=!(y.view&&y.field),v(\"editorAddLogo\").textContent=E?\"Заменить логотип\":\"Добавить логотип\",v(\"editorFit\").disabled=v(\"editorCenter\").disabled=v(\"editorAngle\").disabled=v(\"editorRotateLeft\").disabled=v(\"editorRotateRight\").disabled=v(\"editorClip\").disabled=v(\"editorRemoveLogo\").disabled=!E,document.activeElement!==v(\"editorAngle\")&&(v(\"editorAngle\").value=String(n?.rotation||0)),document.activeElement!==v(\"rotation\")&&(v(\"rotation\").value=String(n?.rotation||0)),v(\"editorClip\").checked=v(\"clipToField\").checked=!!n?.clipToField;const o=y.placements.some(u=>u.art&&u.placement&&u.field);v(\"step4Box\").hidden=!o;const l=pe().some(u=>u.status===\"bad\"),h=l?JSON.stringify(y.placements.map(u=>[u.art?.name,u.field,u.placement])):\"\";h!==ln&&(v(\"confirmErrors\").checked=!1,ln=h);const d=l&&!v(\"confirmErrors\").checked;v(\"confirmErrorsBox\").hidden=!l,v(\"export\").disabled=y.busy||!o||d,v(\"saveProject\").disabled=y.busy||!o||d,v(\"prepareOrderPdf\").disabled=y.busy||!o||d,v(\"simpleFit\").disabled=v(\"simpleCenter\").disabled=y.busy||!y.art||!y.field||!y.placement,v(\"simpleExport\").disabled=y.busy||!o||d,v(\"simpleFill\").disabled=y.busy||!y.art||!(c.fieldOptions||[]).some((u,p)=>!y.placements.some(f=>f.fieldIndex===p&&f.art)),v(\"simpleDraw\").hidden=!!c.fieldOptions?.length&&!y.draw,v(\"simpleFill\").hidden=(c.fieldOptions?.length||0)<2,v(\"simpleDraw\").textContent=y.draw?\"Коснитесь шаблона и обведите поле\":\"Обвести поле на шаблоне\",yi()}",
    "function X(){const c=y.template;if(H.clearRect(0,0,pt.width,pt.height),!c)return;const t=y.view||{x:0,y:0,w:c.w,h:c.h},e=pt.width/t.w,s=pt.height/t.h,i=pt.width/Math.max(1,pt.clientWidth);Ft(),H.save(),H.scale(e,s),H.translate(-t.x,-t.y);const n=y.placement,r=y.field;for(const[u,p]of(c.fieldOptions||[]).entries())p.page===y.page&&(H.strokeStyle=\"#17838b\",H.lineWidth=2*i/e,H.setLineDash([5*i/e,4*i/e]),gwbCanvasFieldPath(H,p)?H.stroke():H.strokeRect(p.x,p.y,p.w,p.h),H.setLineDash([]),H.fillStyle=\"#126b70\",H.font=`bold ${12*i/e}px system-ui`,H.fillText(String(u+1),p.x+4*i/e,p.y+16*i/e));for(const[u,p]of y.placements.entries())if(p.page===y.page&&p.placement&&p.art){const f=p.placement;H.save(),f.clipToField&&p.field&&(gwbCanvasFieldPath(H,p.field)?H.clip(p.field.evenOdd?\"evenodd\":\"nonzero\"):(H.beginPath(),H.rect(p.field.x,p.field.y,p.field.w,p.field.h),H.clip())),H.translate(f.x+f.w/2,f.y+f.h/2),H.rotate((f.rotation||0)*Math.PI/180),H.drawImage(p.art.image,-f.w/2,-f.h/2,f.w,f.h),H.strokeStyle=u===y.active?\"#f07832\":\"#12808a\",H.lineWidth=(u===y.active?2:1)*i/e,H.strokeRect(-f.w/2,-f.h/2,f.w,f.h),H.restore()}n&&y.art&&(H.strokeStyle=\"#f07832\",H.fillStyle=\"white\",H.beginPath(),H.arc(n.x+n.w,n.y+n.h,6*i/e,0,Math.PI*2),H.fill(),H.stroke()),r&&(H.strokeStyle=\"#007d88\",H.lineWidth=2*i/e,H.setLineDash([7*i/e,4*i/e]),gwbCanvasFieldPath(H,r)?H.stroke():H.strokeRect(r.x,r.y,r.w,r.h),H.setLineDash([])),H.restore();if(document.getElementById(\"preflightMarkers\")?.checked&&n){const report=window.gwbLogoPreflight?.find(q=>q.fieldIndex===y.placements[y.active]?.fieldIndex&&q.page===y.page);H.save();H.scale(e,s);H.translate(-t.x,-t.y);drawPreflightMarkers(H,report,n,1.5*i/e);H.restore();}const a=(c.fieldOptions||[]).findIndex(u=>r&&u.page===y.page&&Math.abs(u.x-r.x)+Math.abs(u.y-r.y)+Math.abs(u.w-r.w)+Math.abs(u.h-r.h)<.3);v(\"fieldSize\").textContent=r?`${a>=0?\"Поле \"+(a+1)+\" · \":\"\"}${ft(r.nominalW||r.w)} × ${ft(r.nominalH||r.h)} мм · ${r.source===\"pdf-vector\"?\"из векторного шаблона\":r.source===\"pdf-opacity-98-fill\"?\"по прозрачной заливке\":\"выделено вручную\"}`:\"Поле не выбрано\",n?(document.activeElement!==v(\"width\")&&(v(\"width\").value=ft(n.w)),document.activeElement!==v(\"height\")&&(v(\"height\").value=ft(n.h)),v(\"position\").textContent=`X ${ft(n.x-(r?.x||0))} · Y ${ft(n.y-(r?.y||0))} мм ${r?\"от поля\":\"от страницы\"}`):(v(\"width\").value=\"\",v(\"height\").value=\"\",v(\"position\").textContent=y.field?\"Загрузите логотип для этого поля\":\"Выберите поле\"),v(\"rotateLeft\").disabled=v(\"rotateRight\").disabled=v(\"rotation\").disabled=v(\"clipToField\").disabled=!n;const E=y.active>=0&&y.placements[y.active]?.art&&y.placements[y.active]?.placement;v(\"zoomPage\").hidden=!y.view,v(\"templatePickHint\").hidden=!!y.view,v(\"editorStep3\").hidden=!(y.view&&y.field),v(\"fieldLogoTools\").hidden=!(y.view&&y.field),v(\"editorAddLogo\").textContent=E?\"Заменить логотип\":\"Добавить логотип\",v(\"editorFit\").disabled=v(\"editorCenter\").disabled=v(\"editorAngle\").disabled=v(\"editorRotateLeft\").disabled=v(\"editorRotateRight\").disabled=v(\"editorClip\").disabled=v(\"editorRemoveLogo\").disabled=!E,document.activeElement!==v(\"editorAngle\")&&(v(\"editorAngle\").value=String(n?.rotation||0)),document.activeElement!==v(\"rotation\")&&(v(\"rotation\").value=String(n?.rotation||0)),v(\"editorClip\").checked=v(\"clipToField\").checked=!!n?.clipToField;const o=y.placements.some(u=>u.art&&u.placement&&u.field);v(\"step4Box\").hidden=!o;const l=pe().some(u=>u.status===\"bad\"),h=l?JSON.stringify([y.placements.map(u=>[u.art?.name,u.field,u.placement]),pe().filter(u=>u.status===\"bad\")]):\"\";h!==ln&&(v(\"confirmErrors\").checked=!1,ln=h);const d=l&&!v(\"confirmErrors\").checked;v(\"confirmErrorsBox\").hidden=!l,v(\"export\").disabled=y.busy||!o||d,v(\"saveProject\").disabled=y.busy||!o||d,v(\"prepareOrderPdf\").disabled=y.busy||!o||d,v(\"simpleFit\").disabled=v(\"simpleCenter\").disabled=y.busy||!y.art||!y.field||!y.placement,v(\"simpleExport\").disabled=y.busy||!o||d,v(\"simpleFill\").disabled=y.busy||!y.art||!(c.fieldOptions||[]).some((u,p)=>!y.placements.some(f=>f.fieldIndex===p&&f.art)),v(\"simpleDraw\").hidden=!!c.fieldOptions?.length&&!y.draw,v(\"simpleFill\").hidden=(c.fieldOptions?.length||0)<2,v(\"simpleDraw\").textContent=y.draw?\"Коснитесь шаблона и обведите поле\":\"Обвести поле на шаблоне\",yi()}"
  ],
  [
    "function pe(){const c=[];if(y.selectedEntry?.fieldLabelAudit){const a=y.selectedEntry.fieldLabelAudit;c.push({hidden:!0,status:a.ok?(a.mode===\"pdf-numbered-only\"?\"manual\":\"ok\"):\"bad\",text:a.ok?(a.mode===\"pdf-numbered-only\"?`На странице заказа названия мест не указаны; используются явные номера полей PDF: ${a.numberedFields.join(\", \")}.`:\"Подписи PDF соответствуют местам заказа.\"):a.issues.join(\". \")})}const t=y.placements.filter(e=>e.art&&e.placement&&e.field);if(y.selectedEntry){const e=gwbPlaceAudit(y.selectedEntry,y.template?.fieldOptions?.length);e.error?c.push({hidden:!0,status:\"bad\",text:`Контроль мест нанесения: не удалось проверить шаблон — ${e.error}.`}):e.pdfNumbered?c.push({hidden:!0,status:\"manual\",text:`Поля нанесения: ${e.actual} поля однозначно пронумерованы в PDF; названия на странице заказа отсутствуют.`}):e.expected<1?c.push({hidden:!0,status:\"bad\",text:\"Контроль мест нанесения: на странице заказа не определено ни одного места.\"}):e.actual!==e.expected?c.push({hidden:!0,status:\"bad\",text:`Контроль мест нанесения: в заказе ${e.expected}, в шаблоне ${e.actual??0}. Проверьте соответствие артикула и шаблона.`}):c.push({hidden:!0,status:e.reliable?\"ok\":\"manual\",text:`Контроль мест нанесения: ${e.expected} в заказе = ${e.actual} в шаблоне.`})}if(!t.length)return c.concat({status:\"manual\",text:\"Выберите поле и загрузите хотя бы один логотип.\"});for(const e of t){const s=e.field,i=e.placement,n=e.art,r=`Поле ${e.fieldIndex===void 0?\"ручное\":e.fieldIndex+1}, стр. ${e.page+1}`,a=Math.min(...co(i,s));c.push({status:a>=-.001?\"ok\":\"bad\",text:`${r}: ${a>=-.001?\"логотип внутри поля\":`выход за поле ${ft(-a)} мм${i.clipToField?\"; выступающая часть будет обрезана\":\"\"}`}.`});const o=v(\"guard\").value,l=Number(o);if(c.push({status:o===\"\"?\"manual\":a+1e-6>=l?\"ok\":\"bad\",text:`${r}: отступ ${ft(a)} мм${o?` / норма ${ft(l)} мм`:\"; норма не задана\"}.`}),n.pixelW){const h=Math.min(n.pixelW/i.w,n.pixelH/i.h)*25.4,d=uo();c.push({status:d===null?\"manual\":h>=d?\"ok\":\"bad\",text:`${r}: разрешение ${Math.round(h)} ppi${d!==null?` / норма ${d}`:\"; норма для этого метода не определена автоматически\"}.`})}if(n.pdfChecks){const h=n.pdfChecks;c.push({status:h.text?\"bad\":\"ok\",text:`${r}: ${h.text?\"в PDF логотипа есть текст, переведите в кривые\":\"в PDF логотипа нет текстовых объектов\"}.`}),(h.gradients||h.transparency)&&c.push({status:\"manual\",text:`${r}: есть градиент или прозрачность, проверьте по ТТ.`})}if(n.svg){const h=n.svg;c.push({status:h.text?\"bad\":\"ok\",text:`${r}: ${h.text?\"в SVG есть текст, переведите в кривые\":\"в SVG нет текста\"}.`}),(h.effects||h.gradients||h.transparency)&&c.push({status:\"manual\",text:`${r}: проверьте эффекты, градиенты и прозрачность по ТТ.`})}}return c.push({status:\"manual\",text:`Метод ${v(\"method\").value||\"не указан\"}: цвета, минимальные элементы и пробелы требуют проверки по ТТ выбранного вида нанесения. Автоматическая проверка охватывает геометрию, обрезку, текст и разрешение растра.`}),c}",
    "function pe(){const c=[];if(y.selectedEntry?.fieldLabelAudit){const a=y.selectedEntry.fieldLabelAudit;c.push({hidden:!0,status:a.ok?(a.mode===\"pdf-numbered-only\"?\"manual\":\"ok\"):\"bad\",text:a.ok?(a.mode===\"pdf-numbered-only\"?`На странице заказа названия мест не указаны; используются явные номера полей PDF: ${a.numberedFields.join(\", \")}.`:\"Подписи PDF соответствуют местам заказа.\"):a.issues.join(\". \")})}const t=y.placements.filter(e=>e.art&&e.placement&&e.field);if(y.selectedEntry){const e=gwbPlaceAudit(y.selectedEntry,y.template?.fieldOptions?.length);e.error?c.push({hidden:!0,status:\"bad\",text:`Контроль мест нанесения: не удалось проверить шаблон — ${e.error}.`}):e.pdfNumbered?c.push({hidden:!0,status:\"manual\",text:`Поля нанесения: ${e.actual} поля однозначно пронумерованы в PDF; названия на странице заказа отсутствуют.`}):e.expected<1?c.push({hidden:!0,status:\"bad\",text:\"Контроль мест нанесения: на странице заказа не определено ни одного места.\"}):e.actual!==e.expected?c.push({hidden:!0,status:\"bad\",text:`Контроль мест нанесения: в заказе ${e.expected}, в шаблоне ${e.actual??0}. Проверьте соответствие артикула и шаблона.`}):c.push({hidden:!0,status:e.reliable?\"ok\":\"manual\",text:`Контроль мест нанесения: ${e.expected} в заказе = ${e.actual} в шаблоне.`})}if(!t.length){renderDiagnostics([]);return c.concat({status:\"manual\",text:\"Выберите поле и загрузите хотя бы один логотип.\"});}const reports=[];for(const e of t){const label=`Поле ${e.fieldIndex===void 0?\"ручное\":e.fieldIndex+1}, стр. ${e.page+1}`;const mapped=Number.isInteger(e.fieldIndex)?oo(e.fieldIndex):null;const method=e.field.orderMethod||mapped?.method||(y.selectedEntry?.fieldLabelAudit?.ok===false?\"\":y.selectedEntry?.method||v(\"method\").value);const report=checkLogo({art:e.art,placement:e.placement,field:e.field,method,context:contextFromOrder((mapped?.name||e.field.orderPlace||\"\")+\" \"+(y.selectedEntry?.product||\"\")),minDpi:v(\"minDpi\").value,margin:Math.min(...co(e.placement,e.field))});report.label=label;report.fieldIndex=e.fieldIndex;report.page=e.page;reports.push(report);for(const f of report.findings)c.push({...f,text:label+\": \"+f.text});const guard=v(\"guard\").value;if(guard!==\"\"){const actual=Math.min(...co(e.placement,e.field))*(e.field.templateScale||1),required=Number(guard);c.push({status:actual>=required?\"ok\":\"bad\",text:label+\": пользовательский отступ от поля \"+ft(actual)+\" / \"+ft(required)+\" мм.\"});}}renderDiagnostics(reports);return c}"
  ],
  [
    "v(\"guard\").oninput=yi;v(\"minDpi\").oninput=yi;",
    "v(\"guard\").oninput=X;v(\"minDpi\").oninput=X;v(\"method\").oninput=X;document.getElementById(\"preflightMarkers\")?.addEventListener(\"change\",X);"
  ],
  [
    "checks:pe(),productionApproved:!1",
    "checks:pe(),logoPreflight:window.gwbLogoPreflight||[],productionApproved:!1"
  ],
  [
    "",
    "import {installLogoRotation} from \"./logo-rotation.mjs?v=20260929-2\";\nlet gwbRotationTool;\n"
  ],
  [
    "logo-preflight.mjs?v=20260929-1",
    "logo-preflight.mjs?v=20260929-2"
  ],
  [
    "if(H.clearRect(0,0,pt.width,pt.height),!c)return;",
    "if(H.clearRect(0,0,pt.width,pt.height),!c){gwbRotationTool?.refresh();return;}"
  ],
  [
    "yi()}function co(c,t)",
    "yi();gwbRotationTool?.refresh()}function co(c,t)"
  ],
  [
    "=atob(e.bytes);e.bytes=Uint8Array.from(s,i=>i.charCodeAt(0)).buffer}er(t).catch(It)}catch(t){It(t)}}",
    "=atob(e.bytes);e.bytes=Uint8Array.from(s,i=>i.charCodeAt(0)).buffer}er(t).catch(It)}catch(t){It(t)}}\ngwbRotationTool=installLogoRotation({canvas:pt,getState:()=>y,redraw:X,toPoint:Wn});\n"
  ],
  [
    "logo-preflight.mjs?v=20260929-2",
    "logo-preflight.mjs?v=20260930-1"
  ],
  [
    "",
    "import {installDetailCheck} from \"./logo-detail-check.mjs?v=20260930-1\";\nlet gwbDetailTool;\n"
  ],
  [
    "logo-preflight.mjs?v=20260930-1",
    "logo-preflight.mjs?v=20260930-2"
  ],
  [
    "gwbRotationTool?.refresh();return;",
    "gwbRotationTool?.refresh();gwbDetailTool?.refresh();return;"
  ],
  [
    "yi();gwbRotationTool?.refresh()}",
    "yi();gwbRotationTool?.refresh();gwbDetailTool?.refresh()}"
  ],
  [
    "gwbRotationTool=installLogoRotation({canvas:pt,getState:()=>y,redraw:X,toPoint:Wn});",
    "gwbRotationTool=installLogoRotation({canvas:pt,getState:()=>y,redraw:X,toPoint:Wn});\ngwbDetailTool=installDetailCheck({canvas:pt,getState:()=>y,redraw:X});"
  ],
  [
    "",
    "import {installFieldZoom} from \"./field-zoom.mjs?v=20260930-1\";\nlet gwbFieldZoom;\n"
  ],
  [
    "gwbDetailTool?.refresh();return;",
    "gwbDetailTool?.refresh();gwbFieldZoom?.refresh();return;"
  ],
  [
    "gwbDetailTool?.refresh()}",
    "gwbDetailTool?.refresh();gwbFieldZoom?.refresh()}"
  ],
  [
    "gwbDetailTool=installDetailCheck({canvas:pt,getState:()=>y,redraw:X});",
    "gwbDetailTool=installDetailCheck({canvas:pt,getState:()=>y,redraw:X});\ngwbFieldZoom=installFieldZoom({canvas:pt,getState:()=>y,render:zt});"
  ],
  [
    "./logo-detail-check.mjs?v=20260930-1",
    "./logo-detail-check.mjs?v=20260930-2"
  ],
  [
    "./logo-preflight.mjs?v=20260930-2",
    "./logo-preflight.mjs?v=20260930-3"
  ],
  [
    "./field-zoom.mjs?v=20260930-1",
    "./field-zoom.mjs?v=20260930-2"
  ],
  [
    "async function zt(){const c=y.template;if(!c)return;const t=",
    "async function zt(){const c=y.template;if(!c)return;const sc=v(\"stageScroll\"),cs=getComputedStyle(sc),fw=Math.max(96,sc.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)),fh=Math.max(96,sc.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom));gwbFieldZoom?.layout(fw,fh);const t="
  ],
  [
    "i=Math.min(1e3,s,Math.max(96,(v(\"stageScroll\").clientHeight-36)*e));",
    "i=y.view&&y.field?fw:Math.min(1e3,s,Math.max(96,(v(\"stageScroll\").clientHeight-36)*e));"
  ],
  [
    "const sc=v(\"stageScroll\"),cs=getComputedStyle(sc)",
    "gwbFieldZoom?.refresh();const sc=v(\"stageScroll\"),cs=getComputedStyle(sc)"
  ],
  [
    "",
    "import {installMethodAdmin} from \"./method-admin.mjs?v=20260930-1\";\n"
  ],
  [
    "const guard=v(\"guard\").value;if(guard!==\"\"){const actual=Math.min(...co(e.placement,e.field))*(e.field.templateScale||1),required=Number(guard);c.push({status:actual>=required?\"ok\":\"bad\",text:label+\": пользовательский отступ от поля \"+ft(actual)+\" / \"+ft(required)+\" мм.\"});}}",
    "}"
  ],
  [
    "minDpi:v(\"minDpi\").value,margin:",
    "margin:"
  ],
  [
    "gwbFieldZoom=installFieldZoom({canvas:pt,getState:()=>y,render:zt});",
    "gwbFieldZoom=installFieldZoom({canvas:pt,getState:()=>y,render:zt});\ninstallMethodAdmin({redraw:X});"
  ],
  [
    "./logo-preflight.mjs?v=20260930-3",
    "./logo-preflight.mjs?v=20260930-4"
  ],
  [
    "./logo-detail-check.mjs?v=20260930-2",
    "./logo-detail-check.mjs?v=20260930-3"
  ],
  [
    "inspectArtwork,checkLogo,renderDiagnostics,contextFromOrder",
    "inspectArtwork,checkLogo,renderDiagnostics,renderErrorOverlay,contextFromOrder"
  ],
  [
    "const t=pe(),r=t.filter(s=>!s.hidden);",
    "const t=pe(),r=t.filter(s=>!s.hidden);renderErrorOverlay(t);"
  ],
  [
    "\"Найдены проблемы: \"+e.map(s=>s.text).join(\" \")",
    "\"Найдено ошибок: \"+e.length+\". Список — справа над макетом.\""
  ],
  [
    "./logo-preflight.mjs?v=20260930-4",
    "./logo-preflight.mjs?v=20261001-1"
  ],
  [
    "./logo-preflight.mjs?v=20261001-1",
    "./logo-preflight.mjs?v=20261001-2"
  ],
  [
    "for(const f of report.findings)c.push({...f,text:label+\": \"+f.text});",
    "for(const f of report.findings)c.push({...f,text:label+\": \"+f.text,displayText:f.displayText||f.text,active:y.active<0||e===y.placements[y.active]});"
  ],
  [
    "./logo-detail-check.mjs?v=20260930-3",
    "./logo-detail-check.mjs?v=20261001-1"
  ],
  [
    "./logo-preflight.mjs?v=20261001-2",
    "./logo-preflight.mjs?v=20261001-3"
  ],
  [
    "./logo-detail-check.mjs?v=20261001-1",
    "./logo-detail-check.mjs?v=20261001-2"
  ],
  [
    "./logo-preflight.mjs?v=20261001-3",
    "./logo-preflight.mjs?v=20261001-4"
  ],
  [
    "",
    "import {installArtworkView} from \"./logo-artwork-view.mjs?v=20261001-1\";\nlet gwbArtworkView;\n"
  ],
  [
    "H.drawImage(p.art.image,-f.w/2,-f.h/2,f.w,f.h)",
    "!gwbArtworkView&&H.drawImage(p.art.image,-f.w/2,-f.h/2,f.w,f.h)"
  ],
  [
    "gwbFieldZoom?.refresh();return;}const t=y.view",
    "gwbFieldZoom?.refresh();gwbArtworkView?.refresh();return;}const t=y.view"
  ],
  [
    "gwbDetailTool?.refresh();gwbFieldZoom?.refresh()}function co",
    "gwbDetailTool?.refresh();gwbFieldZoom?.refresh();gwbArtworkView?.refresh()}function co"
  ],
  [
    "installMethodAdmin({redraw:X});",
    "installMethodAdmin({redraw:X});\ngwbArtworkView=installArtworkView({canvas:pt,getState:()=>y});"
  ],
  [
    "./logo-detail-check.mjs?v=20261001-2",
    "./logo-detail-check.mjs?v=20261005-1"
  ],
  [
    "./logo-preflight.mjs?v=20261001-4",
    "./logo-preflight.mjs?v=20261005-1"
  ],
  [
    "gwbArtworkView=installArtworkView({canvas:pt,getState:()=>y});",
    "gwbArtworkView=installArtworkView({canvas:pt,getState:()=>y});\n;window.gwbBuildMockupHandoff=async function(){\n  const entry=y.selectedEntry||null, template=y.template||null;\n  if(!entry&&!template)return null;\n  const fields=(template?.fieldOptions||[]).map((field,index)=>{\n    const meta=oo(index)||{}, binding=(entry?.placeBindings||[]).find(b=>Number(b.templateIndex||b.index)===index+1)||{};\n    return {\n      id:String(binding.applicationId||field.applicationId||meta.code||field.printId||(\"field-\"+(index+1))),\n      printId:String(meta.code||field.printId||binding.printId||(\"print\"+(index+1))),\n      applicationId:String(binding.applicationId||field.applicationId||\"\"),\n      place:String(meta.name||binding.name||field.orderPlace||field.pdfPlace||field.pdfLabel||(\"Поле \"+(index+1))),\n      method:String(meta.method||binding.method||entry?.method||v(\"method\").value||\"\"),\n      page:Number(field.page||0),\n      bounds:{x:Number(field.x),y:Number(field.y),w:Number(field.w),h:Number(field.h)},\n      fieldW:Number(field.nominalW||field.w||0),\n      fieldH:Number(field.nominalH||field.h||0)\n    };\n  });\n  let activeIndex=Number(v(\"orderFieldChoice\")?.value);\n  if(!Number.isInteger(activeIndex)||activeIndex<0||activeIndex>=fields.length){\n    const activePlacement=y.placements?.[y.active];\n    if(Number.isInteger(activePlacement?.fieldIndex))activeIndex=activePlacement.fieldIndex;\n    else activeIndex=(template?.fieldOptions||[]).findIndex(f=>y.field&&f.page===y.page&&Math.abs(f.x-y.field.x)+Math.abs(f.y-y.field.y)+Math.abs(f.w-y.field.w)+Math.abs(f.h-y.field.h)<.3);\n  }\n  const activeField=activeIndex>=0?fields[activeIndex]:null;\n  const placement=(y.placements||[]).find(p=>p.fieldIndex===activeIndex&&p.art&&p.placement)||(y.placements||[]).find(p=>p.art&&p.placement)||null;\n  const art=placement?.art||y.art||null;\n  let fieldCompositeDataUrl=art?.src||\"\";\n  try{\n    let compositeImage=art?.image||null;\n    if(art?.pdf){\n      try{\n        const page=art.pdfPage||await art.pdf.getPage(1),baseViewport=page.getViewport({scale:1}),renderScale=Math.min(4,1600/Math.max(1,baseViewport.width,baseViewport.height)),viewport=page.getViewport({scale:renderScale}),transparent=document.createElement(\"canvas\");\n        transparent.width=Math.max(1,Math.ceil(viewport.width));transparent.height=Math.max(1,Math.ceil(viewport.height));\n        const transparentCtx=transparent.getContext(\"2d\");\n        transparentCtx.clearRect(0,0,transparent.width,transparent.height);\n        await page.render({canvasContext:transparentCtx,viewport,background:\"rgba(0,0,0,0)\"}).promise;\n        compositeImage=transparent;\n      }catch{}\n    }\n    if(placement?.field&&placement?.placement&&compositeImage){\n      const field=placement.field,p=placement.placement,W=1000,H=Math.max(1,Math.round(W*field.h/field.w)),canvas=document.createElement(\"canvas\");\n      canvas.width=W;canvas.height=H;\n      const ctx=canvas.getContext(\"2d\"),scale=W/field.w;\n      ctx.clearRect(0,0,W,H);\n      ctx.save();\n      ctx.translate((p.x-field.x+p.w/2)*scale,(p.y-field.y+p.h/2)*scale);\n      ctx.rotate((Number(p.rotation)||0)*Math.PI/180);\n      ctx.drawImage(compositeImage,-p.w*scale/2,-p.h*scale/2,p.w*scale,p.h*scale);\n      ctx.restore();\n      fieldCompositeDataUrl=canvas.toDataURL(\"image/png\");\n    }\n  }catch{}\n  const order=String(entry?.order||v(\"order\")?.value||\"\"), article=String(entry?.article||v(\"article\")?.value||\"\");\n  const photoCandidates=[];\n  if(order&&entry?.itemId){\n    try{\n      const base=\"/api/orders/\"+encodeURIComponent(order)+\"/items/\"+encodeURIComponent(String(entry.itemId));\n      const listRes=await fetch(base+\"/photos\",{cache:\"no-store\"});\n      const list=await listRes.json().catch(()=>null);\n      if(listRes.ok&&Array.isArray(list?.photos)){\n        const queue=list.photos.slice(0,20);\n        let cursor=0;\n        async function loadNextPhoto(){\n          while(cursor<queue.length){\n            const meta=queue[cursor++];\n            const candidate={id:String(meta.id||article+\"-\"+(Number(meta.index)+1)),name:String(meta.name||\"Фото \"+(Number(meta.index)+1)+\" · арт. \"+article),url:String(meta.url||\"\"),dataUrl:\"\",kind:\"product-photo\"};\n            try{\n              const res=await fetch(base+\"/photos/\"+encodeURIComponent(String(meta.index)),{cache:\"no-store\"});\n              if(res.ok&&/^image\\//i.test(res.headers.get(\"content-type\")||\"\")){\n                const blob=await res.blob();\n                candidate.dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader;r.onload=()=>resolve(String(r.result||\"\"));r.onerror=()=>reject(r.error);r.readAsDataURL(blob)});\n              }\n            }catch{}\n            if(candidate.url||candidate.dataUrl)photoCandidates.push(candidate);\n          }\n        }\n        await Promise.all(Array.from({length:Math.min(4,queue.length)},()=>loadNextPhoto()));\n        photoCandidates.sort((a,b)=>{\n          const ai=Number((a.id.match(/-(\\d+)$/)||[])[1]||999),bi=Number((b.id.match(/-(\\d+)$/)||[])[1]||999);\n          return ai-bi;\n        });\n      }\n    }catch{}\n  }\n  if(!photoCandidates.length&&entry?.imageUrl)photoCandidates.push({id:article+\"-main\",name:\"Фото артикула \"+article,url:String(entry.imageUrl),kind:\"order-preview\"});\n  return {\n    schema:\"gifts-mockup-handoff/v1\",\n    source:\"maketnaya-mockups\",\n    order,\n    article,\n    product:String(entry?.product||\"\"),\n    productUrl:String(entry?.productUrl||\"\"),\n    variant:String(entry?.variant||entry?.color||\"\"),\n    place:String(activeField?.place||entry?.place||(Array.isArray(entry?.places)&&entry.places[0])||\"\"),\n    method:String(activeField?.method||entry?.method||v(\"method\")?.value||\"\"),\n    item:{\n      itemId:String(entry?.itemId||\"\"),\n      order,\n      article,\n      product:String(entry?.product||\"\"),\n      productUrl:String(entry?.productUrl||\"\"),\n      quantity:Number(entry?.quantity||0)||0,\n      imageUrl:String(entry?.imageUrl||\"\"),\n      placeBindings:Array.isArray(entry?.placeBindings)?entry.placeBindings.map(b=>({\n        applicationId:String(b.applicationId||\"\"),\n        name:String(b.name||b.place||\"\"),\n        method:String(b.method||\"\"),\n        printId:String(b.printId||\"\"),\n        index:Number(b.index||0)||undefined,\n        templateIndex:Number(b.templateIndex||0)||undefined,\n        fieldW:Number(b.fieldW||0)||undefined,\n        fieldH:Number(b.fieldH||0)||undefined\n      })):[],\n      fieldCandidates:fields\n    },\n    photoCandidates,\n    fieldCandidates:fields,\n    selectedField:activeField?{...activeField}:null,\n    templateWidth:Number(template?.w||0),\n    templateHeight:Number(template?.h||0),\n    templateName:String(template?.name||\"\"),\n    constructorPreviewDataUrl:String(template?.src||\"\"),\n    artworkName:String(art?.name||\"\"),\n    artworkDataUrl:String(art?.src||\"\"),\n    fieldCompositeDataUrl:String(fieldCompositeDataUrl||\"\")\n  };\n};\nwindow.gwbGetMockupState=function(){\n  Ft();\n  const filled=(y.placements||[]).filter(p=>p?.art&&p?.placement&&p?.field);\n  const active=y.active>=0?y.placements[y.active]:null, placement=active?.art&&active?.placement&&active?.field?active:(filled[0]||null);\n  const index=Number.isInteger(placement?.fieldIndex)?placement.fieldIndex:null, meta=index!==null?(oo(index)||{}):{}, field=placement?.field||null, entry=y.selectedEntry||null;\n  return {\n    hasSelectedArticle:!!entry?.article,\n    article:String(entry?.article||v(\"article\")?.value||\"\"),\n    order:String(entry?.order||v(\"order\")?.value||\"\"),\n    logoCount:filled.length,\n    fieldIndex:index,\n    printId:String(meta.code||field?.printId||\"\"),\n    place:String(meta.name||field?.orderPlace||entry?.place||(Array.isArray(entry?.places)&&entry.places[0])||\"\"),\n    method:String(meta.method||entry?.method||v(\"method\")?.value||\"\"),\n    fieldW:Number(field?.nominalW||field?.w||0),\n    fieldH:Number(field?.nominalH||field?.h||0),\n    exportDisabled:!!v(\"simpleExport\")?.disabled\n  };\n};\nwindow.gwbGetMockupTargets=function(){\n  Ft();\n  const entry=y.selectedEntry||null, fields=y.template?.fieldOptions||[];\n  return (y.placements||[]).filter(p=>p?.art&&p?.placement&&p?.field).map(p=>{\n    const rawIndex=Number(p.fieldIndex);let index=Number.isInteger(rawIndex)?rawIndex:-1;\n    if(index<0)index=fields.findIndex(f=>f&&p.field&&f.page===p.field.page&&Math.abs(f.x-p.field.x)+Math.abs(f.y-p.field.y)+Math.abs(f.w-p.field.w)+Math.abs(f.h-p.field.h)<.3);\n    const meta=index>=0?(oo(index)||{}):{}, field=p.field||fields[index]||null;\n    return {\n      hasSelectedArticle:!!entry?.article,\n      article:String(entry?.article||v(\"article\")?.value||\"\"),\n      variant:String(entry?.variant||entry?.color||\"\"),\n      order:String(entry?.order||v(\"order\")?.value||\"\"),\n      logoCount:1,\n      fieldIndex:index,\n      printId:String(meta.code||field?.printId||(index>=0?\"print\"+(index+1):\"\")),\n      applicationId:String(field?.applicationId||\"\"),\n      place:String(meta.name||field?.orderPlace||entry?.place||(Array.isArray(entry?.places)&&index>=0?entry.places[index]:\"\")||\"\"),\n      method:String(meta.method||field?.orderMethod||entry?.method||v(\"method\")?.value||\"\"),\n      fieldW:Number(field?.nominalW||field?.w||0),\n      fieldH:Number(field?.nominalH||field?.h||0),\n      artworkName:String(p.art?.name||\"\"),\n      exportDisabled:!!v(\"simpleExport\")?.disabled\n    };\n  }).filter(t=>t.fieldIndex>=0);\n};\nwindow.gwbBuildMockupHandoffForField=async function(fieldIndex){\n  const payload=await window.gwbBuildMockupHandoff();\n  if(!payload)return null;\n  const index=Number(fieldIndex);\n  const placement=(y.placements||[]).find(p=>p?.art&&p?.placement&&p?.field&&Number(p.fieldIndex)===index);\n  if(!placement)return null;\n  const field=payload.fieldCandidates?.[index]||null, art=placement.art;\n  let composite=String(art?.src||\"\");\n  try{\n    let image=art?.image||null;\n    if(art?.pdf){\n      try{\n        const page=art.pdfPage||await art.pdf.getPage(1),base=page.getViewport({scale:1}),scale=Math.min(4,1600/Math.max(1,base.width,base.height)),viewport=page.getViewport({scale}),canvas=document.createElement(\"canvas\");\n        canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));\n        const ctx=canvas.getContext(\"2d\");ctx.clearRect(0,0,canvas.width,canvas.height);\n        await page.render({canvasContext:ctx,viewport,background:\"rgba(0,0,0,0)\"}).promise;image=canvas;\n      }catch{}\n    }\n    if(image){\n      const f=placement.field,p=placement.placement,W=1000,H=Math.max(1,Math.round(W*f.h/f.w)),canvas=document.createElement(\"canvas\");\n      canvas.width=W;canvas.height=H;const ctx=canvas.getContext(\"2d\"),scale=W/f.w;\n      ctx.clearRect(0,0,W,H);ctx.save();\n      ctx.translate((p.x-f.x+p.w/2)*scale,(p.y-f.y+p.h/2)*scale);\n      ctx.rotate((Number(p.rotation)||0)*Math.PI/180);\n      ctx.drawImage(image,-p.w*scale/2,-p.h*scale/2,p.w*scale,p.h*scale);ctx.restore();\n      composite=canvas.toDataURL(\"image/png\");\n    }\n  }catch{}\n  payload.activeFieldIndex=index;\n  payload.selectedField=field?{...field}:null;\n  payload.place=String(field?.place||placement.field?.orderPlace||payload.place||\"\");\n  payload.method=String(field?.method||placement.field?.orderMethod||payload.method||\"\");\n  payload.artworkName=String(art?.name||\"\");\n  payload.artworkDataUrl=String(art?.src||\"\");\n  payload.fieldCompositeDataUrl=composite;\n  return payload;\n};\nwindow.gwbCreateReadyLayoutPdf=async function(){\n  if(y.busy||!y.template)throw new Error(\"Макет пока не готов к экспорту.\");\n  y.busy=!0;X();\n  try{\n    const placements=Qn(),bytes=await hn({template:y.template,placements},PDFLib,Jn),filename=Hn([v(\"order\").value,v(\"article\").value,\"макет\"].filter(Boolean).join(\"_\"))+\".pdf\";\n    return {blob:new Blob([bytes],{type:\"application/pdf\"}),filename};\n  }finally{y.busy=!1;X()}\n};\nwindow.gwbRefreshEditorState=function(){X();};\nwindow.gwbGetEditorReadiness=function(){\n  const fieldOptions=Array.isArray(y.template?.fieldOptions)?y.template.fieldOptions:null;\n  const logoCount=(y.placements||[]).filter(p=>p?.art).length||(y.art?1:0);\n  return {\n    templateReady:!!y.template&&fieldOptions!==null,\n    templateFieldCount:fieldOptions?.length||0,\n    logoReady:logoCount>0,\n    logoCount,\n    hasSelectedField:!!y.field,\n    busy:!!y.busy\n  };\n};\nwindow.dispatchEvent(new CustomEvent(\"gwb-editor-readiness-changed\"));\nwindow.dispatchEvent(new CustomEvent(\"gwb-mockup-handoff-ready\"));\n"
  ],
  [
    "./logo-detail-check.mjs?v=20261005-1",
    "./logo-detail-check.mjs?v=20261006-1"
  ],
  [
    "./logo-preflight.mjs?v=20261005-1",
    "./logo-preflight.mjs?v=20261006-1"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-1",
    "./logo-detail-check.mjs?v=20261006-2"
  ],
  [
    "./logo-preflight.mjs?v=20261006-1",
    "./logo-preflight.mjs?v=20261006-2"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-2",
    "./logo-detail-check.mjs?v=20261006-3"
  ],
  [
    "./logo-preflight.mjs?v=20261006-2",
    "./logo-preflight.mjs?v=20261006-3"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-3",
    "./logo-detail-check.mjs?v=20261006-4"
  ],
  [
    "./logo-preflight.mjs?v=20261006-3",
    "./logo-preflight.mjs?v=20261006-4"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-4",
    "./logo-detail-check.mjs?v=20261006-5"
  ],
  [
    "./logo-preflight.mjs?v=20261006-4",
    "./logo-preflight.mjs?v=20261006-5"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-5",
    "./logo-detail-check.mjs?v=20261006-6"
  ],
  [
    "./logo-preflight.mjs?v=20261006-5",
    "./logo-preflight.mjs?v=20261006-6"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-6",
    "./logo-detail-check.mjs?v=20261006-7"
  ],
  [
    "./logo-preflight.mjs?v=20261006-6",
    "./logo-preflight.mjs?v=20261006-7"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-7",
    "./logo-detail-check.mjs?v=20261006-8"
  ],
  [
    "./logo-preflight.mjs?v=20261006-7",
    "./logo-preflight.mjs?v=20261006-8"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-8",
    "./logo-detail-check.mjs?v=20261006-9"
  ],
  [
    "./logo-preflight.mjs?v=20261006-8",
    "./logo-preflight.mjs?v=20261006-9"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-9",
    "./logo-detail-check.mjs?v=20261006-10"
  ],
  [
    "./logo-preflight.mjs?v=20261006-9",
    "./logo-preflight.mjs?v=20261006-10"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-10",
    "./logo-detail-check.mjs?v=20261006-11"
  ],
  [
    "./logo-preflight.mjs?v=20261006-10",
    "./logo-preflight.mjs?v=20261006-11"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-11",
    "./logo-detail-check.mjs?v=20261006-13"
  ],
  [
    "./logo-preflight.mjs?v=20261006-11",
    "./logo-preflight.mjs?v=20261006-13"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-13",
    "./logo-detail-check.mjs?v=20261006-14"
  ],
  [
    "./logo-preflight.mjs?v=20261006-13",
    "./logo-preflight.mjs?v=20261006-14"
  ],
  [
    "function cn(c){const t=i=>Number(i.replace(\",\",\".\")),e=[...c.matchAll(/(\\d+(?:[.,]\\d+)?)\\s*[xх×]\\s*(\\d+(?:[.,]\\d+)?)/gi)].map(i=>({w:t(i[1])*10,h:t(i[2])*10})),s=i=>c.match(i)?.[1]||\"\";return{order:s(/№\\s*(\\d+)/),article:s(/Арт\\.\\s*([\\d.]+)/),method:s(/\\b([A-Z]+[\\w-]*\\d[\\w-]*)\\s*:/),sizes:e,minDpi:s(/Разрешение\\s+растрового\\s+изображения\\s+от\\s+(\\d+)\\s*dpi/i),requirements:c.includes(\"Технические требования\")?c.slice(c.indexOf(\"Технические требования\")):\"\"}}",
    "function cn(c){const t=i=>Number(i.replace(\",\",\".\")),e=[...c.matchAll(/(\\d+(?:[.,]\\d+)?)\\s*[xх×]\\s*(\\d+(?:[.,]\\d+)?)\\s*(мм|mm|см|cm)(?=\\s|[),.;]|$)/gi)].map(i=>{const n=t(i[1]),r=t(i[2]),a=/^(?:см|cm)$/i.test(i[3])?10:1;return{w:n*a,h:r*a,unit:i[3].toLowerCase()}}),s=i=>c.match(i)?.[1]||\"\";return{order:s(/№\\s*(\\d+)/),article:s(/Арт\\.\\s*([\\d.]+)/),method:s(/\\b([A-Z]+[\\w-]*\\d[\\w-]*)\\s*:/),sizes:e,minDpi:s(/Разрешение\\s+растрового\\s+изображения\\s+от\\s+(\\d+)\\s*dpi/i),requirements:c.includes(\"Технические требования\")?c.slice(c.indexOf(\"Технические требования\")):\"\"}}"
  ],
  [
    "v(\"fieldSize\").textContent=r?`${a>=0?\"Поле \"+(a+1)+\" · \":\"\"}${ft(r.nominalW||r.w)} × ${ft(r.nominalH||r.h)} мм · ${r.source===\"pdf-vector\"?\"из векторного шаблона\":r.source===\"pdf-opacity-98-fill\"?\"по прозрачной заливке\":\"выделено вручную\"}`:\"Поле не выбрано\",n?",
    "const gwbFieldOpened=!!(r&&y.view),gwbFieldSizeText=gwbFieldOpened?`${a>=0?\"Поле \"+(a+1)+\" · \":\"\"}${ft(r.nominalW||r.w)} × ${ft(r.nominalH||r.h)} мм · ${r.source===\"pdf-vector\"?\"из векторного шаблона\":r.source===\"pdf-opacity-98-fill\"?\"по прозрачной заливке\":\"выделено вручную\"}`:r?\"Поле выбрано\":\"Поле не выбрано\";v(\"fieldSize\").textContent=gwbFieldSizeText;const gwbSelectedFieldSize=v(\"selectedFieldSize\");gwbSelectedFieldSize&&(gwbSelectedFieldSize.hidden=!gwbFieldOpened,gwbSelectedFieldSize.textContent=gwbFieldOpened?`Размер поля: ${ft(r.nominalW||r.w)} × ${ft(r.nominalH||r.h)} мм`:\"\");n?"
  ],
  [
    "v(\"dimensions\").textContent=`${ft(c.w)} × ${ft(c.h)} мм`",
    "v(\"dimensions\").textContent=y.view?\"\":`Размер шаблона: ${ft(c.w)} × ${ft(c.h)} мм`"
  ],
  [
    "./logo-detail-check.mjs?v=20261006-14",
    "./logo-detail-check.mjs?v=20261007-1"
  ],
  [
    "./logo-preflight.mjs?v=20261006-14",
    "./logo-preflight.mjs?v=20261007-1"
  ]
];
export function applyLogoPreflight(){
 let source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 if(hash(source)===expected)return;
 if(hash(source)!==baseline)throw Error('Editor baseline changed; actual='+hash(source)+' baseline='+baseline);
 for(const [from,to] of edits){
  if(from&&source.split(from).length!==2)throw Error('Preflight integration target is not unique');
  source=from?source.replace(from,to):to+source;
 }
 if(hash(source)!==expected)throw Error('Preflight integration result mismatch: actual='+hash(source)+' expected='+expected);
 fs.writeFileSync(file,source);
}
