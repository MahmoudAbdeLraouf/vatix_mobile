import React, { useEffect, useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { BottomTabBar } from '@/components/BottomTabBar'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'
import { StoreValueChips } from '@/components/StoreValue'
import { IS_IOS, PAID_UI_ENABLED } from '@/lib/platform'
import { fetchIosProducts } from '@/lib/iap'
import { SUBSCRIPTION_SKUS } from '@/lib/iap-products'
import { fmtPrice, svText, useStoreValueParams } from '@/lib/storeValue'

type SignupRoute = '/(auth)/signup-client' | '/(auth)/signup-store'

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

// Account-type chooser (mockups/register-price.html): store card carries the real
// price (plans on Android, StoreKit on iOS); the client card matches its weight.
export default function RegisterScreen() {
  const { t, locale, isRtl, setLocale } = useLocale()
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const p = useStoreValueParams()
  const sv = t.storeValue
  const [iosPrice, setIosPrice] = useState<string | null>(null)

  useEffect(() => {
    if (!IS_IOS) return
    let live = true
    fetchIosProducts(SUBSCRIPTION_SKUS, 'subs')
      .then(products => {
        const prod = products.find(x => x?.id === SUBSCRIPTION_SKUS[0]) ?? products[0]
        if (live && prod?.displayPrice) setIosPrice(prod.displayPrice)
      })
      .catch(e => console.warn('[IAP] register subs fetch threw:', e))
    return () => {
      live = false
    }
  }, [])

  const clientItems = [
    svText(sv, 'regClientCap', p, locale),
    ...(p.offersOn ? [svText(sv, 'regClientOffers', p, locale)] : []),
    sv.regClientSwitch,
  ]

  const go = (route: SignupRoute) =>
    router.push(redirect ? { pathname: route, params: { redirect } } : route)

  return (
    <SafeAreaView style={[styles.flex, { direction: isRtl ? 'rtl' : 'ltr' }]} edges={['top']}>
      {/* Navy hero */}
      <View style={styles.hero}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))}
          >
            <Ionicons
              name={isRtl ? 'arrow-forward-outline' : 'arrow-back-outline'}
              size={20}
              color={colors.white}
            />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            >
              <Ionicons name="globe-outline" size={20} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/dashboard/messages')}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/dashboard/notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.heroTitle, dirStyle]}>{sv.regTitle}</Text>
        <Text style={[styles.heroSubtitle, dirStyle]}>{sv.regSub}</Text>
      </View>

      {/* White card */}
      <View style={styles.card}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Store — recommended */}
          <Pressable
            style={({ pressed }) => [styles.storeCard, pressed && { opacity: 0.92 }]}
            onPress={() => go('/(auth)/signup-store')}
          >
            <View style={[styles.rib, ar ? { right: 14 } : { left: 14 }]}>
              <Text style={styles.ribText}>{sv.regStoreRibbon}</Text>
            </View>
            <View style={[styles.optHead, rowDir]}>
              <View style={[styles.typeIconWrap, styles.typeIconStore]}>
                <Ionicons name="storefront-outline" size={22} color={colors.dk} />
              </View>
              <View style={[{ flex: 1 }, colDir]}>
                <Text style={[styles.typeLabel, dirStyle]}>{sv.regStoreTitle}</Text>
                <Text style={[styles.typeMeta, dirStyle]}>{svText(sv, 'regStoreMeta', p, locale)}</Text>
              </View>
            </View>
            <StoreValueChips params={p} short />
            <View style={[styles.priceRow, rowDir]}>
              {PAID_UI_ENABLED ? (
                <Text style={[styles.priceText, dirStyle]}>
                  <Text style={styles.priceBig}>{fmtPrice(p.price)}</Text> {sv.perMonthShort}
                  {p.list > p.price ? (
                    <>
                      {' '}
                      <Text style={styles.strike}>{fmtPrice(p.list)}</Text>
                    </>
                  ) : null}
                </Text>
              ) : iosPrice ? (
                <Text style={[styles.priceText, dirStyle]}>
                  <Text style={styles.priceIos}>{iosPrice}</Text>
                  {sv.perMonthSlash}
                </Text>
              ) : (
                <Text style={[styles.priceText, dirStyle]}>{sv.iosStoreSub}</Text>
              )}
              {p.trialDays > 0 ? (
                <View style={styles.trialPill}>
                  <Text style={[styles.trialPillText, dirStyle]}>{svText(sv, 'trialPill', p, locale)}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>{sv.regStoreCta}</Text>
            </View>
          </Pressable>

          {/* Client — same weight as the store card */}
          <Pressable
            style={({ pressed }) => [styles.clientCard, pressed && { opacity: 0.85 }]}
            onPress={() => go('/(auth)/signup-client')}
          >
            <View style={[styles.optHead, rowDir]}>
              <View style={[styles.typeIconWrap, styles.typeIconClient]}>
                <Ionicons name="person-outline" size={21} color={isDark ? colors.y : colors.dk} />
              </View>
              <View style={[{ flex: 1 }, colDir]}>
                <Text style={[styles.typeLabel, dirStyle]}>{sv.regClientTitle}</Text>
                <Text style={[styles.typeMeta, dirStyle]}>{sv.regClientSub}</Text>
              </View>
            </View>
            <View style={styles.list}>
              {clientItems.map(item => (
                <View key={item} style={[styles.listRow, rowDir]}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={[styles.listText, dirStyle]}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.freeText, dirStyle]}>
              {sv.regFree} <Text style={styles.freeSmall}>{sv.regFreeForever}</Text>
            </Text>
            <View style={styles.outlineBtn}>
              <Text style={styles.outlineBtnText}>{sv.regClientCta}</Text>
            </View>
          </Pressable>

          <View style={styles.footer}>
            <Text style={[styles.footerText, dirStyle]}>{t.alreadyHaveAccount} </Text>
            <Link
              href={redirect ? { pathname: '/(auth)/login', params: { redirect } } : '/(auth)/login'}
              asChild
            >
              <Pressable>
                <Text style={[styles.link, dirStyle]}>{t.login}</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </View>

      <BottomTabBar />
    </SafeAreaView>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.hero },

  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: colors.white,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  scroll: { paddingTop: 6, paddingBottom: spacing.lg },

  storeCard: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.y,
    backgroundColor: dark ? colors.card : '#FFFCF0',
    padding: 16,
    paddingTop: 20,
    marginTop: 8,
    gap: 10,
    ...(dark ? null : shadow.ss),
  },
  rib: {
    position: 'absolute',
    top: -11,
    backgroundColor: colors.y,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 1,
  },
  ribText: { fontFamily: fonts.black, fontSize: 11, color: colors.dk },
  optHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  priceText: { fontFamily: fonts.bold, fontSize: 13, color: dark ? colors.muted : colors.g600 },
  priceBig: { fontFamily: fonts.black, fontSize: 22, color: colors.heading },
  priceIos: { fontFamily: fonts.black, fontSize: 20, color: colors.heading },
  strike: { textDecorationLine: 'line-through', color: colors.subtle },
  trialPill: {
    backgroundColor: dark ? 'rgba(16,185,129,0.16)' : '#E7F8F1',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  trialPillText: { fontFamily: fonts.extraBold, fontSize: 12, color: dark ? colors.green : '#0b7a57' },
  cta: {
    backgroundColor: colors.y,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ctaText: { fontFamily: fonts.black, fontSize: 15, color: colors.dk },

  clientCard: {
    marginTop: 14,
    padding: 16,
    gap: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconStore: { backgroundColor: colors.y },
  typeIconClient: {
    backgroundColor: dark ? colors.placeholder : colors.g100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeLabel: { fontFamily: fonts.black, fontSize: 16, color: colors.heading },
  list: { gap: 4 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  bullet: { fontFamily: fonts.bold, fontSize: 12, color: colors.subtle, lineHeight: 20 },
  listText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 20,
    color: dark ? colors.muted : colors.g600,
  },
  freeText: { fontFamily: fonts.black, fontSize: 20, color: colors.heading },
  freeSmall: { fontFamily: fonts.semiBold, fontSize: 12, color: dark ? colors.muted : colors.g600 },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: dark ? colors.y : colors.dk,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  outlineBtnText: { fontFamily: fonts.extraBold, fontSize: 14, color: dark ? colors.y : colors.dk },
  typeMeta: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.muted },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: spacing.lg,
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.y,
  },
})
