# Cylindrical imprint alignment — 2026-10-14

## User issue
The full field composite was placed on a flat template development, but the cylinder renderer drew part of the print below the blue user-marked field. The previous repair normalized rim top/bottom at the front meridian only; a residual displacement remained on side meridians (especially with negative `topArc`/`bottomArc`).

## Source and safe rollback
Repository: `tohaa28/tohaa28.github.io`, branch `gifts-layout-workbench-mockups-source`.
Last known fully green baseline: `77f047c91930a1f8f06287dfa34633b5ae85238a` (GitHub Actions run `38544382762`: unit, Chromium, publish and browser verify all SUCCESS).
Rollback branch created: `backup-cylinder-stable-20261014-77f047c`.
Preserve `mockup-profiles.json` verbatim: do not rewrite or prune user mappings. No changes to the main Workbench, PrintCheck, motion, UI, server handoff protocol.

## Fix
`assets/mockup-cylinder.mjs` exports `cylinder3DArtworkSurfacePoint`. The front meridian is unchanged. On side meridians, the renderer compensates only for the depth-dependent **axial** displacement inherited from rim guide curvature, using `correction = ((1-axial)*topArc + axial*bottomArc) * axialSpan * (1-cos(theta))`. `cylinder3DSurfacePoint` remains the guide/torus-outline mapping; thus green top/bottom rims still bow, while flat-development artwork retains its user-defined axial coordinates and sine-based circumferential wrap, including back-face clipping. Renderer uses the new function for both preview and PNG.

The change applies to vertical and horizontal cylinder axes; does not affect perspective mode, composite aspect-fit logic, photo source or profile persistence. Module cache key: `20261014-3`; mockup UI version `r20261014-3`.

## Validation
Unit: `tests/mockup-cylinder.test.mjs` tests normal and negative arcs, different wrapped locations and both axes, plus independent guide-vs-print geometry.
Browser: `tests/mockup-cylinder-browser.mjs` samples a full field composite's red stripe at an off-axis location in both preview and exported PNG, checking painted pixels *inside* and background *below* the blue marked bottom using negative arcs.
Workflow: `.github/workflows/publish-maketnaya-mockups.yml` runs precheck, Chromium mockup test, publish, full Workbench browser_verify. Confirm latest `gifts-layout-workbench-mockups-source` commit runs are all successful before marking deployed.

## Release check
Open `https://tohaa28.github.io/gifts-layout-workbench-mockups/mockup.html`, choose cylinder, and use a saved 77700.60 cylinder profile; verify that printed content remains at the height of the blue development on center and sides. Confirm all user profiles still exist. Original screenshot artwork is unavailable for pixel-perfect validation; tests use the retained user geometry and synthetic contrast markers.
