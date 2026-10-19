#!/usr/bin/env python3
"""Pin-and-patch TraceDraw WASM to a single Maketnaya imprint field.
Keep the original igtoth/tracedraw source untouched in our source branch.
No customer artwork leaves the user's browser."""
import pathlib, sys

root=pathlib.Path(sys.argv[1])
main=root/"apps/tracedraw/src/main.rs"
src=main.read_text(encoding="utf-8")
def once(old,new):
    global src
    if src.count(old)!=1:
        raise RuntimeError(f"TraceDraw upstream drift: expected one {old!r}, got {src.count(old)}")
    src=src.replace(old,new)
once('mod web;\n','mod web;\n#[cfg(target_arch = "wasm32")]\nmod gwb_bridge;\n')
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
module_new='    import init, {gwb_tracedraw_request_apply} from "./tracedraw.js";'
if page.count(module_import)!=1: raise RuntimeError("TraceDraw WASM import changed")
page=page.replace(module_import,module_new)

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
