#!/usr/bin/env python3
"""Pin-checked upstream patches: Maketnaya embedded VectorCraft is SINGLE document.

Only applied to the iframe launched by Maketnaya (#gwb=...). Standalone
VectorCraft remains unmodified at runtime (new/open/tab functionality intact).
Run after patch-vectorcraft-upstream.py, before trunk build.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve()
def patch(relative, changes):
    file=root/relative
    text=file.read_text()
    for old,new in changes:
        n=text.count(old)
        if n!=1: raise RuntimeError(f"Upstream VectorCraft changed {relative}: expected exactly one {old[:85]!r}, got {n}")
        text=text.replace(old,new)
    file.write_text(text)
    print(f"Single-field VectorCraft patched: {relative}")

patch("crates/ui-egui/src/lib.rs", [
    ("    pub session: Session,\n    pub ui: UiState,",
     "    pub session: Session,\n    /// This browser instance edits one logo placed in Maketnaya, never another document.\n    pub single_field_mode: bool,\n    pub ui: UiState,"),
    ("        Self {\n            session,\n            ui: UiState::default(),",
     "        Self {\n            session,\n            single_field_mode: false,\n            ui: UiState::default(),"),
    ("    pub fn run(&mut self, id: &str, params: Value) -> Result<Value, String> {\n",
     """    pub fn run(&mut self, id: &str, params: Value) -> Result<Value, String> {
        // ALL command paths (menus, shortcuts, command palette and automation)
        // come through here. Do not permit new/open/close, even if the menu
        // was hidden or another shortcut was configured.
        if self.single_field_mode && (matches!(id,
            "file.new" | "file.newDialog" | "file.newFromTemplate"
            | "file.open" | "document.open" | "document.new"
            | "file.close" | "file.closeAll" | "app.home" | "app.quit"
        ) || id.starts_with("file.openRecent")) {
            self.status("В Макетной VectorCraft редактирует только текущее поле нанесения");
            return Err("Создание и открытие других документов отключено в Макетной".into());
        }
"""),
    ("        for (name, bytes) in arrived {\n            if let Err(e) = io::open_bytes(self, &name, &bytes, None) {",
     """        for (name, bytes) in arrived {
            // Initial byte stream from the trusted Maketnaya bridge is the
            // only allowed new document; File › Place and clipboard paste
            // are separate operations that still edit the current artwork.
            if self.single_field_mode && !self.session.documents().is_empty() {
                self.status("В Макетной нельзя открывать второй документ");
                continue;
            }
            if let Err(e) = io::open_bytes(self, &name, &bytes, None) {"""),
    ("                chrome::doc_tabs(self, ui);",
     """                // Hide the document-tab close/switch affordances for embedded
                // one-field sessions; work directly on the selected logo.
                if !self.single_field_mode { chrome::doc_tabs(self, ui); }""")
])
patch("crates/ui-egui/src/chrome.rs", [
    ("""            let on_home = menus::home_showing(app);
            if widgets::icon_button(ui, "house", tl!("Home"), on_home, 20.0).clicked() {
                app.run("app.home", json!({})).ok();
            }
            ui.add_space(2.0);""",
     """            if !app.single_field_mode {
                let on_home = menus::home_showing(app);
                if widgets::icon_button(ui, "house", tl!("Home"), on_home, 20.0).clicked() {
                    app.run("app.home", json!({})).ok();
                }
                ui.add_space(2.0);
            }""")
])
patch("crates/ui-egui/src/menus.rs", [
    ("    let tree = menu_tree_named(app.session.prefs.font_names_in_english);\n",
     """    let mut tree = menu_tree_named(app.session.prefs.font_names_in_english);
    if app.single_field_mode {
        // Keep File › Place for adding objects to the CURRENT logo while
        // removing entrypoints that replace, close, or create documents.
        for (title,items) in &mut tree {
            if *title == "File" {
                items.retain(|item| match item {
                    Item::Cmd(_,id,_) => !matches!(*id,
                        "file.newDialog" | "file.newFromTemplate" | "file.open"
                        | "file.close" | "file.closeAll"),
                    Item::Sub(name,_) => *name != "Open Recent Files",
                    _ => true,
                });
            }
        }
    }
""")
])
# Set mode before any egui frame, including keyboard shortcuts and menu UI.
patch("apps/vectorcraft-web/src/web.rs", [
    ("                let app = match taken.borrow_mut().take() {\n",
     "                let mut app = match taken.borrow_mut().take() {\n"),
    ("                Ok(Box::new(WebShell { app: Some(app), host, canvas: page, loss }))",
     """                app.single_field_mode = gwb_is_embedded();
                Ok(Box::new(WebShell { app: Some(app), host, canvas: page, loss }))"""),
    ("        if !dropped.is_empty() {\n",
     "        if !gwb_is_embedded() && !dropped.is_empty() {\n"),
])
print("VectorCraft native single-field lock installed; standalone behavior unchanged")
