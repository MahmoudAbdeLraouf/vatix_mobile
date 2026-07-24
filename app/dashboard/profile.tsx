import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import type { UserProfile } from '@/lib/api'
import { authFetch, authPost } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type Msg = { ok: boolean; text: string } | null

export default function ProfileScreen() {
  const { t, locale } = useLocale()
  const { user, updateDisplayName } = useAuth()
  const ar = locale === 'ar'
  const isStore = user?.isStore ?? false

  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
  }
  const dirContainer = ar ? { direction: 'rtl' as const } : null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  async function loadProfile() {
    const data = await authFetch<UserProfile>('/user/profile')
    if (data) {
      setWhatsapp(data.whatsapp ?? '')
      if (isStore) {
        setStoreName(data.storeProfile?.name ?? '')
      } else {
        setFirstName(data.clientProfile?.firstName ?? '')
        setLastName(data.clientProfile?.lastName ?? '')
      }
    }
  }

  useEffect(() => {
    loadProfile().finally(() => setLoading(false))
  }, [isStore])

  async function handleSave() {
    setMsg(null)
    setSaving(true)
    try {
      if (isStore) {
        await authPost('/user/profile/store', {
          storeName: storeName.trim(),
        })
        await updateDisplayName(storeName.trim())
      } else {
        await authPost('/user/profile/client', {
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          whatsapp: whatsapp.trim() || null,
        })
        const newName = `${firstName.trim()} ${lastName.trim()}`.trim()
        await updateDisplayName(newName)
      }
      await loadProfile()
      setMsg({ ok: true, text: t.profileUpdated })
    } catch {
      setMsg({ ok: false, text: t.serverError })
    } finally {
      setSaving(false)
    }
  }

  const initials = (() => {
    const name = user?.displayName?.trim() ?? ''
    if (!name) return isStore ? 'S' : 'U'
    const parts = name.split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ''
    const second = parts[1]?.[0] ?? ''
    return (first + second).toUpperCase() || (isStore ? 'S' : 'U')
  })()

  return (
    <DashboardLayout title={t.profile}>
      <KeyboardAvoidingView
        style={[{ flex: 1 }, dirContainer]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.y} size="large" />
          </View>
        ) : (
          <View style={[styles.container, dirContainer]}>
            {/* Hero card */}
            <View style={styles.hero}>
              <View style={styles.heroAccent} />
              <View style={styles.heroInner}>
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                  <View style={styles.avatarBadge}>
                    <Ionicons
                      name={isStore ? 'business' : 'person'}
                      size={12}
                      color={colors.dk}
                    />
                  </View>
                </View>
                <View style={styles.heroMeta}>
                  <Text style={[styles.heroName, dirStyle]} numberOfLines={1}>
                    {user?.displayName ?? ''}
                  </Text>
                  <View style={styles.heroPhoneRow}>
                    <Ionicons name="call-outline" size={13} color={colors.g300} />
                    <Text style={[styles.heroPhone, dirStyle]} numberOfLines={1}>
                      {user?.phone ?? ''}
                    </Text>
                  </View>
                  <View style={styles.typePill}>
                    <Ionicons
                      name={isStore ? 'business-outline' : 'person-outline'}
                      size={12}
                      color={colors.dk}
                    />
                    <Text style={styles.typePillText}>
                      {isStore ? t.iAmStore : t.iAmClient}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Personal Info */}
            <View style={[styles.card, dirContainer]}>
              <SectionHeader
                icon={isStore ? 'business-outline' : 'person-outline'}
                title={t.personalInfo}
                dirStyle={dirStyle}
              />

              {isStore ? (
                <Input
                  label={t.storeName}
                  value={storeName}
                  onChangeText={setStoreName}
                  placeholder={t.storeName}
                  leftIcon={<Ionicons name="business-outline" size={18} color={colors.g400} />}
                />
              ) : (
                <View style={[styles.row2, dirContainer]}>
                  <View style={styles.col}>
                    <Input
                      label={t.firstName}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder={t.firstName}
                    />
                  </View>
                  <View style={styles.col}>
                    <Input
                      label={t.lastName}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder={t.lastName}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Contact Info */}
            <View style={[styles.card, dirContainer]}>
              <SectionHeader
                icon="call-outline"
                title={ar ? 'معلومات التواصل' : 'Contact Info'}
                dirStyle={dirStyle}
              />

              {/* Phone — read only */}
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, dirStyle]}>{t.phone}</Text>
                  <View style={styles.lockPill}>
                    <Ionicons name="lock-closed" size={10} color={colors.g500} />
                    <Text style={styles.lockPillText}>
                      {ar ? 'محمي' : 'Protected'}
                    </Text>
                  </View>
                </View>
                <View style={styles.readonly}>
                  <Ionicons name="call-outline" size={16} color={colors.g400} />
                  <Text style={[styles.readonlyText, dirStyle]}>
                    {user?.phone ?? ''}
                  </Text>
                </View>
                <View style={styles.hintRow}>
                  <Text style={[styles.hint, dirStyle]}>
                    {ar
                      ? 'للتغيير، تواصل مع الدعم.'
                      : 'Contact support to change your phone number.'}
                  </Text>
                </View>
              </View>

              {/* WhatsApp — client only (backend store DTO strips it) */}
              {!isStore && (
                <View style={styles.field}>
                  <Input
                    label={t.whatsapp}
                    value={whatsapp}
                    onChangeText={setWhatsapp}
                    placeholder="01xxxxxxxxx"
                    keyboardType="phone-pad"
                    leftIcon={<Text style={styles.waEmoji}>💬</Text>}
                  />
                  <View style={styles.hintRow}>
                    <Text style={[styles.hint, dirStyle]}>
                      {ar
                        ? 'سيكون مرئياً للمشترين على صفحة إعلاناتك.'
                        : 'This will be visible to buyers on your listings page.'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {msg && (
              <View
                style={[
                  styles.msgBox,
                  {
                    backgroundColor: msg.ok ? colors.gl : colors.rl,
                    borderColor: msg.ok ? colors.green : colors.red,
                  },
                ]}
              >
                <Ionicons
                  name={msg.ok ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={msg.ok ? colors.green : colors.red}
                />
                <Text
                  style={[
                    styles.msgText,
                    dirStyle,
                    { color: msg.ok ? colors.green : colors.red },
                  ]}
                >
                  {msg.text}
                </Text>
              </View>
            )}

            <View style={styles.saveWrap}>
              <Button
                label={t.save}
                onPress={handleSave}
                loading={saving}
                variant="cta"
                leftIcon={
                  !saving ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.dk} />
                  ) : undefined
                }
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </DashboardLayout>
  )
}

