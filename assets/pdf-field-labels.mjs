// PDF text and vector rectangles share viewport coordinates, converted to mm.
const MM = 25.4 / 72;
const clean = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const nameKey = s => clean(s).toLocaleLowerCase('ru').replace(/ё/g, 'е');
const printKey = s => /\bprint\s*(\d+)\b/i.exec(s)?.[1];
const placeName = s => clean(s.replace(/\[?\s*print\s*\d+\s*\]?/ig, '').replace(/^\s*(?:место(?: нанесения)?|поле)\s*[:：]\s*/i, '').split(/\s*[·|]\s*/)[0]);

export function extractFieldLabels(content, viewport) {
  const lines = [];
  const labels = [];

  const rawItems = content.items.filter(t => t.str?.trim() && t.transform).map(t => {
    const [a,b,,,x,y] = t.transform, scale = Math.hypot(a,b);
    return {text:t.str, x,y, ux:a/scale, uy:b/scale, w:Math.abs(t.width), h:Math.abs(t.height)||scale};
  }).filter(t => [t.x,t.y,t.ux,t.uy,t.w,t.h].every(Number.isFinite));

  const boundsFor = group => {
    const points = group.flatMap(t => [0,t.w].flatMap(u => [-.2*t.h,.8*t.h].map(v => viewport.convertToViewportPoint(t.x+t.ux*u-t.uy*v,t.y+t.uy*u+t.ux*v))));
    const xs=points.map(p=>p[0]*MM), ys=points.map(p=>p[1]*MM);
    return {x:Math.min(...xs), y:Math.min(...ys), w:Math.max(...xs)-Math.min(...xs), h:Math.max(...ys)-Math.min(...ys)};
  };

  // Field numbers in Gifts templates are often tiny standalone PDF text items.
  // Read them directly before line assembly, because PDF.js may otherwise merge
  // the digit with unrelated text that shares the same baseline.
  for (const item of rawItems) {
    const text=clean(item.text);
    const match=/^([1-9]\d?)\s*[.):.-]?$/.exec(text);
    if (!match) continue;
    const fieldIndex=Number(match[1]);
    labels.push({
      text:String(fieldIndex),
      name:String(fieldIndex),
      printId:null,
      fieldIndex,
      confidence:2.75,
      source:'numeric-item',
      ...boundsFor([item])
    });
  }

  // Assemble nearby fragments on the same baseline, independently of PDF stream order.
  const items=[...rawItems].sort((a,b) => b.y-a.y || a.x-b.x);
  for (const t of items) {
    let line = lines.find(l => Math.abs(l.ux-t.ux)<.01 && Math.abs(l.uy-t.uy)<.01 && Math.abs((t.x-l.x)*-l.uy+(t.y-l.y)*l.ux)<Math.min(l.h,t.h)*.3);
    if (!line) lines.push(line = {...t, parts:[]});
    line.parts.push(t);
  }

  for (const line of lines) {
    line.parts.sort((a,b) => (a.x-b.x)*line.ux+(a.y-b.y)*line.uy);
    const groups = [];
    for (const t of line.parts) {
      const group = groups.at(-1), last = group?.at(-1);
      if (!last || (t.x-last.x)*line.ux+(t.y-last.y)*line.uy-last.w > Math.max(last.h,t.h)*1.5) groups.push([t]);
      else group.push(t);
    }
    for (const group of groups) {
      const text = clean(group.map((t,i)=>{
        const previous=group[i-1];
        const gap=previous ? (t.x-previous.x)*line.ux+(t.y-previous.y)*line.uy-previous.w : 0;
        return (gap>t.h*.15?' ':'')+t.text;
      }).join(''));
      const ids = [...text.matchAll(/\bprint\s*(\d+)\b/ig)];
      const explicitName=/^(?:место(?: нанесения)?|поле)\s*[:：]/i.test(text);
      const numericMatch=/^([1-9]\d?)\s*[.):.-]?$/.exec(text);
      const numericIndex=numericMatch ? Number(numericMatch[1]) : null;
      const plainName=/^[\p{L}][\p{L}\s()-]{1,79}$/u.test(text);
      if (ids.length > 1 || (!ids.length && !explicitName && !numericIndex && !plainName)) continue;

      // A one-item numeric group is already captured above. Skipping it avoids
      // turning the same digit into two equally strong claims for one field.
      if (numericIndex && group.length===1) continue;

      const confidence = ids.length ? 3 : numericIndex ? 2.5 : explicitName ? 2 : 0;
      labels.push({
        text,
        name:placeName(text),
        printId:ids[0] ? `print${Number(ids[0][1])}` : null,
        fieldIndex:numericIndex,
        confidence,
        source:'assembled-line',
        ...boundsFor(group)
      });
    }
  }

  // De-duplicate equivalent labels that can arise from unusual PDF text streams.
  const unique=[];
  for (const label of labels) {
    if (unique.some(other =>
      other.fieldIndex===label.fieldIndex &&
      other.printId===label.printId &&
      clean(other.text)===clean(label.text) &&
      Math.abs(other.x-label.x)+Math.abs(other.y-label.y)+Math.abs(other.w-label.w)+Math.abs(other.h-label.h)<.5
    )) continue;
    unique.push(label);
  }
  return unique;
}

