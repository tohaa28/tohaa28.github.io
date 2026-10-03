# Maketnaya + Mockups — canonical handoff
Snapshot date: 2026-10-03
Repository: tohaa28/tohaa28.github.io
Canonical source branch: gifts-layout-workbench-mockups-source
Published path: https://tohaa28.github.io/gifts-layout-workbench-mockups/
Published editor: https://tohaa28.github.io/gifts-layout-workbench-mockups/editor.html
Canonical main Maketnaya remains separate and MUST NOT be modified by mockup experiments:
https://tohaa28.github.io/gifts-layout-workbench/

## 0. EXACT SNAPSHOT

Code-state source HEAD before this handoff file:
5b0083483aab8ef137f65bdd163e584778a1de52
message: Remove reverted issue-based mockup save workflow

Published main HEAD observed at snapshot:
9331381c02d75008dbeca9ea8655780bfeb83be4
message: Publish independent Maketnaya with Mockups

Last successful publish for restored state:
workflow run 37148942959
source SHA 0ae56cba94fb77e06a5333e3f08aeb18a1808e73
conclusion: success
The following source-only commit 5b008348... removes the reverted issue workflow file; it does not change the published UI behavior.

Important current file blob SHAs:
- editor.html = 9eecd46e1a4d888f0e67a37aa8bcf0587c696582
- mockup.html = e3631e02483c2de582dc2798845c54e33c6b9e31
- save-profile.html = 0561df707c766ec878ed85b6802aa2cb34c2fe64
- mockup-profiles.json = 1ffd964c56d44a1725a87e1afe000296c2f99198
- tools/collect-mockup-sources.mjs = 036c7bbb271a283b54137c65afc0434d8ab8903c
- .github/workflows/publish-maketnaya-mockups.yml = d84078c0e8a278fff2c2610fe3da26ee2c449551

This handoff commit itself changes only documentation. Continue development from the code-state SHA above plus the handoff commit; do not reset/rebuild the project from scratch.

## 1. USER INTENT / NON-NEGOTIABLES

The independent version “Макетная + мокапы” is a copy of Maketnaya with Mockup Lab integrated into the same page.
Floot is not used.
GitHub is canonical storage and history.
Do not modify the original canonical /gifts-layout-workbench/ unless explicitly requested.
Do not regress existing Maketnaya functionality when editing mockups.

The mockup workflow:
1. User selects an article/order field in Maketnaya.
2. At least one logo is placed in a field.
3. “Редактор мокапов” becomes available.
4. Template, selected field, logo composite and product photos are transferred to Mockup Lab.
5. If confirmed Git mappings exist, the correct photo mapping is applied automatically.
6. If several confirmed photos are mapped to the same field/place, a mockup MUST be generated for every mapped photo.
7. Combined download contains one ready layout PDF and N mockup PNGs.

## 2. CURRENT UI RULES

Top button:
- id: mockupModeButton
- current label: “Редактор мокапов”
- title: “Открыть редактор мокапов”
- compact CSS: padding 4px 10px; min-height 28px; line-height 18px.
- Commit: af90b453b5739fadcc4893b8b4584fdb922c93fb

Visibility:
- button hidden until a real article is selected AND at least one logo is actually placed in a field.
- source of truth is editor state API, not DOM text where possible.
- “Скачать макет и мокап(ы)” appears only when confirmed mapping(s) exist.
- for multiple profiles label becomes e.g. “Скачать макет и 3 мокапа”.

Combined export:
- one ready PDF layout
- one PNG per distinct confirmed photo mapping
- unique PNG filenames include article/place/index/photo
- output ZIP contains all files.

Do not return to one-profile-only export.

## 3. MOCKUP EMBEDDING / HANDOFF

Mockup Lab is embedded in the launcher as srcdoc, not loaded as a remote nested github.io iframe.
Reason: this keeps the working context compatible with gifts.ru and avoids prior photo loading/origin problems.

Direct same-origin bridge exists:
- child exposes window.gwbApplyMockupHandoff
- parent calls frame.contentWindow.gwbApplyMockupHandoff when available
- postMessage remains a fallback

