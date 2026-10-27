import { useMemo } from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { fonts, spacing, radius, shadow, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

interface Section {
  t: string
  b: string
}

const SECTIONS_AR: Section[] = [
  {
    t: 'قبول الشروط',
    b: 'باستخدامك لمنصة VATIX فإنك توافق على الالتزام بجميع الشروط والأحكام المذكورة. إذا كنت لا توافق على أي بند، يرجى عدم استخدام الخدمة.',
  },
  {
    t: 'الحسابات والمسؤولية',
    b: 'أنت مسؤول عن الحفاظ على سرية بيانات حسابك وكلمة مرورك. تتحمل المسؤولية الكاملة عن جميع الأنشطة التي تتم من خلال حسابك.',
  },
  {
    t: 'الإعلانات والمحتوى',
    b: 'يجب أن تكون إعلاناتك دقيقة وصادقة. يُحظر نشر محتوى مضلل أو مخالف للقوانين أو المنتجات المقلدة أو المسروقة.',
  },
  {
    t: 'المدفوعات والاشتراكات',
    b: 'الباقات المدفوعة تُجدّد تلقائياً ما لم تُلغ قبل ٢٤ ساعة من تاريخ التجديد. المدفوعات غير قابلة للاسترداد بعد التفعيل.',
  },
  {
    t: 'الخصوصية وحماية البيانات',
    b: 'نلتزم بحماية بياناتك الشخصية وفقاً لسياسة الخصوصية المعتمدة وأحكام نظام حماية البيانات الشخصية.',
  },
  {
    t: 'إخلاء المسؤولية',
    b: 'VATIX وسيط تقني بين البائعين والمشترين ولا يتحمل مسؤولية المعاملات التجارية المباشرة بين الأطراف.',
  },
]

const SECTIONS_EN: Section[] = [
  {
    t: 'Acceptance of Terms',
    b: 'By using the VATIX platform you agree to abide by all stated terms and conditions. If you do not agree to any clause, please do not use the service.',
  },
  {
    t: 'Accounts & Responsibility',
    b: 'You are responsible for keeping your account details and password confidential. You bear full responsibility for all activity that occurs through your account.',
  },
  {
    t: 'Listings & Content',
    b: 'Your ads must be accurate and truthful. Misleading content, unlawful items, counterfeit or stolen products are strictly prohibited.',
  },
  {
    t: 'Payments & Subscriptions',
    b: 'Paid plans renew automatically unless cancelled at least 24 hours before the renewal date. Payments are non-refundable once activated.',
  },
  {
    t: 'Privacy & Data Protection',
    b: 'We commit to protecting your personal data in accordance with our published privacy policy and the applicable personal data protection law.',
  },
  {
    t: 'Disclaimer',
    b: 'VATIX is a technical intermediary between sellers and buyers and is not liable for direct commercial transactions between the parties.',
  },
]

export default function TermsScreen() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const sections = ar ? SECTIONS_AR : SECTIONS_EN
  const { colors, isDark } = useTheme()
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark])

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: ar ? 'الشروط والأحكام' : 'Terms',
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { fontFamily: fonts.black, color: colors.heading },
          headerTintColor: colors.heading,
        }}
      />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.hero}>
          <Text style={s.heroTitle}>{ar ? 'الشروط والأحكام 📋' : 'Terms & Conditions 📋'}</Text>
          <Text style={s.heroSub}>
            {ar ? 'آخر تحديث: مايو ٢٠٢٥' : 'Last updated: May 2025'}
          </Text>
        </View>

        <View style={s.list}>
          {sections.map((sec, i) => (
            <View key={i} style={s.card}>
              <View style={s.head}>
                <View style={s.badge}>
                  <Text style={s.badgeText}>{ar ? toArDigits(i + 1) : String(i + 1)}</Text>
                </View>
                <Text style={s.title}>{sec.t}</Text>
              </View>
              <Text style={s.body}>{sec.b}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function toArDigits(n: number): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  return String(n)
    .split('')
    .map((d) => map[Number(d)] ?? d)
    .join('')
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xl },
  hero: {
    backgroundColor: colors.hero,
    paddingVertical: 40,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  heroTitle: {
    fontFamily: fonts.black,
    fontSize: 26,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...(dark ? null : shadow.ss),
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.black,
    fontSize: 13,
    color: colors.dk,
  },
  title: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.heading,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 26,
  },
})