export function extractAnnotationFieldLabels(annotations, viewport) {
  const labels=[];
  for (const annotation of annotations || []) {
    const raw = annotation?.contentsObj?.str ?? annotation?.contents ?? annotation?.fieldValue ?? "";
    const text=clean(raw);
    if (!text || !Array.isArray(annotation?.rect) || annotation.rect.length!==4) continue;
    const numeric=/^([1-9]\d?)\s*[.):.-]?$/.exec(text);
    const fieldIndex=numeric ? Number(numeric[1]) : null;
    if (!fieldIndex) continue;

    let rect;
    if (typeof viewport.convertToViewportRectangle==="function") {
      rect=viewport.convertToViewportRectangle(annotation.rect);
    } else {
      const [x1,y1,x2,y2]=annotation.rect;
      const p1=viewport.convertToViewportPoint(x1,y1);
      const p2=viewport.convertToViewportPoint(x2,y2);
      rect=[p1[0],p1[1],p2[0],p2[1]];
    }
    if (!rect?.every(Number.isFinite)) continue;
    const xs=[rect[0],rect[2]].map(v=>v*MM);
    const ys=[rect[1],rect[3]].map(v=>v*MM);
    labels.push({
      text:String(fieldIndex),
      name:String(fieldIndex),
      printId:null,
      fieldIndex,
      confidence:2.9,
      source:'annotation',
      x:Math.min(...xs),
      y:Math.min(...ys),
      w:Math.max(...xs)-Math.min(...xs),
      h:Math.max(...ys)-Math.min(...ys)
    });
  }
  return labels;
}

