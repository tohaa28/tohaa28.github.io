#!/usr/bin/env python3
"""Pin-and-patch TraceDraw WASM to a single Maketnaya imprint field.
Keep the original igtoth/tracedraw source untouched in our source branch.
No customer artwork leaves the user's browser."""
import pathlib, sys, subprocess, hashlib

root=pathlib.Path(sys.argv[1])
raster_patch=pathlib.Path(__file__).with_name("tracedraw-raster-cmyk.patch").resolve()
asset_revision=hashlib.sha256(raster_patch.read_bytes()).hexdigest()[:12]
subprocess.run(["git","apply","--check",str(raster_patch)],cwd=root,check=True)
subprocess.run(["git","apply",str(raster_patch)],cwd=root,check=True)
main=root/"apps/tracedraw/src/main.rs"
src=main.read_text(encoding="utf-8")
def once(old,new):
    global src
    if src.count(old)!=1:
        raise RuntimeError(f"TraceDraw upstream drift: expected one {old!r}, got {src.count(old)}")
    src=src.replace(old,new)
once('mod web;\n','mod web;\n')
once('        files::run_finished(app);\n',
     '        files::run_finished(app);\n        #[cfg(target_arch = "wasm32")]\n        gwb_bridge::poll(app, ui.ctx());\n')

main.write_text(src,encoding="utf-8")

index=root/"web/index.html"
page=index.read_text(encoding="utf-8")
hook=r"""
  <!-- Maketnaya embedding is enabled only for a valid one-use session token. -->
  <script>
  (function(){
    const token=new URLSearchParams(location.hash.slice(1)).get('gwb');
    if(!token||!/^[a-f0-9]{48}$/.test(token))return;
    window.__gwbTraceToken=token;
    window.__gwbTracePending=null;
    window.__gwbTraceApply=false;
    window.addEventListener('message',event=>{
      if(event.source!==window.parent||!event.data||event.data.token!==token)return;
      if(event.data.type==='gwb-tracedraw-open'){
        const d=event.data;
        if(!d.bytes||!Number.isFinite(d.w)||!Number.isFinite(d.h))return;
        window.__gwbTracePending={bytes:d.bytes,name:d.name,w:d.w,h:d.h};
      }else if(event.data.type==='gwb-tracedraw-apply'){
        window.__gwbTraceApply=true;
      }
    });
    window.addEventListener('gwb-tracedraw-started',()=>{
      window.parent.postMessage({type:'gwb-tracedraw-ready',token},'*');
    });
  })();
  </script>
"""
if page.count('  <script type="module">')!=1:
    raise RuntimeError("TraceDraw upstream index entrypoint drift")
page=page.replace('  <script type="module">',hook+'  <script type="module">')
# Embedded control is inside the actual TraceDraw iframe. It calls the genuine
# Rust WASM exporter, and is omitted in nonembedded TraceDraw sessions.
embedded=r"""
  <style>
    #gwb-tracedraw-transfer{position:fixed;z-index:9999;top:7px;right:12px;
      background:#639b1a;color:#fff;border:1px solid #477b0c;border-radius:6px;
      box-shadow:0 2px 7px #0003;padding:7px 14px;font:700 12px system-ui;
      cursor:pointer;min-height:30px}
    #gwb-tracedraw-transfer:hover{background:#528810}
  </style>
"""
if page.count('  <script type="module">')!=1:
    raise RuntimeError("TraceDraw index script changed")
page=page.replace('  <script type="module">',embedded+'  <script type="module">')
module_import='    import init from "./tracedraw.js";'
module_new='    import init, {gwb_tracedraw_request_apply} from "./tracedraw.js?v='+asset_revision+'";'
if page.count(module_import)!=1: raise RuntimeError("TraceDraw WASM import changed")
page=page.replace(module_import,module_new)
wasm_url='new URL("tracedraw_bg.wasm", import.meta.url)'
if page.count(wasm_url)!=1: raise RuntimeError("TraceDraw WASM URL changed")
page=page.replace(wasm_url,'new URL("tracedraw_bg.wasm?v='+asset_revision+'", import.meta.url)')

if page.count('await init({ module_or_path: bytes });')!=1:
    raise RuntimeError("TraceDraw upstream boot drift")