function SectionHeader({
  icon,
  title,
  dirStyle,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  title: string
  dirStyle: { textAlign: 'right' | 'left'; writingDirection: 'rtl' | 'ltr' }
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={14} color={colors.dk} />
      </View>
      <Text style={[styles.sectionTitle, dirStyle]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  container: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md,
  },

  // Hero
  hero: {
    borderRadius: radius.xl,
    backgroundColor: colors.dk,
    overflow: 'hidden',
    ...shadow.sm,
  },
  heroAccent: {
    height: 4,
    backgroundColor: colors.y,
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  avatarBox: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.ss,
  },
  avatarInitials: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: colors.dk,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -4,
    end: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.dk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMeta: {
    flexShrink: 1,
    gap: 6,
  },
  heroName: {
    fontFamily: fonts.black,
    fontSize: 17,
    color: colors.white,
  },
  heroPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroPhone: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g300,
    flexShrink: 1,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.y,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: 2,
  },
  typePillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.dk,
  },

  // Cards
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    ...shadow.ss,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.g200,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.yl,
    borderWidth: 1,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flexShrink: 1,
    fontFamily: fonts.black,
    fontSize: 15,
    color: colors.dk,
  },

  // Fields
  row2: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  col: {
    flex: 1,
    minWidth: 120,
  },
  field: {
    marginTop: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g700,
    flexShrink: 1,
  },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.g100,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.g200,
  },
  lockPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.g500,
  },
  readonly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.g200,
    borderRadius: radius.md,
    backgroundColor: colors.g100,
    paddingHorizontal: spacing.md,
  },
  readonlyText: {
    flexShrink: 1,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.g700,
  },
  hintRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 6,
    marginBottom: spacing.sm,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
  },
  waEmoji: {
    fontSize: 16,
  },

  // Message
  msgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  msgText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },

  // Save
  saveWrap: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
})