export function bindFieldLabels(fields, labels) {
  const result = fields.map(f => ({...f, labelStatus:'missing'}));
  const claims = new Map();
  const canonical=[];
  for (const label of [...labels].sort((a,b)=>(b.confidence||0)-(a.confidence||0))) {
    const duplicate=canonical.some(other =>
      other.source && label.source && other.source!==label.source &&
      other.fieldIndex===label.fieldIndex &&
      other.printId===label.printId &&
      clean(other.text)===clean(label.text) &&
      Math.abs(other.x-label.x)+Math.abs(other.y-label.y)+Math.abs(other.w-label.w)+Math.abs(other.h-label.h)<1
    );
    if (!duplicate) canonical.push(label);
  }
  for (const label of canonical) {
    const cx=label.x+label.w/2, cy=label.y+label.h/2;
    const ranked = result.map((f,index) => {
      const dx=Math.max(f.x-cx,0,cx-f.x-f.w), dy=Math.max(f.y-cy,0,cy-f.y-f.h);
      return {index, distance:Math.hypot(dx,dy)};
    }).sort((a,b)=>a.distance-b.distance);
    // Named labels may sit next to a field; a bare numeric field index must be
    // inside the field or no farther than 2 mm from its border.
    const maxDistance = Number.isInteger(label.fieldIndex) ? 2 : 12;
    if (!ranked.length || ranked[0].distance>maxDistance) continue;
    if (ranked[1] && ranked[1].distance-ranked[0].distance<3) {
      for (const r of ranked.filter(r=>r.distance-ranked[0].distance<3)) result[r.index].labelStatus='ambiguous';
      continue;
    }
    const index=ranked[0].index;
    if (!claims.has(index)) claims.set(index,[]);
    claims.get(index).push(label);
  }
  for (const [index, found] of claims) {
    const f=result[index];
    if (f.labelStatus==='ambiguous') continue;
    const strength = label => Number.isFinite(label.confidence) ? label.confidence : label.printId ? 3 : 0;
    const maxStrength = Math.max(...found.map(strength));
    const strongest = found.filter(label => strength(label)===maxStrength);
    if (strongest.length!==1) { f.labelStatus='ambiguous'; continue; }
    const label=strongest[0];
    Object.assign(f,{pdfLabel:label.text,pdfPlace:label.name,printId:label.printId,fieldIndex:label.fieldIndex||null,labelSource:label.source||null,labelBounds:{x:label.x,y:label.y,w:label.w,h:label.h},labelStatus:'matched'});
  }
  // Gifts templates often print the semantic name in the table below the
  // drawing ("лицо [print1]"), while only a bare 1/2/3 is placed by the frame.
  // Use the shared printN id to enrich the spatially-bound numeric label.
  const globalPrintLabels = canonical.filter(label => label.printId && clean(label.name));
  for (const f of result) {
    if (f.labelStatus !== 'matched' || !Number.isInteger(f.fieldIndex)) continue;
    const printId = `print${f.fieldIndex}`;
    const matches = globalPrintLabels.filter(label => label.printId === printId);
    const names = [...new Set(matches.map(label => nameKey(label.name)).filter(Boolean))];
    if (names.length !== 1) continue;
    const best = matches.sort((a,b)=>(b.confidence||0)-(a.confidence||0))[0];
    if (!best) continue;
    f.pdfLabel = best.text;
    f.pdfPlace = best.name;
    f.printId = printId;
    f.labelSource = [f.labelSource, 'global-print-table'].filter(Boolean).join('+');
  }

  for (const f of result) if (f.printId && result.filter(g=>g.printId===f.printId).length>1) f.labelStatus='ambiguous';
  for (const f of result) if (f.fieldIndex && result.filter(g=>g.fieldIndex===f.fieldIndex).length>1) f.labelStatus='ambiguous';
  return result;
}

