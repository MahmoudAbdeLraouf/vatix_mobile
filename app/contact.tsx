import { useEffect, useState } from 'react'
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale } from '@/contexts/locale'
import { getSiteSettings, type SiteSettings } from '@/lib/api'
import { authErrorMessage } from '@/lib/auth'
import { colors, fonts, spacing, radius, shadow } from '@/constants/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005'

type MethodKey = 'email' | 'phone' | 'whatsapp' | 'twitter'

interface Method {
  key: MethodKey
  icon: string
  title: string
  value: string
  href: string
  sub: string
  color: string
  bg: string
  border: string
}

export default function ContactScreen() {
  const { locale, t } = useLocale()
  const ar = locale === 'ar'

  const [settings, setSettings] = useState<SiteSettings | null>(null)

  useEffect(() => {
    let alive = true
    getSiteSettings()
      .then((s) => {
        if (alive) setSettings(s)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const methods: Method[] = []
  const email = settings?.email
  const phone = settings?.phone
  const whatsapp = settings?.whatsapp
  const twitter = settings?.twitter

  if (email) {
    methods.push({
      key: 'email',
      icon: '📧',
      title: ar ? 'راسلنا بريدياً' : 'Email us',
      value: email,
      href: `mailto:${email}`,
      sub: ar ? 'رد خلال ٢٤ ساعة' : 'Reply within 24h',
      color: '#B45309',
      bg: '#FFFBEB',
      border: '#FDE68A',
    })
  }
  if (phone) {
    methods.push({
      key: 'phone',
      icon: '📞',
      title: ar ? 'اتصل بنا' : 'Call us',
      value: phone,
      href: `tel:${phone}`,
      sub: ar ? 'من ٩ صباحاً - ٦ مساءً' : '9 AM - 6 PM',
      color: '#1D4ED8',
      bg: '#EFF6FF',
      border: '#BFDBFE',
    })
  }
  if (whatsapp) {
    const digits = whatsapp.replace(/\D/g, '')
    methods.push({
      key: 'whatsapp',
      icon: '💬',
      title: ar ? 'واتساب' : 'WhatsApp',
      value: whatsapp,
      href: `https://wa.me/${digits}`,
      sub: ar ? 'رد فوري' : 'Instant reply',
      color: '#047857',
      bg: '#ECFDF5',
      border: '#A7F3D0',
    })
  }
  if (twitter) {
    methods.push({
      key: 'twitter',
      icon: '𝕏',
      title: ar ? 'تابعنا' : 'Follow us',
      value: twitter.startsWith('http') ? twitter.replace(/^https?:\/\//, '') : twitter,
      href: twitter.startsWith('http') ? twitter : `https://x.com/${twitter.replace(/^@/, '')}`,
      sub: ar ? 'آخر الأخبار' : 'Latest news',
      color: colors.dk,
      bg: colors.g100,
      border: colors.g300,
    })
  }

  const SUBJECTS = ar
    ? ['استفسار عام', 'مشكلة تقنية', 'شكوى إعلان', 'طلب شراكة']
    : ['General Inquiry', 'Technical Issue', 'Ad Complaint', 'Partnership Request']

  const [name, setName] = useState('')
  const [emailField, setEmailField] = useState('')
  const [phoneField, setPhoneField] = useState('')
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const onSubmit = async () => {
    setError(null)
    if (!name.trim() || !emailField.trim() || !message.trim()) {
      setError(t.fillRequiredFields)
      return
    }
    if (message.trim().length < 5) {
      setError(t.messageTooShort)
      return
    }
    setSending(true)
    try {
      const res = await fetch(`${API_URL}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: emailField.trim(),
          phone: phoneField.trim() || undefined,
          subject,
          message: message.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message ?? t.somethingWentWrong
        throw new Error(msg)
      }
      setSuccess(true)
      setName('')
      setEmailField('')
      setPhoneField('')
      setMessage('')
      setSubject(SUBJECTS[0])
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
      setSending(false)
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: ar ? 'تواصل معنا' : 'Contact',
          headerStyle: { backgroundColor: colors.white },
          headerTitleStyle: { fontFamily: fonts.black, color: colors.dk },
          headerTintColor: colors.dk,
        }}
      />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <Text style={s.heroEmoji}>💬</Text>
          <Text style={s.heroTitle}>{ar ? 'تواصل معنا' : 'Contact Us'}</Text>
          <Text style={s.heroSub}>
            {ar
              ? 'نحن هنا لمساعدتك. أرسل لنا استفسارك وسنرد في أقرب وقت.'
              : "We're here to help. Send us your inquiry and we'll get back to you soon."}
          </Text>
        </View>

        {methods.length > 0 && (
          <View style={s.methods}>
            {methods.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => Linking.openURL(m.href).catch(() => {})}
                style={({ pressed }) => [
                  s.methodCard,
                  { backgroundColor: m.bg, borderColor: m.border },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={s.methodIcon}>{m.icon}</Text>
                <Text style={[s.methodTitle, { color: m.color }]}>{m.title}</Text>
                <Text style={[s.methodValue, { color: m.color }]} numberOfLines={1}>
                  {m.value}
                </Text>
                <Text style={s.methodSub}>{m.sub}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {methods.length > 0 && (
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>
              {ar ? 'أو أرسل لنا رسالة مباشرة' : 'or send us a message directly'}
            </Text>
            <View style={s.dividerLine} />
          </View>
        )}

        <View style={s.formCard}>
          {success ? (
            <View style={s.successBox}>
              <Text style={s.successEmoji}>✅</Text>
              <Text style={s.successTitle}>
                {ar ? 'تم إرسال رسالتك!' : 'Message sent!'}
              </Text>
              <Text style={s.successBody}>
                {ar
                  ? 'سنرد عليك في أقرب وقت ممكن.'
                  : "We'll get back to you as soon as possible."}
              </Text>
              <View style={{ height: spacing.md }} />
              <Button
                label={ar ? 'إرسال رسالة أخرى' : 'Send another message'}
                variant="outline"
                size="md"
                onPress={() => setSuccess(false)}
              />
            </View>
          ) : (
            <>
              <Text style={s.formTitle}>{ar ? 'أرسل رسالة ✉️' : 'Send a Message ✉️'}</Text>

              <View style={{ gap: spacing.sm }}>
                <Input
                  label={ar ? 'الاسم' : 'Name'}
                  value={name}
                  onChangeText={setName}
                  maxLength={100}
                  placeholder={ar ? 'اسمك الكامل' : 'Your full name'}
                />
                <Input
                  label={ar ? 'البريد الإلكتروني' : 'Email'}
                  value={emailField}
                  onChangeText={setEmailField}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="you@example.com"
                  // Email addresses render LTR regardless of UI locale.
                  style={{ textAlign: 'left', writingDirection: 'ltr' }}
                />
                <Input
                  label={ar ? 'الهاتف (اختياري)' : 'Phone (optional)'}
                  value={phoneField}
                  onChangeText={setPhoneField}
                  keyboardType="phone-pad"
                  maxLength={20}
                  placeholder={ar ? '+٢٠١xxxxxxxxx' : '+201xxxxxxxxx'}
                  // Phone numbers render LTR regardless of UI locale.
                  style={{ textAlign: 'left', writingDirection: 'ltr' }}
                />

                <View>
                  <Text style={s.fieldLabel}>{ar ? 'الموضوع' : 'Subject'}</Text>
                  <View style={s.chipRow}>
                    {SUBJECTS.map((sj) => {
                      const active = sj === subject
                      return (
                        <Pressable
                          key={sj}
                          onPress={() => setSubject(sj)}
                          style={({ pressed }) => [
                            s.chip,
                            active && s.chipActive,
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Text style={[s.chipText, active && s.chipTextActive]}>{sj}</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>

                <View>
                  <Text style={s.fieldLabel}>{ar ? 'الرسالة' : 'Message'}</Text>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={6}
                    maxLength={2000}
                    placeholder={
                      ar ? 'اكتب رسالتك هنا...' : 'Write your message here...'
                    }
                    placeholderTextColor={colors.g400}
                    textAlignVertical="top"
                    style={[
                      s.textarea,
                      { textAlign: ar ? 'right' : 'left' },
                    ]}
                  />
                  <Text style={[s.counter, { textAlign: ar ? 'left' : 'right' }]}>
                    {message.length}/2000
                  </Text>
                </View>

                {error && <Text style={s.errorText}>{error}</Text>}

                <View style={{ marginTop: spacing.sm }}>
                  <Button
                    label={
                      sending
                        ? ar
                          ? 'جاري الإرسال...'
                          : 'Sending...'
                        : ar
                          ? 'إرسال الرسالة ←'
                          : 'Send Message →'
                    }
                    variant="y"
                    size="lg"
                    loading={sending}
                    onPress={onSubmit}
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {!settings && (
          <View style={s.loaderBar}>
            <ActivityIndicator color={colors.dk} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.g100 },
  scroll: { paddingBottom: spacing.xl },
  hero: {
    backgroundColor: colors.dk,
    paddingVertical: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  heroEmoji: { fontSize: 44, marginBottom: spacing.sm },
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
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 520,
  },
  methods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  methodCard: {
    flexGrow: 1,
    minWidth: '46%',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingVertical: 22,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  methodIcon: { fontSize: 28, marginBottom: 6 },
  methodTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    marginBottom: 2,
    textAlign: 'center',
  },
  methodValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
  },
  methodSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g600,
    marginTop: 6,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.g300,
  },
  dividerText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    ...shadow.ss,
  },
  formTitle: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.dk,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dk,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.g300,
    backgroundColor: colors.white,
  },
  chipActive: {
    borderColor: colors.dk,
    backgroundColor: colors.dk,
  },
  chipText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g700,
  },
  chipTextActive: {
    color: colors.white,
  },
  textarea: {
    minHeight: 130,
    borderWidth: 1.5,
    borderColor: colors.g300,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.dk,
    backgroundColor: colors.white,
  },
  counter: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
    marginTop: 4,
  },
  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.red,
    marginTop: spacing.xs,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  successEmoji: { fontSize: 44, marginBottom: spacing.sm },
  successTitle: {
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.dk,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  successBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    textAlign: 'center',
    lineHeight: 22,
  },
  loaderBar: {
    padding: spacing.md,
    alignItems: 'center',
  },
})
