import { useCallback, useEffect, useRef, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { imgUrl } from '@/lib/api'
import {
  answerBroAvailability,
  getBroSellerView,
  submitBroFreeText,
  type BroScratches,
  type BroSellerView,
} from '@/lib/bro'
import { BroAvatar, BroBadge } from '@/components/bro/BroAvatar'
import { BroButton } from '@/components/bro/BroButton'
import { BroDetailsForm } from '@/components/bro/BroDetailsForm'
import { Button } from '@/components/ui/Button'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

// Mirrors the backend `assertAnswerable`: only queued and skipped inquiries cannot be answered.
// `available` and `sold` stay answerable too (a correction), but the page shows their current answer instead.
const AWAITING_ANSWER = ['sent', 'free_text', 'no_reply']

/** Seller landing page for a Bro ask (`/bro/i/<inquiryId>`). Port of the website seller page. */
export default function BroSellerScreen() {
  const { locale, t } = useLocale()
  const b = t.bro
  const ar = locale === 'ar'
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }
  const rowDir = ar ? ({ direction: 'ltr', flexDirection: 'row-reverse' } as const) : null

  const { id: rawParam } = useLocalSearchParams<{ id: string }>()
  const rawId = Array.isArray(rawParam) ? rawParam[0] : rawParam
  const id = Number(rawId)

  const [view, setView] = useState<BroSellerView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState('')
  const inFlight = useRef(false)

  const load = useCallback(async (): Promise<BroSellerView | null> => {
    if (!Number.isInteger(id) || id <= 0) return null
    try {
      return await getBroSellerView(id)
    } catch {
      return null
    }
  }, [id])

  const initialLoad = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    const v = await load()
    setView(v)
    setFailed(!v)
    setLoading(false)
  }, [load])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const v = await load()
      if (cancelled) return
      setView(v)
      setFailed(!v)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  // After an answer the server is the source of truth: refetch instead of tracking local state.
  async function refetch() {
    const v = await load()
    if (v) setView(v)
    else setError(b.sellerLoadFailed)
  }

  // One API call at a time (state alone lags a rapid double tap). On failure the controls stay enabled for retry.
  async function answer(call: () => Promise<unknown>): Promise<boolean> {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      await call()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : b.errGeneric)
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
    await refetch()
    return true
  }

  async function sendReply() {
    const v = text.trim()
    if (!v) return
    const ok = await answer(() => submitBroFreeText(id, v))
    if (ok) {
      setReplying(false)
      setText('')
    }
  }

  const header = <Stack.Screen options={{ headerShown: true, title: b.sellerPageTitle }} />

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {header}
        <View style={styles.content}>
          <Skeleton height={32} width="50%" />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    )
  }

  if (failed || !view) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Text style={[styles.strong, dirStyle]}>{b.sellerLinkNotYours}</Text>
            <Text style={[styles.muted, dirStyle]}>{b.sellerLoadFailed}</Text>
            <Button label={b.retry} variant="dk" size="sm" onPress={() => void initialLoad()} />
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const { product, facts } = view
  const awaiting = AWAITING_ANSWER.includes(view.status)
  const scratchLabel: Record<BroScratches, string> = {
    none: b.scratchesNone,
    minor: b.scratchesMinor,
    repaired: b.scratchesRepaired,
  }
  const image = imgUrl(product?.image, { w: 128 })
  const extras = [
    facts.hasBox && `📦 ${b.extraBox}`,
    facts.hasInvoice && `🧾 ${b.extraInvoice}`,
    facts.hasWarranty && `🛡️ ${b.extraWarranty}`,
  ].filter(Boolean) as string[]

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.identity, rowDir]}>
          <BroAvatar size={32} />
          <View style={{ gap: 2 }}>
            <Text style={[styles.name, dirStyle]}>{b.name}</Text>
            <BroBadge label={b.badge} />
          </View>
        </View>

        <View style={styles.card}>
          <View>
            <Text style={[styles.h1, dirStyle]}>{b.sellerPageTitle}</Text>
            <Text style={[styles.muted, dirStyle, { marginTop: 4 }]}>{b.sellerBuyerArea.replace('{area}', view.area)}</Text>
          </View>

          {product ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/products/${product.id}` as never)}
              style={[styles.product, rowDir]}
            >
              <View style={styles.thumb}>{image ? <Image source={{ uri: image }} style={styles.thumbImg} /> : null}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.productTitle, dirStyle]}>{product.title}</Text>
                <Text style={[styles.muted, dirStyle]}>{b.priceEgp.replace('{price}', product.price.toLocaleString())}</Text>
              </View>
            </Pressable>
          ) : null}

          {awaiting ? (
            <>
              {view.freeText ? (
                <Text style={[styles.muted, dirStyle]}>{b.sellerYourReply.replace('{text}', view.freeText)}</Text>
              ) : null}
              <View style={[styles.chips, rowDir]}>
                <BroButton
                  label={b.qrAvailable}
                  disabled={busy}
                  onPress={() => void answer(() => answerBroAvailability(id, true))}
                  dirStyle={dirStyle}
                />
                <BroButton
                  label={b.qrSold}
                  disabled={busy}
                  onPress={() => void answer(() => answerBroAvailability(id, false))}
                  dirStyle={dirStyle}
                />
                <BroButton label={b.qrOwnReply} disabled={busy} onPress={() => setReplying(v => !v)} dirStyle={dirStyle} />
              </View>
              {replying ? (
                <View style={{ gap: 6 }}>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={2000}
                    editable={!busy}
                    placeholder={b.freeTextPlaceholder}
                    placeholderTextColor={colors.g400}
                    style={[styles.input, dirStyle]}
                  />
                  <View style={[styles.chips, rowDir]}>
                    <Button
                      label={busy ? '...' : b.sellerSend}
                      variant="dk"
                      size="sm"
                      disabled={busy || !text.trim()}
                      onPress={() => void sendReply()}
                    />
                  </View>
                </View>
              ) : null}
            </>
          ) : null}

          {view.status === 'available' ? (
            <>
              <Text style={[styles.strong, dirStyle]}>{b.sellerStatusAvailable}</Text>
              {facts.latestPrice == null ? (
                <View style={{ gap: 6 }}>
                  <Text style={[styles.body, dirStyle]}>{b.formIntro}</Text>
                  <BroDetailsForm inquiryId={id} onSubmitted={() => void refetch()} />
                </View>
              ) : (
                <View style={{ gap: 4 }}>
                  <Text style={[styles.body, dirStyle]}>
                    {b.fieldLatestPrice}: {b.priceEgp.replace('{price}', facts.latestPrice.toLocaleString())}
                  </Text>
                  {facts.checkArea ? (
                    <Text style={[styles.body, dirStyle]}>{b.factArea.replace('{area}', facts.checkArea)}</Text>
                  ) : null}
                  {facts.scratches ? (
                    <Text style={[styles.body, dirStyle]}>
                      {b.fieldScratches}: {scratchLabel[facts.scratches]}
                    </Text>
                  ) : null}
                  {extras.length > 0 ? <Text style={[styles.body, dirStyle]}>{extras.join(' · ')}</Text> : null}
                  {facts.warrantyNote ? (
                    <Text style={[styles.body, dirStyle]}>{b.factWarranty.replace('{note}', facts.warrantyNote)}</Text>
                  ) : null}
                  {facts.sellerNote ? (
                    <Text style={[styles.body, dirStyle]}>{b.sellerQuote.replace('{note}', facts.sellerNote)}</Text>
                  ) : null}
                </View>
              )}
            </>
          ) : null}

          {view.status === 'sold' ? <Text style={[styles.strong, dirStyle]}>{b.sellerStatusSold}</Text> : null}

          {view.status === 'queued' || view.status === 'skipped' ? (
            <Text style={[styles.muted, dirStyle]}>{b.sellerStatusClosed}</Text>
          ) : null}

          {error ? <Text style={[styles.err, dirStyle]}>{error}</Text> : null}

          {view.conversationId != null ? (
            <View style={[styles.chips, rowDir]}>
              <BroButton
                label={b.sellerOpenChat}
                onPress={() => router.push(`/dashboard/messages/${view.conversationId}` as never)}
                dirStyle={dirStyle}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.dk },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.md,
    gap: 12,
    ...shadow.ss,
  },
  h1: { fontFamily: fonts.extraBold, fontSize: 17, color: colors.dk },
  strong: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.dk },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.g500 },
  body: { fontFamily: fonts.regular, fontSize: 13, color: colors.g700 },
  product: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.g100 },
  thumbImg: { width: 64, height: 64 },
  productTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.dk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  input: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.g200,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g900,
    textAlignVertical: 'top',
  },
  err: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
})
