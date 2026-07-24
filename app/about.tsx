import { useEffect, useState } from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { Stack, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { getProducts, getStores } from '@/lib/api'
import { colors, fonts, spacing, radius, shadow } from '@/constants/theme'
import { Button } from '@/components/ui/Button'

interface Stat {
  n: string
  l: string
}

interface Value {
  emoji: string
  title: string
  body: string
}

export default function AboutScreen() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const nfmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-EG')

  const [totalAds, setTotalAds] = useState<number>(0)
  const [storeCount, setStoreCount] = useState<number>(0)

  useEffect(() => {
    let alive = true
    Promise.allSettled([getProducts({ limit: 1, sort: 'newest' }), getStores()]).then(
      ([productsRes, storesRes]) => {
        if (!alive) return
        if (productsRes.status === 'fulfilled') {
          setTotalAds(productsRes.value.meta.total)
        }
        if (storesRes.status === 'fulfilled') {
          setStoreCount(storesRes.value.length)
        }
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const roundedAds = totalAds < 100 ? totalAds : Math.round(totalAds / 100) * 100
  const displayStores = storeCount || 850
  const founded = ar ? '٢٠٢٦' : '2026'
  const usersLabel = ar ? '+٢K' : '+2K'

  const stats: Stat[] = ar
    ? [
        { n: `+${nfmt(roundedAds)}`, l: 'إعلان نشط' },
        { n: `+${nfmt(displayStores)}`, l: 'متجر موثّق' },
        { n: usersLabel, l: 'مستخدم' },
        { n: founded, l: 'سنة التأسيس' },
      ]
    : [
        { n: `+${nfmt(roundedAds)}`, l: 'Active Ads' },
        { n: `+${nfmt(displayStores)}`, l: 'Verified Stores' },
        { n: usersLabel, l: 'Users' },
        { n: founded, l: 'Founded' },
      ]

  const values: Value[] = ar
    ? [
        { emoji: '🎯', title: 'الشفافية', body: 'كل صفقة تتم بوضوح كامل. لا رسوم مخفية، لا مفاجآت.' },
        { emoji: '⚡', title: 'السرعة', body: 'انشر إعلانك أو ابحث عن منتجك في أقل من دقيقة.' },
        { emoji: '🛡️', title: 'الأمان', body: 'كل التجار موثّقون. تقييمات المستخدمين تحمي المشترين.' },
      ]
    : [
        { emoji: '🎯', title: 'Transparency', body: 'Every deal happens in full clarity. No hidden fees, no surprises.' },
        { emoji: '⚡', title: 'Speed', body: 'Post your ad or find your product in less than a minute.' },
        { emoji: '🛡️', title: 'Safety', body: 'All merchants are verified. User ratings protect buyers.' },
      ]

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: ar ? 'من نحن' : 'About',
          headerStyle: { backgroundColor: colors.white },
          headerTitleStyle: { fontFamily: fonts.black, color: colors.dk },
          headerTintColor: colors.dk,
        }}
      />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.hero}>
          <Text style={s.heroEmoji}>🏢</Text>
          <Text style={s.heroTitle}>{ar ? 'من نحن' : 'About Vatix'}</Text>
          <Text style={s.heroSub}>
            {ar
              ? 'فاتكس هو أول سوق إلكتروني متخصص في الأجهزة الإلكترونية بمصر. نربط المشترين بالتجار الموثوقين بسهولة وشفافية.'
              : 'Vatix is Egypt’s first marketplace dedicated to electronics. We connect buyers with trusted merchants with ease and transparency.'}
          </Text>
        </View>

        <View style={s.statsBar}>
          {stats.map((st, i) => (
            <View key={i} style={s.statCell}>
              <Text style={s.statN} numberOfLines={1}>
                {st.n}
              </Text>
              <Text style={s.statL} numberOfLines={2}>
                {st.l}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.h2}>{ar ? 'قيمنا' : 'Our Values'}</Text>
          <View style={s.valuesGrid}>
            {values.map((v, i) => (
              <View key={i} style={s.valueCard}>
                <Text style={s.valueEmoji}>{v.emoji}</Text>
                <Text style={s.valueTitle}>{v.title}</Text>
                <Text style={s.valueBody}>{v.body}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.missionCard}>
          <Text style={s.missionTitle}>{ar ? '🚀 مهمتنا' : '🚀 Our Mission'}</Text>
          <Text style={s.missionBody}>
            {ar
              ? 'نسعى لجعل شراء وبيع الإلكترونيات في مصر تجربة موثوقة، سريعة، وممتعة. نقدم منصة تجمع بين البسطاء والتجار في مكان واحد آمن.'
              : 'We aim to make buying and selling electronics in Egypt a trusted, fast, and delightful experience. Our platform brings individuals and merchants together in one safe space.'}
          </Text>
        </View>

        <View style={s.ctaCard}>
          <Text style={s.ctaTitle}>{ar ? 'انضم إلينا اليوم' : 'Join Us Today'}</Text>
          <Text style={s.ctaBody}>
            {ar
              ? 'ابدأ رحلتك مع فاتكس، سواء كنت مشترياً أو تاجراً.'
              : 'Start your journey with Vatix, whether you’re a buyer or a merchant.'}
          </Text>
          <View style={s.ctaButtons}>
            <Button
              label={ar ? 'ابدأ الآن' : 'Get Started'}
              variant="y"
              size="lg"
              onPress={() => router.push('/(auth)/register')}
            />
            <Button
              label={ar ? 'تواصل معنا' : 'Contact Us'}
              variant="outline"
              size="lg"
              onPress={() => router.push('/contact' as never)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  scroll: { paddingBottom: spacing.xl },
  hero: {
    backgroundColor: colors.dk,
    paddingVertical: 48,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  heroEmoji: { fontSize: 44, marginBottom: spacing.sm },
  heroTitle: {
    fontFamily: fonts.black,
    fontSize: 28,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 560,
  },
  statsBar: {
    backgroundColor: colors.dk2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  statCell: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statN: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: colors.y,
    textAlign: 'center',
  },
  statL: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginTop: 2,
  },
  section: {
    padding: spacing.md,
  },
  h2: {
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.dk,
    marginBottom: spacing.md,
  },
  valuesGrid: {
    gap: spacing.sm,
  },
  valueCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    ...shadow.ss,
  },
  valueEmoji: { fontSize: 32, marginBottom: spacing.sm },
  valueTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.dk,
    marginBottom: 4,
  },
  valueBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    lineHeight: 22,
  },
  missionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...shadow.ss,
  },
  missionTitle: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.dk,
    marginBottom: spacing.sm,
  },
  missionBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g600,
    lineHeight: 24,
  },
  ctaCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    alignItems: 'center',
    ...shadow.ss,
  },
  ctaTitle: {
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.dk,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  ctaBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  ctaButtons: {
    width: '100%',
    gap: spacing.sm,
  },
})