Bundle exposes reproducible APIs through tools/patch-artwork-preflight.mjs:
- window.gwbGetMockupState()
- window.gwbBuildMockupHandoff()
- window.gwbCreateReadyLayoutPdf()

Handoff includes:
- order
- article / variant
- method / place
- printId
- all fieldCandidates
- selectedField
- template dimensions
- artwork info
- transparent fieldCompositeDataUrl
- photoCandidates

Do not append ad-hoc code directly to the compiled bundle; the reproducible patcher has a checksum guard. Changes to compiled behavior must be made through tools/patch-artwork-preflight.mjs unless there is a deliberate baseline migration.

## 4. TRANSPARENT ARTWORK / FIXED REGRESSION

A prior bug added a rectangular background to mockups even when the PDF/AI artwork had no background.
Root cause: PDF.js preview rendered the PDF page background as pixels before mockup compositing.

Current fix:
- PDF artwork used for mockup composite is rerendered to transparent canvas.
- PDF render background is explicitly rgba(0,0,0,0).
- real white artwork remains white; only the PDF page background is transparent.
- fieldCompositeDataUrl is made from this transparent render.
- drawWarped itself does not add a background.

Relevant commits:
2b1395a283b441f3e37a4fa4ef098c264cd3cdf3 Preserve transparent PDF artwork in mockup composites
dde64552ec2a623905431c1165381034ccb1d6b7 Regression-test transparent mockup artwork composites

CI checks for:
- background:"rgba(0,0,0,0)"
- ctx.drawImage(compositeImage...)

Do not remove these checks.

## 5. PRODUCT PHOTO DISCOVERY

Public gifts.ru product pages are used; product photo discovery does not require order authentication.

Known article:
15637 → https://gifts.ru/id/228756
It has real product photos under files.gifts.ru/reviewer/webp/.
“Примеры” under reviewer/tb are NOT product gallery photos and are excluded.

direct-mode.js includes gallery discovery and APIs:
- /api/orders/{order}/items/{itemId}/photos
- /api/orders/{order}/items/{itemId}/photos/{index}

Historical fixes:
cb0168b6b6d987f7184d1034d20a779075f3fe8b Discover and proxy all product gallery photos from gifts.ru
1378b5897fc3d8ffe54d2de7eaae1a7f246ce9c5 Send complete gifts.ru product photo gallery to Mockup Lab
21d97fbcc6c5694fa5e35aae526f3fad9e994ce0 Keep product photo URLs when CORS blocks binary fetch
9f76905f15fc1d84860a1309abc91cac5bd8ca26 Fallback to normal image loading for gifts.ru photos
b43db9c76f7bb3d29b61bb1d6f5fc3600295afd Serialize independent mockup publishes

Mockup image loader tries CORS image first, then ordinary img fallback.
Display can work even when canvas export would be tainted; confirmed Git profile photo loading is part of current flow.

## 6. GIT PROFILE REGISTRY — CANONICAL STORAGE

Canonical file:
mockup-profiles.json
Schema:
gifts-mockup-profile-registry/v1

Current registry snapshot:
updatedAt: 2026-10-03T19:28:42.050Z
confirmed profiles: 5
automatic candidates: 16
article sources: 4

Confirmed profiles at snapshot:
1. article 16535.66
   place: “сторона b [черный(Black); белый(White)]”
   printId: print1
   sizeCm: 29.9999 × 29.9999
   status: confirmed-manual
   photo: 16535.66-2

2. article 15637
   place: лицо
   printId: print1
   sizeCm: 3.2 × 3.2
   status: confirmed-auto
   photo: 15637_4
   confidence: 0.985

3. article 15637
   place: оборот
   printId: print2
   sizeCm: 3.2 × 3.2
   status: confirmed-auto
   photo: 15637_1
   confidence: 0.9592

4. article 16535.66
   place: сторона а
   sizeCm: 30 × 30
   status: confirmed-auto
   photo: 16535.66_76
   confidence: 0.9232

5. article 16535.66
   place: сторона а
   sizeCm: 26 × 25
   status: confirmed-auto
   photo: 16535.66_76
   confidence: 0.9232