page=page.replace('await init({ module_or_path: bytes });',
                  'await init({ module_or_path: bytes });\n'
                  '        window.dispatchEvent(new Event("gwb-tracedraw-started"));\n'
                  '        if (window.__gwbTraceToken) {\n'
                  '          const apply = document.createElement("button");\n'
                  '          apply.id = "gwb-tracedraw-transfer";\n'
                  '          apply.textContent = "Перенести на шаблон артикула";\n'
                  '          apply.type = "button";\n'
                  '          apply.addEventListener("click", () => gwb_tracedraw_request_apply());\n'
                  '          document.body.append(apply);\n'
                  '        }')
index.write_text(page,encoding="utf-8")
print("Applied pinned TraceDraw WASM embedding, native transfer and single-field bridge")


# The embedded editor is not a free document manager. Protect all native
# code paths (menus, toolbar, tabs, shortcuts, recent/template dialogs).
# Import is intentionally left enabled: it inserts editable objects into
# the one imprint page instead of replacing the document.
def patch_source(relative, replacements):
    p=root/relative
    body=p.read_text(encoding="utf-8")
    for old,new in replacements:
        n=body.count(old)
        if n!=1: raise RuntimeError(f"{relative}: expected one {old[:110]!r}; got {n}")
        body=body.replace(old,new,1)
    p.write_text(body,encoding="utf-8")

def protected(signature):
    return (signature, signature +
        '\n        if crate::gwb_embedded() { self.status = "Редактируйте только текущее поле нанесения Макетной".into(); return; }')

patch_source("apps/tracedraw/src/main.rs", [
  ('mod web;\n', '''mod web;
#[cfg(target_arch = "wasm32")]
mod gwb_bridge;
fn gwb_embedded() -> bool {
    #[cfg(target_arch = "wasm32")]
    { gwb_bridge::locked() }
    #[cfg(not(target_arch = "wasm32"))]
    { false }
}
fn gwb_field_loaded() -> bool {
    #[cfg(target_arch = "wasm32")]
    { gwb_bridge::field_loaded() }
    #[cfg(not(target_arch = "wasm32"))]
    { false }
}
''')
])
# Because the initial script already inserts "mod gwb_bridge", remove
# the duplicate insertion in the older patch stage.
# NOTE: the original "once('mod web;')" above is the only point to edit
# if the upstream layout changes.

