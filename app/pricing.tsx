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
  getSubscriptionPlans,
  PlanData,
} from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { IS_IOS, PAID_UI_ENABLED } from '@/lib/platform'

type Billing = 'monthly' | 'yearly'

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
function toArDigits(input: string | number): string {
  return String(input)
    .split('')
    .map((c) => (/\d/.test(c) ? AR_DIGITS[Number(c)] : c))
    .join('')
}

interface Section {
  title: string
  rows: { label: string; client: CellValue; store: CellValue; plus: CellValue }[]
}
type CellValue = boolean | string

export default function PricingScreen() {
  const { locale } = useLocale()
  const ar = locale === 'ar'

  const [plans, setPlans] = useState<PlanData[]>([])
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)
  const [billing, setBilling] = useState<Billing>('monthly')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [p, b] = await Promise.all([
        getSubscriptionPlans().catch(() => [] as PlanData[]),
        getPromotionBundles().catch(() => [] as Bundle[]),
      ])
      if (!alive) return
      setPlans(p)
      setBundles(b.filter((x) => x.isActive))
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  const storeMonthly = useMemo(
    () => Number(plans.find((p) => p.storeType === 'store')?.price ?? 300),
    [plans],
  )
  const plusMonthly = useMemo(
    () => Number(plans.find((p) => p.storeType === 'store_plus')?.price ?? 500),
    [plans],
  )
  const storeYearly = storeMonthly * 10
  const plusYearly = plusMonthly * 10
  const storeSavings = storeMonthly * 12 - storeYearly
  const plusSavings = plusMonthly * 12 - plusYearly

  const fmt = (n: number) =>
    ar ? toArDigits(n.toLocaleString('ar-EG')) : n.toLocaleString('en-EG')
  const currency = ar ? 'ج.م' : 'EGP'

  const isYearly = billing === 'yearly'

  const sections: Section[] = ar ? SECTIONS_AR : SECTIONS_EN

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

          {/* Billing toggle — iOS is monthly-only (App Store SKUs) */}
          {!IS_IOS && (
            <View style={s.toggleWrap}>
              <Pressable
                onPress={() => setBilling('monthly')}
                style={[s.toggleBtn, !isYearly && s.toggleBtnActive]}
              >
                <Text style={[s.toggleText, !isYearly && s.toggleTextActive]}>
                  {ar ? 'شهري' : 'Monthly'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setBilling('yearly')}
                style={[s.toggleBtn, isYearly && s.toggleBtnActive]}
              >
                <View style={s.yearlyLabel}>
                  <Text style={[s.toggleText, isYearly && s.toggleTextActive]}>
                    {ar ? 'سنوي' : 'Yearly'}
                  </Text>
                  <View style={s.savingBadge}>
                    <Text style={s.savingBadgeText}>
                      {ar ? 'شهرين مجاناً' : '2 months free'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>
          )}
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
                ? 'ابدأ متجرك واعرض منتجاتك'
                : 'Launch your store and list products'
            }
            price={
              isYearly
                ? `${fmt(Math.round(storeYearly / 12))}`
                : `${fmt(storeMonthly)}`
            }
            unit={
              isYearly
                ? ar
                  ? `${currency} / شهر`
                  : `${currency} / mo`
                : ar
                  ? `${currency} / شهر`
                  : `${currency} / mo`
            }
            billingNote={
              isYearly
                ? ar
                  ? `يُدفع ${fmt(storeYearly)} ${currency} سنوياً`
                  : `Billed ${fmt(storeYearly)} ${currency} yearly`
                : undefined
            }
            savings={
              isYearly
                ? ar
                  ? `توفير ${fmt(storeSavings)} ${currency}`
                  : `Save ${fmt(storeSavings)} ${currency}`
                : undefined
            }
            badge={ar ? '🎁 شهر مجاني' : '🎁 1 month free'}
            accent={colors.blue}
            ctaLabel={ar ? 'اشترك كمتجر' : 'Subscribe as store'}
            ctaVariant="dk"
            onPress={() => router.push('/(auth)/signup-store')}
          />

          {/* Store Plus (featured) */}
          <PlanCard
            icon="⭐"
            title={ar ? 'متجر بلس' : 'Store Plus'}
            subtitle={
              ar
                ? 'ملف احترافي وصفحة قابلة للمشاركة'
                : 'Pro profile with shareable page'
            }
            price={
              isYearly
                ? `${fmt(Math.round(plusYearly / 12))}`
                : `${fmt(plusMonthly)}`
            }
            unit={ar ? `${currency} / شهر` : `${currency} / mo`}
            billingNote={
              isYearly
                ? ar
                  ? `يُدفع ${fmt(plusYearly)} ${currency} سنوياً`
                  : `Billed ${fmt(plusYearly)} ${currency} yearly`
                : undefined
            }
            savings={
              isYearly
                ? ar
                  ? `توفير ${fmt(plusSavings)} ${currency}`
                  : `Save ${fmt(plusSavings)} ${currency}`
                : undefined
            }
            badge={ar ? '🔥 الأكثر شعبية' : '🔥 Most popular'}
            accent={colors.y}
            ctaLabel={ar ? 'ابدأ مع بلس' : 'Start with Plus'}
            ctaVariant="y"
            featured
            onPress={() => router.push('/(auth)/signup-store')}
          />
        </View>

        {/* Yearly value reminder */}
        {isYearly && (
          <View style={s.valueCard}>
            <Text style={s.valueTitle}>
              💰{' '}
              {ar
                ? 'وفّر شهرين كاملين مع الاشتراك السنوي'
                : 'Save 2 full months with yearly billing'}
            </Text>
            <View style={s.valueRow}>
              <Text style={s.valueText}>
                {ar ? 'متجر:' : 'Store:'}{' '}
                <Text style={s.valueBold}>
                  {fmt(storeSavings)} {currency}
                </Text>
              </Text>
              <Text style={s.valueText}>
                {ar ? 'متجر بلس:' : 'Store Plus:'}{' '}
                <Text style={s.valueBold}>
                  {fmt(plusSavings)} {currency}
                </Text>
              </Text>
            </View>
          </View>
        )}

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
              <View style={[s.comparePlanCol, s.comparePlusCol]}>
                <Text style={[s.compareHeaderPlan, { color: colors.y }]}>
                  {ar ? 'بلس' : 'Plus'}
                </Text>
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
                    <View style={[s.comparePlanCol, s.comparePlusCol]}>
                      <Cell value={row.plus} ar={ar} />
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
              <Pressable
                onPress={() => router.push('/(auth)/signup-store')}
                style={s.footerBtnY}
              >
                <Text style={s.footerBtnYText}>
                  {ar ? 'ابدأ مع بلس' : 'Start with Plus'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Store Plus highlight */}
        <View style={s.plusHighlight}>
          <Text style={s.plusHighlightEmoji}>🏪</Text>
          <Text style={s.plusHighlightTitle}>
            {ar
              ? 'صفحة متجر قابلة للمشاركة'
              : 'Shareable Online Store Page'}
          </Text>
          <Text style={s.plusHighlightSub}>
            {ar
              ? 'رابط احترافي وواجهة مخصصة لعرض علامتك التجارية أمام العملاء'
              : 'A pro link and dedicated storefront to showcase your brand'}
          </Text>
          <View style={s.plusPillRow}>
            {(ar
              ? [
                  '🎨 هوية بصرية',
                  '📱 صفحة مخصصة',
                  '🔗 رابط قابل للمشاركة',
                  '⭐ تقييمات مركزة',
                ]
              : [
                  '🎨 Visual identity',
                  '📱 Dedicated page',
                  '🔗 Shareable link',
                  '⭐ Focused reviews',
                ]
            ).map((label, i) => (
              <View key={i} style={s.plusPill}>
                <Text style={s.plusPillText}>{label}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={() => router.push('/(auth)/signup-store')}
            style={s.plusCta}
          >
            <Text style={s.plusCtaText}>
              {ar ? 'ابدأ مع بلس ←' : 'Start with Plus →'}
            </Text>
          </Pressable>
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
          {(ar ? FAQ_AR(storeMonthly, plusMonthly) : FAQ_EN(storeMonthly, plusMonthly)).map(
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
  billingNote?: string
  savings?: string
  badge?: string
  accent: string
  ctaLabel: string
  ctaVariant: 'y' | 'dk' | 'outline'
  featured?: boolean
  onPress: () => void
}

function PlanCard({
  icon,
  title,
  subtitle,
  price,
  unit,
  billingNote,
  savings,
  badge,
  accent,
  ctaLabel,
  ctaVariant,
  featured,
  onPress,
}: PlanCardProps) {
  const ctaStyle: ViewStyle =
    ctaVariant === 'y'
      ? { backgroundColor: colors.y }
      : ctaVariant === 'dk'
        ? { backgroundColor: colors.dk }
        : {
            backgroundColor: colors.white,
            borderWidth: 1.5,
            borderColor: colors.g300,
          }
  const ctaTextColor =
    ctaVariant === 'y' ? colors.dk : ctaVariant === 'dk' ? colors.white : colors.dk

  return (
    <View
      style={[
        s.planCard,
        featured && {
          borderColor: colors.y,
          borderWidth: 2,
          backgroundColor: colors.yl,
        },
      ]}
    >
      {badge && (
        <View
          style={[
            s.planBadge,
            { backgroundColor: featured ? colors.y : colors.dk },
          ]}
        >
          <Text
            style={[
              s.planBadgeText,
              { color: featured ? colors.dk : colors.white },
            ]}
          >
            {badge}
          </Text>
        </View>
      )}
      <Text style={[s.planIcon, { color: accent }]}>{icon}</Text>
      <Text style={s.planTitle}>{title}</Text>
      <Text style={s.planSubtitle}>{subtitle}</Text>

      <View style={s.planPriceRow}>
        <Text style={[s.planPrice, { color: accent }]}>{price}</Text>
        <Text style={s.planUnit}>{unit}</Text>
      </View>
      {billingNote && <Text style={s.planNote}>{billingNote}</Text>}
      {savings && (
        <View style={s.planSavings}>
          <Text style={s.planSavingsText}>{savings}</Text>
        </View>
      )}

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

const SECTIONS_AR: Section[] = [
  {
    title: '📋 الإعلانات',
    rows: [
      { label: 'عدد الإعلانات المسموح', client: '٥', store: '٢٠', plus: '٢٠+' },
      { label: 'نشر إعلان', client: true, store: true, plus: true },
      { label: 'تعديل / حذف إعلاناتك', client: true, store: true, plus: true },
      { label: 'ترويج الإعلانات (Boost)', client: 'قريباً', store: true, plus: true },
    ],
  },
  {
    title: '🏪 المتجر والملف',
    rows: [
      { label: 'ملف متجر أساسي', client: false, store: true, plus: true },
      { label: 'صفحة متجر قابلة للمشاركة', client: false, store: false, plus: true },
      { label: 'شعار وصورة غلاف', client: false, store: true, plus: true },
      { label: 'وصف تفصيلي للمتجر', client: false, store: true, plus: true },
    ],
  },
  {
    title: '📊 التحليلات',
    rows: [
      { label: 'مشاهدات الإعلانات', client: true, store: true, plus: true },
      { label: 'نقرات رقم الهاتف', client: false, store: true, plus: true },
      { label: 'تقارير الأداء المتقدمة', client: false, store: false, plus: true },
    ],
  },
  {
    title: '🌐 السوشيال ميديا',
    rows: [
      { label: 'روابط انستغرام / فيسبوك', client: false, store: true, plus: true },
      { label: 'واتساب مباشر', client: true, store: true, plus: true },
      { label: 'تويتر / تيك توك / يوتيوب', client: false, store: false, plus: true },
    ],
  },
  {
    title: '🌿 التواصل والمجتمع',
    rows: [
      { label: 'رسائل خاصة', client: true, store: true, plus: true },
      { label: 'المتابعة', client: true, store: true, plus: true },
      { label: 'التقييمات', client: true, store: true, plus: true },
    ],
  },
  {
    title: '🏢 الفروع والأرقام',
    rows: [
      { label: 'رقم هاتف واحد', client: true, store: true, plus: true },
      { label: 'فروع متعددة', client: false, store: false, plus: true },
      { label: 'أرقام إضافية للفروع', client: false, store: false, plus: true },
    ],
  },
  {
    title: '🎁 التجربة المجانية',
    rows: [
      { label: 'شهر مجاني عند الاشتراك', client: false, store: true, plus: true },
      { label: 'لا يوجد رسوم إعداد', client: true, store: true, plus: true },
    ],
  },
  {
    title: '🎧 الدعم',
    rows: [
      { label: 'دعم عبر البريد', client: true, store: true, plus: true },
      { label: 'دعم واتساب', client: false, store: true, plus: true },
      { label: 'دعم أولوية', client: false, store: false, plus: true },
    ],
  },
]

const SECTIONS_EN: Section[] = [
  {
    title: '📋 Ads',
    rows: [
      { label: 'Number of ads allowed', client: '5', store: '20', plus: '20+' },
      { label: 'Publish ads', client: true, store: true, plus: true },
      { label: 'Edit / delete your ads', client: true, store: true, plus: true },
      { label: 'Boost / promote ads', client: 'Coming', store: true, plus: true },
    ],
  },
  {
    title: '🏪 Store & Profile',
    rows: [
      { label: 'Basic store profile', client: false, store: true, plus: true },
      { label: 'Shareable store page', client: false, store: false, plus: true },
      { label: 'Logo & cover image', client: false, store: true, plus: true },
      { label: 'Detailed store description', client: false, store: true, plus: true },
    ],
  },
  {
    title: '📊 Analytics',
    rows: [
      { label: 'Ad views', client: true, store: true, plus: true },
      { label: 'Phone number clicks', client: false, store: true, plus: true },
      { label: 'Advanced performance reports', client: false, store: false, plus: true },
    ],
  },
  {
    title: '🌐 Social Media',
    rows: [
      { label: 'Instagram / Facebook links', client: false, store: true, plus: true },
      { label: 'Direct WhatsApp', client: true, store: true, plus: true },
      { label: 'Twitter / TikTok / YouTube', client: false, store: false, plus: true },
    ],
  },
  {
    title: '🌿 Community',
    rows: [
      { label: 'Private messages', client: true, store: true, plus: true },
      { label: 'Following', client: true, store: true, plus: true },
      { label: 'Ratings', client: true, store: true, plus: true },
    ],
  },
  {
    title: '🏢 Branches & Numbers',
    rows: [
      { label: 'Single phone number', client: true, store: true, plus: true },
      { label: 'Multiple branches', client: false, store: false, plus: true },
      { label: 'Extra branch numbers', client: false, store: false, plus: true },
    ],
  },
  {
    title: '🎁 Free trial',
    rows: [
      { label: '1 month free on subscribe', client: false, store: true, plus: true },
      { label: 'No setup fees', client: true, store: true, plus: true },
    ],
  },
  {
    title: '🎧 Support',
    rows: [
      { label: 'Email support', client: true, store: true, plus: true },
      { label: 'WhatsApp support', client: false, store: true, plus: true },
      { label: 'Priority support', client: false, store: false, plus: true },
    ],
  },
]

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_AR = (store: number, plus: number) => [
  {
    q: 'هل يمكنني تجربة الخدمة قبل الاشتراك؟',
    a: 'نعم! كل حساب متجر جديد يبدأ بتجربة مجانية لمدة شهر كامل بدون رسوم.',
  },
  {
    q: 'هل يمكنني تغيير باقتي لاحقاً؟',
    a: 'بالطبع. يمكنك الترقية من متجر إلى بلس في أي وقت من إعدادات حسابك.',
  },
  {
    q: 'ما الفرق بين الاشتراك الشهري والسنوي؟',
    a: `الاشتراك السنوي يوفر شهرين مجاناً — أي ${store * 2} ج.م للمتجر و ${plus * 2} ج.م لبلس سنوياً.`,
  },
  {
    q: 'هل يمكنني إلغاء الاشتراك في أي وقت؟',
    a: 'نعم، يمكنك الإلغاء متى شئت. سيظل حسابك نشطاً حتى نهاية دورة الفوترة الحالية.',
  },
  {
    q: 'كيف يعمل ترويج الإعلانات؟',
    a: 'اشترِ باقة ترويج ثم اختر إعلاناتك — سيتم تثبيتها في أعلى نتائج البحث للفترة المحددة.',
  },
]

const FAQ_EN = (store: number, plus: number) => [
  {
    q: 'Can I try before subscribing?',
    a: 'Yes! Every new store starts with a full free month — no fees required.',
  },
  {
    q: 'Can I change my plan later?',
    a: 'Absolutely. You can upgrade from Store to Plus anytime from your settings.',
  },
  {
    q: 'What is the difference between monthly and yearly?',
    a: `Yearly saves you 2 free months — that's ${store * 2} EGP on Store and ${plus * 2} EGP on Plus per year.`,
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, cancel whenever you like. Your account remains active until the end of the current billing cycle.',
  },
  {
    q: 'How does ad promotion work?',
    a: 'Buy a bundle, pick your ads — they get pinned to the top of search results for the chosen period.',
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
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.full,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.full,
  },
  toggleBtnActive: {
    backgroundColor: colors.y,
  },
  toggleText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
  toggleTextActive: {
    color: colors.dk,
  },
  yearlyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  savingBadge: {
    backgroundColor: colors.green,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.full,
  },
  savingBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.white,
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
  planNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
    marginBottom: spacing.sm,
  },
  planSavings: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gl,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  planSavingsText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.green,
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

  // Yearly value card
  valueCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.gl,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.green,
    gap: spacing.sm,
  },
  valueTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  valueText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g700,
  },
  valueBold: {
    fontFamily: fonts.extraBold,
    color: colors.green,
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
  comparePlusCol: {
    backgroundColor: 'rgba(6,43,91,0.04)',
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
  footerBtnY: {
    flex: 1,
    backgroundColor: colors.y,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  footerBtnYText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    color: colors.dk,
  },

  // Plus highlight
  plusHighlight: {
    margin: spacing.md,
    backgroundColor: colors.dk,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow.md,
  },
  plusHighlightEmoji: {
    fontSize: 44,
    marginBottom: spacing.sm,
  },
  plusHighlightTitle: {
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  plusHighlightSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  plusPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  plusPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,184,0,0.35)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  plusPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.white,
  },
  plusCta: {
    backgroundColor: colors.y,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.md,
    ...shadow.ss,
  },
  plusCtaText: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.dk,
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
