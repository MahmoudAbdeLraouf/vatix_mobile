// Cap-reached two-way choice (mockups/store-upsell-system.html §4): convert to
// a store (recommended) or buy extra listing slots, with a live price
// comparison. Shared by products/add, import confirm, ClientCapCard and my-ads.
import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { Button } from '@/components/ui/Button'
import { StoreValueChips } from '@/components/StoreValue'
import { PAID_UI_ENABLED } from '@/lib/platform'
import { getClientSlotBundles, type ClientSlotBundle } from '@/lib/api'
import { fmtPrice, svText, useStoreValueParams, type StoreValueParams } from '@/lib/storeValue'

function useDir() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return {
    ar,
    rowDir: ar ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const } : null,
    colDir: ar ? { direction: 'rtl' as const } : null,
    dirStyle: {
      writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
      textAlign: 'auto' as const,
    },
  }
}

/** Cheapest bundle (shown in the slots pick) + best per-slot rate (comparison line). */
export function useSlotBundleQuote() {
  const [bundles, setBundles] = useState<ClientSlotBundle[]>([])
  useEffect(() => {
    let alive = true
    getClientSlotBundles()
      .then((b) => alive && setBundles(Array.isArray(b) ? b : []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return useMemo(() => {
    const active = bundles
      .filter((b) => b.isActive !== false && b.slotCount > 0 && Number(b.price) > 0)
      .map((b) => ({ count: b.slotCount, price: Number(b.price) }))
    if (!active.length) return null
    const cheapest = active.reduce((a, b) => (b.price < a.price ? b : a))
    const perSlot = Math.min(...active.map((b) => b.price / b.count))
    return { cheapest, perSlot }
  }, [bundles])
}

interface CapReachedChoiceBodyProps {
  /** Lifetime listings used; defaults to the cap (the user is at the limit). */
  used?: number
  cap?: number
  params?: StoreValueParams
  /** Show the "your listing is saved" line (add-product flow only). */
  savedLine?: boolean
  /** Convert CTA copy: "convert and publish" (add flow) or plain. */
  publishCta?: boolean
  onConvert: () => void
  onBuySlots: () => void
}

/** The sheet contents without the modal chrome (title row excluded). */
export function CapReachedChoiceBody({
  used: usedProp,
  cap: capProp,
  params,
  savedLine = false,
  publishCta = false,
  onConvert,
  onBuySlots,
}: CapReachedChoiceBodyProps) {
  const { colors, isDark } = useTheme()
  const { t, locale } = useLocale()
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const live = useStoreValueParams()
  const p = params ?? live
  const cap = capProp || p.cap
  const used = usedProp ?? cap
  const sv = t.storeValue
  const quote = useSlotBundleQuote()
  const pct = cap > 0 ? Math.min(1, used / cap) : 1

  return (
    <View>
      <View style={[styles.meter, rowDir]}>
        <View style={[styles.meterFill, { width: `${Math.round(pct * 100)}%` }]} />
      </View>
      {savedLine ? <Text style={[styles.saved, dirStyle]}>{sv.capSaved}</Text> : null}

      <View style={[styles.pick, styles.pickRec, { marginTop: savedLine ? 6 : 14 }]}>
        <View style={[styles.rib, ar ? { right: 12 } : { left: 12 }]}>
          <Text style={styles.ribText}>{sv.capRibbon}</Text>
        </View>
        <Text style={[styles.pickTitle, dirStyle]}>{sv.capConvertTitle}</Text>
        <StoreValueChips params={p} short giftFull />
        {PAID_UI_ENABLED ? (
          <Text style={[styles.pp, dirStyle]}>
            <Text style={styles.ppBig}>{fmtPrice(p.price)}</Text> {sv.perMonthShort}
            {p.list > p.price ? (
              <>
                {' '}
                <Text style={styles.strike}>{fmtPrice(p.list)}</Text>
              </>
            ) : null}
          </Text>
        ) : (
          <Text style={[styles.pp, dirStyle]}>{sv.iosStoreSub}</Text>
        )}
        {p.trialDays > 0 ? (
          <Text style={[styles.pp, styles.trial, dirStyle]}>{svText(sv, 'trialFirst', p, locale)}</Text>
        ) : null}
        <Button
          label={publishCta ? sv.capConvertCta : sv.capConvertCtaPlain}
          variant="y"
          size="sm"
          onPress={onConvert}
          style={{ marginTop: 4 }}
        />
      </View>

      <View style={[styles.pick, styles.pickRow, rowDir, { marginTop: 10 }]}>
        <View style={[{ flex: 1 }, colDir]}>
          <Text style={[styles.pickTitle, dirStyle]}>{sv.capSlotsTitle}</Text>
          {PAID_UI_ENABLED && quote ? (
            <Text style={[styles.ppSmall, dirStyle]}>
              {svText(sv, 'capSlotsMeta', p, locale, {
                count: quote.cheapest.count,
                price: quote.cheapest.price,
              })}
            </Text>
          ) : null}
        </View>
        <Button label={sv.capSlotsBuy} variant="outline" size="sm" fullWidth={false} onPress={onBuySlots} />
      </View>

      {PAID_UI_ENABLED && quote ? (
        <View style={[styles.cmp, { marginTop: 10 }]}>
          <Text style={[styles.cmpText, dirStyle]}>
            {svText(sv, 'capCompare', p, locale, {
              count: cap,
              total: Math.round(cap * quote.perSlot),
            })}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

interface CapReachedChoiceProps extends CapReachedChoiceBodyProps {
  visible: boolean
  onClose: () => void
}

/** Bottom sheet: "وصلت للحد — 10 من 10" + the two options. */
export function CapReachedChoice({ visible, onClose, onConvert, onBuySlots, ...rest }: CapReachedChoiceProps) {
  const { colors, isDark } = useTheme()
  const { t, locale } = useLocale()
  const { rowDir, dirStyle } = useDir()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const live = useStoreValueParams()
  const p = rest.params ?? live
  const cap = rest.cap || p.cap
  const used = rest.used ?? cap

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grab} />
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={[styles.head, rowDir]}>
              <Text style={[styles.title, dirStyle]}>
                {svText(t.storeValue, 'capTitle', p, locale, { used, cap })}
              </Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <CapReachedChoiceBody
              {...rest}
              params={p}
              cap={cap}
              used={used}
              onConvert={() => {
                onClose()
                onConvert()
              }}
              onBuySlots={() => {
                onClose()
                onBuySlots()
              }}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function makeStyles(c: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.backdrop, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: '92%',
      overflow: 'hidden',
      ...shadow.sl,
    },
    grab: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      marginTop: 8,
    },
    body: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    title: { flex: 1, fontFamily: fonts.black, fontSize: 17, color: c.heading },
    meter: {
      flexDirection: 'row',
      height: 8,
      borderRadius: 6,
      backgroundColor: c.border,
      overflow: 'hidden',
      marginTop: 8,
    },
    meterFill: { height: '100%', backgroundColor: c.y, borderRadius: 6 },
    saved: {
      fontFamily: fonts.semiBold,
      fontSize: 12.5,
      color: isDark ? c.muted : c.g600,
      marginTop: 6,
      marginBottom: 10,
    },
    pick: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      padding: 14,
      gap: 6,
      backgroundColor: c.card,
    },
    pickRec: { borderWidth: 2, borderColor: c.y, backgroundColor: c.yellowBg, paddingTop: 16 },
    pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rib: {
      position: 'absolute',
      top: -11,
      backgroundColor: c.y,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 1,
    },
    ribText: { fontFamily: fonts.black, fontSize: 11, color: c.dk },
    pickTitle: { fontFamily: fonts.black, fontSize: 14.5, color: c.heading },
    pp: { fontFamily: fonts.bold, fontSize: 13, color: isDark ? c.muted : c.g600 },
    ppBig: { fontFamily: fonts.black, fontSize: 16, color: c.heading },
    ppSmall: { fontFamily: fonts.bold, fontSize: 12, color: isDark ? c.muted : c.g600 },
    strike: { textDecorationLine: 'line-through', color: c.subtle },
    trial: { color: isDark ? c.green : '#0b7a57', fontFamily: fonts.extraBold },
    cmp: { backgroundColor: c.yellowBg, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
    cmpText: { fontFamily: fonts.extraBold, fontSize: 11.5, color: c.yellowText },
  })
}
