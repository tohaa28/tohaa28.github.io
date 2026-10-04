# Maketnaya + Mockups — CURRENT CANONICAL SNAPSHOT
Date: 2026-10-04

Repository: tohaa28/tohaa28.github.io
Branch: gifts-layout-workbench-mockups-source
Published: https://tohaa28.github.io/gifts-layout-workbench-mockups/
Original canonical Maketnaya: https://tohaa28.github.io/gifts-layout-workbench/ — DO NOT modify for mockup experiments.

## Base handoff
Read first:
handoff/handoff_MAKETNAYA_MOCKUPS_2026-10-03.md

This file OVERRIDES that handoff wherever they conflict.

## Exact code point
Code HEAD before this snapshot:
ff6d5db7b34b307aa1a1a577589acd598b44afd2
Rollback persistent-token regression checks

Previous commit:
e170c29c5c12afb14de68be517f696a9b08d0b45
Rollback persistent Git token storage

These two commits were explicitly requested by the user and revert ONLY the most recent persistent-token change.

## CURRENT TOKEN BEHAVIOR — IMPORTANT OVERRIDE
Current save-profile.html uses sessionStorage again.
- PAT is NOT persisted in localStorage.
- PAT is NOT stored in Git.
- PAT is NOT embedded in GitHub Pages source.
- PAT survives only the current browser session.
- Closing the browser session requires token entry again.

Current save-profile.html blob:
22a2559d2debb6512adfa1fa14dcf02f17192f6f

Current publish workflow blob:
4aa0b864849b28a9892a7f94bfedf96cbe9fb

Temporary persistent-token implementation existed in:
8e0430e27c713f9de6cde046cde913b2c21b8b17
1990ee49a08bd810228972324d89536417fd724c
It is NOT current.

A later idea to store the token “on Git” was discussed but NOT implemented. Never commit a PAT to this public repo.

## Current UI / export behavior
- top button label: “Редактор мокапов”
- compact CSS: padding 4px 10px; min-height 28px; line-height 18px
- button hidden until an article is selected AND at least one real logo is placed
- combined download hidden until confirmed mapping(s) exist
- one mapping: “Скачать макет и мокап”
- several mappings: “Скачать макет и N мокапов”
- ZIP contains exactly one ready layout PDF + one PNG for every distinct confirmed mapped photo
- multiple photos for one place MUST coexist, never overwrite one another

Core multi-profile implementation:
3d6ce3c2cc21c376a15f3c680d2a52f09b289bc6
de26964dfada1133fb12ab863f812e304c40118d
2e87703e732353afd32ab9930d6e1a508871a00e
6e862c104d9d1fcc5576b25972f670791d18419b

Button UI commit:
af90b453b5739fadcc4893b8b4584fdb922c93fb

## Current Git profile registry
File: mockup-profiles.json
Schema: gifts-mockup-profile-registry/v1
updatedAt: 2026-10-03T19:28:42.050Z
confirmed profiles: 5
automatic candidates: 16
article sources: 4

Confirmed:
1) 16535.66
   place: сторона b [черный(Black); белый(White)]
   print1
   29.9999 x 29.9999 cm
   confirmed-manual
   photo 16535.66-2

2) 15637
   лицо
   print1
   3.2 x 3.2 cm
   confirmed-auto
   photo 15637_4
   confidence 0.985

3) 15637
   оборот
   print2
   3.2 x 3.2 cm
   confirmed-auto
   photo 15637_1
   confidence 0.9592

4) 16535.66
   сторона а
   30 x 30 cm
   confirmed-auto
   photo 16535.66_76
   confidence 0.9232

5) 16535.66
   сторона а
   26 x 25 cm
   confirmed-auto
   photo 16535.66_76
   confidence 0.9232

Accepted confirmed statuses:
confirmed / confirmed-auto / confirmed-manual
Plain candidates MUST NOT auto-apply.

Uniqueness remains photo-specific:
article + variant + place + photo identity + field/print identity.

## Transparency fix — preserve
PDF/AI artwork used for mockups must be rerendered on transparent background.
Do not reintroduce white PDF page background.
Relevant commits:
2b1395a283b441f3e37a4fa4ef098c264cd3cdf3
dde64552ec2a623905431c1165381034ccb1d6b7

