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
    let field=host.bridge_field_mm.clone();
    let repaint=host.bridge_ctx.clone();
    let listener=wasm_bindgen::closure::Closure::<dyn FnMut(web_sys::MessageEvent)>::new(move |event: web_sys::MessageEvent|{
        // The token is an unguessable per-editor hash fragment; the parent
        // only sends to this specific embedded VectorCraft iframe.
        let data=event.data();
        let get=|key:&str|Reflect::get(&data,&JsValue::from_str(key)).ok();
        let event_type=get("type").and_then(|v|v.as_string()).unwrap_or_default();
        if event_type!="gwb-vectorcraft-open"&&event_type!="gwb-vectorcraft-apply"{return;}
        let token=get("token").and_then(|v|v.as_string()).unwrap_or_default();
        if token.is_empty()||token!=gwb_token(){return;}
        let origin=event.origin();
        if origin!="https://gifts.ru"&&origin!="https://tohaa28.github.io"&&origin!="http://localhost"&&origin!="http://127.0.0.1"{return;}
        if event_type=="gwb-vectorcraft-apply"{
            apply.set(true);
            if let Some(ctx)=repaint.borrow().as_ref(){ctx.request_repaint();}
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
        *field.borrow_mut()=Some((w,h,prepared));
        inbox.lock().unwrap_or_else(|e|e.into_inner()).push((name,data.to_vec()));
        open_pending.set(true);
        if let Some(ctx)=repaint.borrow().as_ref(){ctx.request_repaint();}
    });
    if window.add_event_listener_with_callback("message",listener.as_ref().unchecked_ref()).is_ok(){listener.forget();}
}
fn gwb_apply_field_size(app: &mut VectorcraftApp, field: &(f64,f64,bool)) -> Result<(), String> {
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
fn gwb_export_editor(app: &mut VectorcraftApp) {
    let Some(st)=app.session.active() else {
        gwb_send("gwb-vectorcraft-error",None,Some("В VectorCraft нет открытого документа"));
        return;
    };
    let opts=serde_json::json!({"images":"embed","artboard":0,"useArtboards":true});
    match fileio::encode_with_warnings(&st.doc,"svg",&opts) {
        Ok((bytes,warnings))=>{
            if bytes.is_empty()||bytes.len()>40*1024*1024{
                gwb_send("gwb-vectorcraft-error",None,Some("SVG больше 40 МБ или пустой"));
                return;
            }
            let notes=warnings.join("\n");
            gwb_send("gwb-vectorcraft-svg",Some(&bytes),Some(&notes));
        }
        Err(err)=>gwb_send("gwb-vectorcraft-error",None,Some(&err.to_string())),
    };
}
