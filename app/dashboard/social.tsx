import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLocale } from '@/contexts/locale'
import { authFetch, authPatch } from '@/lib/auth'
import type { UserProfile } from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type Msg = { ok: boolean; text: string } | null

type SocialKey = 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'youtube' | 'linkedin'

const SOCIALS: {
  key: SocialKey
  label: string
  ph: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  color: string
}[] = [
  { key: 'instagram', label: 'Instagram',   ph: 'https://instagram.com/…', icon: 'logo-instagram', color: '#E1306C' },
  { key: 'facebook',  label: 'Facebook',    ph: 'https://facebook.com/…',  icon: 'logo-facebook',  color: '#1877F2' },
  { key: 'twitter',   label: 'X / Twitter', ph: 'https://x.com/…',         icon: 'logo-twitter',   color: '#000000' },
  { key: 'tiktok',    label: 'TikTok',      ph: 'https://tiktok.com/@…',   icon: 'logo-tiktok',    color: '#010101' },
  { key: 'youtube',   label: 'YouTube',     ph: 'https://youtube.com/…',   icon: 'logo-youtube',   color: '#FF0000' },
  { key: 'linkedin',  label: 'LinkedIn',    ph: 'https://linkedin.com/…',  icon: 'logo-linkedin',  color: '#0A66C2' },
]

export default function SocialScreen() {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const dirContainer = ar ? { direction: 'rtl' as const } : null

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const [values, setValues] = useState<Record<SocialKey, string>>({
    instagram: '',
    facebook: '',
    twitter: '',
    tiktok: '',
    youtube: '',
    linkedin: '',
  })

  useEffect(() => {
    authFetch<UserProfile>('/user/profile')
      .then(data => {
        if (!data) return
        setProfile(data)
        const sp = data.storeProfile
        if (sp) {
          setValues({
            instagram: sp.instagram ?? '',
            facebook: sp.facebook ?? '',
            twitter: sp.twitter ?? '',
            tiktok: sp.tiktok ?? '',
            youtube: sp.youtube ?? '',
            linkedin: sp.linkedin ?? '',
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      await authPatch('/social/me', {
        instagram: values.instagram.trim() || null,
        facebook: values.facebook.trim() || null,
        twitter: values.twitter.trim() || null,
        tiktok: values.tiktok.trim() || null,
        youtube: values.youtube.trim() || null,
        linkedin: values.linkedin.trim() || null,
      })
      setMsg({
        ok: true,
        text: ar ? 'تم حفظ الروابط بنجاح ✓' : 'Social links saved successfully ✓',
      })
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof Error ? err.message : ar ? 'حدث خطأ أثناء الحفظ' : 'Save failed',
      })
    } finally {
      setSaving(false)
    }
  }

  const setField = (key: SocialKey) => (v: string) =>
    setValues(prev => ({ ...prev, [key]: v }))

  return (
    <DashboardLayout title={t.socialMedia}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.y} size="large" />
            </View>
          ) : !profile?.storeProfile ? (
            <View style={styles.card}>
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>📱</Text>
                <Text style={[styles.emptyText, { textAlign: 'center' }]}>
                  {ar
                    ? 'هذه الصفحة متاحة فقط لأصحاب المتاجر.'
                    : 'This page is only available for store owners.'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { textAlign: ar ? 'right' : 'left', writingDirection: ar ? 'rtl' : 'ltr' }]}>
                {ar ? 'روابط التواصل الاجتماعي 📱' : 'Social Media Links 📱'}
              </Text>
              <Text style={[styles.hint, { textAlign: ar ? 'right' : 'left', writingDirection: ar ? 'rtl' : 'ltr' }]}>
                {ar
                  ? 'أضف روابط حساباتك على منصات التواصل الاجتماعي لتظهر في صفحة متجرك.'
                  : 'Add your social media profile links to display them on your store page.'}
              </Text>

              {SOCIALS.map(({ key, label, ph, icon, color }) => (
                <Input
                  key={key}
                  label={label}
                  value={values[key]}
                  onChangeText={setField(key)}
                  placeholder={ph}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  // Social URLs render LTR regardless of UI locale.
                  style={{ textAlign: 'left', writingDirection: 'ltr' }}
                  leftIcon={<Ionicons name={icon} size={18} color={color} />}
                />
              ))}

              {msg && (
                <View
                  style={[
                    styles.msgBox,
                    dirContainer,
                    {
                      backgroundColor: msg.ok ? colors.gl : colors.rl,
                      borderColor: msg.ok ? colors.green : colors.red,
                    },
                  ]}
                >
                  <Ionicons
                    name={msg.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                    size={16}
                    color={msg.ok ? colors.green : colors.red}
                  />
                  <Text style={[styles.msgText, { color: msg.ok ? colors.green : colors.red }]}>
                    {msg.text}
                  </Text>
                </View>
              )}

              <Button
                label={ar ? 'حفظ الروابط' : 'Save Links'}
                onPress={handleSave}
                loading={saving}
              />
            </View>
          )}
        </ScrollView>
    </DashboardLayout>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    ...shadow.ss,
  },
  cardTitle: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.dk,
    marginBottom: spacing.xs,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
    marginBottom: spacing.lg,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g500,
    paddingHorizontal: spacing.md,
  },
  msgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  msgText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
})
