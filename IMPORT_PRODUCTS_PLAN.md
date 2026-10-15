# Mobile: "Where are your products?" chooser and product import

Port the website's add-product chooser and its three import flows to the app.

**Website reference:** `vatix_website/app/products/add/entry.tsx` and `vatix_website/app/dashboard/products/import/page.tsx`.

**Date:** 2026-10-15

---

## 1. Goal

When the user taps **Add product**, they see the same chooser as the website before the form:

| Option | Goes to |
|---|---|
| 📱 مش موجودة في أي حتة، هضيفها بنفسي (Manual) | The existing form `/products/add` |
| 🟢 عندي متجر على Shopify | `/products/import/shopify` |
| 🟠 عندي متجر على EasyOrders | `/products/import/easyorders` |
| 📊 عندي شيت Excel بالمنتجات | `/products/import/excel` |

- Each option opens **its own screen directly**, with no tabs, just like the website after the latest change.
- The chooser is shown to every user type on every visit, also like the website.
- A successful import goes to `/dashboard/my-ads`.

## 2. What already exists

**Backend:** no backend changes are needed, except optionally T3.5.
- All endpoints are under `store/products/import` and use the JWT guard.

| Flow | Endpoints | Notes |
|---|---|---|
| Excel/CSV | `POST /preview` (multipart `file`, CSV only), `POST /confirm` `{rows}` | The client converts xlsx to CSV and maps columns itself |
| EasyOrders | `GET /easy-orders/status`, `POST/DELETE /easy-orders/connection` `{apiKey}`, `GET /easy-orders/preview?limit=25&page=N`, `POST /easy-orders/confirm` | Paged by page number (`hasMore`) |
| Shopify | `GET /shopify/status`, `GET /shopify/install?shop=` → `{installUrl}`, `GET /shopify/preview?limit=50`, `POST /shopify/confirm`, `DELETE /shopify/connection` | The callback returns an HTML page that calls `window.opener.postMessage` and then closes itself. **There is no redirect.** |

- **Limits:** `CLIENT_PRODUCT_CAP_REACHED` (400) is returned on confirm. The app already sends this to `/dashboard/buy-slots`.
  - Shopify and EasyOrders rows allow at most 5 images.
  - Every row needs a `categoryId` and a `brandId`.

**Mobile:**
- `app/products/add.tsx` is the manual form, one long screen inside `DashboardLayout` + `BottomTabBar`.
- **Helpers to reuse:**
  - `lib/api.ts`: `getCategories()`, `getBrands()`, `localeName()`
  - `components/ui/SearchableSelect.tsx`, `Button`, `Input`, `Card`, `EmptyState`
- `lib/auth.ts`: `authFetch` / `authPost` / `authDelete`.
  - **Problem:** `_authFetchImpl` always sets `Content-Type: application/json`, so it can't send FormData. CSV upload needs a new helper (T0.3).
- **Chooser card UI to copy:** `app/(auth)/register.tsx`, lines 21–26, 96–114 and 194–232.
- **Packages:**
  - `expo-web-browser` and `expo-linking` are installed. The `vatix://` scheme is set in `app.json`.
  - `expo-document-picker`, `expo-file-system` (as a direct dependency) and an xlsx parser are **not** installed.
- The only check available is `npx tsc --noEmit`. The app has no lint or test scripts.

## 3. Key decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Chooser as a separate screen or a mode inside `add.tsx` | **A new route, `app/products/new.tsx`.** `buy-slots` and the cap-reached resume must keep going straight to the manual form at `/products/add`, so only the "start adding" entry points change. |
| D2 | Import screens | **One route per provider:** `app/products/import/{shopify,easyorders,excel}.tsx`. They are not tabs. |
| D3 | Preview layout on a phone | **A list of cards, one per product:** thumbnail, title, price, category and brand selects, and a remove ✕. Default category and brand selects sit at the top. The website's table doesn't fit a phone screen. |
| D4 | Shopify OAuth in the app | **`WebBrowser.openAuthSessionAsync(installUrl, 'vatix://import/shopify')`, then re-check `/shopify/status` when the browser closes.** This needs no backend change, but the user has to close the browser after the "You can close this window" page. T3.5 is an optional backend change that redirects back to `vatix://` so the browser closes by itself. |
| D5 | Reading Excel in React Native | **`expo-document-picker` + `expo-file-system` (read as base64) + SheetJS `xlsx` (`XLSX.read(b64,{type:'base64'})` → `sheet_to_csv`).** The parsed CSV then goes through the same header mapping and normalization as the website. `read-excel-file/browser` only runs in a browser, so it can't be used here. |
| D6 | Code shared between flows | **`lib/import.ts`** holds types, API calls and the pure CSV helpers copied from the website. **`components/import/*`** holds the shared preview UI. |

