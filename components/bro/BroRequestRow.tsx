import { useMemo, useRef, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useLocale } from '@/contexts/locale'
import {
  budgetFitOf,
  foundBroRequest,
  rerunBroRequest,
  type BroRequest,
  type BroRequestStatus,
  type BroRequestView,
} from '@/lib/bro'
import { imgUrl } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { useBroCardFormat, useBroDir } from '@/components/bro/BroCardParts'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

/** One request card: status edge, count boxes, the two best offers and the next actions. Port of the website BroRequestCard. */
export function BroRequestRow({
  request: r,
  statusLabel,
  view,
  now,
  onChanged,
}: {
  request: BroRequest
  statusLabel: string
  view?: BroRequestView | null
  now: number
  onChanged: () => void
}) {
  const { t } = useLocale()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const b = t.bro
  const { ar, dirStyle, rowDir, colDir } = useBroDir()
  const { ago } = useBroCardFormat(now)
  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-US')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const tone: Record<BroRequestStatus, { edge: string; bg: string; fg: string }> = {
    searching: { edge: colors.y, bg: '#fff8e1', fg: '#8a6500' },
    found: { edge: '#1a7f3c', bg: '#e6f7ec', fg: '#1a7f3c' },
    done: { edge: colors.dk, bg: colors.placeholder, fg: colors.text },
    expired: { edge: colors.border, bg: colors.placeholder, fg: colors.muted },
    cancelled: { edge: colors.border, bg: colors.placeholder, fg: colors.muted },
  }
  const st = tone[r.status]
  const searching = r.status === 'searching'
  const expired = r.status === 'expired'
  const done = r.status === 'done'
  const newOffers = r.newOfferCount ?? 0

  let left: string | null = null
  if (searching && now > 0) {
    const ms = new Date(r.expiresAt).getTime() - now
    if (ms > 0) {
      const h = Math.max(1, Math.ceil(ms / 3.6e6))
      left = h > 24 ? b.leftDays.replace('{n}', fmt(Math.ceil(h / 24))) : b.leftHours.replace('{n}', fmt(h))
    }
  }

  const budgetMax = r.budgetMax == null || r.budgetMax === '' ? null : Number(r.budgetMax)
  const available = view ? view.offers.filter(o => o.available) : []
  const best = [...available].sort((a, c) => Number(a.price) - Number(c.price)).slice(0, 2)
  const n = view ? available.length : (r.offerCount ?? null)
  const canRerun = !!view?.onBoard && (expired || done)
  const canFound = searching || done || expired

  async function run(fn: () => Promise<unknown>) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if (res == null || res === false) throw new Error('failed')
      onChanged()
    } catch {
      setError(b.errGeneric)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  function confirmFound() {
    Alert.alert(b.foundShort, b.foundConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: b.foundShort, onPress: () => void run(() => foundBroRequest(r.id)) },
    ])
  }

  function fitLabel(price: number): string | null {
    const fit = budgetFitOf(price, budgetMax)
    if (fit === 'in' && budgetMax != null) {
      const under = budgetMax - price
      return under > 0 ? b.fitUnder.replace('{amount}', fmt(under)) : b.fitInBudget
    }
    if (fit === 'near') return b.fitNearBudget
    return null
  }

  const openOffers = () => router.push(`/bro/request-offers/${r.id}` as never)

  return (
    <View style={[styles.card, { borderStartColor: st.edge }, r.status === 'cancelled' && { opacity: 0.7 }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/bro/requests/${r.id}` as never)}
        style={({ pressed }) => [styles.head, rowDir, pressed && { opacity: 0.85 }]}
      >
        <View style={[styles.headText, colDir]}>
          <Text style={[styles.title, dirStyle]} numberOfLines={2}>
            {r.modelText}
            {r.storage ? ` · ${r.storage}` : ''}
          </Text>
          <Text style={[styles.sub, dirStyle]}>
            {ago(r.createdAt)}
            {left ? <Text style={{ color: '#8a6500' }}>{` · ⏳ ${left}`}</Text> : null}
          </Text>
        </View>
        <View style={[styles.headSide, rowDir]}>
          {newOffers > 0 ? (
            <View style={[styles.pill, { backgroundColor: colors.red }]}>
              <Text style={[styles.pillText, { color: '#fff' }]}>{b.newOffersBadge.replace('{n}', fmt(newOffers))}</Text>
            </View>
          ) : null}
          <View style={[styles.pill, { backgroundColor: st.bg }]}>
            <Text style={[styles.pillText, { color: st.fg }]}>{statusLabel}</Text>
          </View>
        </View>
      </Pressable>

      {view ? (
        <View style={[styles.boxes, rowDir]}>
          <CountBox styles={styles} value={fmt(view.counts.asked)} label={b.countAsked} />
          <CountBox styles={styles} value={fmt(view.counts.available)} label={b.countAvailable} strong={view.counts.available > 0} />
          <CountBox styles={styles} value={fmt(view.counts.pending)} label={b.countPending} />
        </View>
      ) : null}

      {best.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={[styles.sectionTitle, dirStyle]}>{b.bestOffersTitle}</Text>
          {best.map((o, i) => {
            const price = Number(o.price)
            const fit = fitLabel(price)
            const src = o.image ? imgUrl(o.image, { w: 120 }) : null
            return (
              <Pressable
                key={o.offerId}
                accessibilityRole="button"
                onPress={openOffers}
                style={({ pressed }) => [styles.preview, rowDir, i === 0 && styles.previewBest, pressed && { opacity: 0.85 }]}
              >
                {src ? <Image source={{ uri: src }} style={styles.previewImg} /> : <View style={styles.previewImg} />}
                <View style={[styles.previewText, colDir]}>
                  <Text style={[styles.previewTitle, dirStyle]} numberOfLines={1}>{o.title}</Text>
                  <Text style={[styles.previewMeta, dirStyle]} numberOfLines={1}>
                    {[o.seller?.name, o.locationName].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={styles.previewPriceCol}>
                  <Text style={styles.previewPrice}>{b.priceEgp.replace('{price}', fmt(price))}</Text>
                  {fit ? <Text style={styles.fit}>{fit}</Text> : null}
                </View>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      {expired ? (
        <View style={styles.tip}>
          <Text style={[styles.tipText, dirStyle]}>{b.expiredTip}</Text>
        </View>
      ) : null}

      {error ? <Text style={[styles.error, dirStyle]}>{error}</Text> : null}

      <View style={[styles.actions, rowDir]}>
        <Button
          label={b.allOffers.replace('{n}', n == null ? '…' : fmt(n))}
          variant={(n ?? 0) > 0 ? 'dk' : 'outline'}
          size="sm"
          fullWidth={false}
          onPress={openOffers}
        />
        {canRerun ? (
          <Button
            label={b.searchAgainBtn}
            variant="y"
            size="sm"
            fullWidth={false}
            loading={busy}
            disabled={busy}
            onPress={() => void run(() => rerunBroRequest(r.id))}
          />
        ) : expired ? (
          <Button
            label={b.searchAgainBtn}
            variant="y"
            size="sm"
            fullWidth={false}
            onPress={() => router.push(`/bro/requests/${r.id}` as never)}
          />
        ) : null}
        {canFound ? (
          <Button label={b.foundShort} variant="outline" size="sm" fullWidth={false} disabled={busy} onPress={confirmFound} />
        ) : null}
      </View>
    </View>
  )
}

function CountBox({
  styles,
  value,
  label,
  strong,
}: {
  styles: ReturnType<typeof makeStyles>
  value: string
  label: string
  strong?: boolean
}) {
  return (
    <View style={[styles.box, strong && styles.boxStrong]}>
      <Text style={styles.boxValue}>{value}</Text>
      <Text style={styles.boxLabel} numberOfLines={1}>{label}</Text>
    </View>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStartWidth: 4,
    padding: spacing.md,
    gap: 12,
    ...(dark ? null : shadow.ss),
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  headSide: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  title: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.heading },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontFamily: fonts.bold, fontSize: 11 },
  boxes: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center' },
  boxStrong: { backgroundColor: colors.yellowBg },
  boxValue: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.heading },
  boxLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewBest: { backgroundColor: dark ? colors.yellowBg : '#fffbea', borderColor: colors.y },
  previewImg: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.placeholder },
  previewText: { flex: 1, minWidth: 0 },
  previewTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.heading },
  previewMeta: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  previewPriceCol: { alignItems: 'flex-end', flexShrink: 0 },
  previewPrice: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.price },
  fit: { fontFamily: fonts.bold, fontSize: 10.5, color: '#1a7f3c' },
  tip: { backgroundColor: colors.placeholder, borderRadius: 10, padding: 10 },
  tipText: { fontFamily: fonts.regular, fontSize: 12, color: colors.text },
  error: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.red },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
