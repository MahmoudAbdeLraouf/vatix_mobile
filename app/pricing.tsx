import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { router } from 'expo-router'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import {
  Bundle,
  ClientOfferPack,
  ClientSlotBundle,
  getClientOfferPacks,
  getClientSlotBundles,
  getPromotionBundles,
  getSiteSettings,
  getSubscriptionPlans,
  PlanData,
  SiteSettings,
} from '@/lib/api'
import { darkColors, fonts, lightColors, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { PAID_UI_ENABLED } from '@/lib/platform'
import { useBroEnabled } from '@/components/bro/BroEntryCard'
import { Ionicons } from '@expo/vector-icons'
import { TRIAL_DAYS } from '@/lib/trial'
import {
  GIFT_VALUE,
  LIST_PRICE,
  storeValueParamsFrom,
  svText,
  toArDigits,
  visibleStoreValueItems,
} from '@/lib/storeValue'

const WEB_SHOT = require('@/assets/pricing/pc-live-web.jpg')
const APP_SHOT = require('@/assets/pricing/pc-live-app.jpg')
const WEB_ASPECT = 1600 / 1458
const APP_ASPECT = 720 / 1564

type CellValue = boolean | string

interface TopUpTile {
  id: number
  count: number
  price: number
  best: boolean
}

/** Normalises slot bundles / offer packs into sorted tiles, flagging the cheapest per unit. */
function toTiles<T extends { id: number; price: number | string }>(
  items: T[],
  count: (t: T) => number,
): TopUpTile[] {
  const tiles = items
    .map((t) => ({ id: t.id, count: count(t), price: Number(t.price), best: false }))
    .filter((t) => t.count > 0 && Number.isFinite(t.price))
    .sort((a, b) => a.count - b.count)
  if (tiles.length > 1) {
    const bestRatio = Math.min(...tiles.map((t) => t.price / t.count))
    for (const t of tiles) t.best = Math.abs(t.price / t.count - bestRatio) < 0.001
  }
  return tiles
}

export default function PricingScreen() {
  const { locale, t } = useLocale()
  const { colors, isDark } = useTheme()
  const { user } = useAuth()
  const broEnabled = useBroEnabled()
  const s = useStyles()
  const ar = locale === 'ar'
  const { width: winW } = useWindowDimensions()
  // Both screenshots share one height and fill the row (section padding, gap, card borders).
  const shotH = (winW - spacing.md * 2 - spacing.sm - 4) / (WEB_ASPECT + APP_ASPECT)
  const tx = (a: string, e: string) => (ar ? a : e)

  const [plans, setPlans] = useState<PlanData[]>([])
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [slotBundles, setSlotBundles] = useState<ClientSlotBundle[]>([])
  const [offerPacks, setOfferPacks] = useState<ClientOfferPack[]>([])
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [p, st, sb, op, b] = await Promise.all([
        getSubscriptionPlans().catch(() => [] as PlanData[]),
        getSiteSettings().catch(() => null),
        getClientSlotBundles().catch(() => [] as ClientSlotBundle[]),
        getClientOfferPacks().catch(() => [] as ClientOfferPack[]),
        getPromotionBundles().catch(() => [] as Bundle[]),
      ])
      if (!alive) return
      setPlans(p)
      setSettings(st)
      setSlotBundles(sb)
      setOfferPacks(op)
      setBundles(b)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  const fmt = (n: number) => (ar ? toArDigits(n.toLocaleString('ar-EG')) : n.toLocaleString('en-EG'))
  const currency = ar ? 'ج.م' : 'EGP'

  const price = Number(
    plans.find((p) => p.storeType === 'store' && (p.billingCycle ?? 'monthly') === 'monthly')?.price ?? 450,
  )
  const showWas = price < LIST_PRICE
  const offPct = Math.round((1 - price / LIST_PRICE) * 100)
  const perDay = Math.round(price / 30)
  const giftDays = settings?.subscriptionGiftDays ?? 7
  const clientMax = settings?.maxProductsPerClient ?? 10
  const clientOffers = settings?.broClientOffersPerMonth ?? 10

  const slotTiles = useMemo(
    () => toTiles(slotBundles.filter((b) => b.isActive), (b) => b.slotCount),
    [slotBundles],
  )
  const offerTiles = useMemo(() => toTiles(offerPacks, (p) => p.offerCount), [offerPacks])
  const offersOn = broEnabled && offerTiles.length > 0
  const packsLine = offerTiles
    .map((t) => (ar ? `${fmt(t.count)} عرض بـ${fmt(t.price)} ج.م` : `${t.count} offers for ${t.price} EGP`))
    .join(ar ? '، ' : ', ')

  const isStore = !!user?.isStore
  const trial = fmt(TRIAL_DAYS)

  const goConvert = () => {
    if (!user) router.push('/(auth)/signup-store')
    else router.push({ pathname: '/dashboard/subscription', params: { upgrade: 'store' } } as never)
  }
  const ctaLabel = tx(`حوّل لمتجر — ${trial} يوم مجاناً`, `Switch to a store — ${TRIAL_DAYS} days free`)

  const bestRatio = bundles.length
    ? Math.min(...bundles.map((b) => Number(b.price) / Math.max(b.productCount, 1)))
    : Infinity

  // ── Why-store rows ──────────────────────────────────────────────────────────
  // The shared store-value items (lib/storeValue) + the pricing-only bulk-import row.
  const svParams = storeValueParamsFrom(settings, plans, offersOn, loading)
  const whyRows: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; was?: string }[] = [
    ...visibleStoreValueItems(svParams).map((item) => ({
      icon: item.icon,
      title: svText(t.storeValue, item.title, svParams, locale),
      body:
        item.key === 'page'
          ? tx('vatix.store/yourstore — شاركه مع زباينك على واتساب وفيسبوك.', 'vatix.store/yourstore — share it with customers on WhatsApp and Facebook.')
          : svText(t.storeValue, item.sub, svParams, locale),
      was: item.key === 'products' ? tx(`العميل: ${fmt(clientMax)} مدى الحياة`, `Client: ${clientMax} for life`) : undefined,
    })),
    {
      icon: 'flash-outline',
      title: tx('استيراد بالجملة', 'Bulk import'),
      body: tx('انقل منتجاتك من Excel أو Shopify أو EasyOrders في دقايق.', 'Bring your products from Excel, Shopify or EasyOrders in minutes.'),
    },
  ]

  // ── Compare rows ────────────────────────────────────────────────────────────
  const compareRows: { label: string; client: CellValue; store: CellValue }[] = [
    { label: tx('المنتجات', 'Products'), client: tx(`${fmt(clientMax)} مدى الحياة`, `${clientMax} for life`), store: '∞' },
    ...(offersOn
      ? [
          {
            label: tx('العروض على الطلبات', 'Offers on requests'),
            client: tx(`${fmt(clientOffers)} / شهر`, `${clientOffers} / month`),
            store: '∞',
          },
        ]
      : []),
    { label: tx('صفحة متجر', 'Store page'), client: false, store: 'vatix.store/yourstore' },
    { label: tx('علامة موثّق', 'Verified badge'), client: false, store: true },
    { label: tx('إحصائيات المتجر', 'Store analytics'), client: false, store: true },
    ...(giftDays > 0 ? [{ label: tx('ترويج منتج هدية', 'Free product promotion'), client: false, store: true }] : []),
    { label: tx('استيراد بالجملة', 'Bulk import'), client: false, store: true },
  ]

  const renderCell = (v: CellValue, store: boolean) => {
    if (v === true) return <Text style={s.cellYes}>✓</Text>
    if (v === false) return <Text style={s.cellNo}>—</Text>
    return (
      <Text style={[s.cellString, store && s.cellStringStore]} numberOfLines={2}>
        {v}
      </Text>
    )
  }

  // ── FAQ ─────────────────────────────────────────────────────────────────────
  const faqs: { q: string; a: string }[] = [
    {
      q: tx('إيه اللي بيحصل لمنتجاتي لما أحوّل لمتجر؟', 'What happens to my products when I switch to a store?'),
      a: tx(
        'ولا حاجة — بتفضل زي ما هي، بنفس المشاهدات والمفضلة، وبتظهر على صفحة متجرك على طول.',
        'Nothing — they stay exactly as they are, with the same views and favorites, and show up on your store page right away.',
      ),
    },
    {
      q: tx(`إيه اللي بيحصل بعد الـ${trial} يوم؟`, `What happens after the ${TRIAL_DAYS} days?`),
      a: tx(
        `هنفكّرك قبلها بأسبوع، وبـ٣ أيام، وبيوم. مفيش أي خصم تلقائي — لو عايز تكمّل بتدفع ${fmt(price)} ج.م${showWas ? ` بدل ${fmt(LIST_PRICE)} (سعر لفترة محدودة)` : ''} بإنستاباي أو المحفظة أو محافظ الموبايل.`,
        `We remind you a week, 3 days and a day before. Nothing is charged automatically — to continue you pay ${price} EGP${showWas ? ` instead of ${LIST_PRICE} (limited-time price)` : ''} via InstaPay, your wallet, or mobile wallets.`,
      ),
    },
    ...(giftDays > 0
      ? [
          {
            q: tx('هدية الترويج بتشتغل إزاي؟', 'How does the promotion gift work?'),
            a: tx(
              `مع كل دفعة اشتراك بنضيفلك ترويج منتج واحد هدية (قيمته ${fmt(GIFT_VALUE)} ج.م) لمدة ${fmt(giftDays)} أيام: تختار أي منتج من منتجاتك، ويطلع في الأول في المنتجات المميزة. الهدية مع الدفع — مش مع التجربة المجانية.`,
              `Every subscription payment adds one free product promotion (worth ${GIFT_VALUE} EGP) for ${giftDays} days: pick any of your products and it shows first in featured products. The gift comes with payments — not with the free trial.`,
            ),
          },
        ]
      : []),
    ...(offersOn
      ? [
          {
            q: tx('يعني إيه “عروض بلا حدود”؟', 'What does “unlimited offers” mean?'),
            a: tx(
              `لما مشتري ينزّل طلب بالجهاز اللي بيدوّر عليه، تقدر تبعتله عرض بسعرك. العميل ليه ${fmt(clientOffers)} عروض مجانية في الشهر، وبعدها يشتري باقة: ${packsLine}. المتجر يبعت على كل الطلبات من غير حد ومن غير باقات.`,
              `When a buyer posts a request for a device, you can send them an offer with your price. Clients get ${clientOffers} free offers a month, then buy a pack: ${packsLine}. Stores reply to every request with no limit and no packs.`,
            ),
          },
        ]
      : []),
    {
      q: tx('هل أقدر أرجع لحساب عميل؟', 'Can I go back to a client account?'),
      a: tx(
        `أيوه في أي وقت. لو عندك أكتر من ${fmt(clientMax)} منتجات نشطة، الأقدم بيتوقف تلقائياً لحد ما توصل للحد.`,
        `Yes, anytime. If you have more than ${clientMax} active products, the oldest are paused automatically until you're within the limit.`,
      ),
    },
    {
      q: tx('هل الحد بيرجع لو مسحت منتج أو بعته؟', 'Does the limit reset if I delete or sell a product?'),
      a: tx(
        `لأ — حد العميل ${fmt(clientMax)} منتجات مدى الحياة وبيحسب كل المنتجات اللي اتعملت. المتجر مالوش حد.`,
        `No — the client limit is ${clientMax} products for life and counts every product ever created. Stores have no limit.`,
      ),
    },
    {
      q: tx('إزاي أدفع؟', 'How do I pay?'),
      a: tx('إنستاباي، أو رصيد محفظتك على Vatix، أو محافظ الموبايل.', 'InstaPay, your Vatix wallet balance, or mobile wallets.'),
    },
    ...(broEnabled
      ? [
          {
            q: tx('مين هو جيكو؟ وهل الطلب بفلوس؟', 'Who is Geeko? Do requests cost money?'),
            a: tx(
              'جيكو هو مساعد Vatix. اكتب الجهاز اللي بتدور عليه، وجيكو يسأل البائعين ويرجعلك بالعروض المتاحة فعلاً. الطلب مجاني تماماً.',
              "Geeko is Vatix's assistant. Write the device you're looking for, and Geeko asks sellers and comes back with offers that are actually available. Requests are completely free.",
            ),
          },
        ]
      : []),
  ]

  // ── Top-up tiles ────────────────────────────────────────────────────────────
  const renderTopUp = (title: string, unit: string, tiles: TopUpTile[], onPick: (id: number) => void) => (
    <View style={s.topUpGroup}>
      <Text style={s.topUpGroupTitle}>{title}</Text>
      <View style={s.topUpGrid}>
        {tiles.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => (user ? onPick(t.id) : router.push('/(auth)/login'))}
            style={({ pressed }) => [s.topUpTile, t.best && s.topUpTileBest, pressed && { opacity: 0.8 }]}
          >
            {t.best && (
              <View style={s.topUpBadge}>
                <Text style={s.topUpBadgeText}>{tx('الأوفر', 'Best value')}</Text>
              </View>
            )}
            <Text style={s.topUpCount}>+{fmt(t.count)}</Text>
            <Text style={s.topUpUnit}>{unit}</Text>
            {PAID_UI_ENABLED && (
              <>
                <Text style={s.topUpPrice}>
                  {fmt(t.price)} <Text style={s.topUpCurrency}>{currency}</Text>
                </Text>
                <Text style={s.topUpPer}>
                  {tx(`${fmt(Math.round(t.price / t.count))} ج.م / ${unit}`, `${Math.round(t.price / t.count)} EGP each`)}
                </Text>
              </>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  )

  return (
    <DashboardLayout title={ar ? 'الأسعار' : 'Pricing'} contentPadding={false}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.pill}>
            <Text style={s.pillText}>
              {tx('🏪 للتجار والمحلات وأي حد بيبيع بانتظام', '🏪 For merchants, shops and anyone who sells regularly')}
            </Text>
          </View>
          <Text style={s.heroTitle}>
            {tx('بطّل تعدّ منتجاتك.\nافتح متجرك على Vatix.', 'Stop counting your products.\nOpen your store on Vatix.')}
          </Text>
        </View>

        {/* Plan card */}
        <View style={s.plansWrap}>
          <View style={s.planCard}>
            <View style={s.trialPill}>
              <Text style={s.trialPillText}>{tx(`${trial} يوم مجاناً`, `${TRIAL_DAYS} days free`)}</Text>
            </View>
            <View style={s.planHead}>
              <Text style={s.planName}>{tx('🏪 متجر', '🏪 Store')}</Text>
              {showWas && offPct > 0 && (
                <View style={s.offPill}>
                  <Text style={s.offPillText}>-{fmt(offPct)}%</Text>
                </View>
              )}
            </View>

            {PAID_UI_ENABLED && (
              <View style={s.priceBlock}>
                {showWas && (
                  <Text style={s.priceWas}>
                    {fmt(LIST_PRICE)} {currency}
                  </Text>
                )}
                <View style={s.priceRow}>
                  <Text style={s.priceBig}>{fmt(price)}</Text>
                  <Text style={s.priceUnit}>{tx('ج.م / شهر', 'EGP / month')}</Text>
                </View>
                <Text style={s.perDay}>{tx(`≈ ${fmt(perDay)} ج.م في اليوم`, `≈ ${perDay} EGP a day`)}</Text>
              </View>
            )}

            <View style={s.valueRow}>
              <View style={s.valueTile}>
                <Text style={s.valueBig}>∞</Text>
                <Text style={s.valueLabel}>{tx('منتجات', 'Products')}</Text>
              </View>
              {offersOn && (
                <View style={s.valueTile}>
                  <Text style={s.valueBig}>∞</Text>
                  <Text style={s.valueLabel}>{tx('عروض', 'Offers')}</Text>
                </View>
              )}
              {giftDays > 0 && (
                <View style={[s.valueTile, s.valueTileGift]}>
                  <Text style={s.valueGift}>🎁 {fmt(GIFT_VALUE)}</Text>
                  <Text style={s.valueLabel}>{tx('ترويج هدية', 'Promo gift')}</Text>
                </View>
              )}
            </View>

            {giftDays > 0 && (
              <Text style={s.giftNote}>
                {tx(
                  `مع كل دفعة: ترويج منتج ${fmt(giftDays)} أيام هدية (قيمته ${fmt(GIFT_VALUE)} ج.م)`,
                  `With every payment: a ${giftDays}-day product promotion free (worth ${GIFT_VALUE} EGP)`,
                )}
              </Text>
            )}

            {isStore ? (
              <View style={s.storeStatus}>
                <Text style={s.storeStatusText}>{tx('✓ إنت متجر بالفعل', "✓ You're already a store")}</Text>
                {giftDays > 0 && (
                  <Pressable onPress={() => router.push('/dashboard/promote' as never)}>
                    <Text style={s.storeStatusLink}>{tx('استخدم هدية الترويج ←', 'Use your promotion gift →')}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => router.push('/dashboard/subscription' as never)} style={s.manageBtn}>
                  <Text style={s.manageBtnText}>{tx('إدارة الاشتراك', 'Manage subscription')}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Pressable onPress={goConvert} style={({ pressed }) => [s.ctaY, pressed && { opacity: 0.85 }]}>
                  <Text style={s.ctaYText}>{ctaLabel}</Text>
                </Pressable>
                <Text style={s.fine}>
                  {tx('بدون كارت • مفيش خصم تلقائي • نفس حسابك ومنتجاتك', 'No card • No auto-charge • Same account and products')}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Live store screenshots */}
        <View style={s.section}>
          <Text style={s.compareHeading}>{tx('متجر حقيقي — مش تصميم', 'A real store — not a mockup')}</Text>
          <View style={s.urlPill}>
            <Text style={s.urlPillText}>vatix.store/phone-corner</Text>
          </View>
          <View style={s.shotsRow}>
            <View style={[s.shotCard, { width: shotH * WEB_ASPECT }]}>
              <Image source={WEB_SHOT} style={{ width: shotH * WEB_ASPECT, height: shotH }} resizeMode="cover" />
              <Text style={s.shotCaption}>{tx('💻 الموقع', '💻 Website')}</Text>
            </View>
            <View style={[s.shotCard, { width: shotH * APP_ASPECT }]}>
              <Image source={APP_SHOT} style={{ width: shotH * APP_ASPECT, height: shotH }} resizeMode="cover" />
              <Text style={s.shotCaption}>{tx('📱 التطبيق', '📱 App')}</Text>
            </View>
          </View>
        </View>

        {/* Why store */}
        <View style={s.section}>
          <Text style={s.compareHeading}>{tx('ليه متجر؟', 'Why a store?')}</Text>
          <View style={s.whyCard}>
            {whyRows.map((r, i) => (
              <View key={i} style={[s.whyRow, i > 0 && s.whyRowBorder]}>
                <View style={s.whyIcon}>
                  <Ionicons name={r.icon} size={20} color={colors.yellowText} />
                </View>
                <View style={s.whyBody}>
                  <Text style={s.whyTitle}>{r.title}</Text>
                  <Text style={s.whyText}>{r.body}</Text>
                  {r.was && <Text style={s.whyWas}>{r.was}</Text>}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Compare */}
        <View style={s.section}>
          <Text style={s.compareHeading}>{tx('عميل ولا متجر؟', 'Client or store?')}</Text>
          <View style={s.compareCard}>
            <View style={s.compareHeader}>
              <View style={s.compareFeatureCol}>
                <Text style={s.compareHeadText}>{tx('الميزة', 'Feature')}</Text>
              </View>
              <View style={s.comparePlanCol}>
                <Text style={s.compareHeadText}>{tx('عميل', 'Client')}</Text>
              </View>
              <View style={s.comparePlanCol}>
                <Text style={[s.compareHeadText, { color: colors.y }]}>{tx('متجر', 'Store')}</Text>
              </View>
            </View>
            {compareRows.map((r, i) => (
              <View
                key={i}
                style={[s.compareRow, i % 2 === 1 && { backgroundColor: isDark ? colors.pressed : colors.g50 }]}
              >
                <View style={s.compareFeatureCol}>
                  <Text style={s.compareLabel}>{r.label}</Text>
                </View>
                <View style={s.comparePlanCol}>{renderCell(r.client, false)}</View>
                <View style={s.comparePlanCol}>{renderCell(r.store, true)}</View>
              </View>
            ))}
          </View>
        </View>

        {/* Top-up */}
        {!isStore && (slotTiles.length > 0 || offersOn) && (
          <View style={s.section}>
            <Text style={s.compareHeading}>{tx('زوّد حدّك', 'Raise your limit')}</Text>
            <Text style={s.bundlesSubtitle}>
              {tx('منتجات أو عروض إضافية بتتدفع مرة واحدة وبتفضل معاك.', 'Extra products or offers — pay once, keep them.')}
            </Text>
            {slotTiles.length > 0 &&
              renderTopUp(tx('📦 منتجات إضافية', '📦 Extra products'), tx('منتج', 'product'), slotTiles, (id) =>
                router.push({ pathname: '/dashboard/buy-slots', params: { bundleId: String(id) } } as never),
              )}
            {offersOn &&
              renderTopUp(tx('💬 عروض إضافية', '💬 Extra offers'), tx('عرض', 'offer'), offerTiles, (id) =>
                router.push(`/dashboard/buy-offers?pack=${id}` as never),
              )}
            <Pressable onPress={goConvert} style={s.nudge}>
              <Text style={s.nudgeText}>{tx('أو حوّل لمتجر وخلّيها ∞ ←', 'Or switch to a store and make it ∞ →')}</Text>
            </Pressable>
          </View>
        )}

        {/* Promotion bundles */}
        <View style={s.bundlesSection}>
          <Text style={s.compareHeading}>{tx('باقات ترويج الإعلانات', 'Ad Promotion Bundles')}</Text>
          <Text style={s.bundlesSubtitle}>
            {tx('ادفع مرة واحدة — ثبّت إعلاناتك في الأعلى', 'Pay once — pin your ads to the top')}
          </Text>
          {loading ? (
            <ActivityIndicator color={colors.y} style={{ marginVertical: spacing.lg }} />
          ) : bundles.length === 0 ? (
            <Text style={s.emptyText}>{tx('لا توجد باقات ترويج متاحة حالياً', 'No promotion bundles available right now')}</Text>
          ) : (
            bundles.map((b) => {
              const bPrice = Number(b.price)
              const perAd = bPrice / Math.max(b.productCount, 1)
              const isFeatured = Math.abs(perAd - bestRatio) < 0.001 && bundles.length > 1
              const tr =
                b.translations?.find((t) => t.locale === locale) ?? b.translations?.find((t) => t.locale === 'ar')
              const name = tr?.name || b.name
              const desc = tr?.description || b.description
              const shown = Math.min(b.productCount, 7)
              return (
                <View
                  key={b.id}
                  style={[s.bundleCard, isFeatured && { backgroundColor: colors.fab, borderColor: colors.y, borderWidth: 2 }]}
                >
                  {isFeatured && (
                    <View style={s.bundleBadge}>
                      <Text style={s.bundleBadgeText}>{tx('🔥 الأوفر', '🔥 Best value')}</Text>
                    </View>
                  )}
                  <Text style={[s.bundleName, isFeatured && { color: colors.white }]}>{name}</Text>
                  {!!desc && (
                    <Text style={[s.bundleDesc, isFeatured && { color: 'rgba(255,255,255,0.7)' }]}>{desc}</Text>
                  )}
                  <View style={s.slotRow}>
                    {Array.from({ length: shown }).map((_, i) => (
                      <View
                        key={i}
                        style={[s.slot, isFeatured && { backgroundColor: 'rgba(245,184,0,0.15)', borderColor: colors.y }]}
                      >
                        <Text style={s.slotIcon}>{isFeatured ? '⭐' : '📋'}</Text>
                      </View>
                    ))}
                    {b.productCount > 7 && (
                      <View style={s.slotOverflow}>
                        <Text style={s.slotOverflowText}>+{fmt(b.productCount - 7)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.bundlePriceRow}>
                    <View style={{ gap: 4 }}>
                      <Text style={[s.bundleCount, isFeatured && { color: 'rgba(255,255,255,0.7)' }]}>
                        {fmt(b.productCount)} {tx('إعلان', b.productCount === 1 ? 'ad' : 'ads')}
                      </Text>
                      {PAID_UI_ENABLED && (
                        <View style={s.perAdPill}>
                          <Text style={s.perAdText}>
                            {fmt(Math.round(perAd))} {currency} / {tx('إعلان', 'ad')}
                          </Text>
                        </View>
                      )}
                    </View>
                    {PAID_UI_ENABLED && (
                      <Text style={[s.bundlePrice, isFeatured && { color: colors.y }]}>
                        {fmt(bPrice)} <Text style={[s.bundleCurrency, isFeatured && { color: colors.white }]}>{currency}</Text>
                      </Text>
                    )}
                  </View>
                  {PAID_UI_ENABLED && (
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/dashboard/promotions', params: { bundleId: String(b.id) } } as never)
                      }
                      style={[
                        s.bundleCta,
                        isFeatured
                          ? { backgroundColor: colors.y }
                          : { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[s.bundleCtaText, { color: isFeatured ? colors.dk : colors.heading }]}>
                        {tx('اختر ←', 'Select →')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )
            })
          )}
        </View>

        {/* FAQ */}
        <View style={s.faqSection}>
          <Text style={s.compareHeading}>{tx('أسئلة شائعة', 'FAQs')}</Text>
          {faqs.map((f, i) => (
            <View key={i} style={s.faqCard}>
              <Text style={s.faqQ}>{f.q}</Text>
              <Text style={s.faqA}>{f.a}</Text>
            </View>
          ))}
        </View>

        {/* Final CTA */}
        {!isStore && (
          <View style={s.finalCta}>
            <Text style={s.finalEmoji}>🏪</Text>
            <Text style={s.finalTitle}>{tx('جاهز تفتح متجرك؟', 'Ready to open your store?')}</Text>
            <Text style={s.finalSub}>
              {PAID_UI_ENABLED
                ? tx(
                    `${trial} يوم مجاناً، وبعدها ${fmt(price)} ج.م في الشهر — من غير خصم تلقائي.`,
                    `${TRIAL_DAYS} days free, then ${price} EGP a month — no auto-charge.`,
                  )
                : tx(`${trial} يوم مجاناً — من غير خصم تلقائي.`, `${TRIAL_DAYS} days free — no auto-charge.`)}
            </Text>
            <Pressable onPress={goConvert} style={s.finalBtnY}>
              <Text style={s.finalBtnYText}>{ctaLabel}</Text>
            </Pressable>
          </View>
        )}
    </DashboardLayout>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors, dark = false) =>
  StyleSheet.create({

    // Hero
    hero: {
      backgroundColor: colors.hero,
      paddingTop: 40,
      paddingBottom: 76,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    pill: {
      backgroundColor: 'rgba(245,184,0,0.15)',
      borderWidth: 1,
      borderColor: colors.y,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      marginBottom: spacing.md,
    },
    pillText: { fontFamily: fonts.bold, fontSize: 12, color: colors.y, textAlign: 'center' },
    heroTitle: {
      fontFamily: fonts.black,
      fontSize: 26,
      lineHeight: 40,
      color: colors.white,
      textAlign: 'center',
    },

    // Plan card
    plansWrap: { marginTop: -36, paddingHorizontal: spacing.md },
    planCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 2,
      borderColor: colors.y,
      padding: spacing.lg,
      ...(dark ? {} : shadow.ss),
    },
    trialPill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.greenBg,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: spacing.sm,
    },
    trialPillText: { fontFamily: fonts.extraBold, fontSize: 12, color: colors.green },
    planHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    planName: { fontFamily: fonts.black, fontSize: 22, color: colors.heading },
    offPill: { backgroundColor: colors.red, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    offPillText: { fontFamily: fonts.extraBold, fontSize: 12, color: colors.white },
    priceBlock: { marginTop: spacing.sm },
    priceWas: {
      fontFamily: fonts.bold,
      fontSize: 15,
      color: colors.muted,
      textDecorationLine: 'line-through',
      textAlign: 'left',
    },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    priceBig: { fontFamily: fonts.black, fontSize: 44, color: colors.price },
    priceUnit: { fontFamily: fonts.bold, fontSize: 14, color: colors.muted },
    perDay: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.subtle, textAlign: 'left' },
    valueRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    valueTile: {
      flex: 1,
      backgroundColor: dark ? colors.pressed : colors.g50,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    valueTileGift: { backgroundColor: colors.yellowBg },
    valueBig: { fontFamily: fonts.black, fontSize: 24, color: colors.heading },
    valueGift: { fontFamily: fonts.black, fontSize: 18, lineHeight: 32, color: colors.yellowText },
    valueLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
    giftNote: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      lineHeight: 20,
      color: colors.muted,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    ctaY: {
      backgroundColor: colors.y,
      borderRadius: radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    ctaYText: { fontFamily: fonts.black, fontSize: 15, color: colors.dk },
    fine: { fontFamily: fonts.regular, fontSize: 11, color: colors.subtle, textAlign: 'center', marginTop: spacing.sm },
    storeStatus: { marginTop: spacing.md, alignItems: 'center', gap: spacing.sm },
    storeStatusText: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.green },
    storeStatusLink: { fontFamily: fonts.bold, fontSize: 13, color: colors.blue },
    manageBtn: {
      alignSelf: 'stretch',
      backgroundColor: colors.fab,
      borderRadius: radius.md,
      paddingVertical: 12,
      alignItems: 'center',
    },
    manageBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },

    // Generic section
    section: { padding: spacing.md, paddingTop: spacing.xl },

    // Screenshots
    urlPill: {
      alignSelf: 'center',
      backgroundColor: dark ? colors.pressed : colors.g100,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      marginTop: -spacing.sm,
      marginBottom: spacing.md,
    },
    urlPillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.heading, writingDirection: 'ltr' },
    shotsRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
    shotCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...(dark ? {} : shadow.ss),
    },
    shotCaption: {
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
      paddingVertical: 6,
    },

    // Why store
    whyCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    whyRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
    whyRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    whyIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.yellowBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    whyIconText: { fontFamily: fonts.black, fontSize: 20, color: colors.yellowText },
    whyBody: { flex: 1 },
    whyTitle: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.heading, textAlign: 'left' },
    whyText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.muted, textAlign: 'left' },
    whyWas: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: colors.subtle,
      textDecorationLine: 'line-through',
      textAlign: 'left',
      marginTop: 2,
    },

    // Compare
    compareHeading: {
      fontFamily: fonts.black,
      fontSize: 20,
      color: colors.heading,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    compareCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    compareHeader: { flexDirection: 'row', backgroundColor: colors.hero, paddingVertical: spacing.sm },
    compareHeadText: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.white, textAlign: 'center' },
    compareRow: { flexDirection: 'row', paddingVertical: 10 },
    compareFeatureCol: { flex: 2.2, paddingHorizontal: 8, justifyContent: 'center' },
    comparePlanCol: { flex: 1.4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    compareLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.text, textAlign: 'left' },
    cellYes: { fontFamily: fonts.black, fontSize: 16, color: colors.green },
    cellNo: { fontFamily: fonts.bold, fontSize: 16, color: colors.dot },
    cellString: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted, textAlign: 'center' },
    cellStringStore: { color: colors.heading, fontFamily: fonts.extraBold },

    // Top-up
    topUpGroup: { marginBottom: spacing.md },
    topUpGroupTitle: {
      fontFamily: fonts.extraBold,
      fontSize: 14,
      color: colors.heading,
      marginBottom: spacing.sm,
      textAlign: 'left',
    },
    topUpGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    topUpTile: {
      flexBasis: '30%',
      flexGrow: 1,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
    },
    topUpTileBest: { backgroundColor: colors.yellowBg, borderColor: colors.y, borderWidth: 2 },
    topUpBadge: {
      position: 'absolute',
      top: -10,
      backgroundColor: colors.y,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 1,
    },
    topUpBadgeText: { fontFamily: fonts.extraBold, fontSize: 10, color: colors.dk },
    topUpCount: { fontFamily: fonts.black, fontSize: 22, color: colors.heading },
    topUpUnit: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
    topUpPrice: { fontFamily: fonts.black, fontSize: 16, color: colors.price, marginTop: 6 },
    topUpCurrency: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted },
    topUpPer: { fontFamily: fonts.semiBold, fontSize: 10, color: colors.subtle },
    nudge: { alignSelf: 'center', paddingVertical: spacing.sm },
    nudgeText: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.blue },

    // Bundles
    bundlesSection: { padding: spacing.md, paddingTop: spacing.xl },
    bundlesSubtitle: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      marginTop: -spacing.sm,
      marginBottom: spacing.md,
    },
    emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', marginVertical: spacing.lg },
    bundleCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...(dark ? {} : shadow.ss),
    },
    bundleBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.y,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginBottom: spacing.sm,
    },
    bundleBadgeText: { fontFamily: fonts.extraBold, fontSize: 11, color: colors.dk },
    bundleName: { fontFamily: fonts.extraBold, fontSize: 18, color: colors.heading, textAlign: 'left' },
    bundleDesc: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'left' },
    slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: spacing.md },
    slot: {
      width: 30,
      height: 30,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: dark ? colors.pressed : colors.g50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slotIcon: { fontSize: 14 },
    slotOverflow: {
      height: 30,
      paddingHorizontal: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.y,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slotOverflowText: { fontFamily: fonts.extraBold, fontSize: 12, color: colors.dk },
    bundlePriceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    bundleCount: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted, textAlign: 'left' },
    perAdPill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.greenBg,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    perAdText: { fontFamily: fonts.bold, fontSize: 11, color: colors.green },
    bundlePrice: { fontFamily: fonts.black, fontSize: 26, color: colors.price },
    bundleCurrency: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
    bundleCta: { paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
    bundleCtaText: { fontFamily: fonts.extraBold, fontSize: 13 },

    // FAQ
    faqSection: { padding: spacing.md, paddingTop: spacing.xl, gap: spacing.sm },
    faqCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    faqQ: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.heading, marginBottom: 6, textAlign: 'left' },
    faqA: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, lineHeight: 22, textAlign: 'left' },

    // Final CTA
    finalCta: {
      margin: spacing.md,
      backgroundColor: colors.yellowBg,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.y,
    },
    finalEmoji: { fontSize: 40, marginBottom: spacing.sm },
    finalTitle: { fontFamily: fonts.black, fontSize: 22, color: colors.heading, textAlign: 'center', marginBottom: 6 },
    finalSub: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: spacing.md,
    },
    finalBtnY: {
      alignSelf: 'stretch',
      backgroundColor: colors.fab,
      paddingVertical: 12,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    finalBtnYText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  })

const themedStyles = { light: makeStyles(lightColors), dark: makeStyles(darkColors, true) }

function useStyles() {
  return themedStyles[useTheme().mode]
}
