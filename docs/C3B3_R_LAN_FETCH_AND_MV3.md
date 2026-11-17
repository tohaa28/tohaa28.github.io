# Vision Check C3B.3.R — 10/10 LAN card failures and opt-in MV3 cross-origin transport

Date: 2026-11-17. Source: two user-provided anonymous files,
\`vision-local-test-order-review.json\` (2026-11-17T10:46:19.507Z) and
\`vision-local-table-diagnostic (3).json\` (2026-11-17T10:46:24.475Z).
These files are NOT committed to GitHub. This document contains only
source-derived aggregate counts and code architecture.

## Actual LAN evidence — not a successful artwork scan

- \`61\` recognized order table rows, \`61\` explicit order-card links,
  \`0\` ambiguous or unresolved.
- \`10\` rows marked \`analysis_complete=true\`; **all ten** have exactly
  \`status:MANUAL, reason:ORDER_DETAIL_FETCH_OR_CORS_FAILURE\`.
- \`51\` remaining rows are unexamined. No row has a verified
  \`customer_uploaded_artworks\`, \`constructor_template_count\` or source
  bytes. \`order_card_discovered=true\` means **the link was detected**,
  not that the card HTML was actually retrieved.
- The table has 7 link-text artwork candidates, all cross-origin/unsafe,
  and 0 direct same-origin artwork files. They are not proof of uploads.
- The previous exception handler collapsed BOTH order-card and popup
  HTTP failures into the same code. From this evidence alone, we **cannot
  assert CORS was the cause**. HTTP redirect, blocked cookies, offline
  host, DNS, CSP and different server response types remain plausible.

## Code corrections

1. \`vision/orders/order-page-discovery.mjs\` now uses non-sensitive
   \`stage\` (\`order_card\`/\`popup\`) and \`origin_relation\`
   (\`same_origin\`/\`approved_other_test_origin\`) on errors.
   Separately reports HTTP status (no response body), HTML login,
   timeout, response size, content-type and fetch rejection. The last
   still correctly says \`cors_redirect_or_network\`, not "CORS proven".
2. \`vision/orders/row-scanner.mjs\` adds anonymous
   \`order_target_origin_counts\` for the 61 known links; no URLs,
   order IDs, cookies or filenames leave the user's browser.
3. \`vision/orders/overlay-entry.mjs\` places stage/reason in row text
   and \`Отчёт JSON\`. All findings remain \`MANUAL\` or
   \`RESEARCH_ONLY\` and never mean production approval.

## Opt-in local Chrome MV3 solution

**Browser transport is packaged locally**, not downloaded as executable
remote script. The user must explicitly install unpacked extension in
Chrome. Files:
\`vision/orders/extension/manifest.json\`,
\`content-transport.js\`, \`service-worker.js\`, \`README_RU.md\`,
plus **bundled** \`vision-order-overlay.js\` produced by esbuild.

Exactly two explicit host permissions:
\`http://psk.testgifts.local/*\` and
\`http://testgifts.local/*\`.
The service worker accepts connections only from the top-level
\`http://psk.testgifts.local/devorders*\` page. It serves only
GET requests to exact read-only paths:
\`/private/order/<digits>\`,
\`/ajax/gifts/order?action=makets_popup&oid=<digits>\`,
\`/cart/act/mda?oid=<digits>&id=<digits>\`.
No production Gifts, remote telemetry, arbitrary URLs, uploads,
deletes, popup reference constructors, or background bulk crawl.
It streams short chunks back to its own isolated content script.
Document max 3MB, artwork max 16MB, 15sec worker timeout.
The UI does not initiate network activity until user explicitly clicks
on a row or a ten-order batch.

**Security limitation:** Browser host permission makes extension worker
cross-origin requests permissible; it does NOT bypass server sessions,
authorization or cookie restrictions. If either test host denies access
or redirects to a login, actual verification still needs a same-browser
authorized test session and status stays MANUAL. No server auth bypass.

## Verification

[GitHub Actions 44069420844](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44069420844)
**SUCCESS**, commit \`a5ac89d2\`:

- Node \`tests/printcheck-vision-lan-failure-stages.test.mjs\` confirms
  CARD vs POPUP, same vs other approved origin, HTTP 403, auth HTML,
  unknown browser fetch cause, and no personal URL/body leakage.
- Node \`tests/printcheck-vision-extension-worker.test.mjs\` confirms
  only approved sender, hosts, paths, method GET, bounded chunking,
  no server-rejection body.
- **Real Chromium with a loaded MV3 extension**,
  \`tests/printcheck-vision-lan-extension.browser.mjs\`, confirmed
  cross-origin order→AJAX popup→source SVG under two test hostnames
  without page CORS headers; no production URL, no automatic GET,
  anonymous report and research-only status.
- Previous 61-row and 4-row synthetic smoke, vector-first checks,
  ZIP integrity and local Windows lab tests remain green.
- Isolated code-only preview published under
  \`main/gifts-layout-workbench-vision/\` (main commit \`344e277\`),
  \`vision-local-lan-extension.zip\` **42,506 bytes**, verified via
  GitHub main repo contents. No real customer art in release.
- Production Maketnaya unchanged and PR #4 stays DRAFT.

**Next dependency:** User installs extension unpacked on LAN PC,
reloads the orders table (not simultaneously with old bookmarklet),
clicks \`Проверить строку\` once, then shares *anonymous*
\`Отчёт JSON\`. If the card and popup succeed, only original
test-source ZIP with expert-selected samples is imported locally into
\`D:\\VisionCheckLab\`; source-scale/spot/ROI and independent holdout
are required to decide whether examples are actually fit for training.
