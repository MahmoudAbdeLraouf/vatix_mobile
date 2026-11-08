import React, { useMemo } from 'react'
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
import { PAID_UI_ENABLED } from '@/lib/platform'
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

// Account-type chooser (mockups/store-upsell-system.html §1): the store card is
// the hero (all value items, price, trial); the client card stays small and honest.
export default function RegisterScreen() {
  const { t, locale, isRtl, setLocale } = useLocale()
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const { ar, rowDir, colDir, dirStyle } = useDir()
  const p = useStoreValueParams()
  const sv = t.storeValue

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

          {/* Client — small and honest */}
          <Pressable
            style={({ pressed }) => [styles.clientCard, rowDir, pressed && { opacity: 0.85 }]}
            onPress={() => go('/(auth)/signup-client')}
          >
            <View style={styles.typeIconWrap}>
              <Ionicons name="person-outline" size={20} color={isDark ? colors.y : colors.dk} />
            </View>
            <View style={[{ flex: 1 }, colDir]}>
              <Text style={[styles.clientLabel, dirStyle]}>{sv.regClientTitle}</Text>
              <Text style={[styles.typeMeta, dirStyle]}>{svText(sv, 'regClientMeta', p, locale)}</Text>
            </View>
            <Ionicons
              name={ar ? 'chevron-back' : 'chevron-forward'}
              size={18}
              color={colors.subtle}
            />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.yellowBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconStore: { backgroundColor: colors.y },
  typeLabel: { fontFamily: fonts.black, fontSize: 16, color: colors.heading },
  clientLabel: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.heading },
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
