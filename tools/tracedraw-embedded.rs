//! Maketnaya embed bridge. Only present in the self-hosted WASM build.
//! TraceDraw's drawing engine, tools, document model and exporters are upstream.
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use std::path::Path;
use tracedraw_core::{Command,geometry::Size};

#[wasm_bindgen(inline_js = r#"
export function gwbTakeOpen() {
  const event=window.__gwbTracePending||null;
  window.__gwbTracePending=null;
  return event;
}
export function gwbReport(type,message) {
  if(!window.__gwbTraceToken)return;
  window.parent.postMessage({type,token:window.__gwbTraceToken,message},'*');
}
export function gwbReturnSvg(svg,x,y,w,h) {
  if(!window.__gwbTraceToken)return;
  window.parent.postMessage({type:'gwb-tracedraw-svg',
    token:window.__gwbTraceToken,svg,logoBoundsMm:{x,y,w,h}},'*');
}
export function gwbTakeApply() {
  const requested=window.__gwbTraceApply===true;
  window.__gwbTraceApply=false;
  return requested;
}
export function gwbIsEmbedded() {return typeof window.__gwbTraceToken==='string'&&window.__gwbTraceToken.length>20;}
"#)]
extern "C" {
  fn gwbTakeOpen() -> JsValue;
  fn gwbReport(kind:&str,message:&str);
  fn gwbReturnSvg(svg:&str,x:f64,y:f64,w:f64,h:f64);
  fn gwbTakeApply() -> bool;
  fn gwbIsEmbedded() -> bool;
}

fn member(v:&JsValue,k:&str)->JsValue {
  js_sys::Reflect::get(v,&JsValue::from_str(k)).unwrap_or(JsValue::NULL)
}
fn number(v:&JsValue,k:&str)->Option<f64>{member(v,k).as_f64().filter(|v|v.is_finite())}

fn import(app:&mut crate::app::App,ctx:&egui::Context,v:JsValue)->Result<(),String>{
  let w=number(&v,"w").ok_or("Не передана ширина поля")?;
  let h=number(&v,"h").ok_or("Не передана высота поля")?;
  if !(0.01..=2000.0).contains(&w)||!(0.01..=2000.0).contains(&h) {
    return Err("Неверный размер поля нанесения".into());
  }
  let name=member(&v,"name").as_string().unwrap_or_else(||"logo.svg".into());
  let ext=name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
  if !["svg","pdf"].contains(&ext.as_str()){
    return Err("Макетная передаёт в TraceDraw SVG (включая растр) или PDF".into());
  }
  let bytes=js_sys::Uint8Array::new(&member(&v,"bytes")).to_vec();
  if bytes.is_empty()||bytes.len()>40*1024*1024{
    return Err("Размер логотипа должен быть до 40 МБ".into());
  }
  // Only the current imprint field: a new fixed-size page, not a user document.
  // Embedded opens from its own fresh WebAssembly frame with one empty page.
  app.run(Command::ResizePage{page:app.page,size:Size::new(w,h)});
  let path=Path::new(if ext=="pdf"{"/upload/gwb-logo.pdf"}else{"/upload/gwb-logo.svg"});
  crate::files::store(path,bytes);
  if ext=="pdf"{app.import_pdf(path)}else{app.import_svg(path)}
  crate::files::forget(path);
  // An empty SVG is a valid new design: the user draws the first object
  // inside this already-sized imprint field. Nonempty imports remain editable.
  app.fit_pending=true;
  ctx.request_repaint();
  Ok(())
}

fn export(app:&crate::app::App)->Result<(),String>{
  let f=app.page_size();
  let mut bounds:Option<tracedraw_core::geometry::Rect>=None;
  for layer in app.page_layers(){
    if !layer.visible {continue}
    for shape in &layer.shapes{
      if !shape.visible {continue}
      let b=app.visual_bounds(shape);
      if ![b.x0,b.y0,b.x1,b.y1].iter().all(|v|v.is_finite()){continue}
      bounds=Some(if let Some(prev)=bounds {prev.union(b)} else {b});
    }
  }
  let b=bounds.ok_or("Рисунок пуст — добавьте объекты")?;
  let x=b.x0;
  let y=f.height-b.y1; // TraceDraw page is bottom-up; SVG viewport is top-down.
  let w=b.width();let h=b.height();
  if !(0.001..=2000.0).contains(&w)||!(0.001..=2000.0).contains(&h) {
    return Err("Неверные габариты нанесения".into());
  }
  if w>f.width*10.0||h>f.height*10.0{
    return Err("Нанесение слишком велико относительно поля".into());
  }
  // Don't return the page-sized object. Crop the *viewBox* around the real
  // artwork without moving / rasterizing any underlying vector paths.
  let full=tracedraw_io::svg::page_to_svg(app.doc(),0);
  let end=full.find('>').ok_or("Не удалось сформировать SVG")?;
  if !full.starts_with("<svg ") {return Err("Некорректный экспорт SVG".into())}
  let svg=format!(
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}mm\" height=\"{h}mm\" viewBox=\"{x} {y} {w} {h}\">{}",
    &full[end+1..]);
  if svg.len()>40*1024*1024 {return Err("Экспорт SVG превышает 40 МБ".into())}
  gwbReturnSvg(&svg,x,y,w,h);
  Ok(())
}
pub fn poll(app:&mut crate::app::App,ctx:&egui::Context){
  if !gwbIsEmbedded(){return}
  let request=gwbTakeOpen();
  if !request.is_null()&&!request.is_undefined(){
    match import(app,ctx,request){
      Ok(())=>gwbReport("gwb-tracedraw-opened",""),
      Err(e)=>gwbReport("gwb-tracedraw-error",&e),
    }
  }
  if gwbTakeApply(){
    if let Err(e)=export(app){gwbReport("gwb-tracedraw-error",&e)}
  }
}
pub fn transfer_button(app:&crate::app::App,ui:&mut egui::Ui){
  if !gwbIsEmbedded(){return}
  // Reserve a real top panel before TraceDraw's own menu/canvas panels
  // are laid out. A foreground Area could be obscured by other egui windows,
  // so clicking its approximate coordinates never invoked the action.
  egui::Panel::top("gwb_tracedraw_transfer_panel")
    .exact_height(40.0)
    .show(ui,|ui|{
      ui.with_layout(egui::Layout::right_to_left(egui::Align::Center),|ui|{
        let button=egui::Button::new(egui::RichText::new("Перенести на шаблон артикула")
          .strong().color(egui::Color32::WHITE))
          .fill(egui::Color32::from_rgb(94,148,28));
        if ui.add_sized([224.0,30.0],button).clicked(){
          if let Err(e)=export(app){gwbReport("gwb-tracedraw-error",&e)}
        }
      });
    });
}
