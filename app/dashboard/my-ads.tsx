import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import {
  getPromotionBundles,
  getSiteSettings,
  imgUrl,
  type Bundle,
  type Product,
  type SiteSettings,
} from '@/lib/api'
import { authDelete, authErrorMessage, authFetch, authPost } from '@/lib/auth'
import { IS_IOS, PAID_UI_ENABLED, PROMOTION_UI_ENABLED } from '@/lib/platform'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { SkeletonGrid } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PaymentScreenshotUpload } from '@/components/ui/PaymentScreenshotUpload'
import { InstapayQrCard } from '@/components/InstapayQrCard'
import { MobileWalletCard } from '@/components/MobileWalletCard'

export default function MyAdsScreen() {
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const ar = locale === 'ar'
  const isStore = user?.isStore ?? false
  const isStorePlus = user?.type === 'store_plus' || user?.type === 'STORE_PLUS'

  const dirStyle = {
    textAlign: 'auto' as const,
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
  }
  const dirContainer = ar ? { direction: 'rtl' as const } : null

  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [boostingId, setBoostingId] = useState<number | null>(null)
  const [noCreditsProduct, setNoCreditsProduct] = useState<Product | null>(null)
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [settings, setSettings] = useState<SiteSettings | null>(null)

  // Inline bundle-buy payment modal state (mirrors website's instapayFor popover)
  const [payFor, setPayFor] = useState<{ product: Product; bundle: Bundle } | null>(null)
  const [payMethod, setPayMethod] = useState<'instapay' | 'mobile_wallet'>('instapay')
  const [screenshot, setScreenshot] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [paySuccess, setPaySuccess] = useState(false)

  useEffect(() => {
    getSiteSettings().then(setSettings).catch(() => {})
    getPromotionBundles().then(setBundles).catch(() => {})
  }, [])

  const limit = isStore
    ? settings?.maxActiveProductsPerStore ?? 20
    : settings?.maxProductsPerClient ?? 5
  const fmt = (n: number | string) =>
    Number(n ?? 0).toLocaleString(ar ? 'ar-EG' : 'en-EG')

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await authFetch<Product[]>('/products/mine')
      setProducts(data ?? [])
    } catch (e) {
      setError(e as Error)
      setProducts([])
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const stats = useMemo(() => {
    const list = products ?? []
    const now = Date.now()
    return {
      total: list.length,
      active: list.filter((p) => p.isActive).length,
      promoted: list.filter(
        (p) => p.promotedUntil && new Date(p.promotedUntil).getTime() > now,
      ).length,
    }
  }, [products])

  const usedForLimit = isStore ? stats.active : stats.total
  const usagePct = isStorePlus
    ? 0
    : Math.min(100, Math.round((usedForLimit / limit) * 100))
  const isAtLimit = !isStorePlus && usedForLimit >= limit

  function confirmDelete(id: number) {
    Alert.alert(
      ar ? 'حذف الإعلان' : 'Delete listing',
      ar ? 'هل تريد حذف هذا الإعلان؟' : 'Delete this listing?',
      [
        { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: ar ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            await authDelete(`/products/${id}`)
            load()
          },
        },
      ],
    )
  }

  async function handleBoost(p: Product) {
    setBoostingId(p.id)
    try {
      await authPost(`/payments/promo-credits/apply/${p.id}`, {})
      load()
    } catch {
      // iOS: route to Apple-IAP-wired promote screen (no InstaPay modal on iOS).
      if (IS_IOS) {
        goPromote(p.id)
      } else {
        setNoCreditsProduct(p)
      }
    } finally {
      setBoostingId(null)
    }
  }

  function goPromote(productId: number, bundleId?: number) {
    setNoCreditsProduct(null)
    router.push({
      pathname: '/dashboard/promote',
      params: bundleId
        ? { resumeProductId: String(productId), bundleId: String(bundleId) }
        : { resumeProductId: String(productId) },
    })
  }

  function openPaymentModal(product: Product, bundle: Bundle) {
    setNoCreditsProduct(null)
    const defaultMethod: 'instapay' | 'mobile_wallet' = settings?.instapayEnabled
      ? 'instapay'
      : settings?.mobileWalletEnabled
        ? 'mobile_wallet'
        : 'instapay'
    setPayMethod(defaultMethod)
    setPayFor({ product, bundle })
    setScreenshot('')
    setPhone('')
    setSubmitError(null)
    setPaySuccess(false)
  }

  function closePaymentModal() {
    setPayFor(null)
    setScreenshot('')
    setPhone('')
    setSubmitError(null)
    setPaySuccess(false)
  }

  async function submitBundlePayment() {
    if (!payFor) return
    if (!screenshot) {
      setSubmitError(ar ? 'الرجاء رفع لقطة الإيصال' : 'Please upload the receipt screenshot')
      return
    }
    if (!phone || phone.trim().length < 6) {
      setSubmitError(ar ? 'الرجاء إدخال رقم الهاتف' : 'Please enter your phone')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const endpoint =
        payMethod === 'mobile_wallet'
          ? '/payments/promotions/mobile-wallet'
          : '/payments/promotions/instapay'
      await authPost(endpoint, {
        bundleId: payFor.bundle.id,
        screenshotKey: screenshot,
        buyerPhone: phone.trim(),
        productId: payFor.product.id,
      })
      setPaySuccess(true)
      load()
    } catch (e) {
      setSubmitError(authErrorMessage(e, t))
    } finally {
      setSubmitting(false)
    }
  }

  const hasData = products !== null && !error
  const showList = hasData && products!.length > 0

  return (
    <DashboardLayout title={t.myAds}>
      {/* Summary card: usage + quick stats + post CTA */}
      {hasData && (
        <View style={[styles.summary, dirContainer]}>
          <View style={styles.summaryAccent} />
          <View style={[styles.summaryTop, dirContainer]}>
            <View style={styles.summaryTextWrap}>
              <Text style={[styles.summaryTitle, dirStyle]} numberOfLines={1}>
                {ar ? 'إعلاناتي' : 'My Listings'}
              </Text>
              <Text style={[styles.summarySub, dirStyle]} numberOfLines={1}>
                {isStorePlus
                  ? ar
                    ? `${fmt(stats.total)} من غير محدود ∞`
                    : `${fmt(stats.total)} of Unlimited ∞`
                  : ar
                    ? `${fmt(usedForLimit)} من ${fmt(limit)}${isStore ? ' (نشط)' : ''}`
                    : `${fmt(usedForLimit)} of ${fmt(limit)}${isStore ? ' (active)' : ''}`}
              </Text>
            </View>
            <Pressable
              onPress={() => !isAtLimit && router.push('/products/add')}
              disabled={isAtLimit}
              style={({ pressed }) => [
                styles.postCta,
                isAtLimit && styles.postCtaDisabled,
                pressed && !isAtLimit && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
            >
              <Ionicons
                name={isAtLimit ? 'lock-closed' : 'add'}
                size={16}
                color={isAtLimit ? colors.g500 : colors.dk}
              />
              <Text
                style={[
                  styles.postCtaText,
                  isAtLimit && { color: colors.g500 },
                ]}
              >
                {ar ? 'إضافة إعلان' : 'Post Ad'}
              </Text>
            </Pressable>
          </View>

          {/* Progress bar */}
          {!isStorePlus && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${usagePct}%` },
                  isAtLimit && { backgroundColor: colors.red },
                ]}
              />
            </View>
          )}

          {/* Stat chips */}
          <View style={[styles.statsRow, dirContainer]}>
            <StatChip
              icon="checkmark-circle"
              tint={colors.green}
              tintLight={colors.gl}
              label={ar ? 'نشط' : 'Active'}
              value={stats.active}
            />
            <StatChip
              icon="rocket"
              tint={colors.yd}
              tintLight={colors.yl}
              label={ar ? 'مروّج' : 'Promoted'}
              value={stats.promoted}
            />
            <StatChip
              icon="layers"
              tint={colors.dk}
              tintLight={colors.g100}
              label={ar ? 'الإجمالي' : 'Total'}
              value={stats.total}
            />
          </View>
        </View>
      )}

      {products === null && !error ? (
        <SkeletonGrid count={4} />
      ) : error ? (
        <ErrorState kind="network" onRetry={load} />
      ) : products && products.length === 0 ? (
        <EmptyState
          title={ar ? 'لم تضف إعلانات بعد.' : 'No ads posted yet.'}
          actionLabel={ar ? 'أضف إعلانك الأول' : 'Post your first ad'}
          onAction={() => router.push('/products/add')}
        />
      ) : (
        showList && (
          <View style={styles.list}>
            {products!.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                ar={ar}
                dirStyle={dirStyle}
                dirContainer={dirContainer}
                boosting={boostingId === p.id}
                onBoost={() => handleBoost(p)}
                onView={() => router.push(`/products/${p.id}`)}
                onEdit={() => router.push(`/products/edit/${p.id}`)}
                onDelete={() => confirmDelete(p.id)}
              />
            ))}
          </View>
        )
      )}

      {/* No-credits modal — iOS hides paid entry (App Store §3.1.1) */}
      {PAID_UI_ENABLED && (
      <Modal
        visible={!!noCreditsProduct}
        transparent
        animationType="fade"
        onRequestClose={() => setNoCreditsProduct(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setNoCreditsProduct(null)}>
          <Pressable style={[styles.popover, dirContainer]} onPress={(e) => e.stopPropagation()}>
            {/* Popover header */}
            <View style={[styles.popHeader, dirContainer]}>
              <View style={styles.popIconWrap}>
                <Ionicons name="rocket" size={20} color={colors.dk} />
              </View>
              <View style={styles.popHeaderText}>
                <Text style={[styles.popTitle, dirStyle]} numberOfLines={1}>
                  {ar ? 'لا يوجد رصيد ترويج' : 'No Promo Credits'}
                </Text>
                <Text style={[styles.popSub, dirStyle]} numberOfLines={2}>
                  {ar
                    ? 'اختر باقة لتظهر في الأعلى لمدة ٧ أيام.'
                    : 'Pick a pack to appear at the top for 7 days.'}
                </Text>
              </View>
              <Pressable
                onPress={() => setNoCreditsProduct(null)}
                hitSlop={12}
                style={styles.popClose}
              >
                <Ionicons name="close" size={18} color={colors.g500} />
              </Pressable>
            </View>

            <View style={styles.packList}>
              {bundles.length === 0 ? (
                <Text style={[styles.packEmpty, dirStyle]}>
                  {ar ? 'لا توجد باقات متاحة' : 'No bundles available'}
                </Text>
              ) : (
                bundles.map((b) => {
                  const tName =
                    b.translations.find((tr) => tr.locale === locale)?.name ?? b.name
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => {
                        if (!noCreditsProduct) return
                        openPaymentModal(noCreditsProduct, b)
                      }}
                      style={({ pressed }) => [
                        styles.packRow,
                        dirContainer,
                        pressed && styles.packRowPressed,
                      ]}
                    >
                      <View style={[styles.packLeft, dirContainer]}>
                        <View style={styles.packIconWrap}>
                          <Ionicons name="rocket-outline" size={14} color={colors.dk} />
                        </View>
                        <Text style={[styles.packLabel, dirStyle]}>
                          {tName} ({b.productCount})
                        </Text>
                      </View>
                      <Text style={styles.packPrice}>
                        {b.price} {ar ? 'ج.م' : 'EGP'}
                      </Text>
                    </Pressable>
                  )
                })
              )}
            </View>

            <Pressable
              onPress={() => noCreditsProduct && goPromote(noCreditsProduct.id)}
              style={({ pressed }) => [styles.popFooter, dirContainer, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.popFooterText}>
                {ar ? 'عرض جميع خيارات الترويج' : 'View all promotion options'}
              </Text>
              <Ionicons
                name={ar ? 'arrow-back' : 'arrow-forward'}
                size={14}
                color={colors.yd}
              />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      )}

      {/* Inline bundle-buy payment modal — iOS hides paid entry (App Store §3.1.1) */}
      {PAID_UI_ENABLED && (
      <Modal
        visible={!!payFor}
        transparent
        animationType="fade"
        onRequestClose={closePaymentModal}
      >
        <Pressable style={styles.backdrop} onPress={closePaymentModal}>
          <Pressable
            style={[styles.paySheet, dirContainer]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView
              contentContainerStyle={styles.paySheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {paySuccess ? (
                <View style={styles.successWrap}>
                  <View style={styles.successIcon}>
                    <Ionicons name="checkmark" size={36} color={colors.white} />
                  </View>
                  <Text style={[styles.successTitle, dirStyle]}>
                    {ar ? 'تم إرسال الدفعة' : 'Payment submitted'}
                  </Text>
                  <Text style={[styles.successMsg, dirStyle]}>
                    {ar
                      ? 'سنراجع الإيصال ونفعّل الترويج لإعلانك قريباً.'
                      : 'We will review the receipt and activate promotion on your listing shortly.'}
                  </Text>
                  <Button
                    label={ar ? 'حسناً' : 'OK'}
                    variant="cta"
                    onPress={closePaymentModal}
                    style={styles.successBtn}
                  />
                </View>
              ) : (
                <>
                  <View style={[styles.payHeader, dirContainer]}>
                    <View style={styles.popIconWrap}>
                      <Ionicons name="rocket" size={20} color={colors.dk} />
                    </View>
                    <View style={styles.popHeaderText}>
                      <Text style={[styles.popTitle, dirStyle]} numberOfLines={1}>
                        {payFor
                          ? payFor.bundle.translations.find((tr) => tr.locale === locale)?.name ??
                            payFor.bundle.name
                          : ''}
                      </Text>
                      <Text style={[styles.popSub, dirStyle]} numberOfLines={2}>
                        {payFor
                          ? ar
                            ? `${payFor.bundle.productCount} إعلان · ${fmt(payFor.bundle.price)} ج.م`
                            : `${payFor.bundle.productCount} ads · ${fmt(payFor.bundle.price)} EGP`
                          : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={closePaymentModal}
                      hitSlop={12}
                      style={styles.popClose}
                    >
                      <Ionicons name="close" size={18} color={colors.g500} />
                    </Pressable>
                  </View>

                  {settings?.instapayEnabled && settings?.mobileWalletEnabled && (
                    <View style={styles.methodToggle}>
                      <Pressable
                        onPress={() => setPayMethod('instapay')}
                        style={[
                          styles.methodChip,
                          payMethod === 'instapay' && styles.methodChipInstapay,
                        ]}
                      >
                        <Ionicons
                          name="qr-code-outline"
                          size={14}
                          color={payMethod === 'instapay' ? colors.white : colors.g600}
                        />
                        <Text
                          style={[
                            styles.methodChipText,
                            payMethod === 'instapay' && styles.methodChipTextActive,
                          ]}
                        >
                          {ar ? 'إنستاباي' : 'InstaPay'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPayMethod('mobile_wallet')}
                        style={[
                          styles.methodChip,
                          payMethod === 'mobile_wallet' && styles.methodChipWallet,
                        ]}
                      >
                        <Ionicons
                          name="phone-portrait-outline"
                          size={14}
                          color={payMethod === 'mobile_wallet' ? colors.white : colors.g600}
                        />
                        <Text
                          style={[
                            styles.methodChipText,
                            payMethod === 'mobile_wallet' && styles.methodChipTextActive,
                          ]}
                        >
                          {ar ? 'محفظة موبايل' : 'Mobile Wallet'}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {payMethod === 'instapay' ? (
                    <InstapayQrCard amount={payFor ? payFor.bundle.price : 0} />
                  ) : (
                    <MobileWalletCard
                      amount={payFor ? fmt(payFor.bundle.price) : ''}
                      walletNumber={settings?.mobileWalletAccount ?? ''}
                      walletName={settings?.mobileWalletName ?? null}
                    />
                  )}

                  <Input
                    label={ar ? 'رقم هاتفك' : 'Your phone'}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder={ar ? '01xxxxxxxxx' : '01xxxxxxxxx'}
                  />

                  <PaymentScreenshotUpload
                    label={ar ? 'لقطة إيصال الدفع' : 'Payment receipt screenshot'}
                    value={screenshot}
                    onChange={setScreenshot}
                    hint={
                      ar
                        ? 'ارفع صورة واضحة من تأكيد التحويل'
                        : 'Upload a clear image of the transfer confirmation'
                    }
                  />

                  {submitError ? (
                    <Text style={[styles.errorText, dirStyle]}>{submitError}</Text>
                  ) : null}

                  <Button
                    label={
                      submitting
                        ? ar
                          ? 'جاري الإرسال…'
                          : 'Submitting…'
                        : ar
                          ? 'إرسال الدفعة'
                          : 'Submit payment'
                    }
                    variant="cta"
                    onPress={submitBundlePayment}
                    disabled={submitting}
                  />
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      )}
    </DashboardLayout>
  )
}

function StatChip({
  icon,
  tint,
  tintLight,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  tint: string
  tintLight: string
  label: string
  value: number
}) {
  return (
    <View style={[styles.statChip, { backgroundColor: tintLight }]}>
      <Ionicons name={icon} size={14} color={tint} />
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

function ProductRow({
  product,
  ar,
  dirStyle,
  dirContainer,
  boosting,
  onBoost,
  onView,
  onEdit,
  onDelete,
}: {
  product: Product
  ar: boolean
  dirStyle: { textAlign: 'auto'; writingDirection: 'rtl' | 'ltr' }
  dirContainer: { direction: 'rtl' } | null
  boosting: boolean
  onBoost: () => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const thumb = imgUrl(product.images?.[0]?.url)
  const isPromoted =
    !!product.promotedUntil && new Date(product.promotedUntil) > new Date()
  const priceStr = `${Number(product.price).toLocaleString(ar ? 'ar-EG' : 'en-EG')} ${
    ar ? 'ج.م' : 'EGP'
  }`

  return (
    <View style={[styles.row, dirContainer]}>
      {isPromoted && <View style={styles.rowAccent} />}
      <View style={[styles.rowTop, dirContainer]}>
        <View style={styles.thumb}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            <Ionicons name="image-outline" size={26} color={colors.g400} />
          )}
        </View>

        <View style={styles.info}>
          <Text style={[styles.title, dirStyle]} numberOfLines={1}>
            {product.title}
          </Text>
          <Text style={[styles.price, dirStyle]} numberOfLines={1}>
            {priceStr}
          </Text>
          <View style={[styles.pillRow, dirContainer]}>
            <View
              style={[
                styles.statusPill,
                product.isActive ? styles.pillGreen : styles.pillRed,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: product.isActive ? colors.green : colors.red },
                ]}
              />
              <Text
                style={[
                  styles.statusPillText,
                  { color: product.isActive ? colors.green : colors.red },
                ]}
              >
                {product.isActive ? (ar ? 'نشط' : 'Active') : ar ? 'غير نشط' : 'Inactive'}
              </Text>
            </View>
            {isPromoted && (
              <View style={styles.promotedPill}>
                <Ionicons name="rocket" size={10} color={colors.dk} />
                <Text style={styles.promotedPillText}>
                  {ar ? 'مروّج' : 'Featured'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.actions, dirContainer]}>
        {/* Boost — iOS uses Apple IAP via /dashboard/promote when credits are 0. */}
        {!isPromoted && PROMOTION_UI_ENABLED && (
          <Pressable
            onPress={onBoost}
            disabled={boosting}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.boostBtn,
              pressed && { opacity: 0.85 },
              boosting && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="rocket-outline" size={13} color={colors.dk} />
            <Text style={[styles.actionText, { color: colors.dk }]}>
              {boosting ? (ar ? 'جاري…' : 'Boosting…') : ar ? 'ترويج' : 'Boost'}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={onView}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.viewBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="eye-outline" size={13} color={colors.dk} />
          <Text style={[styles.actionText, { color: colors.dk }]}>
            {ar ? 'عرض' : 'View'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.viewBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="pencil-outline" size={13} color={colors.dk} />
          <Text style={[styles.actionText, { color: colors.dk }]}>
            {ar ? 'تعديل' : 'Edit'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.deleteBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="trash-outline" size={13} color={colors.red} />
          <Text style={[styles.actionText, { color: colors.red }]}>
            {ar ? 'حذف' : 'Delete'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Summary
  summary: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.g200,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadow.ss,
  },
  summaryAccent: {
    height: 4,
    backgroundColor: colors.y,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  summaryTextWrap: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.dk,
  },
  summarySub: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g500,
  },
  postCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.y,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    ...shadow.ss,
  },
  postCtaDisabled: {
    backgroundColor: colors.g200,
    shadowOpacity: 0,
    elevation: 0,
  },
  postCtaText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
  },

  progressTrack: {
    height: 6,
    marginHorizontal: spacing.md,
    borderRadius: 3,
    backgroundColor: colors.g100,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.y,
    borderRadius: 3,
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.md,
  },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.md,
  },
  statValue: {
    fontFamily: fonts.black,
    fontSize: 14,
  },
  statLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.g600,
    flexShrink: 1,
  },

  // List
  list: {
    gap: spacing.sm,
  },
  row: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
    overflow: 'hidden',
    ...shadow.ss,
  },
  rowAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.y,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.g100,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 14,
    color: colors.dk,
  },
  price: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.yd,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillGreen: {
    backgroundColor: colors.gl,
    borderColor: colors.green,
  },
  pillRed: {
    backgroundColor: colors.rl,
    borderColor: colors.red,
  },
  statusPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  promotedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.y,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  promotedPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.dk,
  },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.g200,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  boostBtn: {
    backgroundColor: colors.yl,
    borderColor: colors.y,
  },
  viewBtn: {
    backgroundColor: colors.white,
    borderColor: colors.g300,
  },
  deleteBtn: {
    backgroundColor: colors.rl,
    borderColor: colors.red,
  },

  // Popover modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,43,91,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  popover: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.sl,
  },
  popHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  popIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popHeaderText: {
    flex: 1,
    gap: 2,
  },
  popTitle: {
    fontFamily: fonts.black,
    fontSize: 15,
    color: colors.dk,
  },
  popSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
    lineHeight: 18,
  },
  popClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.g100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packList: {
    gap: 8,
  },
  packRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g200,
    backgroundColor: colors.white,
  },
  packRowPressed: {
    borderColor: colors.y,
    backgroundColor: colors.yl,
  },
  packLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  packIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.yl,
    borderWidth: 1,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
  },
  packPrice: {
    fontFamily: fonts.black,
    fontSize: 13,
    color: colors.yd,
  },
  packEmpty: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g500,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  popFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.g100,
    paddingTop: spacing.sm,
  },
  popFooterText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.yd,
  },

  // Inline bundle-buy payment modal
  paySheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.g200,
    overflow: 'hidden',
    ...shadow.sl,
  },
  paySheetContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  payHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  methodToggle: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  methodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.g200,
    backgroundColor: colors.white,
  },
  methodChipInstapay: {
    backgroundColor: '#7B2FBE',
    borderColor: '#7B2FBE',
  },
  methodChipWallet: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  methodChipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.g600,
  },
  methodChipTextActive: {
    color: colors.white,
  },
  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.red,
  },
  successWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  successTitle: {
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.dk,
  },
  successMsg: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    lineHeight: 20,
    textAlign: 'center',
  },
  successBtn: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
})