## 4. Tasks

Each task is small: about one file, roughly 50–150 lines, and can be reviewed on its own.

**Checks for every task:**
1. `npx tsc --noEmit` passes.
2. Arabic RTL and English both look right.
3. All new strings are in `lib/i18n.ts` (ar + en), under a new `importProducts` group.

### Phase 0: Foundations

- [x] **T0.1 i18n group.** Add `importProducts: {…}` to the `Translations` interface and to `ar` and `en` in `lib/i18n.ts`.
  - Include the chooser title and subtitle, the 4 option labels, and the common words: connect, disconnect, load, load more, confirm import, default category, default brand, remove, imported N, errors.
  - Copy the wording from `vatix_website/lib/i18n/translations.ts` (`import` block) and `entry.tsx`.
- [x] **T0.2 Types and API in `lib/import.ts`.** Add the row, preview and status types for all three flows (copy them from the website page, lines 14–44 and 746–804).
  - Add typed wrappers using `authFetch`/`authPost`/`authDelete`: `getShopifyStatus`, `getShopifyInstallUrl`, `getShopifyPreview`, `confirmShopify`, `disconnectShopify`, plus the same set for EasyOrders, and `confirmCsv`.
  - Add a small `importErrorCode(err)` that reads `code` from both `body.code` and `body.message.code`, because Shopify uses both shapes.
- [x] **T0.3 `authUploadForm` helper in `lib/auth.ts`.** It takes `(path, formData)`, gets the token with `getValidToken()`, and sets the Authorization and `X-Client-Platform` headers **without** a JSON Content-Type.
  - It retries once on 401 after a refresh, and throws the parsed error body. Model it on `authUploadFile` (line 583).
  - Add `previewCsv(uri, name)` to `lib/import.ts` that uses it, sending field `file` with type `text/csv`.
- [x] **T0.4 Shared preview components in `components/import/`.**
  - `ImportRowCard.tsx`: thumbnail with "+N", title, price, category and brand `SearchableSelect`, and remove ✕.
  - `DefaultCategoryBrand.tsx`: the two default selects. Changing one fills rows that don't have a value yet.
  - `ImportErrors.tsx`: a list of errors grouped by row number.
  - All three take `categories`/`brands` from `getCategories()`/`getBrands()`, using the `localeName` option mapping as in `add.tsx:179`.
- [x] **T0.5 `useImportConfirm` hook.** It wraps a confirm call and covers four cases:
  - **Busy state:** a flag while the request is running.
  - **Cap reached:** `CLIENT_PRODUCT_CAP_REACHED` goes to `router.push('/dashboard/buy-slots')`.
  - **Missing category or brand:** `CATEGORY_NOT_FOUND`/`BRAND_NOT_FOUND` show the row number.
  - **Success:** show "Imported N" and then `router.replace('/dashboard/my-ads')`.

### Phase 1: The chooser

- [x] **T1.1 Chooser screen `app/products/new.tsx`.** It shows the 4 option cards (styled like `register.tsx`) inside `DashboardLayout` + `BottomTabBar`.
  - Manual goes to `router.push('/products/add')`.
  - The other options go to `/products/import/<provider>`.
