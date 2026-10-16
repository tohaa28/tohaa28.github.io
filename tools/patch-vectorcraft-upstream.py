#!/usr/bin/env python3
"""Patch a pinned VectorCraft checkout for Maketnaya integration, fail-closed.

No checkout of user artwork on the server: this modifies only Rust build sources.
The copyright and license files from upstream remain present in distribution.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve()
here=Path(__file__).resolve().parent
web=root/"apps/vectorcraft-web/src/web.rs"
manifest=root/"apps/vectorcraft-web/Cargo.toml"
source=web.read_text()
def replace_once(before,after):
    global source
    if source.count(before)!=1:
        raise RuntimeError(f"VectorCraft upstream API changed: expected unique {before[:90]!r}, found {source.count(before)}")
    source=source.replace(before,after)
replace_once("    restarts: u32,\n}", "    restarts: u32,\n    bridge_return: Rc<Cell<bool>>,\n    bridge_open_pending: Rc<Cell<bool>>,\n    bridge_ctx: Rc<RefCell<Option<egui::Context>>>,\n}")
replace_once("            restarts: 0,\n", "            restarts: 0,\n            bridge_return: Rc::default(),\n            bridge_open_pending: Rc::default(),\n            bridge_ctx: Rc::default(),\n")
replace_once("        track_paste(&host.pasted);\n        run(host, canvas, None).await;",
             "        track_paste(&host.pasted);\n        if gwb_is_embedded(){gwb_install_bridge(&host);}\n        run(host, canvas, None).await;")
replace_once("                host.pasted.borrow_mut().ctx = Some(ctx.clone());",
             "                host.pasted.borrow_mut().ctx = Some(ctx.clone());\n                *host.bridge_ctx.borrow_mut() = Some(ctx.clone());")
replace_once("            if let Some(el) = element(LOADING_ID) {\n                el.remove();\n            }",
             "            if let Some(el) = element(LOADING_ID) {\n                el.remove();\n            }\n            if gwb_is_embedded(){gwb_send(\"gwb-vectorcraft-ready\",None,None);}")
replace_once("        app.logic(ctx);",
             "        app.logic(ctx);\n        if gwb_is_embedded() && self.host.bridge_open_pending.get() && app.session.active().is_some(){\n            self.host.bridge_open_pending.set(false);\n            gwb_send("gwb-vectorcraft-opened",None,None);\n        }\n        if gwb_is_embedded() && self.host.bridge_return.replace(false){gwb_export_editor(app);}")
replace_once("        recovery_store: Some(Arc::new(BrowserStore { locks })),",
             "        recovery_store: if gwb_is_embedded(){None}else{Some(Arc::new(BrowserStore { locks }))},")
replace_once("const CANVAS_ID: &str = \"vectorcraft_canvas\";",
             "include!(\"maketnaya_bridge.rs\");\n\nconst CANVAS_ID: &str = \"vectorcraft_canvas\";")
web.write_text(source)
(root/"apps/vectorcraft-web/src/maketnaya_bridge.rs").write_text((here/"vectorcraft-bridge.rs").read_text())
man=manifest.read_text()
if man.count('wasm-bindgen-futures = "0.4"')!=1: raise RuntimeError("upstream manifest mismatch")
man=man.replace('wasm-bindgen-futures = "0.4"', 'wasm-bindgen-futures = "0.4"\nserde_json = { workspace = true }')
if '"MessageEvent"' not in man: man=man.replace('"MouseEvent", "PointerEvent"', '"MouseEvent", "MessageEvent", "PointerEvent"')
manifest.write_text(man)
print("Patched VectorCraft WASM import/export bridge, native canvas preserved")
