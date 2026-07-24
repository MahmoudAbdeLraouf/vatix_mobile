import { useState } from 'react'
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native'
import { Stack, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '@/contexts/locale'
import { colors, fonts, spacing, radius, shadow } from '@/constants/theme'
import { Button } from '@/components/ui/Button'

interface QA {
  q: string
  a: string
}

const FAQS_AR: QA[] = [
  { q: 'كيف أضيف إعلاناً؟', a: 'اضغط على "إضافة إعلان" من القائمة العلوية، ثم اتبع خطوات النموذج السهل.' },
  { q: 'هل النشر مجاني؟', a: 'نعم، النشر الأساسي مجاني تماماً. يمكنك ترويج إعلانك للوصول لأكبر عدد.' },
  { q: 'كيف أتواصل مع البائع؟', a: 'من خلال زر الاتصال أو المراسلة في صفحة الإعلان.' },
  { q: 'كيف أحوّل حسابي إلى متجر؟', a: 'من لوحة التحكم > الإعدادات > ترقية إلى متجر، أو من خلال صفحة الأسعار.' },
  { q: 'ما الفرق بين المتجر وStore Plus؟', a: 'Store Plus يوفر ترتيباً أعلى في نتائج البحث وشارة مميزة وإحصائيات متقدمة.' },
  { q: 'كيف أشحن المحفظة؟', a: 'من لوحة التحكم > المحفظة > شحن الرصيد، ندعم بطاقات Visa وMastercard وInstaPay.' },
  { q: 'كيف أبلّغ عن إعلان مخالف؟', a: 'في صفحة الإعلان توجد خيار "الإبلاغ"، سنراجع الأمر خلال ٢٤ ساعة.' },
]

const FAQS_EN: QA[] = [
  { q: 'How do I post an ad?', a: 'Tap "Add Ad" from the top menu, then follow the simple form steps.' },
  { q: 'Is posting free?', a: 'Yes, basic posting is completely free. You can promote your ad to reach more people.' },
  { q: 'How do I contact the seller?', a: 'Use the call or message button on the product page.' },
  { q: 'How do I convert my account to a store?', a: 'From Dashboard > Settings > Upgrade to Store, or via the Pricing page.' },
  { q: 'What is the difference between Store and Store Plus?', a: 'Store Plus offers higher search ranking, a premium badge, and advanced analytics.' },
  { q: 'How do I top up my wallet?', a: 'From Dashboard > Wallet > Top Up. We support Visa, Mastercard, and InstaPay.' },
  { q: 'How do I report a violating ad?', a: 'On the product page you\'ll find a "Report" option. We review within 24 hours.' },
]

function FAQItem({ q, a }: QA) {
  const [open, setOpen] = useState(false)
  return (
    <View style={s.faqCard}>
      <Pressable onPress={() => setOpen((o) => !o)} style={s.faqHead}>
        <Text style={s.faqQ}>{q}</Text>
        <Ionicons name={open ? 'remove' : 'add'} size={22} color={colors.yd} />
      </Pressable>
      {open && (
        <View style={s.faqBody}>
          <Text style={s.faqA}>{a}</Text>
        </View>
      )}
    </View>
  )
}

export default function FAQScreen() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const faqs = ar ? FAQS_AR : FAQS_EN

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: ar ? 'الأسئلة الشائعة' : 'FAQ',
          headerStyle: { backgroundColor: colors.white },
          headerTitleStyle: { fontFamily: fonts.black, color: colors.dk },
          headerTintColor: colors.dk,
        }}
      />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.hero}>
          <Text style={s.heroTitle}>{ar ? 'الأسئلة الشائعة ❓' : 'FAQ ❓'}</Text>
          <Text style={s.heroSub}>
            {ar ? 'هل لديك سؤال؟ قد تجد إجابته هنا.' : 'Have a question? You might find the answer here.'}
          </Text>
        </View>

        <View style={s.list}>
          {faqs.map((f, i) => (
            <FAQItem key={i} q={f.q} a={f.a} />
          ))}
        </View>

        <View style={s.ctaCard}>
          <Text style={s.ctaText}>{ar ? 'لم تجد إجابتك؟' : "Didn't find your answer?"}</Text>
          <Button
            label={ar ? 'تواصل مع الدعم' : 'Contact Support'}
            variant="y"
            size="md"
            onPress={() => router.push('/contact' as never)}
          />
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
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  faqCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    overflow: 'hidden',
    ...shadow.ss,
  },
  faqHead: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  faqQ: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
    flex: 1,
  },
  faqBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  faqA: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.g600,
    lineHeight: 24,
  },
  ctaCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.yl,
    borderWidth: 1.5,
    borderColor: colors.y,
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dk,
    textAlign: 'center',
  },
})
