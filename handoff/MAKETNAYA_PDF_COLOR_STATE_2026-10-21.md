# PDF color-state regression fix — 21 October 2026

Base source: b6be79b47f175148300413e98106a6dfb02739c5.
Base production: 6010440328ed7c4ebcacc65f237bdc163e5f2f21.
Backup branches: backup-colors-20261021-source and backup-colors-20261021-production.

Four regressions reproduced against the actual inspectArtwork implementation,
using serialized PDF-lib PDF files, before changing the analyzer:

- A Contents array reset the fill/stroke colors at every stream boundary.
- q/Q state split across streams was lost, misreporting CMYK as Gray.
- Form XObjects ignored caller colors and were scanned only once, losing a
  second invocation under a different color; form colors must not leak outward.
- A `/Unused Do` inside a comment or text string activated an unused RGB image.

The analyzer now treats Contents arrays as one program, passes inherited colors
to each Form invocation, isolates its local state, and detects Do through the
same cleaned operator scanner as fill/stroke. Active recursion is bounded.
No input PDF bytes, image data, editor conversion, or export geometry are changed.

Local validation:

- Before fix: all four new PDF fixture tests failed.
- After fix: all 204 unit tests passed.
- Full browser workflow extracted from test-direct-workbench.yml passed with
  checkout assets served locally, including actual PDF.js/native editor return.
- Added repeated RGB → CMYK → RGB returns: each result reports the current PDF
  model, preserves its bytes, invalidates the previous detail key, and completes
  the new small-element scan.
- VectorCraft handoff, TraceDraw integration, raster JPEG/WebP/mixed SVG,
  lossless RGB/CMYK raster/vector PDF crop, and uploaded-order-layout browser
  suites passed. Order save/replace/delete endpoints are mocked in these tests.
- PrintCheck revision after build: v25 re1f43fb8. Maketnaya component remains
  r7fa6f062 because this change affects the independently versioned PrintCheck.

The iframe handoff suites simulate editor messages; no Rust/WASM source changed.
This does not certify the user's particular logo or live authenticated gifts.ru
order. The earlier report's conversion direction remains ambiguous: CMYK → RGB
must produce an RGB finding. Real RGB must never be hidden by a CMYK document label.

Preserved: native raster/vector PDF, transfer progress/interaction lock,
«Сохранить макет в заказ на gifts.ru» and
«Сохранить как.. макет в заказ на gifts.ru», registries, private drafts and history.
Publication/CI results are recorded separately after completion.