patch_source("apps/tracedraw/src/app.rs", [
  ('        app.load_settings();\n        app.apply_runtime_settings();\n', '''        app.load_settings();\n        app.apply_runtime_settings();
        if crate::gwb_embedded() {
            // No recent document, saved workspace or welcome screen in a field.
            app.settings.startup = crate::settings::Startup::NewDocument;
            app.settings.new_document.pages = 1;
            app.settings.new_document.values.rgb = false; // document metadata: CMYK
            app.settings.recent_files.clear();
            app.settings.show_new_document_dialog = false;
            app.units = Units::Millimeters;
            app.color_model = 1; // Color docker: CMYK, not RGB.
            app.mixer_color = app.mixer_color.convert_to("CMYK");
            crate::theme::set_theme(crate::theme::Theme::Light);
            crate::i18n::set_language("ru");
        }
'''),
  ('        if crate::files::WEB {\n            app.show_web_notice();\n', '        if crate::files::WEB && !crate::gwb_embedded() {\n            app.show_web_notice();\n'),
  protected('    pub fn request_new_document(&mut self) {'),
  protected('    pub fn open_dialog(&mut self) {'),
  protected('    pub fn open_template_dialog(&mut self) {'),
  protected('    pub fn open_path_with_password(&mut self, path: PathBuf, password: &str) {'),
  protected('    pub fn close_document(&mut self) {'),
  ('    pub fn new_document(&mut self) {\n',
   '    pub fn new_document(&mut self) {\n        if crate::gwb_embedded() && self.has_document() { return; }\n'),
  ('    pub fn run(&mut self, cmd: Command) {\n',
   '''    pub fn run(&mut self, cmd: Command) {
        if crate::gwb_embedded() && crate::gwb_field_loaded()
            && matches!(&cmd, Command::AddPage { .. } | Command::DeletePage { .. }
                | Command::ResizePage { .. }) {
            self.status = "Размер и количество страниц заданы полем нанесения Макетной".into();
            return;
        }
'''),
])
patch_source("apps/tracedraw/src/documents.rs", [
  ('    pub fn open_document(&mut self, doc: Document, file: Option<PathBuf>) {\n',
   '    pub fn open_document(&mut self, doc: Document, file: Option<PathBuf>) {\n        if crate::gwb_embedded() && self.has_document() { return; }\n'),
  protected('    pub fn close_active_document(&mut self) {'),
  protected('    pub fn close_all_documents(&mut self) {'),
  protected('    pub fn request_exit(&mut self) {'),
  protected('    pub fn new_window(&mut self) {'),
])
patch_source("apps/tracedraw/src/ui/menus.rs", [
  ('fn file_menu(app: &mut App, ui: &mut Ui) {\n',
   '''fn file_menu(app: &mut App, ui: &mut Ui) {
    if crate::gwb_embedded() {
        let doc = app.has_document();
        if item(ui, "menu.file.import", "Ctrl+I", doc) { app.import(); }
        if item(ui, "menu.file.export", "Ctrl+E", doc) { app.export(); }
        return;
    }
'''),
  ('fn window_menu(app: &mut App, ui: &mut Ui) {\n',
   'fn window_menu(app: &mut App, ui: &mut Ui) {\n    if crate::gwb_embedded() { return; }\n'),
])
patch_source("apps/tracedraw/src/ui/toolbar.rs", [
  ('std_button(ui, icons::Action::New, &tip("toolbar.new"), true, false)',
   'std_button(ui, icons::Action::New, &tip("toolbar.new"), !crate::gwb_embedded(), false)'),
  ('std_button(ui, icons::Action::Open, &tip("toolbar.open"), true, false)',
   'std_button(ui, icons::Action::Open, &tip("toolbar.open"), !crate::gwb_embedded(), false)'),
  ('std_arrow(ui, "open_recent", !recent.is_empty())',
   'std_arrow(ui, "open_recent", !crate::gwb_embedded() && !recent.is_empty())')
])
patch_source("apps/tracedraw/src/ui/tabs.rs", [
  ('pub fn document_tabs(app: &mut App, ui: &mut Ui) {\n',
   '''pub fn document_tabs(app: &mut App, ui: &mut Ui) {
    if crate::gwb_embedded() {
        ui.horizontal(|ui| {
            ui.strong("МАКЕТНАЯ · ПОЛЕ НАНЕСЕНИЯ");
            ui.separator();
            let s = app.page_size();
            ui.label(format!("{:.2} × {:.2} мм · CMYK", s.width, s.height));
        });
        return;
    }
''')
])
patch_source("apps/tracedraw/src/theme.rs", [
  ('pub fn set_theme(theme: Theme) {\n',
   'pub fn set_theme(theme: Theme) {\n    let theme = if crate::gwb_embedded() { Theme::Light } else { theme };\n'),
  ('    v.window_corner_radius = 2.0.into();\n    v.menu_corner_radius = 2.0.into();\n    v\n',
   '''    v.window_corner_radius = 2.0.into();
    v.menu_corner_radius = 2.0.into();
    if crate::gwb_embedded() {
        use egui::Color32;
        let green = Color32::from_rgb(0x62, 0x91, 0x25);
        let pale = Color32::from_rgb(0xF3, 0xF7, 0xEF);
        v.panel_fill = pale;
        v.window_fill = Color32::WHITE;
        v.faint_bg_color = Color32::from_rgb(0xE6, 0xEF, 0xDE);
        v.widgets.inactive.bg_stroke.color = Color32::from_rgb(0xBB, 0xD1, 0xB2);
        v.widgets.hovered.bg_fill = Color32::from_rgb(0xE0, 0xEF, 0xD2);
        v.widgets.active.bg_fill = Color32::from_rgb(0xCB, 0xE3, 0xB8);
        v.widgets.hovered.bg_stroke.color = green;
        v.widgets.active.bg_stroke.color = green;
        v.selection.bg_fill = Color32::from_rgb(0xDF, 0xEE, 0xCF);
        v.selection.stroke.color = green;
        v.hyperlink_color = green;
        v.window_corner_radius = 7.0.into();
        v.menu_corner_radius = 7.0.into();
    }
    v
''')
])
print("Patched single-field TraceDraw (native entrypoints, CMYK docker, gifts visuals)")
