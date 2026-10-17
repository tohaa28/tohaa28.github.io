// Maketnaya<->VectorCraft WebAssembly bridge, compiled INSIDE VectorCraft.
// Maintains original format bytes on import; returns a VectorCraft-generated SVG.
// No customer files are uploaded, no local recovery copies in Maketnaya mode.
fn gwb_is_embedded() -> bool {
    web_sys::window().and_then(|w|w.location().hash().ok()).is_some_and(|h|h.starts_with("#gwb="))
}
fn gwb_token() -> String {
    web_sys::window().and_then(|w|w.location().hash().ok())
        .and_then(|h|h.strip_prefix("#gwb=").map(str::to_string)).unwrap_or_default()
}
fn gwb_send(kind: &str, bytes: Option<&[u8]>, note: Option<&str>) {
    use wasm_bindgen::JsValue;
    use js_sys::{Object, Reflect, Uint8Array};
    let Some(w)=web_sys::window() else{return};
    let Ok(Some(parent))=w.parent() else{return};
    let o=Object::new();
    let set=|key:&str,value:&JsValue|{let _=Reflect::set(&o,&JsValue::from_str(key),value);};
    set("type",&JsValue::from_str(kind));
    set("token",&JsValue::from_str(&gwb_token()));
    if let Some(t)=note{set("message",&JsValue::from_str(t));}
    if let Some(data)=bytes{set("bytes",&Uint8Array::from(data).into());}
    // Only the immediate parent receives the message. The parent validates both
    // event.source and event.origin before accessing the file.
    use wasm_bindgen::JsCast as _;
    if let Ok(method)=Reflect::get(parent.as_ref(),&JsValue::from_str("postMessage")){
        if let Some(call)=method.dyn_ref::<js_sys::Function>(){
            let _=call.call2(parent.as_ref(),&o,&JsValue::from_str("*"));
        }
    }
}
fn gwb_install_bridge(host: &Host) {
    use wasm_bindgen::{JsCast, JsValue};
    use js_sys::{Reflect, Uint8Array};
    let Some(window)=web_sys::window() else{return};
    let inbox=host.inbox.clone();
    let apply=host.bridge_return.clone();
    let open_pending=host.bridge_open_pending.clone();
    let document_received=host.bridge_document_received.clone();
    let field=host.bridge_field_mm.clone();
    let repaint=host.bridge_ctx.clone();
    let gifts=host.bridge_gifts_style.clone();
    let gifts_pending=host.bridge_gifts_pending.clone();
    let listener=wasm_bindgen::closure::Closure::<dyn FnMut(web_sys::MessageEvent)>::new(move |event: web_sys::MessageEvent|{
        // The token is an unguessable per-editor hash fragment; the parent
        // only sends to this specific embedded VectorCraft iframe.
        let data=event.data();
        let get=|key:&str|Reflect::get(&data,&JsValue::from_str(key)).ok();
        let event_type=get("type").and_then(|v|v.as_string()).unwrap_or_default();
        if event_type!="gwb-vectorcraft-open"&&event_type!="gwb-vectorcraft-apply"&&event_type!="gwb-vectorcraft-theme"{return;}
        let token=get("token").and_then(|v|v.as_string()).unwrap_or_default();
        if token.is_empty()||token!=gwb_token(){return;}
        let origin=event.origin();
        if origin!="https://gifts.ru"&&origin!="https://tohaa28.github.io"&&origin!="http://localhost"&&origin!="http://127.0.0.1"{return;}
        if event_type=="gwb-vectorcraft-theme"{
            let mode=get("mode").and_then(|v|v.as_string()).unwrap_or_default();
            if mode!="gifts"&&mode!="native"{return;}
            if gifts.get()!=(mode=="gifts"){
                gifts.set(mode=="gifts");
                gifts_pending.set(true);
                if let Some(ctx)=repaint.borrow().as_ref(){ctx.request_repaint();}
            } else {
                gwb_send("gwb-vectorcraft-theme-applied",None,Some(&mode));
            }
            return;
        }
        if event_type=="gwb-vectorcraft-apply"{
            apply.set(true);
            if let Some(ctx)=repaint.borrow().as_ref(){ctx.request_repaint();}
            return;
        }
        // An embedded editor is bound to ONE Maketnaya placement; a second
        // postMessage must never open or replace another document.
        if document_received.get() {
            gwb_send("gwb-vectorcraft-error",None,Some("Открытие других документов отключено. Редактируйте логотип текущего поля."));
            return;
        }
        let raw=get("fieldSizeMm").unwrap_or(JsValue::NULL);
        let dimension=|key: &str|Reflect::get(&raw,&JsValue::from_str(key)).ok().and_then(|v|v.as_f64());
        let (Some(w),Some(h))=(dimension("w"),dimension("h")) else{
            gwb_send("gwb-vectorcraft-error",None,Some("Размер поля нанесения не указан"));
            return;
        };
        if !w.is_finite()||!h.is_finite()||w<=0.0||h<=0.0||w>2000.0||h>2000.0{
            gwb_send("gwb-vectorcraft-error",None,Some("Размер поля нанесения некорректен"));
            return;
        }
        let prepared=get("fieldCanvas").and_then(|v|v.as_bool()).unwrap_or(false);
        let name=get("name").and_then(|v|v.as_string()).unwrap_or_default();
        let blob=get("bytes").unwrap_or(JsValue::NULL);
        if name.is_empty()||name.len()>180||blob.is_null()||blob.is_undefined(){gwb_send("gwb-vectorcraft-error",None,Some("Не найден исходный файл"));return;}
        let data=Uint8Array::new(&blob);
        let size=data.length();
        if size==0||size>40*1024*1024{gwb_send("gwb-vectorcraft-error",None,Some("Размер файла недопустим"));return;}
        document_received.set(true);
        *field.borrow_mut()=Some((w,h,prepared));
        inbox.lock().unwrap_or_else(|e|e.into_inner()).push((name,data.to_vec()));
        open_pending.set(true);
        if let Some(ctx)=repaint.borrow().as_ref(){ctx.request_repaint();}
    });
    if window.add_event_listener_with_callback("message",listener.as_ref().unchecked_ref()).is_ok(){listener.forget();}
}
fn gwb_apply_field_size(app: &mut VectorcraftApp, field: &(f64,f64,bool)) -> Result<(), String> {
    // Every artwork opened inside Maketnaya uses genuine VectorCraft CMYK
    // document mode. Preserve incoming object colours as editable objects;
    // changing the working space is not a destructive RGB->CMYK rasterization.
    let Some(doc)=app.session.active_mut() else{return Err("Логотип ещё не открыт".into());};
    doc.doc.color_mode=vectorcraft_doc::ColorMode::Cmyk;
    let (w,h,was_prepared)=*field;
    let (target_w,target_h)=(w*72.0/25.4,h*72.0/25.4);
    let Some(state)=app.session.active() else{return Err("Логотип ещё не открыт".into());};
    let Some(board)=state.doc.artboards.first() else{return Err("Отсутствует монтажная область".into());};
    let (old_w,old_h)=(board.rect.width(),board.rect.height());
    if (old_w-target_w).abs()<0.02 && (old_h-target_h).abs()<0.02{return Ok(());}
    if was_prepared{
        return Err(format!("Подготовленный SVG имеет неверный физический размер: {:.2} × {:.2} мм",
          old_w*25.4/72.0,old_h*25.4/72.0));
    }
    // Native PDF/AI vectors stay editable. Scale the art only when the
    // document has the same aspect ratio as the imprint field, preventing
    // unexpected non-proportional stretching of graphic elements.
    let proportional=(old_w/old_h-target_w/target_h).abs()<0.002;
    app.session.execute("artboard.setProps",&serde_json::json!({
       "index":0,"x":0.0,"y":0.0,"width":target_w,"height":target_h,
       "scaleArt":proportional,"moveArt":true
    })).map_err(|e|format!("Не удалось установить размер поля: {e}"))?;
    Ok(())
}
// The actual printed artwork is NOT the VectorCraft artboard. Export with the
// source engine's visual art bounds and send the bounding box relative to the
// original field separately so Maketnaya restores geometry exactly once.
fn gwb_send_cropped_logo(bytes: &[u8], note: &str, bounds: [f64;4]) {
    use js_sys::{Object,Reflect,Uint8Array};
    use wasm_bindgen::{JsCast,JsValue};
    let Some(window)=web_sys::window() else {return};
    let Ok(Some(parent))=window.parent() else {return};
    let message=Object::new();
    let set=|key:&str,value:&JsValue|{let _=Reflect::set(&message,&JsValue::from_str(key),value);};
    set("type",&JsValue::from_str("gwb-vectorcraft-svg"));
    set("token",&JsValue::from_str(&gwb_token()));
    set("message",&JsValue::from_str(note));
    set("bytes",&Uint8Array::from(bytes).into());
    let rectangle=Object::new();
    for (key,value) in ["x","y","w","h"].into_iter().zip(bounds) {
        let _=Reflect::set(&rectangle,&JsValue::from_str(key),&JsValue::from_f64(value));
    }
    set("logoBoundsMm",&rectangle.into());
    if let Ok(method)=Reflect::get(parent.as_ref(),&JsValue::from_str("postMessage")) {
        if let Some(call)=method.dyn_ref::<js_sys::Function>() {
            let _=call.call2(parent.as_ref(),&message,&JsValue::from_str("*"));
        }
    }
}
fn gwb_export_editor(app: &mut VectorcraftApp, requested_field: Option<(f64,f64,bool)>) {
    if app.session.documents().len()!=1 {
        gwb_send("gwb-vectorcraft-error",None,Some("В Макетной разрешён только один документ текущего поля"));
        return;
    }
    let Some(st)=app.session.active() else {
        gwb_send("gwb-vectorcraft-error",None,Some("В VectorCraft нет открытого документа"));
        return;
    };
    let Some((field_w,field_h,_))=requested_field else {
        gwb_send("gwb-vectorcraft-error",None,Some("Размер исходного поля нанесения недоступен"));
        return;
    };
    let Some(board)=st.doc.artboards.first() else {
        gwb_send("gwb-vectorcraft-error",None,Some("Монтажная область VectorCraft не обнаружена"));
        return;
    };
    let mm_to_pt=72.0/25.4;
    if (board.rect.width()-field_w*mm_to_pt).abs()>0.15 ||
       (board.rect.height()-field_h*mm_to_pt).abs()>0.15 {
        gwb_send("gwb-vectorcraft-error",None,Some("Размер монтажной области изменён. Верните размер выбранного поля нанесения в миллиметрах."));
        return;
    }
    let Some(art)=st.doc.art_bounds() else {
        gwb_send("gwb-vectorcraft-error",None,Some("Нет нарисованных объектов для передачи в Макетную"));
        return;
    };
    let bounds=[
        (art.x0-board.rect.x0)/mm_to_pt,
        (art.y0-board.rect.y0)/mm_to_pt,
        art.width()/mm_to_pt,
        art.height()/mm_to_pt,
    ];
    if !bounds.iter().all(|n|n.is_finite()) ||
       bounds[2]<=0.001 || bounds[3]<=0.001 ||
       bounds[2]>2000.0 || bounds[3]>2000.0 ||
       bounds[0].abs()>2000.0 || bounds[1].abs()>2000.0 {
        gwb_send("gwb-vectorcraft-error",None,Some("У рисунка некорректные или пустые границы"));
        return;
    }
    // SVG export uses the same visual art bounds, shifting their origin to
    // (0,0). No page-sized empty margins and no rasterization of vector paths.
    let opts=serde_json::json!({"images":"embed","useArtboards":false});
    match fileio::encode_with_warnings(&st.doc,"svg",&opts) {
        Ok((bytes,warnings))=>{
            if bytes.is_empty()||bytes.len()>40*1024*1024{
                gwb_send("gwb-vectorcraft-error",None,Some("SVG больше 40 МБ или пустой"));
                return;
            }
            let notes=warnings.join("\n");
            gwb_send_cropped_logo(&bytes,&notes,bounds);
        }
        Err(err)=>gwb_send("gwb-vectorcraft-error",None,Some(&err.to_string())),
    };
}
