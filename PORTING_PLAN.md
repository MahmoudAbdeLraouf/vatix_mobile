# Vatix Mobile — Porting Plan

Goal: bring `vatix_mobile/` to full feature + design parity with `vatix_website/`.

Baseline audit (as of 2026-07-13):
- Website routes: 45
- Mobile routes present: 14 (~31%)
- Mobile partial: 1 (~2%)
- Mobile missing: 30 (~67%)

Reconciliation (2026-07-17):
- All 6 phases materially complete (files present, `tsc --noEmit` clean).
- Remaining ticks are external blockers: (a) backend `/user/delivery-areas` endpoint, (b) backend push-token endpoint, (c) backend `SITE_URL` override for mobile deep links; and internal scope decisions: `app/blog.tsx`, dark-mode audit.

Design tokens to mirror (from `vatix_website/app/globals.css`):
- `--dk: #062B5B` (navy)
- `--y: #F5B800` (yellow accent)
- `--g50` … `--g900` (grey scale)
- `--success: #1BC47D`, `--warning: #FFA92A`, `--error: #E83E3E`
- Fonts: Cairo (400/600/700/800/900) + Tajawal (400/700)

Rules of engagement:
- Work phase by phase. Do not start the next phase until the previous is signed off.
- Every phase must be tested in a running Expo simulator (iOS + Android where feasible) before ticking `Complete`.
- Match website markup semantics via RN equivalents. Preserve RTL by using `marginStart` / `marginEnd`.
- Reuse existing helpers in `lib/api.ts`, `lib/auth.ts`, `lib/i18n.ts`, `constants/theme.ts`. Extend rather than duplicate.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 1 — Foundation & Core UX  (est. 4–5 weeks)  [x]

Goal: reusable UI primitives + redesigned home / catalog / product-detail matching website look & feel.

### 1.0 Theme reconciliation
- [x] `constants/theme.ts` — align with website `globals.css` tokens (navy, greys, semantic colors, shadows, radius)

### 1.1 UI component library expansion
- [x] `components/ui/Button.tsx` — add variants: `y`, `dk`, `outline`, `ghost`, `red`, `cta` + sizes `sm`/`md`/`lg` + `fullWidth`
- [x] `components/ui/Card.tsx` — mirror `.card / .card-hd / .card-bd`
- [x] `components/ui/FileUpload.tsx` — single-file upload with preview
- [x] `components/ui/SearchableSelect.tsx` — searchable dropdown (category/brand/location)
- [x] `components/StarRating.tsx` — 5-star display + input variant
- [x] `components/CategoryBar.tsx` — horizontal scrollable category chips (`.catbar`)
- [x] `components/FilterCombobox.tsx` — filter chip + popover

### 1.2 Home redesign (`app/(tabs)/home.tsx`)
- [x] Hero + search block (`.hero`, `.hero-in`, `.hsearch`)
- [x] Featured stores grid (`.fsg`, `.fsc`)
- [x] Ad grid (`.ag`, `.ac`)
- [x] Latest products section using `ProductCard`
- [x] Category bar under hero

### 1.3 Product catalog (`app/(tabs)/products.tsx`)
- [x] Sticky `CategoryBar`
- [x] `FilterCombobox` row (category, brand, location, price)
- [x] Sort dropdown (newest / oldest / price asc / price desc) — "popular" dropped; backend `SortValue` union does not include it
- [x] Keep infinite scroll, mirror website spacing

### 1.4 Product detail (`app/products/[id].tsx`)
- [x] Image gallery (swipeable)
- [x] `StarRating` block
- [x] `FavoriteButton`
- [x] `RevealPhone` (respect `showPhone`)
- [x] `StartChatButton`
- [x] Store link card (nav to `/store/[id]`)
- [x] Description + specs sections

### 1.5 Store detail enhancement (`app/store/[id].tsx`)
- [x] `FollowButton`
- [x] Store profile card matching website layout
- [x] Products grid inside store view

**Deliverable:** end-to-end browse flow (home → catalog → product → store) with website-matching visuals.

---

## Phase 2 — Dashboard Foundation & User Profile  (est. 3–4 weeks)  [x]

