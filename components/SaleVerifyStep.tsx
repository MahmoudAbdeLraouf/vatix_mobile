import { useMemo, useState } from 'react'
import { Image as RNImage, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import { useTheme } from '@/contexts/theme'
import { useAuth } from '@/contexts/auth'
import { fonts, radius, spacing, type ThemeColors } from '@/constants/theme'
import { imgUrl } from '@/lib/api'
import { AuthFetchError, authFetch } from '@/lib/auth'
import { fillTemplate, isValidBuyerPhone } from '@/lib/salesRecord'
import { Button } from '@/components/ui/Button'

export interface SaleVerifyProduct {
  id: number
  title: string
  images?: { url: string }[]
}

interface Props {
  product: SaleVerifyProduct
  /** Called when the owner is finished (after a successful send, via the close/CTA button). */
  onDone: () => void
  /** Called when the owner skips the step. */
  onLater: () => void
  /** Called when the backend says the sale state changed under us (409) so the parent can refresh its rows. */
  onConflict?: () => void
}

const PREVIEW_TITLE_MAX = 60

/** Strips the `*bold*` markers used in the WhatsApp template text; the preview renders plain text. */
const stripAsterisks = (s: string) => s.split('*').join('')

/**
 * Step 2 of mark-sold: the store owner types the buyer's phone and we send a
 * WhatsApp confirmation request. The phone is only ever sent in the request
 * body; it is never read back or shown after sending.
 */
export function SaleVerifyStep({ product, onDone, onLater, onConflict }: Props) {
  const { t, isRtl } = useLocale()
  const { colors, isDark } = useTheme()
  const { user } = useAuth()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const s = t.salesRecord
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const dirStyle = {
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }
  const rowDir = isRtl ? ({ direction: 'ltr' as const, flexDirection: 'row-reverse' as const }) : null

  const stripped = phone.replace(/\s+/g, '')
  const valid = isValidBuyerPhone(phone)
  const isOwnNumber = !!user?.phone && stripped.length > 0 && stripped === user.phone.replace(/\s+/g, '')
  const showInvalid = touched && stripped.length > 0 && !valid

  const thumb = imgUrl(product.images?.[0]?.url, { w: 120 })
  const shortTitle =
    product.title.length > PREVIEW_TITLE_MAX
      ? `${product.title.slice(0, PREVIEW_TITLE_MAX)}…`
      : product.title
  const storeName = user?.displayName ?? ''

  async function send() {
    setTouched(true)
    if (!valid || sending) return
    setSending(true)
    setError(null)
    try {
      await authFetch(`/products/${product.id}/sale-verification`, {
        method: 'POST',
        body: JSON.stringify({ phone: stripped }),
      })
      setSent(true)
    } catch (e) {
      const status = e instanceof AuthFetchError ? e.status : 0
      if (status === 409) onConflict?.()
      // 400/409 carry a user-facing Arabic message from the backend; anything else is generic.
      setError(
        (status === 400 || status === 409) && e instanceof Error && e.message
          ? e.message
          : s.step2Failed,
      )
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.sentBox, { backgroundColor: colors.greenBg }]}>
          <Text style={[styles.sentText, dirStyle]}>{s.toastSent}</Text>
        </View>
        <Button
          label={s.toastNudge}
          variant="y"
          fullWidth
          onPress={() => {
            onDone()
            router.push('/products/new')
          }}
        />
        <Button label={s.close} variant="outline" fullWidth onPress={onDone} />
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, dirStyle]}>{s.step2Title}</Text>

      <View style={[styles.productRow, rowDir]}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.inputBg }]} />
        )}
        <Text style={[styles.productTitle, dirStyle]} numberOfLines={2}>
          {product.title}
        </Text>
      </View>

      <Text style={[styles.explainer, dirStyle]}>{s.step2Explainer}</Text>

      <View style={styles.field}>
        <Text style={[styles.label, dirStyle]}>{s.step2Phone}</Text>
        <TextInput
          value={phone}
          onChangeText={v => {
            setPhone(v)
            setError(null)
          }}
          onBlur={() => setTouched(true)}
          keyboardType="phone-pad"
          placeholder={s.step2PhoneHint}
          placeholderTextColor={colors.subtle}
          autoComplete="off"
          maxLength={14}
          style={[styles.input, showInvalid && styles.inputInvalid]}
        />
        {showInvalid ? (
          <Text style={[styles.hintError, dirStyle]}>{s.step2PhoneInvalid}</Text>
        ) : isOwnNumber ? (
          <Text style={[styles.hintWarn, dirStyle]}>{s.step2OwnNumber}</Text>
        ) : null}
      </View>

      <View style={styles.preview}>
        <Text style={[styles.previewLabel, dirStyle]}>{s.step2Preview}</Text>
        <View style={styles.bubble}>
          <View style={styles.bubbleHeader}>
            <RNImage
              source={require('@/assets/logo_img.png')}
              style={styles.bubbleLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.bubbleBody}>
            <Text style={[styles.bubbleText, dirStyle]}>{s.previewIntro}</Text>
            <Text style={[styles.bubbleText, dirStyle]}>
              {stripAsterisks(fillTemplate(s.previewBody, { store: storeName }))}
            </Text>
            <Text style={[styles.bubbleText, dirStyle]}>
              {stripAsterisks(fillTemplate(s.previewProduct, { title: shortTitle }))}
            </Text>
            <Text style={[styles.bubbleText, dirStyle]}>{s.previewAsk}</Text>
            <Text style={[styles.bubbleFooter, dirStyle]}>{s.previewFooter}</Text>
          </View>
          <View style={styles.bubbleBtn}>
            <Text style={styles.bubbleBtnText}>{s.previewYes}</Text>
          </View>
          <View style={styles.bubbleBtn}>
            <Text style={styles.bubbleBtnText}>{s.previewNo}</Text>
          </View>
        </View>
      </View>

      {error ? <Text style={[styles.hintError, dirStyle]}>{error}</Text> : null}

      <Button
        label={sending ? s.step2Sending : s.step2Send}
        variant="y"
        fullWidth
        loading={sending}
        disabled={sending || !valid}
        onPress={send}
      />
      <Pressable onPress={onLater} disabled={sending} style={styles.later} hitSlop={8}>
        <Text style={styles.laterText}>{s.step2Later}</Text>
      </Pressable>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, _dark: boolean) =>
  StyleSheet.create({
    wrap: { gap: spacing.md },
    title: { fontFamily: fonts.black, fontSize: 16, color: colors.heading },
    productRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    thumb: { width: 48, height: 48, borderRadius: radius.sm },
    productTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.text },
    explainer: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.muted },
    field: { gap: 6 },
    label: { fontFamily: fonts.bold, fontSize: 12, color: colors.heading },
    input: {
      height: 46,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingHorizontal: spacing.md,
      fontFamily: fonts.semiBold,
      fontSize: 15,
      color: colors.text,
      writingDirection: 'ltr',
      textAlign: 'left',
    },
    inputInvalid: { borderColor: colors.red },
    hintError: { fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 18, color: colors.red },
    hintWarn: { fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 18, color: colors.yellowText },
    preview: { gap: 6 },
    previewLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted },
    bubble: {
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleHeader: {
      backgroundColor: colors.hero,
      height: 72,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bubbleLogo: { width: 120, height: 44 },
    bubbleBody: { padding: spacing.md, gap: 6 },
    bubbleText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.text },
    bubbleFooter: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    bubbleBtn: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 10,
      alignItems: 'center',
    },
    bubbleBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.blue },
    sentBox: { borderRadius: radius.md, padding: spacing.md },
    sentText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 21, color: colors.green },
    later: { alignItems: 'center', paddingVertical: 6 },
    laterText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.muted },
  })
