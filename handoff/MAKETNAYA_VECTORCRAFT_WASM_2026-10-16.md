# VectorCraft WASM inside Макетная — integration handoff (2026-10-16)

## Goal
Replace homegrown vector object editor with genuine [storytold/vectorcraft](https://github.com/storytold/vectorcraft) Rust+WebAssembly editor, and guarantee selected artwork transfer and exact target placement return.

## Fixed bases / rollback
- Source before changes: `b9a9f32389015e4ba98019614ac9fb33004e1955`.
- Published `main` before changes: `d96c616cd1dd1f748cbe6291b5b0edcdff43527d`.
- Backups: `backup-before-vectorcraft-wasm-20261016`, `backup-published-before-vectorcraft-wasm-20261016`.
- Feature: `feature-vectorcraft-integration-20261016`.
- Upstream VectorCraft is pinned to `8bc65329286dc1b84aa392997bb205613c3e96cb`. License MIT OR Apache-2.0, keep both LICENSE files and NOTICE; no upstream application art trademarks copied into Maketnaya UI.

## Architecture / files
- `assets/vectorcraft-integration.js`: capture click on #editorOpenLogoEditor, full-screen iframe of `https://tohaa28.github.io/gifts-layout-workbench-mockups/vectorcraft/index.html#gwb=<session token>`, dark header with single `Применить в Макетной` action. Transfer actual selected `File.arrayBuffer` + filename through structured clone `postMessage`. Receives SVG `Uint8Array` from child, validates origin/source/token and SVG structure, submits File to `window.gwbApplyEditedLogoToActiveField(file, placementToken)`, preserves existing x/y/w/h/rotation/clipToField. Supports cancel and old-editor fallback.
- `editor.html`: loads VectorCraft bridge JS after existing `assets/logo-editor.js`. Old editor stays available as manual fallback, no removal of PrintCheck.
- `tools/vectorcraft-bridge.rs`: included in pinned VectorCraft `apps/vectorcraft-web/src/web.rs` during WASM build. Attaches MessageEvent listener to import original bytes into VectorCraft `Services::inbox`, including PDF/AI/SVG. On `gwb-vectorcraft-apply` invokes the **real** `vectorcraft_engine::cmd::fileio::encode_with_warnings(doc,"svg",...)` on active document and posts SVG bytes and export warnings to parent. Never approximates editing in Maketnaya. Embedded sessions disable VectorCraft localStorage document recovery.
- `tools/patch-vectorcraft-upstream.py`: anchor-checked patch applying Rust addition to exactly pinned checkout, adds Cargo `serde_json` and `web-sys/MessageEvent`, bridge hooks inside runner lifecycle.
- `.github/workflows/build-vectorcraft-web.yml`: separate `on:push` workflow from source branch, checks out pinned VectorCraft, builds with Rust target wasm32 + trunk 0.21.14, validates generated JS and WASM, copies license texts, commits assets under `main/gifts-layout-workbench-mockups/vectorcraft/`. All customer documents stay entirely in browser.
- `.github/workflows/publish-maketnaya-mockups.yml`: regular UI publisher preserves built VectorCraft distribution across ordinary source updates, and tests postMessage bridge by `tests/vectorcraft-handoff-browser.mjs`.
- `tests/vectorcraft-handoff-browser.mjs`: Playwright uses deterministic simulated VectorCraft iframe to test bytes, source/token validation, return to current selected field with same-name independent logos, unchanged placement and cancel. **Does not replace actual Rust WASM compile verification**.

## Must verify before telling user integration is live
1. `Build VectorCraft WebAssembly` GitHub Actions all steps success and WASM/JS publicly available inside `main/gifts-layout-workbench-mockups/vectorcraft`. First build may need Rust API/target fixes — do NOT imply installed if compile fails.
2. Source `editor.html` new script promoted via verified `Publish Maketnaya with Mockups` precheck + publish + browser_verify, no overwritten wasm directory.
3. GitHub Pages actual iframe loads, emits `gwb-vectorcraft-ready`, accepts file, exports `gwb-vectorcraft-svg`, browser in gifts.ru can use WebGPU or WebGL2.
4. Check `mockup-profiles.json` SHA `ddb84fdc0d656341770a2399f5a10f0e21f5d72c` and `method-settings.json` SHA `cbf6c8204e4fb3892d806342d37debefb8d9038e` remain same in source and published.

## Safety
Never commit customer artwork. Don't store file bytes in Git, localStorage, sessionStorage; only `File`/ArrayBuffer in current browser memory. Parent accepts bytes only from exact GitHub Pages origin and current iframe source with session token. Child accepts only known parent origins and matching URL hash token, and file <= 40MB. Both return and original target token are checked, save is non-destructive until trusted export. If VectorCraft returns warnings, user sees a confirmation before replacement. Closing without Apply leaves source intact.
