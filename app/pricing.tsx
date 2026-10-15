import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import { Stack, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import {
  Bundle,
  getPromotionBundles,
  getSiteSettings,
  getStorePromotionOffer,
  getSubscriptionPlans,
  PlanData,
  SiteSettings,
} from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { PAID_UI_ENABLED } from '@/lib/platform'

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
function toArDigits(input: string | number): string {
  return String(input)
    .split('')
    .map((c) => (/\d/.test(c) ? AR_DIGITS[Number(c)] : c))
    .join('')
}

interface Section {
  title: string
  rows: { label: string; client: CellValue; store: CellValue }[]
}
type CellValue = boolean | string

interface PromotionOffer {
  price: number
  days: number
}

export default function PricingScreen() {
  const { locale } = useLocale()
  const ar = locale === 'ar'

  const [plans, setPlans] = useState<PlanData[]>([])
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [offer, setOffer] = useState<PromotionOffer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [p, b, st, of] = await Promise.all([
        getSubscriptionPlans().catch(() => [] as PlanData[]),
        getPromotionBundles().catch(() => [] as Bundle[]),
        getSiteSettings().catch(() => null),
        getStorePromotionOffer().catch(() => null),
      ])
      if (!alive) return
      setPlans(p)
      setBundles(b.filter((x) => x.isActive))
      setSettings(st)
      setOffer(of)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  const storeMonthly = useMemo(
    () => Number(plans.find((p) => p.storeType === 'store')?.price ?? 450),
    [plans],
  )

  const fmt = (n: number) =>
    ar ? toArDigits(n.toLocaleString('ar-EG')) : n.toLocaleString('en-EG')
  const currency = ar ? 'ج.م' : 'EGP'

  const clientLimit = settings ? fmt(settings.maxProductsPerClient) : '—'
  const sections: Section[] = (ar ? SECTIONS_AR : SECTIONS_EN)(clientLimit)

  const bestRatio = useMemo(() => {
    if (bundles.length === 0) return Infinity
    return Math.min(...bundles.map((b) => Number(b.price) / b.productCount))
  }, [bundles])

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: ar ? 'الأسعار' : 'Pricing',
          headerStyle: { backgroundColor: colors.white },
          headerTitleStyle: { fontFamily: fonts.black, color: colors.dk },
          headerTintColor: colors.dk,
        }}
      />
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.pill}>
            <Text style={s.pillText}>
              {ar ? '💎 باقات Vatix لمصر' : '💎 Vatix Plans for Egypt'}
            </Text>
          </View>
          <Text style={s.heroTitle}>
            {ar ? 'اختر الباقة المناسبة لك' : 'Choose the plan that fits you'}
          </Text>
          <Text style={s.heroSub}>
            {ar
              ? 'ابدأ مجاناً أو انطلق كمتجر — بدون رسوم خفية'
              : 'Start free or launch as a store — no hidden fees'}
          </Text>
        </View>

        {/* Plan Cards */}
        <View style={s.plansWrap}>
          {/* Client */}
          <PlanCard
            icon="👤"
            title={ar ? 'عميل' : 'Client'}
            subtitle={
              ar ? 'ابدأ البيع والشراء مجاناً' : 'Buy and sell for free'
            }
            price={ar ? 'مجاناً' : 'Free'}
            unit={ar ? 'للأبد' : 'forever'}
            accent={colors.g400}
            ctaLabel={ar ? 'ابدأ الآن' : 'Get started'}
            ctaVariant="outline"
            onPress={() => router.push('/(auth)/signup-client')}
          />

          {/* Store */}
          <PlanCard
            icon="🏪"
            title={ar ? 'متجر' : 'Store'}
            subtitle={
              ar
                ? 'ابدأ متجرك واعرض منتجاتك بلا حدود'
                : 'Launch your store and list unlimited products'
            }
            price={fmt(storeMonthly)}
            unit={`${currency} / ${ar ? 'شهر' : 'mo'}`}
            badge={ar ? '🎁 شهر مجاني' : '🎁 1 month free'}
            accent={colors.blue}
            ctaLabel={ar ? 'اشترك كمتجر' : 'Subscribe as store'}
            ctaVariant="dk"
            onPress={() => router.push('/(auth)/signup-store')}
          />

          {/* Store promotion */}
          {offer && (
            <View style={s.promoCard}>
              <Text style={s.promoEmoji}>⭐</Text>
              <Text style={s.promoTitle}>
                {ar
                  ? `ترويج المتجر: ${fmt(offer.price)} ${currency} / ${fmt(offer.days)} ${offer.days === 1 ? 'يوم' : 'أيام'}`
                  : `Store promotion: ${fmt(offer.price)} ${currency} / ${fmt(offer.days)} ${offer.days === 1 ? 'day' : 'days'}`}
              </Text>
              <Text style={s.promoSub}>
                {ar
                  ? 'ظهور متجرك بشارة «مميز» وترتيب أعلى في قوائم المتاجر'
                  : 'Get a "Featured" badge and higher placement in store listings'}
              </Text>
            </View>
          )}
        </View>

        {/* Feature comparison */}
        <View style={s.compareSection}>
          <Text style={s.compareHeading}>
            {ar ? 'مقارنة الميزات' : 'Feature Comparison'}
          </Text>

          <View style={s.compareCard}>
            {/* Column headers */}
            <View style={s.compareHeaderRow}>
              <View style={s.compareFeatureCol}>
                <Text style={s.compareHeaderMuted}>
                  {ar ? 'الميزة' : 'Feature'}
                </Text>
              </View>
              <View style={s.comparePlanCol}>
                <Text style={s.compareHeaderPlan}>{ar ? 'عميل' : 'Client'}</Text>
              </View>
              <View style={s.comparePlanCol}>
                <Text style={s.compareHeaderPlan}>{ar ? 'متجر' : 'Store'}</Text>
              </View>
            </View>

            {sections.map((sec, si) => (
              <View key={si}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionHeaderText}>{sec.title}</Text>
                </View>
                {sec.rows.map((row, ri) => (
                  <View
                    key={ri}
                    style={[
                      s.compareRow,
                      ri % 2 === 1 && { backgroundColor: colors.g50 },
                    ]}
                  >
                    <View style={s.compareFeatureCol}>
                      <Text style={s.compareFeatureText}>{row.label}</Text>
                    </View>
                    <View style={s.comparePlanCol}>
                      <Cell value={row.client} ar={ar} />
                    </View>
                    <View style={s.comparePlanCol}>
                      <Cell value={row.store} ar={ar} />
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {/* Footer CTAs */}
            <View style={s.compareFooter}>
              <Pressable
                onPress={() => router.push('/(auth)/signup-client')}
                style={s.footerBtnOutline}
              >
                <Text style={s.footerBtnOutlineText}>
                  {ar ? 'ابدأ مجاناً' : 'Start Free'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(auth)/signup-store')}
                style={s.footerBtnDk}
              >
                <Text style={s.footerBtnDkText}>
                  {ar ? 'اشترك' : 'Subscribe'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Promo bundles */}
        <View style={s.bundlesSection}>
          <Text style={s.compareHeading}>
            {ar ? 'باقات ترويج الإعلانات' : 'Ad Promotion Bundles'}
          </Text>
          <Text style={s.bundlesSubtitle}>
            {ar
              ? 'ادفع مرة واحدة — ثبّت إعلاناتك في الأعلى'
              : 'Pay once — pin your ads to the top'}
          </Text>

          {loading ? (
            <View style={{ paddingVertical: spacing.xl }}>
              <ActivityIndicator color={colors.dk} />
            </View>
          ) : bundles.length === 0 ? (
            <Text style={s.emptyText}>
              {ar
                ? 'لا توجد باقات ترويج متاحة حالياً'
                : 'No promotion bundles available yet'}
            </Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              {bundles.map((b) => {
                const price = Number(b.price)
                const perAd = price / b.productCount
                const isFeatured =
                  Math.abs(perAd - bestRatio) < 0.001 && bundles.length > 1
                const nameTr =
                  b.translations.find((t) => t.locale === (ar ? 'ar' : 'en'))
                    ?.name ??
                  b.translations.find((t) => t.locale === 'ar')?.name ??
                  b.name
                const descTr =
                  b.translations.find((t) => t.locale === (ar ? 'ar' : 'en'))
                    ?.description ??
                  b.translations.find((t) => t.locale === 'ar')?.description ??
                  b.description

                return (
                  <View
                    key={b.id}
                    style={[
                      s.bundleCard,
                      isFeatured && {
                        backgroundColor: colors.dk,
                        borderColor: colors.y,
                        borderWidth: 2,
                      },
                    ]}
                  >
                    {isFeatured && (
                      <View style={s.bundleBadge}>
                        <Text style={s.bundleBadgeText}>
                          {ar ? '🔥 الأوفر' : '🔥 Best value'}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={[
                        s.bundleName,
                        isFeatured && { color: colors.white },
                      ]}
                    >
                      {nameTr}
                    </Text>
                    {descTr ? (
                      <Text
                        style={[
                          s.bundleDesc,
                          isFeatured && { color: colors.g200 },
                        ]}
                      >
                        {descTr}
                      </Text>
                    ) : null}

                    {/* Slot indicator */}
                    <View style={s.slotRow}>
                      {Array.from({ length: Math.min(b.productCount, 7) }).map(
                        (_, i) => (
                          <View
                            key={i}
                            style={[
                              s.slot,
                              isFeatured && {
                                backgroundColor: 'rgba(245,184,0,0.15)',
                                borderColor: colors.y,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                s.slotIcon,
                                isFeatured && { color: colors.y },
                              ]}
                            >
                              {isFeatured ? '⭐' : '📋'}
                            </Text>
                          </View>
                        ),
                      )}
                      {b.productCount > 7 && (
                        <View style={s.slotOverflow}>
                          <Text
                            style={[
                              s.slotOverflowText,
                              isFeatured && { color: colors.y },
                            ]}
                          >
                            +{fmt(b.productCount - 7)}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={s.bundlePriceRow}>
                      <View>
                        <Text
                          style={[
                            s.bundleCount,
                            isFeatured && { color: colors.g200 },
                          ]}
                        >
                          {fmt(b.productCount)}{' '}
                          {ar ? 'إعلان' : 'ad(s)'}
                        </Text>
                        <View style={s.perAdPill}>
                          <Text style={s.perAdText}>
                            {fmt(Math.round(perAd))} {currency} /{' '}
                            {ar ? 'إعلان' : 'ad'}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          s.bundlePrice,
                          isFeatured && { color: colors.y },
                        ]}
                      >
                        {fmt(price)}{' '}
                        <Text style={s.bundleCurrency}>{currency}</Text>
                      </Text>
                    </View>

                    {/* Bundle Select CTA — iOS hides paid entry (App Store §3.1.1) */}
                    {PAID_UI_ENABLED && (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: '/dashboard/promotions',
                            params: { bundleId: String(b.id) },
                          })
                        }
                        style={[
                          s.bundleCta,
                          isFeatured
                            ? { backgroundColor: colors.y }
                            : { backgroundColor: colors.dk },
                        ]}
                      >
                        <Text
                          style={[
                            s.bundleCtaText,
                            isFeatured
                              ? { color: colors.dk }
                              : { color: colors.white },
                          ]}
                        >
                          {ar ? 'اختر ←' : 'Select →'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* FAQ */}
        <View style={s.faqSection}>
          <Text style={s.compareHeading}>
            {ar ? 'أسئلة شائعة' : 'FAQs'}
          </Text>
          {(ar ? FAQ_AR() : FAQ_EN()).map(
            (f, i) => (
              <View key={i} style={s.faqCard}>
                <Text style={s.faqQ}>{f.q}</Text>
                <Text style={s.faqA}>{f.a}</Text>
              </View>
            ),
          )}
        </View>

        {/* Final CTA */}
        <View style={s.finalCta}>
          <Text style={s.finalEmoji}>🚀</Text>
          <Text style={s.finalTitle}>
            {ar ? 'جاهز تبدأ؟' : 'Ready to start?'}
          </Text>
          <Text style={s.finalSub}>
            {ar
              ? 'انضم لآلاف المستخدمين وابدأ رحلتك على Vatix اليوم'
              : 'Join thousands of users and kick off on Vatix today'}
          </Text>
          <View style={s.finalBtnRow}>
            <Pressable
              onPress={() => router.push('/(auth)/signup-client')}
              style={s.finalBtnOutline}
            >
              <Text style={s.finalBtnOutlineText}>
                {ar ? 'انضم كعميل' : 'Sign up as client'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(auth)/signup-store')}
              style={s.finalBtnY}
            >
              <Text style={s.finalBtnYText}>
                {ar ? 'أنشئ متجرك' : 'Create your store'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

interface PlanCardProps {
  icon: string
  title: string
  subtitle: string
  price: string
  unit: string
  badge?: string
  accent: string
  ctaLabel: string
  ctaVariant: 'dk' | 'outline'
  onPress: () => void
}

function PlanCard({
  icon,
  title,
  subtitle,
  price,
  unit,
  badge,
  accent,
  ctaLabel,
  ctaVariant,
  onPress,
}: PlanCardProps) {
  const ctaStyle: ViewStyle =
    ctaVariant === 'dk'
      ? { backgroundColor: colors.dk }
      : {
          backgroundColor: colors.white,
          borderWidth: 1.5,
          borderColor: colors.g300,
        }
  const ctaTextColor = ctaVariant === 'dk' ? colors.white : colors.dk

  return (
    <View style={s.planCard}>
      {badge && (
        <View style={[s.planBadge, { backgroundColor: colors.dk }]}>
          <Text style={[s.planBadgeText, { color: colors.white }]}>{badge}</Text>
        </View>
      )}
      <Text style={[s.planIcon, { color: accent }]}>{icon}</Text>
      <Text style={s.planTitle}>{title}</Text>
      <Text style={s.planSubtitle}>{subtitle}</Text>

      <View style={s.planPriceRow}>
        <Text style={[s.planPrice, { color: accent }]}>{price}</Text>
        <Text style={s.planUnit}>{unit}</Text>
      </View>

      <Pressable onPress={onPress} style={[s.planCta, ctaStyle]}>
        <Text style={[s.planCtaText, { color: ctaTextColor }]}>{ctaLabel}</Text>
      </Pressable>
    </View>
  )
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

function Cell({ value, ar }: { value: CellValue; ar: boolean }) {
  if (value === true) {
    return <Text style={s.cellCheck}>✓</Text>
  }
  if (value === false) {
    return <Text style={s.cellCross}>—</Text>
  }
  const soon = value === 'قريباً' || value.toLowerCase() === 'coming'
  if (soon) {
    return (
      <View style={s.comingPill}>
        <Text style={s.comingText}>{ar ? 'قريباً' : 'Coming'}</Text>
      </View>
    )
  }
  return <Text style={s.cellString}>{value}</Text>
}

// ─── Feature sections data ────────────────────────────────────────────────────

const SECTIONS_AR = (clientLimit: string): Section[] => [
  {
    title: '📋 الإعلانات',
    rows: [
      { label: 'عدد المنتجات المسموح', client: clientLimit, store: 'غير محدود' },
      { label: 'نشر إعلان', client: true, store: true },
      { label: 'تعديل / حذف إعلاناتك', client: true, store: true },
      { label: 'ترويج الإعلانات (Boost)', client: true, store: true },
    ],
  },
  {
    title: '🏪 المتجر والملف',
    rows: [
      { label: 'ملف متجر أساسي', client: false, store: true },
      { label: 'موقع مصغّر للمتجر', client: false, store: true },
      { label: 'رابط الموقع الإلكتروني', client: false, store: true },
      { label: 'شعار وصورة غلاف', client: false, store: true },
      { label: 'ترتيب أعلى في نتائج المتاجر', client: false, store: true },
    ],
  },
  {
    title: '📊 التحليلات',
    rows: [
      { label: 'مشاهدات الإعلانات', client: true, store: true },
      { label: 'نقرات رقم الهاتف', client: false, store: true },
    ],
  },
  {
    title: '🌐 السوشيال ميديا',
    rows: [
      { label: 'روابط انستغرام / فيسبوك', client: false, store: true },
      { label: 'واتساب مباشر', client: true, store: true },
    ],
  },
  {
    title: '🌿 التواصل والمجتمع',
    rows: [
      { label: 'رسائل خاصة', client: true, store: true },
      { label: 'المتابعة', client: true, store: true },
      { label: 'التقييمات', client: true, store: true },
    ],
  },
  {
    title: '🏢 الفروع والأرقام',
    rows: [
      { label: 'رقم هاتف واحد', client: true, store: true },
      { label: 'فروع متعددة', client: false, store: true },
      { label: 'أرقام إضافية للفروع', client: false, store: true },
    ],
  },
  {
    title: '🎁 التجربة المجانية',
    rows: [
      { label: 'شهر مجاني عند الاشتراك', client: false, store: true },
      { label: 'لا يوجد رسوم إعداد', client: true, store: true },
    ],
  },
  {
    title: '🎧 الدعم',
    rows: [{ label: 'الدعم', client: 'البريد', store: 'البريد' }],
  },
]

const SECTIONS_EN = (clientLimit: string): Section[] => [
  {
    title: '📋 Ads',
    rows: [
      { label: 'Number of products allowed', client: clientLimit, store: 'Unlimited' },
      { label: 'Publish ads', client: true, store: true },
      { label: 'Edit / delete your ads', client: true, store: true },
      { label: 'Boost / promote ads', client: true, store: true },
    ],
  },
  {
    title: '🏪 Store & Profile',
    rows: [
      { label: 'Basic store profile', client: false, store: true },
      { label: 'Store mini-site', client: false, store: true },
      { label: 'Website link', client: false, store: true },
      { label: 'Logo & cover image', client: false, store: true },
      { label: 'Higher ranking in store listings', client: false, store: true },
    ],
  },
  {
    title: '📊 Analytics',
    rows: [
      { label: 'Ad views', client: true, store: true },
      { label: 'Phone number clicks', client: false, store: true },
    ],
  },
  {
    title: '🌐 Social Media',
    rows: [
      { label: 'Instagram / Facebook links', client: false, store: true },
      { label: 'Direct WhatsApp', client: true, store: true },
    ],
  },
  {
    title: '🌿 Community',
    rows: [
      { label: 'Private messages', client: true, store: true },
      { label: 'Following', client: true, store: true },
      { label: 'Ratings', client: true, store: true },
    ],
  },
  {
    title: '🏢 Branches & Numbers',
    rows: [
      { label: 'Single phone number', client: true, store: true },
      { label: 'Multiple branches', client: false, store: true },
      { label: 'Extra branch numbers', client: false, store: true },
    ],
  },
  {
    title: '🎁 Free trial',
    rows: [
      { label: '1 month free on subscribe', client: false, store: true },
      { label: 'No setup fees', client: true, store: true },
    ],
  },
  {
    title: '🎧 Support',
    rows: [{ label: 'Support', client: 'Email', store: 'Email' }],
  },
]

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_AR = () => [
  {
    q: 'هل يمكنني تجربة الخدمة قبل الاشتراك؟',
    a: 'نعم! كل حساب متجر جديد يبدأ بتجربة مجانية لمدة شهر كامل بدون رسوم.',
  },
  {
    q: 'هل يمكنني إلغاء الاشتراك في أي وقت؟',
    a: 'نعم، يمكنك الإلغاء متى شئت. سيظل حسابك نشطاً حتى نهاية دورة الفوترة الحالية.',
  },
  {
    q: 'كيف يعمل ترويج الإعلانات؟',
    a: 'اشترِ باقة ترويج ثم اختر إعلاناتك — سيتم تثبيتها في أعلى نتائج البحث للفترة المحددة.',
  },
  {
    q: 'ما هو ترويج المتجر؟',
    a: 'خدمة مدفوعة تمنح متجرك شارة «مميز» وترتيباً أعلى في قوائم المتاجر طوال مدة الترويج.',
  },
]

const FAQ_EN = () => [
  {
    q: 'Can I try before subscribing?',
    a: 'Yes! Every new store starts with a full free month — no fees required.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, cancel whenever you like. Your account remains active until the end of the current billing cycle.',
  },
  {
    q: 'How does ad promotion work?',
    a: 'Buy a bundle, pick your ads — they get pinned to the top of search results for the chosen period.',
  },
  {
    q: 'What is store promotion?',
    a: 'A paid add-on that gives your store a "Featured" badge and higher placement in store listings for the promotion period.',
  },
]

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  scroll: { paddingBottom: spacing.xxl },

  // Hero
  hero: {
    backgroundColor: colors.dk,
    paddingVertical: 48,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  pill: {
    backgroundColor: 'rgba(245,184,0,0.15)',
    borderWidth: 1,
    borderColor: colors.y,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  pillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.y,
  },
  heroTitle: {
    fontFamily: fonts.black,
    fontSize: 26,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Plans
  plansWrap: {
    padding: spacing.md,
    gap: spacing.md,
  },
  planCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    ...shadow.ss,
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  planBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  planIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  planTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.dk,
  },
  planSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: spacing.xs,
  },
  planPrice: {
    fontFamily: fonts.black,
    fontSize: 34,
  },
  planUnit: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
  },
  planCta: {
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  planCtaText: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },


  // Store promotion
  promoCard: {
    backgroundColor: colors.yl,
    borderColor: colors.y,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  promoEmoji: { fontSize: 28, marginBottom: spacing.xs },
  promoTitle: {
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.dk,
    textAlign: 'center',
  },
  promoSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Comparison
  compareSection: {
    padding: spacing.md,
  },
  compareHeading: {
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.dk,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  compareCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    overflow: 'hidden',
    ...shadow.ss,
  },
  compareHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.dk,
    paddingVertical: spacing.sm,
  },
  compareFeatureCol: {
    flex: 2.2,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  comparePlanCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  compareHeaderMuted: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.g300,
  },
  compareHeaderPlan: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.white,
  },
  sectionHeader: {
    backgroundColor: colors.g100,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
  },
  sectionHeaderText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.dk,
  },
  compareRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.g100,
    alignItems: 'center',
    minHeight: 44,
  },
  compareFeatureText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g700,
  },
  cellCheck: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.green,
  },
  cellCross: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.g300,
  },
  cellString: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.g700,
    textAlign: 'center',
  },
  comingPill: {
    backgroundColor: colors.ol,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: radius.full,
  },
  comingText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.orange,
  },
  compareFooter: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.g200,
    backgroundColor: colors.g50,
  },
  footerBtnOutline: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.g300,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  footerBtnOutlineText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.dk,
  },
  footerBtnDk: {
    flex: 1,
    backgroundColor: colors.dk,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  footerBtnDkText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.white,
  },


  // Bundles
  bundlesSection: {
    padding: spacing.md,
  },
  bundlesSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  bundleCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    ...shadow.ss,
  },
  bundleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.y,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  bundleBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.dk,
  },
  bundleName: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.dk,
  },
  bundleDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
    marginTop: 4,
  },
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  slot: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.g100,
    borderWidth: 1,
    borderColor: colors.g200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotIcon: {
    fontSize: 14,
    color: colors.g600,
  },
  slotOverflow: {
    height: 30,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.g100,
    borderWidth: 1,
    borderColor: colors.g200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotOverflowText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.g600,
  },
  bundlePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  bundleCount: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g600,
    marginBottom: 4,
  },
  perAdPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gl,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.full,
  },
  perAdText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.green,
  },
  bundlePrice: {
    fontFamily: fonts.black,
    fontSize: 26,
    color: colors.dk,
  },
  bundleCurrency: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
  },
  bundleCta: {
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  bundleCtaText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
  },

  // FAQ
  faqSection: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  faqCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    ...shadow.ss,
  },
  faqQ: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.dk,
    marginBottom: spacing.xs,
  },
  faqA: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    lineHeight: 22,
  },

  // Final CTA
  finalCta: {
    margin: spacing.md,
    backgroundColor: colors.yl,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.y,
  },
  finalEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  finalTitle: {
    fontFamily: fonts.black,
    fontSize: 22,
    color: colors.dk,
    marginBottom: spacing.xs,
  },
  finalSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g700,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  finalBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  finalBtnOutline: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.dk,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  finalBtnOutlineText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.dk,
  },
  finalBtnY: {
    flex: 1,
    backgroundColor: colors.dk,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  finalBtnYText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.white,
  },
})