- [x] **T1.2 Point "start adding" entry points at `/products/new`.**
  - **Change:**
    - `(tabs)/_layout.tsx:77,96` (camera button)
    - `(tabs)/add.tsx:6` (Redirect)
    - `components/BottomTabBar.tsx:64`, and update its "already there" check to cover `/products/new`
    - `(tabs)/dashboard.tsx:158`
    - `(tabs)/home.tsx:102`
    - `(tabs)/products.tsx:308`
    - `dashboard/my-ads.tsx:311,388`
  - **Leave as is:** `buy-slots.tsx:202–204` and `add.tsx:286` keep pointing at `/products/add`.
- [x] **T1.3 Back link on the manual form.** Add a small "→ رجوع لاختيار طريقة الإضافة" link at the top of `add.tsx` that goes to `/products/new`, matching the website's `onBack`.
  - Don't touch the draft or submit logic.

### Phase 2: EasyOrders (do this one first: no files, no OAuth)

- [x] **T2.1 Screen shell and connection state.** In `app/products/import/easyorders.tsx`, load the status and show loading → disconnected or connected.
  - When connected, show "Connected since …" and Disconnect.
- [x] **T2.2 Connect form and guide.**
  - **Form:** an Api-Key `Input` (8–200 characters) and a Connect button. Errors: `EASYORDERS_INVALID_KEY` and `EASYORDERS_MISSING_PERMISSION`.
  - **Guide:** the 5-step guide.
    - Copy `vatix_website/public/import-guides/easyorders-public-api.png` to `assets/import-guides/`.
    - Add a link that opens `https://my.easy-orders.net` with `Linking.openURL`.
- [x] **T2.3 Preview with "Load more".** Call `GET preview?limit=25&page=N`.
  - Page 1 replaces the list and later pages are appended. Show "Load more" while `hasMore` is true.
  - Apply the default category and brand to rows as they come in.
  - **Errors:**
    - A 401 with `EASYORDERS_RECONNECT_REQUIRED` switches to disconnected and shows a banner.
    - A 429 shows a "try again in Xs" message.
  - Show the errors with `ImportErrors`. Note that EasyOrders errors are `{rowNumber, easyOrdersProductId, errors[]}`, so map them to the shared shape.
- [x] **T2.4 Confirm.** Enable it when there is at least one row and every row has a category and brand. Preview errors don't block confirm, same as the website.
  - Send `{rows}` with `imageUrls` capped at 5, using `useImportConfirm`.

### Phase 3: Shopify

- [x] **T3.1 Screen shell and connection state.** In `app/products/import/shopify.tsx`, show the status; when connected, show the shop name and Disconnect.
- [x] **T3.2 Connect with OAuth.**
  - **Input:** a shop name field with a fixed `.myshopify.com` suffix. Port `normalizeShopDomain` from the website (line 806) into `lib/import.ts`.
  - **Install URL:** get it from `GET install?shop=`.
  - **OAuth:** run `await WebBrowser.openAuthSessionAsync(installUrl, 'vatix://import/shopify')`. **Whatever the result** (dismiss or cancel), re-fetch status after it. Also re-fetch on `AppState` returning to `active` as a fallback.
- [x] **T3.3 Load preview.** Call `GET preview?limit=50`.
  - The website imports only the first batch and doesn't use `nextPageInfo`. Do the same for now.
  - Rows start with no category or brand. Handle `SHOPIFY_RECONNECT_REQUIRED` and 429 using `importErrorCode`.
- [x] **T3.4 Confirm.** Block it on preview errors, no rows, or any row missing a category or brand, same as the website.
  - Send `{rows}` with `imageUrls` capped at 5, using `useImportConfirm`.
- [ ] **T3.5 (Optional, backend) Return to the app by itself.**
  - `GET install` takes an optional `returnTo`, allowed only if it starts with `vatix://`, and stores it in the Redis `StatePayload`.
  - The callback then redirects (302) to `returnTo?status=connected|error&message=…` instead of returning the postMessage HTML. The website flow stays as it is.
  - The app passes `returnTo` and reads the status from the `openAuthSessionAsync` result URL.
  - **Files:** `vatix_backend/src/shopify-import/shopify-import.{controller,service}.ts`.

### Phase 4: Excel

