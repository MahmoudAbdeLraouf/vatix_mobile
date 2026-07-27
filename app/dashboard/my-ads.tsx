import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { getSiteSettings, imgUrl, type Product, type SiteSettings } from '@/lib/api'
import { authDelete, authFetch, authPost } from '@/lib/auth'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { SkeletonGrid } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

type PromoPack = { type: string; labelAr: string; labelEn: string; price: number }

const PACKS: PromoPack[] = [
  { type: 'promotion_1ad', labelAr: '١ إعلان', labelEn: '1 Ad', price: 100 },
  { type: 'promotion_3ads', labelAr: '٣ إعلانات', labelEn: '3 Ads', price: 250 },
  { type: 'promotion_5ads', labelAr: '٥ إعلانات', labelEn: '5 Ads', price: 380 },
]

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
  const [buyingPack, setBuyingPack] = useState(false)
  const [settings, setSettings] = useState<SiteSettings | null>(null)

  useEffect(() => {
    getSiteSettings().then(setSettings).catch(() => {})
  }, [])

  const limit = isStore
    ? settings?.maxActiveProductsPerStore ?? 20
    : settings?.maxProductsPerClient ?? 5
  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-EG')

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
      setNoCreditsProduct(p)
    } finally {
      setBoostingId(null)
    }
  }

  async function buyPackAndBoost(productId: number, packType: string) {
    setBuyingPack(true)
    try {
      const res = await authPost<{ iframeUrl: string; paymentId: number }>(
        '/payments/promotions',
        { type: packType },
      )
      setNoCreditsProduct(null)
      router.push({
        pathname: '/checkout',
        params: {
          paymentId: String(res.paymentId),
          iframeUrl: res.iframeUrl,
          boostProductId: String(productId),
        },
      })
    } catch (e) {
      Alert.alert(
        ar ? 'خطأ' : 'Error',
        e instanceof Error ? e.message : ar ? 'حدث خطأ' : 'An error occurred',
      )
    } finally {
      setBuyingPack(false)
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
                onDelete={() => confirmDelete(p.id)}
              />
            ))}
          </View>
        )
      )}

      {/* No-credits modal */}
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
              {PACKS.map((pack) => (
                <Pressable
                  key={pack.type}
                  disabled={buyingPack}
                  onPress={() =>
                    noCreditsProduct && buyPackAndBoost(noCreditsProduct.id, pack.type)
                  }
                  style={({ pressed }) => [
                    styles.packRow,
                    dirContainer,
                    pressed && !buyingPack && styles.packRowPressed,
                    buyingPack && { opacity: 0.6 },
                  ]}
                >
                  <View style={[styles.packLeft, dirContainer]}>
                    <View style={styles.packIconWrap}>
                      <Ionicons name="rocket-outline" size={14} color={colors.dk} />
                    </View>
                    <Text style={[styles.packLabel, dirStyle]}>
                      {ar ? pack.labelAr : pack.labelEn}
                    </Text>
                  </View>
                  <Text style={styles.packPrice}>
                    {pack.price} {ar ? 'ج.م' : 'EGP'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => {
                setNoCreditsProduct(null)
                router.push('/dashboard/promote')
              }}
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
  onDelete,
}: {
  product: Product
  ar: boolean
  dirStyle: { textAlign: 'auto'; writingDirection: 'rtl' | 'ltr' }
  dirContainer: { direction: 'rtl' } | null
  boosting: boolean
  onBoost: () => void
  onView: () => void
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
        {!isPromoted && (
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
})