## Handoff / compiled patch
Mockup Lab remains embedded as srcdoc.
Direct child API:
window.gwbApplyMockupHandoff
Parent APIs are injected reproducibly by tools/patch-artwork-preflight.mjs:
window.gwbGetMockupState()
window.gwbBuildMockupHandoff()
window.gwbCreateReadyLayoutPdf()

Do NOT patch the compiled bundle ad hoc; preserve checksum-controlled patch workflow.

## Automatic collector
tools/collect-mockup-sources.mjs
.github/workflows/collect-mockup-sources.yml
mockup-discovery/*.json
mockup-discovery/screenshots/*

Known article sources:
15637 -> https://gifts.ru/id/228756
16535.66 -> https://gifts.ru/id/242994
12393.89 -> verified real template
3445.20 -> https://gifts.ru/id/135170

Collector uses official gifts.ru SVG print polygons and photo silhouettes.
Uncertain mappings stay candidates.
Cylinder warp remains experimental.

## Manual save to Git
mockup.html has “Сохранить сопоставление на сайт”.
save-profile.html writes mockup-profiles.json through GitHub Contents API into branch gifts-layout-workbench-mockups-source.
After a successful manual save, current Maketnaya session is notified and export count refreshes.

The GitHub-Issue save experiment was explicitly reverted. Do not restore unless asked.
Attempt:
1057517b929a530c76cdad7a0451980be1f8e9fe
e0c128ac8bd7de076606d26637efd15ddd8b9100
33433913504ec307eb72393b826a5250c4b47ded
36b54325247938ad41c3a5e176d90937491f595c
Rollback:
ecd42799d61874c1e0afa2a7f94bfedf96cbe9fb
610eacacaab3c9bb5644baaaa9b02c40f6589ca5
0ae56cba94fb77e06a5333e3f08aeb18a1808e73
5b0083483aab8ef137f65bdd163e584778a1de52

## Recent commit history to preserve
ff6d5db7b34b307aa1a1a577589acd598b44afd2 Rollback persistent-token regression checks
e170c29c5c12afb14de68be517f696a9b08d0b45 Rollback persistent Git token storage
eacc2e63127827caf0bc3c553e246b0e5f183bb9 Save exact Maketnaya mockups handoff snapshot
5b0083483aab8ef137f65bdd163e584778a1de52 Remove reverted issue-based mockup save workflow
0ae56cba94fb77e06a5333e3f08aeb18a1808e73 Restore previous persistent token save page
610eacacaab3c9bb5644baaaa9b02c40f6589ca5 Restore previous mockup publish pipeline
ecd42799d61874c1e0afa2a7f94bfedf96cbe9fb Revert GitHub issue profile save flow
ebf26562dd0d4a8492931ecaca81d0d52d8eeac9 Save manual mockup mapping 16535.66 side B
1990ee49a08bd810228972324d89536417fd724c Regression-test persistent Git token handling
8e0430e27c713f9de6cde046cde913b2c21b8b17 Persist Git token and request replacement when invalid
65b877fbb0d8d51cff5b864d4231707954b11119 Save manual mockup mapping 16535.66 side B
af90b453b5739fadcc4893b8b4584fdb922c93fb Rename and reduce mockup editor button height
6e862c104d9d1fcc5576b25972f670791d18419b Regression-test Git save and multi-mockup export
2e87703e732353afd32ab9930d6e1a508871a00e Refresh mockup export count after Git mapping save
de26964dfada1133fb12ab863f812e304c40118d Notify Maketnaya immediately after Git mapping save
3d6ce3c2cc21c376a15f3c680d2a52f09b289bc6 Export one mockup per confirmed photo mapping
dde64552ec2a623905431c1165381034ccb1d6b7 Regression-test transparent mockup artwork composites
2b1395a283b441f3e37a4fa4ef098c264cd3cdf3 Preserve transparent PDF artwork in mockup composites

Keep full Git history; do not squash away experiments/rollbacks.

## New chat instruction
Use exactly:
“Продолжай Макетная + мокапы из handoff/handoff_MAKETNAYA_MOCKUPS_2026-10-04.md в ветке gifts-layout-workbench-mockups-source. Ничего не откатывай и не начинай заново.”

Before changing code:
1. read this file
2. read handoff/handoff_MAKETNAYA_MOCKUPS_2026-10-03.md for deeper history
3. inspect current branch HEAD
4. inspect latest publish workflow
5. continue from exact Git state
