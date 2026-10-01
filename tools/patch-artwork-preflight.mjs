// Reproducible integration patch for the existing compiled editor.
// The bundled PDF.js and all field/printN/clip algorithms remain byte-identical.
// Fail closed if either the baseline or resulting application changes.
import fs from 'node:fs';
import crypto from 'node:crypto';
const file=new URL('../assets/index-BpU9kvz8.js',import.meta.url);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const baseline="f8c86ee9390b7bcb7873426c737f9d6105853b10a868aa8ba6e234f3b0e62e1d";
const expected="106e4e5946e673417b40e85758de12be4eafc636b1dc533d17e68a89fce14e10";
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
    "for(const f of report.findings)c.push({...f,text:label+\": \"+f.text,displayText:f.text,active:y.active<0||e===y.placements[y.active]});"
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
    "./logo-detail-check.mjs?v=20261001-3"
  ],
  [
    "./logo-preflight.mjs?v=20261001-4",
    "./logo-preflight.mjs?v=20261001-5"
  ]
];
export function applyLogoPreflight(){
 let source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 if(hash(source)===expected)return;
 if(hash(source)!==baseline)throw Error('Editor baseline changed; review and update the preflight integration patch.');
 for(const [from,to] of edits){
  if(from&&source.split(from).length!==2)throw Error('Preflight integration target is not unique');
  source=from?source.replace(from,to):to+source;
 }
 if(hash(source)!==expected)throw Error('Preflight integration result mismatch');
 fs.writeFileSync(file,source);
}
