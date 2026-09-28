// PDF text and vector rectangles share viewport coordinates, converted to mm.
const MM = 25.4 / 72;
const clean = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const nameKey = s => clean(s).toLocaleLowerCase('ru').replace(/ё/g, 'е');
const printKey = s => /\bprint\s*(\d+)\b/i.exec(s)?.[1];
const placeName = s => clean(s.replace(/\[?\s*print\s*\d+\s*\]?/ig, '').replace(/^\s*(?:место(?: нанесения)?|поле)\s*[:：]\s*/i, '').split(/\s*[·|]\s*/)[0]);

export function extractFieldLabels(content, viewport) {
  const lines = [];
  // Assemble nearby fragments on the same baseline, independently of PDF stream order.
  const items = content.items.filter(t => t.str?.trim() && t.transform).map(t => {
    const [a,b,,,x,y] = t.transform, scale = Math.hypot(a,b);
    return {text:t.str, x,y, ux:a/scale, uy:b/scale, w:Math.abs(t.width), h:Math.abs(t.height)||scale};
  }).filter(t => [t.x,t.y,t.ux,t.uy,t.w,t.h].every(Number.isFinite));
  items.sort((a,b) => b.y-a.y || a.x-b.x);
  for (const t of items) {
    let line = lines.find(l => Math.abs(l.ux-t.ux)<.01 && Math.abs(l.uy-t.uy)<.01 && Math.abs((t.x-l.x)*-l.uy+(t.y-l.y)*l.ux)<Math.min(l.h,t.h)*.3);
    if (!line) lines.push(line = {...t, parts:[]});
    line.parts.push(t);
  }
  const labels = [];
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
      const plainName=/^[\p{L}][\p{L}\s()-]{1,79}$/u.test(text);
      if (ids.length > 1 || (!ids.length && !explicitName && !plainName)) continue;
      const points = group.flatMap(t => [0,t.w].flatMap(u => [-.2*t.h,.8*t.h].map(v => viewport.convertToViewportPoint(t.x+t.ux*u-t.uy*v,t.y+t.uy*u+t.ux*v))));
      const xs=points.map(p=>p[0]*MM), ys=points.map(p=>p[1]*MM);
      labels.push({text, name:placeName(text), printId:ids[0] ? `print${Number(ids[0][1])}` : null, x:Math.min(...xs), y:Math.min(...ys), w:Math.max(...xs)-Math.min(...xs), h:Math.max(...ys)-Math.min(...ys)});
    }
  }
  return labels;
}

export function bindFieldLabels(fields, labels) {
  const result = fields.map(f => ({...f, labelStatus:'missing'}));
  const claims = new Map();
  for (const label of labels) {
    const cx=label.x+label.w/2, cy=label.y+label.h/2;
    const ranked = result.map((f,index) => {
      const dx=Math.max(f.x-cx,0,cx-f.x-f.w), dy=Math.max(f.y-cy,0,cy-f.y-f.h);
      return {index, distance:Math.hypot(dx,dy)};
    }).sort((a,b)=>a.distance-b.distance);
    // Nearby means <= 12 mm; a competing rectangle within 3 mm is ambiguous.
    if (!ranked.length || ranked[0].distance>12) continue;
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
    if (f.labelStatus==='ambiguous' || found.length!==1) { f.labelStatus='ambiguous'; continue; }
    const label=found[0];
    Object.assign(f,{pdfLabel:label.text,pdfPlace:label.name,printId:label.printId,labelBounds:{x:label.x,y:label.y,w:label.w,h:label.h},labelStatus:'matched'});
  }
  for (const f of result) if (f.printId && result.filter(g=>g.printId===f.printId).length>1) f.labelStatus='ambiguous';
  return result;
}

export function auditFieldLabels(fields, entry) {
  const places = (entry?.places?.length ? entry.places : entry?.place ? [entry.place] : []).map(text=>({name:nameKey(placeName(text)), id:printKey(text)}));
  const used=new Set(), issues=[];
  for (const f of fields) {
    if (f.labelStatus!=='matched') { issues.push('Не найдена однозначная подпись PDF для поля'); continue; }
    if (!entry) continue;
    const matches=places.map((p,i)=>({p,i})).filter(({p})=>p.name && p.name===nameKey(f.pdfPlace) && (!p.id || `print${Number(p.id)}`===f.printId));
    if (matches.length!==1 || used.has(matches[0]?.i)) issues.push(`Подпись PDF «${f.pdfLabel}» не соответствует единственному месту заказа`);
    else used.add(matches[0].i);
  }
  if (entry && (used.size!==places.length || fields.length!==places.length || entry.placeCountReliable===false)) issues.push('Соответствие всех мест заказа не подтверждено');
  return {ok:fields.length>0 && issues.length===0, issues:[...new Set(issues)]};
}
