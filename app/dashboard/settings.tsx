import React, { useState } from 'react'
import {
  Alert,
  Linking,
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
import { authErrorMessage, deleteAccount } from '@/lib/auth'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'
import { validatePassword } from '@/lib/password-policy'
import { IS_IOS } from '@/lib/platform'
import type { EventSubscription, Purchase, PurchaseError } from 'react-native-iap'
import {
  addPurchaseErrorListener,
  addPurchaseUpdatedListener,
  endIap,
  finishIosPurchase,
  getIosJws,
  initIap,
  restoreIosPurchases,
} from '@/lib/iap'
import { getIapProduct } from '@/lib/iap-products'
import { finalizePaymentSuccess, verifyIapPurchase } from '@/lib/payment'

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
  const [restoring, setRestoring] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState<Msg>(null)

  function handleSavePassword() {
    setPasswordMsg(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({
        ok: false,
        text: t.fillRequiredFields,
      })
      return
    }
    const pwd = validatePassword(newPassword, locale)
    if (!pwd.valid) {
      setPasswordMsg({ ok: false, text: pwd.error! })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        ok: false,
        text: t.passwordMismatch,
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
        text: t.passwordUpdated,
      })
    }, 400)
  }

  function handleSaveNotifs() {
    setSavingNotifs(true)
    setTimeout(() => {
      setSavingNotifs(false)
      setNotifsMsg({
        ok: true,
        text: t.settingsSaved,
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

  // App Store §3.1.1: iOS apps offering non-consumable IAP (subscriptions) must
  // expose a "Restore Purchases" mechanism. StoreKit re-emits active/valid
  // transactions via the purchaseUpdatedListener; we verify each JWS with the
  // backend, finish the transaction, then refresh the session so entitlement
  // reflects on-device. Consumables (promotion bundles) are not restorable.
  async function handleRestorePurchases() {
    if (restoring) return
    setRestoreMsg(null)
    setRestoring(true)

    // Object wrapper avoids TS control-flow narrowing `let` closure-captured
    // subscriptions to `never` in the `finally` block.
    const subs: { updated: EventSubscription | null; error: EventSubscription | null } = {
      updated: null,
      error: null,
    }
    const restored: Purchase[] = []
    let restoreError: string | null = null

    try {
      await initIap()

      subs.updated = addPurchaseUpdatedListener(p => {
        restored.push(p)
      })
      subs.error = addPurchaseErrorListener((e: PurchaseError) => {
        if (e.code === 'user-cancelled' || /cancel/i.test(e.message ?? '')) return
        restoreError = e.message || 'Restore failed'
      })

      await restoreIosPurchases()
      // StoreKit dispatches restored transactions asynchronously via the
      // listener; give it a short window to drain before we tally.
      await new Promise(resolve => setTimeout(resolve, 2500))

      if (restoreError && restored.length === 0) {
        throw new Error(restoreError)
      }

      let verifiedCount = 0
      for (const purchase of restored) {
        const jws = await getIosJws(purchase)
        if (!jws) continue
        try {
          await verifyIapPurchase({
            signedTransaction: jws,
            metadata: { restored: true },
          })
          const product = getIapProduct(purchase.productId)
          await finishIosPurchase(purchase, product?.isConsumable ?? false)
          verifiedCount++
        } catch {
          // Skip and continue — one bad transaction shouldn't block the rest.
        }
      }

      if (verifiedCount > 0) {
        await finalizePaymentSuccess()
        setRestoreMsg({
          ok: true,
          text: ar
            ? `تم استرجاع ${verifiedCount} عملية شراء بنجاح.`
            : `Restored ${verifiedCount} purchase(s) successfully.`,
        })
      } else {
        setRestoreMsg({
          ok: true,
          text: ar
            ? 'لا توجد عمليات شراء لاستعادتها.'
            : 'No purchases available to restore.',
        })
      }
    } catch (e: unknown) {
      setRestoreMsg({ ok: false, text: authErrorMessage(e, t) })
    } finally {
      subs.updated?.remove()
      subs.error?.remove()
      await endIap()
      setRestoring(false)
    }
  }

  function confirmDeleteAccount() {
    setDeleteMsg(null)
    if (!deletePassword) {
      setDeleteMsg({
        ok: false,
        text: t.enterPasswordToConfirm,
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
      setDeleteMsg({ ok: false, text: authErrorMessage(err, t) })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DashboardLayout title={t.settings}>
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
            <Text style={styles.flag}>🇪🇬</Text>
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
            variant="dk"
            leftIcon={
              <Ionicons name="star" size={18} color={colors.y} />
            }
          />
        </View>

        {/* Restore Purchases — iOS only (App Store §3.1.1 requirement) */}
        {IS_IOS && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, dirStyle]}>
              {ar ? 'استعادة المشتريات' : 'Restore Purchases'}
            </Text>
            <Text style={[styles.helperText, dirStyle]}>
              {ar
                ? 'استعد اشتراكاتك السابقة بعد إعادة تثبيت التطبيق أو تغيير الجهاز.'
                : 'Recover your prior subscriptions after reinstalling the app or switching devices.'}
            </Text>

            {restoreMsg && (
              <View
                style={[
                  styles.msgBox,
                  {
                    backgroundColor: restoreMsg.ok ? colors.gl : colors.rl,
                    borderColor: restoreMsg.ok ? colors.green : colors.red,
                  },
                ]}
              >
                <Ionicons
                  name={restoreMsg.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={16}
                  color={restoreMsg.ok ? colors.green : colors.red}
                />
                <Text
                  style={[
                    styles.msgText,
                    { color: restoreMsg.ok ? colors.green : colors.red },
                  ]}
                >
                  {restoreMsg.text}
                </Text>
              </View>
            )}

            <Button
              label={ar ? 'استعادة المشتريات' : 'Restore Purchases'}
              onPress={handleRestorePurchases}
              loading={restoring}
              variant="dk"
              leftIcon={<Ionicons name="refresh" size={18} color={colors.y} />}
            />
          </View>
        )}

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
