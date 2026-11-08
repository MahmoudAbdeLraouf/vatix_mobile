// Monthly Bro offer cap reached (mockups/store-upsell-implemented.html §8): switch
// to a store (recommended, unlimited offers) or buy an extra-offers pack.
// Used by BroOfferSheet; mirrors the website BroOfferCapPicks.
import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { fonts, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { useLocale } from '@/contexts/locale'
import { Button } from '@/components/ui/Button'
import { StoreValueChips } from '@/components/StoreValue'
import { IS_IOS, PAID_UI_ENABLED } from '@/lib/platform'
import { getClientOfferPacks, type ClientOfferPack } from '@/lib/api'
import { fmtPrice, svText, useStoreValueParams, type StoreValueItemKey } from '@/lib/storeValue'

const STORE_KEYS: readonly StoreValueItemKey[] = ['offers', 'products', 'gift', 'page', 'verified', 'analytics']

/** iOS sells only the packs that have an IAP SKU (same rule as buy-offers). */
const iosSellable = (n: number) => n === 50 || n === 100

export function BroOfferCapPicks({
  cap,
  resetsAt,
  onUpgrade,
  onBuyPack,
}: {
  cap: number
  resetsAt?: string
  onUpgrade: () => void
  onBuyPack: (packId: number) => void
}) {
  const { colors, isDark } = useTheme()
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const p = useStoreValueParams()
  const sv = t.storeValue
  const dirStyle = { writingDirection: ar ? ('rtl' as const) : ('ltr' as const), textAlign: 'auto' as const }

  const [packs, setPacks] = useState<ClientOfferPack[]>([])
  useEffect(() => {
    let alive = true
    getClientOfferPacks()
      .then((list) => {
        if (!alive || !Array.isArray(list)) return
        const sellable = IS_IOS ? list.filter((x) => iosSellable(x.offerCount)) : list
        setPacks([...sellable].sort((a, b) => a.offerCount - b.offerCount).slice(0, 2))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const resetLabel = useMemo(() => {
    if (!resetsAt) return null
    const d = new Date(resetsAt)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long' })
  }, [resetsAt, ar])

  return (
    <View>
      <Text style={[styles.title, dirStyle]}>{svText(sv, 'offerCapTitle', p, locale, { cap })}</Text>
      <Text style={[styles.sub, dirStyle]}>
        {resetLabel ? svText(sv, 'offerCapSub', p, locale, { date: resetLabel }) : sv.offerCapSubNoDate}
      </Text>

      <View style={[styles.pick, styles.pickRec, { marginTop: 16 }]}>
        <View style={[styles.rib, ar ? { right: 12 } : { left: 12 }]}>
          <Text style={styles.ribText}>{sv.capRibbon}</Text>
        </View>
        <Text style={[styles.pickTitle, dirStyle]}>{sv.capConvertTitle}</Text>
        <StoreValueChips params={p} short giftFull order={STORE_KEYS} />
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
        <Button label={sv.offerCapConvertCta} variant="y" size="sm" onPress={onUpgrade} style={{ marginTop: 4 }} />
      </View>

      {packs.length ? (
        <View style={[styles.pick, { marginTop: 10 }]}>
          <Text style={[styles.pickTitle, dirStyle]}>{sv.offerCapPacksTitle}</Text>
          {packs.map((pk) => (
            <Pressable
              key={pk.id}
              onPress={() => onBuyPack(pk.id)}
              accessibilityRole="button"
              hitSlop={4}
            >
              <Text style={[styles.packLine, dirStyle]}>
                {svText(sv, PAID_UI_ENABLED ? 'offerCapPackLine' : 'offerCapPackLineIos', p, locale, {
                  count: pk.offerCount,
                  packPrice: Number(pk.price),
                })}
              </Text>
            </Pressable>
          ))}
          <Text style={[styles.note, dirStyle]}>{sv.offerCapPacksNote}</Text>
          <Button
            label={sv.offerCapPacksBuy}
            variant="outline"
            size="sm"
            fullWidth={false}
            onPress={() => onBuyPack(packs[0].id)}
          />
        </View>
      ) : null}

      {PAID_UI_ENABLED ? (
        <View style={[styles.cmp, { marginTop: 10 }]}>
          <Text style={[styles.cmpText, dirStyle]}>
            {svText(sv, p.trialDays > 0 ? 'offerCapCompareTrial' : 'offerCapCompare', p, locale, { offers: cap })}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function makeStyles(c: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    title: { fontFamily: fonts.black, fontSize: 15.5, color: '#dc2626' },
    sub: { fontFamily: fonts.semiBold, fontSize: 12.5, color: isDark ? c.muted : c.g600, marginTop: 4, lineHeight: 19 },
    pick: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      padding: 14,
      gap: 6,
      backgroundColor: c.card,
    },
    pickRec: { borderWidth: 2, borderColor: c.y, backgroundColor: c.yellowBg, paddingTop: 16 },
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
    strike: { textDecorationLine: 'line-through', color: c.subtle },
    trial: { color: isDark ? c.green : '#0b7a57', fontFamily: fonts.extraBold },
    packLine: { fontFamily: fonts.extraBold, fontSize: 13.5, color: c.heading },
    note: { fontFamily: fonts.semiBold, fontSize: 12, color: isDark ? c.muted : c.g600 },
    cmp: { backgroundColor: c.yellowBg, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
    cmpText: { fontFamily: fonts.extraBold, fontSize: 11.5, color: c.yellowText },
  })
}