Profile uniqueness is intentionally photo-specific:
article + variant + place + photo identity + field/print identity.
Multiple photos for one place MUST coexist and must NOT overwrite each other.

Current matching normalizes decorated order place names, e.g.
“сторона а [черный(...)]” → “сторона а”.

Accepted confirmed statuses:
- confirmed
- confirmed-auto
- confirmed-manual

Do not auto-apply plain candidates.

## 7. MULTI-PHOTO EXPORT

editor.html uses findProfiles(state), not findProfile(state).

Rules:
- collect every compatible confirmed profile
- deduplicate by normalized photo identity
- sort by score/confidence/updated time
- generate one mockup per profile
- create ready PDF once
- zip PDF + all PNGs
- button reflects count

Core commit:
3d6ce3c2cc21c376a15f3c680d2a52f09b289bc6 Export one mockup per confirmed photo mapping

Follow-ups:
de26964dfada1133fb12ab863f812e304c40118d Notify Maketnaya immediately after Git mapping save
2e87703e732353afd32ab9930d6e1a508871a00e Refresh mockup export count after Git mapping save
6e862c104d9d1fcc5576b25972f670791d18419b Regression-test Git save and multi-mockup export

## 8. MANUAL SAVE TO GIT — CURRENT STATE AFTER ROLLBACK

Current architecture is the previously restored browser-PAT save page.

Files:
- mockup.html contains button “Сохранить сопоставление на сайт”
- save-profile.html performs GitHub Contents API write
- target branch: gifts-layout-workbench-mockups-source
- target file: mockup-profiles.json

Current token behavior AFTER rollback:
- token is stored persistently in localStorage on tohaa28.github.io
- key: gifts.mockup.gitToken.v2
- expiration header, when available, is recorded
- before/while saving GitHub is contacted
- invalid/expired/revoked/no-longer-authorized token causes stored token to be removed and UI asks for a new one
- “Забыть токен” button exists
- token is NOT stored in repository files

Relevant commits:
8e0430e27c713f9de6cde046cde913b2c21b8b17 Persist Git token and request replacement when invalid
1990ee49a08bd810228972324d89536417fd724c Regression-test persistent Git token handling

### IMPORTANT ROLLBACK HISTORY
An alternate GitHub-Issue-based save workflow was attempted and then explicitly reverted.

Attempt commits:
1057517b929a530c76cdad7a0451980be1f8e9fe Save mockup mappings through GitHub issue workflow
e0c128ac8bd7de076606d26637efd15ddd8b9100 Add GitHub-native mockup profile save workflow
33433913504ec307eb72393b826a5250c4b47ded Remove browser token page from mockup publish pipeline
36b54325247938ad41c3a5e176d90937491f595c Remove client-side GitHub token storage page

Then user requested rollback. Restored state commits:
ecd42799d61874c1e0afa2a7f94bfedf96cbe9fb Revert GitHub issue profile save flow
610eacacaab3c9bb5644baaaa9b02c40f6589ca5 Restore previous mockup publish pipeline
0ae56cba94fb77e06a5333e3f08aeb18a1808e73 Restore previous persistent token save page
5b0083483aab8ef137f65bdd163e584778a1de52 Remove reverted issue-based mockup save workflow

Therefore CURRENT STATE IS NOT ISSUE-BASED.
Do not reintroduce issue-based save unless the user explicitly requests it.

## 9. AUTOMATIC DISCOVERY / COLLECTOR

Collector:
tools/collect-mockup-sources.mjs

Workflow:
.github/workflows/collect-mockup-sources.yml

