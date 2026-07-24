import React from 'react'
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

interface AccountTypeCard {
  icon: IoniconsName
  label: string
  description: string
  route: '/(auth)/signup-client' | '/(auth)/signup-store'
}

export default function RegisterScreen() {
  const { t, locale, isRtl, setLocale } = useLocale()
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()
  const dirStyle = { writingDirection: isRtl ? 'rtl' as const : 'ltr' as const }

  const cards: AccountTypeCard[] = [
    {
      icon: 'bag-handle-outline',
      label: t.iAmClient,
      description: t.clientDescription ?? '',
      route: '/(auth)/signup-client',
    },
    {
      icon: 'storefront-outline',
      label: t.iAmStore,
      description: t.storeDescription ?? '',
      route: '/(auth)/signup-store',
    },
  ]

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

        <Text style={[styles.heroTitle, dirStyle]}>{t.registerTitle}</Text>
        <Text style={[styles.heroSubtitle, dirStyle]}>{t.registerSubtitle}</Text>
      </View>

      {/* White card */}
      <View style={styles.card}>
        <View style={styles.cards}>
          {cards.map(item => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [styles.typeCard, pressed && { opacity: 0.85 }]}
              onPress={() =>
                router.push(
                  redirect ? { pathname: item.route, params: { redirect } } : item.route,
                )
              }
            >
              <View style={styles.typeIconWrap}>
                <Ionicons name={item.icon} size={32} color={colors.dk} />
              </View>
              <Text style={[styles.typeLabel, dirStyle]}>{item.label}</Text>
              {!!item.description && (
                <Text style={[styles.typeDesc, dirStyle]}>{item.description}</Text>
              )}
            </Pressable>
          ))}
        </View>

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
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.dk },

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
    backgroundColor: colors.white,
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  cards: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  typeCard: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.g300,
    ...shadow.sm,
  },
  typeIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
    textAlign: 'center',
  },
  typeDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g500,
    textAlign: 'center',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: spacing.lg,
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g600,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.y,
  },
})
