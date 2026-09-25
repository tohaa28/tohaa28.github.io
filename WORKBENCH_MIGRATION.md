# Gifts Layout Workbench — GitHub migration

## Source of truth

Branch: `gifts-layout-workbench-source`

The branch contains an exact mirror of the current published Worx frontend plus a new readable backend implementation for gifts.ru.

The existing `main` branch and the current GitHub Pages homepage are intentionally left unchanged.

## Frontend

Mirrored from the last published Worx build:

- `index.html`
- `assets/index-BpU9kvz8.js`
- `assets/index-CdEUuUA7.css`
- `vendor/pdf-lib.min.js`
- `vendor/jszip.min.js`
- `vendor/jspdf.umd.min.js`
- `vendor/svg2pdf.umd.min.js`

The CSS in this branch also contains the elastic workspace fix: the template/editor area shrinks with the viewport instead of keeping the old large fixed minimum heights.

## Backend

Serverless endpoints:

- `POST /api/login` — authenticate to gifts.ru
- `DELETE /api/login` — clear local editor session
- `GET /api/session` — check the editor-side gifts.ru session
- `GET /api/basket` — read available orders
- `GET /api/orders/:order` — read order items and exact application/place labels
- `GET /api/orders/:order/items/:itemId.pdf` — download the selected template PDF
- `GET /api/orders/:order/items/:itemId/preview` — proxy the product preview

The order parser reads application/place labels from the order DOM. Template/PDF filenames are not used as the source of place names.

## Safety contract

After authentication, order access is read-only. The application does not open or modify "Согласования макетов", does not toggle order states and does not send production-order writes. The only POST to gifts.ru is the authentication request required to establish a session.

## Session handling

The user password is used only for the immediate gifts.ru authentication request and is not saved.

The resulting gifts.ru cookie jar is compressed and encrypted into an HttpOnly, Secure, SameSite=Lax cookie belonging to the editor domain.

Required environment variable:

`SESSION_SECRET`

Use a random value of at least 24 characters. Never commit the actual value.

## Deployment target

Recommended: Vercel, because the frontend and `/api/*` functions then share one origin and the editor session cookie is first-party.

The repository already includes `vercel.json` and `package.json`.

## Validation

GitHub Actions workflow: `.github/workflows/validate-workbench.yml`

It checks:

1. JavaScript syntax for `lib/*.js` and `api/*.js`
2. encryption/decryption session roundtrip
3. exact order-place parsing using a fixture where article 15637 must resolve to place `лицо`