export function auditFieldLabels(fields, entry) {
  const places = (entry?.places?.length ? entry.places : entry?.place ? [entry.place] : []).map(text=>({raw:clean(text),name:nameKey(placeName(text)), id:printKey(text)}));
  const explicitBindings = (Array.isArray(entry?.placeBindings) ? entry.placeBindings : [])
    .map(binding => {
      const taskId = /^\d{1,20}$/.test(String(binding?.taskId || "")) ? String(Number(binding.taskId)) : "";
      const printId = /^print\d+$/i.test(String(binding?.printId || ""))
        ? String(binding.printId).toLowerCase()
        : "";
      return {
        name: clean(binding?.name),
        key: nameKey(placeName(binding?.name || "")),
        index: Number.isInteger(binding?.index) ? binding.index : null,
        taskId,
        printId,
        method: clean(binding?.method || ""),
        source: binding?.source || ""
      };
    })
    .filter(binding => binding.name);
  const indexedBindings = explicitBindings.filter(binding => Number.isInteger(binding.index));
  const used=new Set(), issues=[];

  // When Gifts gives an explicit ordered set of selected applications for one
  // template, binding.index is PDF-local (1..N), while taskId is global to the
  // order. The detected vector fields retain their PDF operator-stream order
  // in pdfOrder. If all counts agree and no existing PDF label contradicts
  // that sequence, this is an unambiguous mapping for the editor even when the
  // visible field number itself was converted to curves and is not text.
  const localIndexes=indexedBindings.map(binding=>binding.index).sort((a,b)=>a-b);
  const completeLocalSequence=
    fields.length>0 &&
    places.length===fields.length &&
    indexedBindings.length===fields.length &&
    new Set(localIndexes).size===fields.length &&
    localIndexes.every((value,index)=>value===index+1) &&
    entry?.placeCountReliable!==false;

  if (entry && completeLocalSequence && fields.some(field=>field.labelStatus!=='matched')) {
    const ordered=[...fields].sort((a,b)=>
      (a.page??0)-(b.page??0) ||
      (a.pdfOrder??Number.MAX_SAFE_INTEGER)-(b.pdfOrder??Number.MAX_SAFE_INTEGER) ||
      a.y-b.y || a.x-b.x
    );
    let compatible=true;
    const mapped=[];
    const seenPlaces=new Set();

    for (let rank=0;rank<ordered.length;rank++) {
      const field=ordered[rank];
      const localIndex=rank+1;
      const binding=indexedBindings.find(candidate=>candidate.index===localIndex);
      const placeIndex=binding ? places.findIndex(place=>place.name===binding.key) : -1;
      const expectedPrint=`print${localIndex}`;
      const actualPrint=field.printId ? String(field.printId).toLowerCase() : "";
      if (!binding || placeIndex<0 || seenPlaces.has(placeIndex) ||
          (Number.isInteger(field.fieldIndex) && field.fieldIndex!==localIndex) ||
          (actualPrint && actualPrint!==expectedPrint)) {
        compatible=false;
        break;
      }
      seenPlaces.add(placeIndex);
      mapped.push({field,binding,placeIndex,localIndex,expectedPrint});
    }

    if (compatible && mapped.length===fields.length) {
      for (const {field,binding,placeIndex,localIndex,expectedPrint} of mapped) {
        field.orderPlace=places[placeIndex].raw;
        field.orderPlaceIndex=placeIndex;
        field.orderMethod=binding.method||"";
        field.orderPlaceBindingSource=binding.source||"order-application-id+makets-popup";
        field.templateIndex=localIndex;
        field.fieldIndex=Number.isInteger(field.fieldIndex)?field.fieldIndex:localIndex;
        field.printId=field.printId||expectedPrint;
        field.pdfPlace=field.pdfPlace||binding.name;
        field.pdfLabel=field.pdfLabel||`${binding.name} [${expectedPrint}]`;
        field.labelSource=[field.labelSource,"application-sequence"].filter(Boolean).join("+");
        field.labelStatus="matched";
      }
      return {
        ok:true,
        issues:[],
        mode:"application-sequence",
        mappedBy:"order-application-id+popup-sequence+pdf-order",
        placeCount:fields.length,
        fieldMappings:mapped.map(({binding,localIndex})=>({
          index:localIndex,
          name:binding.name,
          printId:`print${localIndex}`,
          taskId:binding.taskId||"",
          method:binding.method||""
        }))
      };
    }
  }

  // Some Gifts orders do not expose textual place names at all, while the
  // application-template itself explicitly numbers every field. Accept that
  // only when the PDF provides a complete, unique 1..N set. This is not array
  // order inference: each number is real PDF text spatially bound to its frame.
  if (entry && places.length===0 && fields.length>0) {
    const fieldDiagnostics=fields.map((f,index)=>({
      field:index+1,
      status:f.labelStatus,
      pdfLabel:f.pdfLabel||"",
      fieldIndex:Number.isInteger(f.fieldIndex)?f.fieldIndex:null,
      source:f.labelSource||null
    }));
    const numbered=fields.filter(f=>f.labelStatus==='matched' && Number.isInteger(f.fieldIndex));
    const indexes=numbered.map(f=>f.fieldIndex).sort((a,b)=>a-b);
    const complete=numbered.length===fields.length &&
      indexes.every((value,index)=>value===index+1) &&
      new Set(indexes).size===indexes.length;
    const declared=Number.isInteger(entry.placeCount) ? entry.placeCount : 0;
    const countCompatible=declared===0 || declared===fields.length;

    if (complete && countCompatible) {
      for (const f of fields) {
        f.orderPlace=`Место ${f.fieldIndex}`;
        f.orderPlaceIndex=f.fieldIndex-1;
      }
      return {
        ok:true,
        issues:[],
        mode:'pdf-numbered-only',
        placeCount:fields.length,
        numberedFields:indexes,
        orderNamesMissing:true,
        fieldDiagnostics
      };
    }

    issues.push(`На странице заказа названия мест не указаны, а PDF не содержит полной однозначной нумерации полей 1…N. Распознаны номера у рамок: ${indexes.length ? indexes.join(", ") : "нет"}`);
    return {ok:false,issues:[...new Set(issues)],mode:'pdf-numbered-incomplete',placeCount:0,orderNamesMissing:true,numberedFields:indexes,fieldDiagnostics};
  }

  for (const f of fields) {
    delete f.orderPlace;
    delete f.orderPlaceIndex;
    if (f.labelStatus!=='matched') { issues.push('Не найдена однозначная подпись PDF для поля'); continue; }
    if (!entry) continue;

    if (f.printId) {
      const printMatches = explicitBindings.filter(binding => binding.printId === String(f.printId).toLowerCase());
      if (printMatches.length) {
        if (printMatches.length !== 1) {
          issues.push(`PDF «${f.pdfLabel}» соответствует нескольким местам по ${f.printId}`);
        } else {
          const binding = printMatches[0];
          const placeIndex = places.findIndex(place => place.name === binding.key);
          if (placeIndex < 0 || used.has(placeIndex)) {
            issues.push(`Место «${binding.name}» для PDF «${f.pdfLabel}» не найдено однозначно в заказе`);
          } else {
            used.add(placeIndex);
            f.orderPlace = places[placeIndex].raw;
            f.orderPlaceIndex = placeIndex;
            f.orderMethod = binding.method || "";
            f.orderPlaceBindingSource = binding.source;
          }
        }
        continue;
      }
    }

    if (Number.isInteger(f.fieldIndex)) {
      if (indexedBindings.length) {
        const matches=indexedBindings.filter(binding => binding.index===f.fieldIndex);
        if (matches.length!==1) {
          issues.push(`Номер поля PDF «${f.pdfLabel}» не соответствует единственному пронумерованному месту на странице заказа/шаблона`);
        } else {
          const binding=matches[0];
          const placeIndex=places.findIndex(place => place.name===binding.key);
          if (placeIndex<0 || used.has(placeIndex)) {
            issues.push(`Место «${binding.name}» для поля PDF «${f.pdfLabel}» не найдено однозначно в заказе`);
          } else {
            used.add(placeIndex);
            f.orderPlace=places[placeIndex].raw;
            f.orderPlaceIndex=placeIndex;
            f.orderMethod=binding.method || "";
            f.orderPlaceBindingSource=binding.source;
          }
        }
        continue;
      }

      const index=f.fieldIndex-1;
      if (index<0 || index>=places.length || used.has(index)) {
        issues.push(`Номер поля PDF «${f.pdfLabel}» не соответствует единственному месту заказа`);
      } else {
        used.add(index);
        f.orderPlace=places[index].raw;
        f.orderPlaceIndex=index;
      }
      continue;
    }

    const matches=places.map((p,i)=>({p,i})).filter(({p})=>p.name && p.name===nameKey(f.pdfPlace) && (!p.id || `print${Number(p.id)}`===f.printId));
    if (matches.length!==1 || used.has(matches[0]?.i)) issues.push(`Подпись PDF «${f.pdfLabel}» не соответствует единственному месту заказа`);
    else {
      used.add(matches[0].i);
      f.orderPlace=places[matches[0].i].raw;
      f.orderPlaceIndex=matches[0].i;
    }
  }
  if (entry && (used.size!==places.length || fields.length!==places.length || entry.placeCountReliable===false)) issues.push('Соответствие всех мест заказа не подтверждено');
  return {ok:fields.length>0 && issues.length===0, issues:[...new Set(issues)], mode:'order-names'};
}
