# Cylinder field height correction — 2026-10-14

Baseline: b42fc2bad3c4575eea3468e170ed3d1e33f10e21. Latest registry blob d3e49bfcc335030838e1cf832a0588c7df613198 preserved.

User reported that the cylinder artwork appeared below the blue marked field after the development fix. Rim arc offsets were added to axial coordinates already given in photo space. Corrected development-to-surface conversion to anchor the field on the front meridian: axial=(marked-topArc)/(1+bottomArc-topArc); the inverse conversion and metric scales use the same frame. Front top/bottom now match the user's marked height; lateral curvature remains. Applies to both axes and the shared preview/PNG renderer.

144 local unit tests pass, launcher build/syntax pass. Added browser pixel checks for the top and below-bottom of the field in BOTH preview and PNG with nonzero rim arcs. CI execution pending at commit time.

Only mockup geometry/tests/cache revision changed. Existing profiles and other application modules remain untouched. Rollback branch: backup-cylinder-height-20261014.