Data:
mockup-discovery/*.json
mockup-discovery/screenshots/*

Collector principle:
- open public gifts.ru product pages in Chromium
- collect product photos
- collect constructor references
- inspect the “Нанесение” tab
- use official gifts.ru SVG <polygon class="print"> geometry
- find object silhouette on product photo
- map official SVG print zone into normalized photo coordinates
- emit candidates with confidence
- never silently promote uncertain geometry

Current articleSources:
15637 — Брелок Tetta — https://gifts.ru/id/228756
16535.66 — Сумка Cottonica Recycle — https://gifts.ru/id/242994
12393.89 — Зонт-трость Standard — verified real template
3445.20 — Кружка Promo матовая — https://gifts.ru/id/135170

Current candidates include:
- 15637 face/reverse high confidence
- 16535.66 side A high confidence; side B auto candidates lower confidence 0.5
- 3445.20 multiple named zones, outer zones classified cylinder where appropriate

Manual profile for 16535.66 side B/photo 16535.66-2 is now confirmed-manual and supersedes relying on low-confidence auto candidate for that exact mapping.

## 10. EMBEDDED MOCKUP PROFILE APPLICATION

Mockup Lab:
- loads Git registry from raw source branch first
- published Pages copy is fallback
- applies confirmed server profiles automatically
- if profile photo is not present among current order photo candidates, it can load profile.photo.url directly
- localStorage profile library is only local draft/cache, not canonical mapping storage

Profile library UI distinguishes:
- Git-profile
- Git-candidate
- local draft

## 11. ORDER / TEMPLATE / FIELD RULES FROM MAKETNAYA

Preserve these core Maketnaya rules:
- [print1] = first field, [print2] = second, etc.
- order page place names are authoritative
- field names/methods should match order semantics
- article preview photo is common to print fields, but mockup photo mappings are field/place specific
- arbitrary/freeform field geometry must preserve shape, not only bounding box
- template selected field is transferred separately from constructor preview
- if one article selected and logo placed, mockup editor may open; otherwise button hidden

## 12. PUBLISHING

Workflow:
.github/workflows/publish-maketnaya-mockups.yml

Publishing is serialized to avoid races.
It publishes only:
/gifts-layout-workbench-mockups/

It must include:
- editor.html
- mockup.html
- save-profile.html
- mockup-profiles.json
- direct-mode.js
- compiled assets
- launcher.js
and required vendor files.

Current CI includes regression checks for:
- embedded Mockup Lab / launcher
- direct handoff
- transparent PDF mockup composite
- multi-profile export
- Git manual save
- persistent token behavior
- no sessionStorage in save-profile.html
- compact mockup editor button where present through published editor

Browser smoke test launches Workbench on gifts.ru.

## 13. RECENT IMPORTANT COMMIT HISTORY (NEWEST FIRST AT SNAPSHOT)

5b0083483aab8ef137f65bdd163e584778a1de52 Remove reverted issue-based mockup save workflow
0ae56cba94fb77e06a5333e3f08aeb18a1808e73 Restore previous persistent token save page
610eacacaab3c9bb5644baaaa9b02c40f6589ca5 Restore previous mockup publish pipeline
ecd42799d61874c1e0afa2a7f94bfedf96cbe9fb Revert GitHub issue profile save flow
ebf26562dd0d4a8492931ecaca81d0d52d8eeac9 Save manual mockup mapping 16535.66 · сторона b ... · 16535.66-2
36b54325247938ad41c3a5e176d90937491f595c Remove client-side GitHub token storage page
33433913504ec307eb72393b826a5250c4b47ded Remove browser token page from mockup publish pipeline
e0c128ac8bd7de076606d26637efd15ddd8b9100 Add GitHub-native mockup profile save workflow
1057517b929a530c76cdad7a0451980be1f8e9fe Save mockup mappings through GitHub issue workflow
1990ee49a08bd810228972324d89536417fd724c Regression-test persistent Git token handling
8e0430e27c713f9de6cde046cde913b2c21b8b17 Persist Git token and request replacement when invalid
65b877fbb0d8d51cff5b864d4231707954b11119 Save manual mockup mapping 16535.66 · сторона b ... · 16535.66-2
af90b453b5739fadcc4893b8b4584fdb922c93fb Rename and reduce mockup editor button height
6e862c104d9d1fcc5576b25972f670791d18419b Regression-test Git save and multi-mockup export
2e87703e732353afd32ab9930d6e1a508871a00e Refresh mockup export count after Git mapping save
415f284333917ebeb82015a825b475b8f1013283 Reuse Git authorization window across mapping saves
de26964dfada1133fb12ab863f812e304c40118d Notify Maketnaya immediately after Git mapping save
3d6ce3c2cc21c376a15f3c680d2a52f09b289bc6 Export one mockup per confirmed photo mapping
a58d8e9cde66270ee6d7eb5b4887ef7c30d3d3b4 Publish Git profile save page
7d5e7c77586c0939929f20d31c005fee5657bea1 Add secure Git save page for mockup mappings
f3ba5d31105eb4677a00f2738975c28f48aba164 Save manual mockup mappings through GitHub Pages
dde64552ec2a623905431c1165381034ccb1d6b7 Regression-test transparent mockup artwork composites
2b1395a283b441f3e37a4fa4ef098c264cd3cdf3 Preserve transparent PDF artwork in mockup composites
810103c0b5d44bde92ea0608e045a4059225e531 Restore reproducible editor baseline for mockup action patch
ad1a7cbbd7fba19ba3454e5f4f4f815aeb09a01a Keep combined download to layout PDF and mockup PNG only
fc453d6686cae171b5f553f309d8411fb81cebe8 Prevent mockup visibility observer feedback loop
6288ec79722af31c8c121516d439979fba61f477 Add reproducible mockup eligibility and combined PDF export hooks
32a5b3412b9fbaabb0491ea433d7907fca445948 Show mockup actions only for placed logos and mapped photos
3741badebc5098c3c69b0f7de0d4d929fd05ff75 Expose confirmed profile application to combined export
0663b95d37844c5832b8e3a55673d37d30dd4bfa Expose mockup PNG export and load photos from Git profiles
59aee91b77bef454d3c4c89224eb73c3796b48f7 Expose exact editor state and layout export for mockup workflow

Earlier foundational commits to remember:
- b43db9c... serialize independent mockup publishes
- 21d97fbc... keep photo URLs when CORS blocks binary fetch
- 9f76905f... ordinary-image fallback
- 1378b589... send complete product gallery
- cb0168b6... discover/proxy full gallery
- b8f760... / 8c630... reproducible handoff patch lineage
- f28c4... receive live handoff in embedded Maketnaya
- 1e699... Maketnaya handoff shell

## 14. DO NOT LOSE THESE BEHAVIORS

- Never overwrite one photo mapping with another just because article/place are the same.
- Multiple confirmed photo mappings must produce multiple mockups.
- One PDF per layout, N PNGs per mapped photos.
- Mockup button only after selected article + at least one placed logo.
- Combined download only when mapping(s) exist.
- PDF/AI mockup composite stays transparent.
- Button label remains “Редактор мокапов” and compact.
- Git registry remains canonical mapping storage.
- Auto candidates are not auto-confirmed unless validation is strong.
- Manual confirmed profiles are allowed and current registry contains one for 16535.66 side B.
- Preserve reproducible patch/checksum workflow for compiled editor code.
- Original canonical Maketnaya branch/site must remain untouched by this independent mockup work.

## 15. CURRENT KNOWN LIMITATIONS / NEXT WORK

- Current save-to-Git architecture requires GitHub PAT in the browser save page; current restored version stores it persistently in localStorage. This is current behavior after explicit rollback.
- Do not infer a different token architecture from the abandoned issue-based experiment.
- Cylinder rendering is still experimental; candidate geometry for mug zones is not the same as fully validated physical cylindrical warp.
- Automatic matching for some side-B/product views can have low confidence; manual confirmed mappings should take precedence.
- Direct cross-origin product image display can fall back to ordinary <img>; export still depends on an origin-safe image path or profile/photo load that does not taint canvas.
- Continue using Git history and this handoff; do not rewrite the project from scratch.

## 16. NEW CHAT START INSTRUCTION

In a new chat, say:
“Продолжай Макетная + мокапы из handoff/handoff_MAKETNAYA_MOCKUPS_2026-10-03.md в ветке gifts-layout-workbench-mockups-source. Ничего не откатывай и не начинай заново.”

The next assistant should first read this handoff file and inspect the current branch HEAD before making changes.