Goal: authenticated dashboard shell + all "self-service" screens.

### 2.1 Dashboard shell
- [x] `components/DashboardLayout.tsx` — sidebar + topbar analog for RN (drawer on mobile)
- [x] `app/(tabs)/dashboard.tsx` — replace current profile with new shell home

### 2.2 Screens
- [x] `app/dashboard/profile.tsx` — edit profile (name, phone, whatsapp, avatar)
- [x] `app/dashboard/my-ads.tsx` — list + edit + delete user's products
- [x] `app/dashboard/favorites.tsx` — grid of `FavoriteProduct`
- [x] `app/dashboard/following.tsx` — grid of followed stores
- [x] `app/dashboard/settings.tsx` — locale toggle, notifications toggle, logout
- [x] `app/dashboard/messages.tsx` — conversation list
- [x] `app/dashboard/messages/[id].tsx` — chat thread (uses `/chat/messages`)

### 2.3 Supporting
- [x] `components/NotificationBell.tsx`
- [x] Add `authPatch`/`authDelete` usage for profile + product edits

**Deliverable:** logged-in user can fully manage their account without the web app.

---

## Phase 3 — Product Creation & Store Management  (est. 2–3 weeks)  [~]

Goal: content creation parity (product add/edit + store profile edit).

### 3.1 Product add/edit (`app/products/add.tsx`, `app/products/edit/[id].tsx`)
- [x] `components/MultiImageUpload.tsx` — reorderable images
- [x] Category/brand/location `SearchableSelect`
- [x] Price + condition + description form
- [x] Enforce `MAX_PRODUCTS_PER_CLIENT` / `MAX_ACTIVE_PRODUCTS_PER_STORE`
- [x] Draft persistence in `SecureStore`

### 3.2 Store profile management
- [x] `app/dashboard/store.tsx` — edit store name, description, logo, cover, location (see gap notes)
- [~] Delivery-area picker using locations tree — **BLOCKED (backend gap)**
- [x] `app/dashboard/branches.tsx` — CRUD store branches (STORE_PLUS only)
- [x] `app/dashboard/social.tsx` — social links

**Backend gaps discovered (2026-07-15):**
- `PATCH /stores/me` (`stores/dto/update-store-profile.dto.ts`) accepts only `{ name, description, locationId, cover, logo, websiteUrl }`. **No `whatsapp` field on `StoreProfile`** — whatsapp is only on `User`, and neither `UpdateStoreProfileDto` variant (stores/dto or users/dto) exposes it for store users. `UpdateClientProfileDto` is the only DTO with whatsapp today. → dropped whatsapp editing from `store.tsx`.
- Delivery areas are admin-only: `POST/GET/DELETE /admin/locations/stores/:storeId/delivery-areas`. No store-facing CRUD endpoint. → picker deferred, needs backend to expose a `/user/delivery-areas` (or `/stores/me/delivery-areas`) surface before mobile can ship this.

**Deliverable:** clients + stores can list, edit, and manage catalog + storefront from mobile.

---

## Phase 4 — Monetization Tier  (est. 3–4 weeks)

Goal: subscriptions, wallet, promotions, analytics.

### 4.1 Promotions
- [x] `app/dashboard/promotions.tsx` — active + purchased bundles
- [x] `app/dashboard/promote.tsx` — promote a product (bundle selection)
- [x] `components/UpgradeModal.tsx`

### 4.2 Subscription
- [x] `app/dashboard/subscription.tsx` — current plan, trial state, plan tiers
- [x] Subscribe CTA → hand off to Phase 5 checkout

### 4.3 Wallet
- [x] `app/dashboard/wallet.tsx` — balance, transactions, top-up CTA
- [x] `components/WalletTopupModal.tsx`
- [x] `app/dashboard/invoices.tsx` — payment history

### 4.4 Analytics
- [x] `app/dashboard/analytics.tsx` — views / clicks / favorites charts
- [ ] Reuse `TrackView` events from Phase 6

**Deliverable:** users can subscribe, top up wallet, buy promotions, see their stats.

---

## Phase 5 — Payments & Checkout  (est. 2 weeks)

Goal: complete InstaPay (manual screenshot → admin review) + Wallet (internal balance debit) flow inside the app.

