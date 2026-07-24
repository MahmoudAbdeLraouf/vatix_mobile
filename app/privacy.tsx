import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, spacing, radius, shadow } from '@/constants/theme'

interface Section {
  t: string
  b: string
}

const SECTIONS_AR: Section[] = [
  {
    t: 'البيانات التي نجمعها',
    b: 'نجمع المعلومات التي تقدمها عند التسجيل (الاسم، الهاتف، البريد) وبيانات الإعلانات التي تنشرها وإحصائيات الاستخدام.',
  },
  {
    t: 'كيف نستخدم بياناتك',
    b: 'نستخدم بياناتك لتقديم الخدمة وتحسين تجربتك وإرسال إشعارات ذات صلة ومنع الاحتيال وتحليل الأداء.',
  },
  {
    t: 'مشاركة البيانات',
    b: 'لا نبيع بياناتك لأطراف ثالثة. نشارك الحد الأدنى اللازم مع مزودي الخدمة (الدفع، الاتصالات) فقط لتقديم الخدمة.',
  },
  {
    t: 'حقوقك',
    b: 'يحق لك الاطلاع على بياناتك وتصحيحها وحذفها وتصديرها في أي وقت من خلال إعدادات حسابك.',
  },
  {
    t: 'ملفات تعريف الارتباط',
    b: 'نستخدم ملفات الكوكيز الضرورية لتشغيل الخدمة وملفات التحليل لتحسين الأداء. يمكنك التحكم بها من المتصفح.',
  },
  {
    t: 'تواصل معنا',
    b: 'لأي استفسار حول خصوصيتك: privacy@vatix.eg',
  },
]

const SECTIONS_EN: Section[] = [
  {
    t: 'Data We Collect',
    b: 'We collect the information you provide at registration (name, phone, email), the ads you publish, and usage statistics.',
  },
  {
    t: 'How We Use Your Data',
    b: 'We use your data to deliver the service, improve your experience, send relevant notifications, prevent fraud, and analyze performance.',
  },
  {
    t: 'Data Sharing',
    b: 'We do not sell your data to third parties. We share the minimum necessary with service providers (payments, communications) solely to deliver the service.',
  },
  {
    t: 'Your Rights',
    b: 'You have the right to access, correct, delete, and export your data at any time via your account settings.',
  },
  {
    t: 'Cookies',
    b: 'We use essential cookies to operate the service and analytics cookies to improve performance. You can manage them from your browser.',
  },
  {
    t: 'Contact Us',
    b: 'For any question about your privacy: privacy@vatix.eg',
  },
]

export default function PrivacyScreen() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const sections = ar ? SECTIONS_AR : SECTIONS_EN

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: ar ? 'سياسة الخصوصية' : 'Privacy',
          headerStyle: { backgroundColor: colors.white },
          headerTitleStyle: { fontFamily: fonts.black, color: colors.dk },
          headerTintColor: colors.dk,
        }}
      />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.hero}>
          <Text style={s.heroTitle}>{ar ? 'سياسة الخصوصية 🔒' : 'Privacy Policy 🔒'}</Text>
          <Text style={s.heroSub}>
            {ar ? 'آخر تحديث: مايو ٢٠٢٥' : 'Last updated: May 2025'}
          </Text>
        </View>

        <View style={s.list}>
          {sections.map((sec, i) => (
            <View key={i} style={s.card}>
              <Text style={s.title}>
                {ar ? `${toArDigits(i + 1)}. ${sec.t}` : `${i + 1}. ${sec.t}`}
              </Text>
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  scroll: { paddingBottom: spacing.xl },
  hero: {
    backgroundColor: colors.dk,
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
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    ...shadow.ss,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.dk,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g600,
    lineHeight: 26,
  },
})
