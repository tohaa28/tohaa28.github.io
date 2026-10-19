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
if page.count('await init({ module_or_path: bytes });')!=1:
    raise RuntimeError("TraceDraw upstream boot drift")
page=page.replace('await init({ module_or_path: bytes });',
                  'await init({ module_or_path: bytes });\n'
                  '        window.dispatchEvent(new Event("gwb-tracedraw-started"));')
index.write_text(page,encoding="utf-8")
print("Applied pinned TraceDraw WASM embedding, native transfer and single-field bridge")