### 5.1 Checkout
- [x] `lib/payment.ts` — helpers: `initiateInstapaySubscription`, `initiateInstapayPromotion`, `initiateInstapayWalletTopup`, `payWithWalletForSubscription`, `payWithWalletForPromotion`, `finalizePaymentSuccess`
- [x] In-modal flows: `components/UpgradeModal.tsx` (subscription), `components/WalletTopupModal.tsx` (wallet top-up), `app/dashboard/promote.tsx` (promotion)

### 5.2 Payment callbacks
- [x] `app/payment/success.tsx`
- [x] `app/payment/failed.tsx`

**Deliverable:** any paid action (subscription, promotion, wallet top-up) is handled in-app via InstaPay screenshot submission or wallet debit — no external gateway round-trip needed.

---

## Phase 6 — Analytics, Static Pages & Polish  (est. 2–3 weeks)

Goal: parity for tracking, informational pages, and RTL polish.

### 6.1 Analytics event tracking
- [x] `lib/analytics.ts` — event bus + queue
- [x] `TrackView` on product detail
- [x] `StoreViewTracker` on store detail
- [x] `SearchTracker` on catalog
- [x] `VisitTracker` on app open

### 6.2 Static pages
- [x] `app/about.tsx`
- [x] `app/faq.tsx`
- [x] `app/terms.tsx`
- [x] `app/privacy.tsx`
- [x] `app/contact.tsx`
- [x] `app/pricing.tsx` (may reuse Phase 4 subscription view)
- [ ] `app/blog.tsx` (list) — decide if in scope

### 6.3 Notifications & push
- [x] `app/dashboard/notifications.tsx`
- [x] `lib/notifications.ts` — Expo push registration + handlers (wired into `contexts/auth.tsx` + tap handler in `app/_layout.tsx`)

**Backend gap:** no `POST /notifications/push-token` endpoint yet — mobile client posts best-effort and swallows failure. Backend needs to add `pushToken` field on `User` + persist token before push send can work.

### 6.4 UI polish
- [x] Loading skeletons across all list screens — `components/ui/Skeleton.tsx` (SkeletonRow / SkeletonCard / SkeletonGrid) wired into products catalog, stores grid, favorites, following, my-ads, invoices, notifications, messages
- [x] Error states (network, empty, forbidden) — `components/ui/EmptyState.tsx` + `components/ui/ErrorState.tsx` primitives, 3-branch (skeleton → error → empty → data) pattern applied across all list screens above
- [x] RTL edge cases: icons, arrows, swipe direction — 21 chevron/arrow sites audited; 19 already locale-aware, fixed 2 hard-coded chevrons in `components/WalletTopupModal.tsx` (MethodCard) and `components/UpgradeModal.tsx` (MethodCard) to use `ar ? 'chevron-back' : 'chevron-forward'`
- [ ] Dark-mode audit (defer if not on website)

**Deliverable:** app is production-ready, tracking parity with web, informational pages in place.

---

## Rollup

| Phase | Weeks | State |
|-------|-------|-------|
| 1 — Foundation & Core UX | 4–5 | [x] |
| 2 — Dashboard Foundation | 3–4 | [x] |
| 3 — Product & Store Mgmt | 2–3 | [~] delivery-area picker blocked on backend |
| 4 — Monetization | 3–4 | [~] `TrackView` reuse in analytics pending Phase 6 event bus |
| 5 — Payments & Checkout | 2 | [x] InstaPay + Wallet only (PayMob/Kashier removed) |
| 6 — Analytics & Polish | 2–3 | [~] `app/blog.tsx` scope decision + dark-mode audit deferred; push-token endpoint pending backend |
| **Total** | **16–21 weeks** | |

## Working notes
- Website source of truth: `/Users/ekraouf/Projects/vatix/vatix_website/`
- Design tokens: `vatix_website/app/globals.css` (mirror into `vatix_mobile/constants/theme.ts`)
- Backend contracts already exist — no API work should be required; if a gap is found, log it here and confirm with backend before extending.
- Expo SDK 56 versioned docs: https://docs.expo.dev/versions/v54.0.0/ (per `AGENTS.md`)
