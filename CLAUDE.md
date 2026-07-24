@AGENTS.md

# Vatix Mobile — Claude Context

React Native app built with Expo SDK 56 targeting iOS and Android. Arabic-first, RTL layout.

## Stack

| Concern | Solution |
|---------|----------|
| Navigation | Expo Router v5 (file-based, `app/` directory) |
| Auth storage | `expo-secure-store` (not browser cookies) |
| Fonts | `@expo-google-fonts/cairo` + `@expo-google-fonts/tajawal` |
| Safe area | `react-native-safe-area-context` |
| Screens | `react-native-screens` |
| i18n | `lib/i18n.ts` — `ar` default, `en` supported |
| API | `lib/api.ts` — public fetchers; `lib/auth.ts` — authenticated fetchers |

## Key Environment Variables

```
EXPO_PUBLIC_API_URL=http://localhost:3005
EXPO_PUBLIC_MINIO_URL=http://localhost:9000
```

## App Structure

```
app/
  _layout.tsx           Root layout — loads fonts, providers (SafeArea, Locale, Auth)
  index.tsx             Redirects to (auth)/login or (tabs)/home based on auth state
  (auth)/               Unauthenticated screens (Stack navigator)
    login.tsx
    register.tsx        Choose client or store
    signup-client.tsx
    signup-store.tsx
    otp.tsx             Phone OTP verification
  (tabs)/               Authenticated screens (Tab navigator)
    home.tsx            Featured stores + latest products
    products.tsx        Full catalog with search + infinite scroll
    stores.tsx          Stores grid
    dashboard.tsx       User profile + menu tiles
  products/[id].tsx     Product detail
  stores/[id].tsx       Store profile + products

contexts/
  auth.tsx              AuthProvider + useAuth() — manages StoredUser from SecureStore
  locale.tsx            LocaleProvider + useLocale() — manages locale + RTL

components/
  ui/Button.tsx         primary / outline / ghost variants
  ui/Input.tsx          Labeled input with error + right icon
  ui/Logo.tsx           Vatix wordmark + yellow dot
  ProductCard.tsx       Card for product grid/lists
  StoreCard.tsx         Avatar card for store lists

constants/theme.ts      Colors, fonts, spacing, radius, shadow
lib/auth.ts             Token storage, silent refresh, authFetch/authPost/authPatch/authDelete
lib/api.ts              All types + public API calls (no auth header)
lib/i18n.ts             Full ar/en translation strings
```

## Routing Conventions

- Path alias `@/` maps to project root (tsconfig `paths`)
- Route params accessed via `useLocalSearchParams<{ id: string }>()`
- Navigate with `router.push('/path')` or `router.replace('/(auth)/login')`
- Deep link scheme: `vatix://`

## RTL / i18n

- `I18nManager.forceRTL(true)` applied at startup for Arabic
- Use `marginStart`/`marginEnd`/`paddingStart`/`paddingEnd` instead of Left/Right for RTL compat
- `useLocale()` returns `{ locale, t, setLocale }` — `t` is the full translations object

## Auth Flow

1. `app/_layout.tsx` → `AuthProvider` reads SecureStore on mount
2. `app/index.tsx` → redirects based on `isAuthenticated`
3. Login/register → call API → `login(response)` in `useAuth()` → saves to SecureStore → state updates → automatic redirect via index
4. Logout → `clearSession()` → `router.replace('/(auth)/login')`
5. Silent refresh → `startTokenRefresher()` (12-min interval) started after successful auth

## Dev

```bash
cd vatix_mobile
npx expo start
```

Requires backend running at port 3005. See root CLAUDE.md for backend setup.
