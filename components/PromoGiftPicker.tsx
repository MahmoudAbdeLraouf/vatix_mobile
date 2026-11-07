import { useMemo, useState } from 'react'
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { imgUrl, type Product } from '@/lib/api'
import { authErrorMessage } from '@/lib/auth'
import { claimGift, formatGiftDays, formatPromotedUntil } from '@/lib/promoGift'
import type { PromotionGiftItem } from '@/lib/promoGift'
import { Button } from '@/components/ui/Button'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'

interface Props {
  gift: PromotionGiftItem
  products: Product[]
  onClose: () => void
  /** Claim succeeded and the user dismissed the confirmation. */
  onClaimed: () => void
}

type Stage =
  | { kind: 'pick' }
  | { kind: 'confirm'; title: string; promotedUntil: string }

export function PromoGiftPicker({ gift, products, onClose, onClaimed }: Props) {
  const { locale, t } = useLocale()
  const ar = locale === 'ar'
  const lang = ar ? 'ar' : 'en'
  const dirStyle = {
    textAlign: 'auto' as const,
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
  }
  const dirContainer = ar ? { direction: 'rtl' as const } : null
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  const [stage, setStage] = useState<Stage>({ kind: 'pick' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = gift.source === 'admin'
  const daysText = formatGiftDays(gift.days, lang)
  const eligible = useMemo(() => products.filter((p) => p.isActive && !p.soldAt), [products])

  function handleBackdrop() {
    if (stage.kind === 'pick' && !busy) onClose()
  }

  async function handleClaim() {
    if (busy || selectedId === null) return
    setBusy(true)
    setError(null)
    try {
      const res = await claimGift(gift.id, selectedId)
      setStage({ kind: 'confirm', title: res.title, promotedUntil: res.promotedUntil })
    } catch (err) {
      setError(authErrorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  function renderItem({ item: p }: { item: Product }) {
    const thumb = imgUrl(p.images?.[0]?.url)
    const selected = selectedId === p.id
    const promoted = !!p.promotedUntil && new Date(p.promotedUntil) > new Date()
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        onPress={() => setSelectedId(p.id)}
        style={[styles.row, dirContainer, selected && styles.rowSelected]}
      >
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected && <View style={styles.radioDot} />}
        </View>
        <View style={styles.thumb}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            <Ionicons name="image-outline" size={20} color={colors.subtle} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={[styles.productTitle, dirStyle]} numberOfLines={1}>
            {p.title}
          </Text>
          <Text style={[styles.price, dirStyle]} numberOfLines={1}>
            {Number(p.price).toLocaleString(ar ? 'ar-EG' : 'en-EG')} {ar ? 'ج.م' : 'EGP'}
          </Text>
        </View>
        {promoted && (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{ar ? 'متروّج' : 'Promoted'}</Text>
          </View>
        )}
      </Pressable>
    )
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleBackdrop}>
      <Pressable style={styles.backdrop} onPress={handleBackdrop}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={(e) => e.stopPropagation()}
        >
          {stage.kind === 'confirm' ? (
            <>
              <View style={styles.confirmBody}>
                <Text style={[styles.confirmTitle, styles.center]}>
                  {ar ? '✅ إعلانك متروّج!' : '✅ Your listing is promoted!'}
                </Text>
                <Text style={[styles.confirmText, styles.center, { writingDirection: dirStyle.writingDirection }]}>
                  {ar
                    ? `"${stage.title}" هيفضل متروّج لحد ${formatPromotedUntil(stage.promotedUntil, lang)}`
                    : `"${stage.title}" stays promoted until ${formatPromotedUntil(stage.promotedUntil, lang)}`}
                </Text>
              </View>
              <View style={styles.footer}>
                <Button label={ar ? 'تمام' : 'OK'} variant="y" size="lg" onPress={onClaimed} />
              </View>
            </>
          ) : (
            <>
              <View style={[styles.header, dirContainer]}>
                <Text style={[styles.headerTitle, dirStyle]} numberOfLines={1}>
                  {isAdmin
                    ? ar ? '🎁 وصلتك هدية ترويج' : '🎁 You received a promotion gift'
                    : ar ? '🎉 مبروك! كسبت ترويج مجاني' : '🎉 Congrats! You earned a free promotion'}
                </Text>
                <Pressable
                  onPress={onClose}
                  disabled={busy}
                  hitSlop={8}
                  accessibilityLabel={ar ? 'إغلاق' : 'Close'}
                >
                  <Ionicons name="close" size={22} color={colors.white} />
                </Pressable>
              </View>

              <View style={styles.body}>
                <Text style={[styles.description, dirStyle]}>
                  {ar
                    ? `اختار إعلان من إعلاناتك ونروّجه مجاناً لمدة ${daysText}.`
                    : `Pick one of your listings and we'll promote it free for ${daysText}.`}
                </Text>

                {eligible.length === 0 ? (
                  <Text style={[styles.empty, styles.center, { writingDirection: dirStyle.writingDirection }]}>
                    {ar
                      ? 'مفيش إعلانات نشطة دلوقتي — فعّل أو أضف إعلان وارجع استخدم الهدية'
                      : 'You have no active listings right now — activate or add a listing, then come back to use your gift'}
                  </Text>
                ) : (
                  <FlatList
                    data={eligible}
                    keyExtractor={(p) => String(p.id)}
                    renderItem={renderItem}
                    extraData={selectedId}
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    accessibilityRole="radiogroup"
                    keyboardShouldPersistTaps="handled"
                  />
                )}

                {!!error && (
                  <Text style={[styles.error, dirStyle]} accessibilityRole="alert">
                    {error}
                  </Text>
                )}
              </View>

              <View style={[styles.actions, dirContainer]}>
                <View style={styles.actionCell}>
                  <Button
                    label={ar ? 'بعدين' : 'Later'}
                    variant="outline"
                    size="lg"
                    onPress={onClose}
                    disabled={busy}
                  />
                </View>
                <View style={styles.actionCell}>
                  <Button
                    label={ar ? 'روّج الإعلان ده' : 'Promote this listing'}
                    variant="y"
                    size="lg"
                    onPress={handleClaim}
                    disabled={selectedId === null}
                    loading={busy}
                  />
                </View>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    overflow: 'hidden',
    ...(dark ? null : shadow.sl),
  },
  header: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.white,
    marginEnd: spacing.md,
  },
  body: {
    flexShrink: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 24,
  },
  center: {
    textAlign: 'center',
  },
  empty: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 22,
    paddingVertical: spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rowSelected: {
    borderColor: colors.y,
    backgroundColor: colors.yellowBg,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.dot,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: colors.y,
    backgroundColor: colors.y,
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.card,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.border,
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
  },
  productTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.heading,
  },
  price: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.yd,
    marginTop: 2,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.yellowBg,
  },
  pillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.yellowText,
  },
  error: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.red,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  actionCell: {
    flex: 1,
  },
  confirmBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  confirmTitle: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.heading,
  },
  confirmText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
})