- [x] **T4.1 Packages.** Run `npx expo install expo-document-picker expo-file-system`, then add SheetJS from its CDN tarball (`npm i https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`; the npm registry copy is out of date). *Done: pinned to `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` instead of `xlsx-latest` so installs are reproducible.*
  - Check that a dev build still compiles. `expo-document-picker` is a native module, so it **needs a new native build**, not just an OTA update.
- [x] **T4.2 CSV helpers in `lib/import.ts`.** Port these pure functions from the website (page lines 46–209): `parseCsvHeaderLine`, `parseCsvRows`, `csvCellEscape`, `splitImageCell`, `buildNormalizedCsvFile` (which returns a string instead of a `File`), and `autoMapHeaders`.
- [x] **T4.3 Pick and read the file.** In `app/products/import/excel.tsx`:
  1. Run `DocumentPicker.getDocumentAsync({ type: [csv, xlsx MIME types] })`.
  2. For `.csv`, read it as UTF-8 text.
  3. For `.xlsx`, read it as base64, run `XLSX.read`, and use `sheet_to_csv` on the first sheet. Write dates as `YYYY-MM-DD`.
  4. Reject `.xls`.
  - *Done: uses `sheet_to_json({header: 1})` + `csvCellEscape` per cell instead of `sheet_to_csv`, mirroring the website's `readSheetAsCsvText`. The picker is lazy-required; builds without the native module show `excelNeedsUpdate`.*
  - Add a "Download template" link that opens `https://vatix.store/csv-templates/products-import-template.csv`.
- [x] **T4.4 Column mapping.** Add one `SearchableSelect` each for title, description, price and images, filled by `autoMapHeaders`.
  - Preview is enabled once title and price are mapped.
- [x] **T4.5 Preview upload.**
  1. Build the normalized CSV.
  2. Write it to `FileSystem.cacheDirectory + 'import.csv'`.
  3. Send it with `previewCsv(uri)` (T0.3).
  4. Show the rows with `ImportRowCard` and the errors with `ImportErrors`.
- [x] **T4.6 Confirm.** Block it on preview errors, no valid rows, or any row missing a category or brand.
  - Send `{rows:[{title, description, price, categoryId, brandId, images, rowNumber}]}` to `confirmCsv`, using `useImportConfirm`.

### Phase 5: QA and docs

- [ ] **T5.1 Device QA checklist.** Test on both iOS and Android:
  1. The chooser opens from every entry point changed in T1.2.
  2. Buy-slots still resumes straight into the manual form.
  3. A client account at the cap gets sent to buy-slots on confirm.
  4. Arabic RTL looks right.
  5. Shopify OAuth works both when the user closes the browser and when they cancel.
  6. Uploading a large xlsx (about 500 rows) doesn't freeze the UI.
- [x] **T5.2 Docs.** Update the App Structure section of `CLAUDE.md` with `products/new.tsx`, `products/import/*`, `lib/import.ts` and `components/import/`.

## 5. Suggested order and milestones

1. **M1, the chooser:** T0.1 → T1.1 → T1.2 → T1.3. This can ship alone, with the 3 import options showing a "coming soon" screen or hidden behind a flag until their flow is ready.
2. **M2, EasyOrders:** T0.2 → T0.4 → T0.5 → T2.1–T2.4
3. **M3, Shopify:** T3.1–T3.4, then optionally T3.5
4. **M4, Excel:** T0.3 → T4.1–T4.6. This needs a native build because of the document picker.
5. **M5:** T5.1, T5.2

## 6. Risks and open questions

- **Shopify return to the app:** without T3.5 the user has to close the in-app browser by hand. It works, but it's clunky. T3.5 is a small, low-risk backend change.
- **SheetJS bundle size** is about 1 MB. Import it only in `excel.tsx` so it doesn't slow down the other screens.
- **Release:** M4 adds a native module, so it has to ship in a store release. M1–M3 only need JS and can go out over the air if EAS Update is used.
- **iOS client slot purchase:** the cap redirect to `/dashboard/buy-slots` already exists, so confirm that it also works when reached from an import screen.
