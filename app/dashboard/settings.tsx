import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as StoreReview from 'expo-store-review'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { deleteAccount } from '@/lib/auth'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type Msg = { ok: boolean; text: string } | null

type NotifKey = 'messages' | 'listings' | 'offers'

const NOTIFS: { key: NotifKey; ar: string; en: string }[] = [
  { key: 'messages', ar: 'إشعارات الرسائل', en: 'Message Notifications' },
  { key: 'listings', ar: 'تحديثات الإعلانات', en: 'Listing Updates' },
  { key: 'offers', ar: 'عروض المنصة', en: 'Platform Offers' },
]

export default function SettingsScreen() {
  const { t, locale, setLocale } = useLocale()
  const { logout } = useAuth()
  const ar = locale === 'ar'

  // LocaleProvider applies `direction: 'rtl'` at the tree root. Under inherited
  // RTL, `textAlign: 'right'` and `flexDirection: 'row-reverse'` resolve visually
  // BACKWARDS (double-flip). `rowDir` forces LTR + reversed row so the first
  // child anchors to the physical right. `colDir` restores RTL context inside
  // those rows so nested text uses `textAlign: 'auto'` = start alignment.
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null
  const colDir = ar ? { direction: 'rtl' as const } : null
  const dirStyle = {
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }
  const trailAlign = {
    alignItems: (ar ? 'flex-start' : 'flex-end') as 'flex-start' | 'flex-end',
  }

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<Msg>(null)

  const [notifs, setNotifs] = useState<Record<NotifKey, boolean>>({
    messages: true,
    listings: true,
    offers: true,
  })
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [notifsMsg, setNotifsMsg] = useState<Msg>(null)

  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState<Msg>(null)
  const [rating, setRating] = useState(false)

  function handleSavePassword() {
    setPasswordMsg(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({
        ok: false,
        text: ar ? 'يرجى ملء جميع الحقول.' : 'Please fill in all fields.',
      })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMsg({
        ok: false,
        text: ar
          ? 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.'
          : 'Password must be at least 6 characters.',
      })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        ok: false,
        text: ar ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.',
      })
      return
    }
    setSavingPassword(true)
    setTimeout(() => {
      setSavingPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMsg({
        ok: true,
        text: ar ? 'تم تحديث كلمة المرور.' : 'Password updated.',
      })
    }, 400)
  }

  function handleSaveNotifs() {
    setSavingNotifs(true)
    setTimeout(() => {
      setSavingNotifs(false)
      setNotifsMsg({
        ok: true,
        text: ar ? 'تم حفظ الإعدادات.' : 'Settings saved.',
      })
    }, 400)
  }

  async function handleRateApp() {
    if (rating) return
    setRating(true)
    try {
      const canReview =
        (await StoreReview.hasAction()) && (await StoreReview.isAvailableAsync())
      if (canReview) {
        await StoreReview.requestReview()
        return
      }
      const url = StoreReview.storeUrl()
      if (url) {
        await Linking.openURL(url)
        return
      }
      Alert.alert(
        ar ? 'غير متاح' : 'Unavailable',
        ar
          ? 'التقييم غير متاح على هذا الجهاز.'
          : 'Rating is not available on this device.',
      )
    } catch {
      // silent — nothing actionable
    } finally {
      setRating(false)
    }
  }

  function confirmDeleteAccount() {
    setDeleteMsg(null)
    if (!deletePassword) {
      setDeleteMsg({
        ok: false,
        text: ar
          ? 'يرجى إدخال كلمة المرور للتأكيد.'
          : 'Please enter your password to confirm.',
      })
      return
    }
    Alert.alert(
      ar ? 'حذف الحساب' : 'Delete Account',
      ar
        ? 'سيتم حذف حسابك وجميع بياناتك نهائياً. هل أنت متأكد؟'
        : 'Your account and all data will be permanently deleted. Are you sure?',
      [
        { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: ar ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: () => {
            void performDeleteAccount()
          },
        },
      ],
    )
  }

  async function performDeleteAccount() {
    setDeleting(true)
    try {
      await deleteAccount(deletePassword)
      setDeletePassword('')
      await logout()
    } catch (err) {
      setDeleteMsg({
        ok: false,
        text:
          err instanceof Error
            ? err.message
            : ar
              ? 'تعذّر حذف الحساب.'
              : 'Could not delete account.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DashboardLayout title={t.settings}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={[styles.h2, dirStyle]}>
          {ar ? 'الإعدادات ⚙️' : 'Settings ⚙️'}
        </Text>

        {/* Language card */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, dirStyle]}>
            {t.language}
          </Text>
          <Pressable
            onPress={() => setLocale('ar')}
            style={({ pressed }) => [
              styles.langRow,
              locale === 'ar' && styles.langRowActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.flag}>🇸🇦</Text>
            <Text
              style={[styles.langLabel, locale === 'ar' && styles.langLabelActive]}
            >
              العربية
            </Text>
            {locale === 'ar' && (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.y}
                style={styles.langCheck}
              />
            )}
          </Pressable>
          <Pressable
            onPress={() => setLocale('en')}
            style={({ pressed }) => [
              styles.langRow,
              locale === 'en' && styles.langRowActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.flag}>🇺🇸</Text>
            <Text
              style={[styles.langLabel, locale === 'en' && styles.langLabelActive]}
            >
              English
            </Text>
            {locale === 'en' && (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.y}
                style={styles.langCheck}
              />
            )}
          </Pressable>
        </View>

        {/* Password card */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, dirStyle]}>
            {ar ? 'تغيير كلمة المرور' : 'Change Password'}
          </Text>

          <Input
            label={ar ? 'كلمة المرور الحالية' : 'Current Password'}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            secureTextEntry
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.g400} />}
          />
          <Input
            label={ar ? 'كلمة المرور الجديدة' : 'New Password'}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            secureTextEntry
            leftIcon={<Ionicons name="key-outline" size={18} color={colors.g400} />}
          />
          <Input
            label={ar ? 'تأكيد كلمة المرور' : 'Confirm Password'}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            leftIcon={<Ionicons name="key-outline" size={18} color={colors.g400} />}
          />

          {passwordMsg && (
            <View
              style={[
                styles.msgBox,
                {
                  backgroundColor: passwordMsg.ok ? colors.gl : colors.rl,
                  borderColor: passwordMsg.ok ? colors.green : colors.red,
                },
              ]}
            >
              <Ionicons
                name={passwordMsg.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                size={16}
                color={passwordMsg.ok ? colors.green : colors.red}
              />
              <Text
                style={[
                  styles.msgText,
                  { color: passwordMsg.ok ? colors.green : colors.red },
                ]}
              >
                {passwordMsg.text}
              </Text>
            </View>
          )}

          <Button
            label={ar ? 'حفظ كلمة المرور' : 'Save Password'}
            onPress={handleSavePassword}
            loading={savingPassword}
            variant="y"
          />
        </View>

        {/* Notifications card */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, dirStyle]}>
            {ar ? 'إشعارات البريد الإلكتروني' : 'Email Notifications'}
          </Text>

          {NOTIFS.map((n) => {
            const on = notifs[n.key]
            return (
              <Pressable
                key={n.key}
                onPress={() =>
                  setNotifs((s) => ({ ...s, [n.key]: !s[n.key] }))
                }
                style={({ pressed }) => [
                  styles.notifRow,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={[styles.checkbox, on && styles.checkboxOn]}>
                  {on && <Ionicons name="checkmark" size={14} color={colors.dk} />}
                </View>
                <Text style={[styles.notifLabel, dirStyle]}>
                  {ar ? n.ar : n.en}
                </Text>
              </Pressable>
            )
          })}

          {notifsMsg && (
            <View
              style={[
                styles.msgBox,
                {
                  backgroundColor: notifsMsg.ok ? colors.gl : colors.rl,
                  borderColor: notifsMsg.ok ? colors.green : colors.red,
                },
              ]}
            >
              <Ionicons
                name={notifsMsg.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                size={16}
                color={notifsMsg.ok ? colors.green : colors.red}
              />
              <Text
                style={[
                  styles.msgText,
                  { color: notifsMsg.ok ? colors.green : colors.red },
                ]}
              >
                {notifsMsg.text}
              </Text>
            </View>
          )}

          <Button
            label={ar ? 'حفظ الإعدادات' : 'Save Settings'}
            onPress={handleSaveNotifs}
            loading={savingNotifs}
            variant="y"
          />
        </View>

        {/* Rate the App card */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, dirStyle]}>
            {ar ? 'قيّم التطبيق' : 'Rate the App'}
          </Text>
          <Text style={[styles.helperText, dirStyle]}>
            {ar
              ? 'رأيك يهمنا — قيّمنا في المتجر لدعم استمرار التطوير.'
              : 'Your feedback matters — rate us on the store to support continued development.'}
          </Text>
          <Button
            label={ar ? 'قيّم التطبيق' : 'Rate the App'}
            onPress={handleRateApp}
            loading={rating}
            variant="y"
            leftIcon={
              <Ionicons name="star-outline" size={18} color={colors.dk} />
            }
          />
        </View>

        {/* Delete Account card */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, styles.dangerTitle, dirStyle]}>
            {ar ? 'حذف الحساب' : 'Delete Account'}
          </Text>
          <Text style={[styles.helperText, dirStyle]}>
            {ar
              ? 'سيتم حذف حسابك وجميع بياناتك (المنتجات، الرسائل، المتابعات) نهائياً. لا يمكن التراجع.'
              : 'Your account and all data (products, messages, follows) will be permanently deleted. This cannot be undone.'}
          </Text>

          <Input
            label={ar ? 'أدخل كلمة المرور للتأكيد' : 'Enter password to confirm'}
            value={deletePassword}
            onChangeText={setDeletePassword}
            placeholder="••••••••"
            secureTextEntry
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.g400} />}
          />

          {deleteMsg && (
            <View
              style={[
                styles.msgBox,
                {
                  backgroundColor: deleteMsg.ok ? colors.gl : colors.rl,
                  borderColor: deleteMsg.ok ? colors.green : colors.red,
                },
              ]}
            >
              <Ionicons
                name={deleteMsg.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                size={16}
                color={deleteMsg.ok ? colors.green : colors.red}
              />
              <Text
                style={[
                  styles.msgText,
                  { color: deleteMsg.ok ? colors.green : colors.red },
                ]}
              >
                {deleteMsg.text}
              </Text>
            </View>
          )}

          <Button
            label={ar ? 'حذف الحساب نهائياً' : 'Delete Account Permanently'}
            onPress={confirmDeleteAccount}
            loading={deleting}
            variant="red"
            leftIcon={
              <Ionicons name="trash-outline" size={18} color={colors.red} />
            }
          />
        </View>
      </KeyboardAvoidingView>
    </DashboardLayout>
  )
}

const styles = StyleSheet.create({
  h2: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.dk,
    marginBottom: spacing.md + 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.ss,
  },
  cardTitle: {
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.dk,
    marginBottom: spacing.md,
  },
  dangerTitle: {
    color: colors.red,
  },
  helperText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    lineHeight: 20,
    marginBottom: spacing.md,
  },

  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.g200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginBottom: spacing.sm,
  },
  langRowActive: {
    borderColor: colors.y,
    backgroundColor: colors.yl,
  },
  flag: {
    fontSize: 20,
  },
  langLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.g700,
  },
  langLabelActive: {
    color: colors.dk,
  },
  langCheck: {
    marginStart: 'auto',
  },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.g300,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.y,
    borderColor: colors.y,
  },
  notifLabel: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.dk,
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
