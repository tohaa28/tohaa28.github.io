# Макетная / TraceDraw: единый режим поля с VectorCraft (19.10.2026)

## Scope
Continuation of the frozen integration described in `handoff/START_HERE_2026-10-19_FINAL.md`. Implement the same application constraints in embedded TraceDraw as in VectorCraft, without replacing the real Rust/WASM engine.

## Frozen safety snapshots created before the change
- `backup-before-tracedraw-field-lock-20261019-source`: `23e984ebf426a255e6aea8b483f961aee83a21eb`
- `backup-before-tracedraw-field-lock-20261019-production`: `eafb2c85d563b619165c79f858426b97256126ca`

## Work committed to source
- `tools/patch-tracedraw-upstream.py`: native embedded guards in `App` and document manager for New/Open/Close/Exit, template and recent document replacement, new window and new tabs. Existing import action is preserved and inserts objects into the same print field. Page Add/Delete/Resize commands are rejected in the loaded session. File menu remains Import/Export, tabs show the current field, other native tools remain available.
- TraceDraw startup uses one page, `PrimaryColorMode::Cmyk` via `new_document.values.rgb=false`, CMYK Color docker and millimeter units, Russian UI and default locked gifts.ru-inspired light styling. Desktop and standalone TraceDraw (without Maketnaya token) keep their upstream behavior.
- `tools/tracedraw-embedded.rs`: immutable field-size and one-page checks at Apply, real CMYK document-mode validation, unchanged art-only cropped SVG transfer with physical bounds. An invalid document cannot replace the original artwork in Maketnaya.
- `assets/logo-editor-choice.js`: truthful SVG/PDF label, no unsupported embedded CDR claim.
- `assets/vectorcraft-integration.js` and `assets/tracedraw-integration.js`: forbid opening both editors for the same field concurrently; TraceDraw cache key updated.
- `tools/stamp-component-versions.mjs`: Maketnaya version stamp includes both native editor client adapters.
- `tests/tracedraw-field-lock.test.mjs` plus amended browser tests for supported formats and session isolation.

## Validation status (do not overstate)
- **Passed**: exact pinned-upstream search verified unique injection anchors after resolving an ambiguous `apply_runtime_settings()` replacement; 24 targeted method/pattern matches were checked in the pinned upstream. GitHub source writes completed.
- **Passed**: protected source and production JSON blobs are unchanged: `mockup-profiles.json` = `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`; `method-settings.json` = `cbf6c8204e4fb3892d806342d37debefb8d9038e`.
- **Partially published**: the site pipeline has published changed JS adapters. At this writing, latest observed production commit `d1853c46d1888d6db66c1a8e052b100bac63c643`.
- **Not independently verified**: new `tracedraw_bg.wasm` build and live browser runtime. Build is configured to trigger on changes to `tools/patch-tracedraw-upstream.py` and `tools/tracedraw-embedded.rs`, but a successful run and updated WASM SHA must be checked before claiming release completion.

## Next checks
1. Confirm `Build TraceDraw WebAssembly` completed successfully and `main/gifts-layout-workbench-mockups/tracedraw/` contains newly built WASM from the updated bridge.
2. Confirm `Publish Maketnaya with Mockups` precheck, publish and browser verification have passed on latest source.
3. Run `Verify live TraceDraw WASM` **after** the updated binary reaches GitHub Pages, testing fixed 60×35 mm, true CMYK metadata, no second document, import into existing field, crop and return.
4. Exercise Create New, Open, Open Recent, tabs, Ctrl+N/Ctrl+O, Layout page change, Cancel, PDF/SVG imports, negative offsets and double-editor attempt against real authorized gifts.ru.
5. Preserve all saved user draft PDF data; private gifts.ru storage API remains **not deployed**, local IndexedDB is the actual storage. Embedded direct CDR import is not implemented.

## Important
Never roll back existing `mockup-profiles.json`, `method-settings.json`, both WASM directories or private user artwork to an older checkpoint. Do not publish sensitive customer artwork or session tokens to GitHub. Old checkpoint refs remain untouched.
