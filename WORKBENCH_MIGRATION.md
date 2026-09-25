# Gifts Layout Workbench / PrintCheck Web — canonical project state

## Source of truth

Repository: `tohaa28/tohaa28.github.io`

Development branch: `gifts-layout-workbench-source`

Published path: `https://tohaa28.github.io/gifts-layout-workbench/`

Floot is not used by this project. It is not a source repository, build environment, runtime dependency, deployment target, or required service. Future development must continue from the GitHub branch above and must not depend on Floot limits or Floot-hosted artifacts.

## Current architecture

The workbench runs in direct mode on `gifts.ru`.

- `tools/build-launcher.mjs` builds `launcher.js`.
- The launcher is loaded from GitHub Pages and opens the editor over the current `gifts.ru` page.
- `direct-mode.js` provides the adapter used by the editor for session, basket, order, template and preview requests.
- Order data is read from the real Gifts DOM/pages in the browser session.
- The application uses the existing authenticated `gifts.ru` browser session; there is no separate Floot authentication layer.
- The frontend and vendor libraries are static files published from GitHub.

## Safety contract

Order access after authentication is read-only.

The application must not:
- open or modify «Согласования макетов»;
- toggle order states;
- start production;
- send writes that modify live order data.

The application may read the order, basket, article pages, template data and product previews required for the editor.

## Article/place data

Application and place labels must come from the order DOM and must preserve the wording used in the order.

Do not infer place names from template/PDF filenames.

The article-to-template relation must follow the actual Gifts order/template structure.

## Publishing

Workflow: `.github/workflows/publish-direct-workbench.yml`

On changes in `gifts-layout-workbench-source`, GitHub Actions:
1. builds `launcher.js`;
2. validates JavaScript syntax;
3. replaces the published `main/gifts-layout-workbench/` directory;
4. commits the publication to `main`.

GitHub Pages serves the published directory.

## Validation

Workflow: `.github/workflows/test-direct-workbench.yml`

The browser test verifies, among other things:
- the editor launches on a `gifts.ru` page;
- direct-mode session detection works;
- the basket/order adapter works;
- exact order place labels are parsed;
- product preview fallback works;
- PDF processing initializes;
- guided simple-mode steps start in the correct state;
- article details and the product preview are grouped inside the selected article card.

## Continuity rule

Do not restart the project from a new scaffold and do not replace working functionality merely to change hosting.

All further UI and logic changes must be made on top of the current GitHub source branch while preserving already working order loading, template handling, article/place selection, editor tools, logo placement, export and Gifts read-only constraints.
