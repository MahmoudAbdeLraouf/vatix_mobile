import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { FileUpload } from '@/components/ui/FileUpload'
import { useLocale } from '@/contexts/locale'
import { useAuth } from '@/contexts/auth'
import { authErrorMessage } from '@/lib/auth'
import { imgUrl } from '@/lib/api'
import { finalizePaymentSuccess } from '@/lib/payment'
import { refreshMyStoreApplication } from '@/hooks/useMyStoreApplication'
import {
  REASON_EN,
  getMyStoreApplication,
  resubmitStoreApplication,
  type MyStoreApplication,
} from '@/lib/storeApplication'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

type Msg = { ok: boolean; text: string } | null

export default function StoreApplicationScreen() {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const { colors, isDark } = useTheme()
  const { refetchUser } = useAuth()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const dirContainer = ar ? { direction: 'rtl' as const } : null
  const dirStyle = {
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  const [app, setApp] = useState<MyStoreApplication | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('')
  const [cover, setCover] = useState('')
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const fill = useCallback((a: MyStoreApplication) => {
    setApp(a)
    setName(a.storeName)
    setDescription(a.description ?? '')
    setLogo(a.logo ?? '')
    setCover(a.cover ?? '')
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const a = await getMyStoreApplication()
      if (a) fill(a)
      else setApp(null)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [fill])

  useEffect(() => {
    load()
  }, [load])

  async function handleResubmit() {
    if (!app) return
    if (!name.trim()) {
      setMsg({ ok: false, text: ar ? 'اسم المتجر مطلوب' : 'Store name is required' })
      return
    }
    if (!logo) {
      setMsg({ ok: false, text: ar ? 'شعار المتجر مطلوب' : 'Store logo is required' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const updated = await resubmitStoreApplication({
        storeName: name.trim(),
        description: description.trim() || undefined,
        locationId: app.locationId ?? undefined,
        logo,
        cover: cover || undefined,
      })
      fill(updated)
      refreshMyStoreApplication()
      setMsg({
        ok: true,
        text: ar ? 'تم إرسال طلبك للمراجعة ✓' : 'Your application was sent for review ✓',
      })
    } catch (err: unknown) {
      setMsg({ ok: false, text: authErrorMessage(err, t) })
    } finally {
      setSaving(false)
    }
  }

  // The stored token/profile still say "client" until we refresh them.
  async function openStore() {
    setOpening(true)
    try {
      await finalizePaymentSuccess()
      await refetchUser()
      router.replace('/dashboard/store')
    } finally {
      setOpening(false)
    }
  }

  const reason = app?.reasonCode
    ? ar
      ? (app.reasonLabel ?? '')
      : (REASON_EN[app.reasonCode] ?? app.reasonLabel ?? '')
    : ''
  const editable = app?.status === 'needs_changes' || app?.status === 'rejected'
  const individual = app?.status === 'rejected' && app.reasonCode === 'individual_seller'
  // Review can't finish until the merchant has a live product.
  const needsProduct =
    app?.status === 'pending' && (app.activeProductCount ?? 1) < (app.minProducts ?? 1)

  const banner =
    app &&
    {
      pending: {
        icon: '⏳',
        bg: colors.yl,
        bd: colors.y,
        title: ar ? 'طلبك قيد المراجعة' : 'Your application is under review',
        body: ar
          ? `نراجع الطلبات عادةً خلال ${app.reviewSlaHours} ساعة. سنرسل لك إشعاراً فور الانتهاء — وحتى ذلك الحين يمكنك استخدام حسابك كمستخدم عادي.`
          : `We usually review applications within ${app.reviewSlaHours} hours. We'll notify you as soon as it's done — meanwhile you can keep using your account as a regular user.`,
      },
      needs_changes: {
        icon: '✏️',
        bg: colors.yl,
        bd: colors.y,
        title: ar ? 'طلبك يحتاج بعض التعديلات' : 'Your application needs a few changes',
        body: ar
          ? 'عدّل البيانات أدناه وأعد الإرسال في أي وقت.'
          : 'Update the details below and resubmit any time.',
      },
      rejected: individual
        ? {
            icon: '👤',
            bg: colors.yl,
            bd: colors.y,
            title: ar ? 'حسابك هيفضل حساب عادي' : 'Your account stays a regular account',
            body: ar
              ? 'تقدر تكمل نشر منتجاتك كبائع فردي زي ما انت. ولو عندك متجر فعلي، عدّل البيانات وأعد التقديم في أي وقت.'
              : 'You can keep listing your products as an individual seller. If you do run a real store, update the details and resubmit any time.',
          }
        : {
            icon: '❌',
            bg: colors.redBg,
            bd: colors.red,
            title: ar ? 'لم تتم الموافقة على طلبك' : 'Your application was not approved',
            body: ar
              ? 'يمكنك تعديل البيانات وإعادة الإرسال في أي وقت.'
              : 'You can update the details and resubmit any time.',
          },
      approved: {
        icon: '🎉',
        bg: colors.greenBg,
        bd: colors.green,
        title: ar ? 'تمت الموافقة على متجرك!' : 'Your store is approved!',
        body: ar
          ? 'متجرك جاهز الآن. ابدأ بإضافة منتجاتك وتجهيز صفحتك.'
          : 'Your store is live. Start adding products and set up your page.',
      },
    }[app.status]

  const previewLogo = imgUrl(logo)
  const previewCover = imgUrl(cover)

  return (
    <DashboardLayout title={ar ? 'طلب المتجر' : 'Store application'}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.y} size="large" />
        </View>
      ) : loadError ? (
        <ErrorState kind="network" onRetry={load} style={styles.center} />
      ) : !app || !banner ? (
        <View style={styles.card}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyText}>
              {ar ? 'لا يوجد طلب متجر على حسابك.' : 'There is no store application on your account.'}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <Text style={[styles.pageHeading, dirStyle]}>
            {ar ? 'طلب فتح متجر' : 'Store application'}
          </Text>

          <View style={[styles.card, styles.banner, { backgroundColor: banner.bg, borderColor: banner.bd }]}>
            <View style={[styles.bannerRow, dirContainer]}>
              <Text style={styles.bannerIcon}>{banner.icon}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.bannerTitle, dirStyle]}>{banner.title}</Text>
                <Text style={[styles.bannerBody, dirStyle]}>{banner.body}</Text>
              </View>
            </View>
            {editable && (reason || app.adminNote) ? (
              <View style={styles.reasonBox}>
                {reason ? (
                  <Text style={[styles.reasonText, dirStyle]}>
                    {ar ? 'السبب: ' : 'Reason: '}
                    {reason}
                  </Text>
                ) : null}
                {app.adminNote ? (
                  <Text style={[styles.reasonNote, dirStyle, reason ? { marginTop: 4 } : null]}>
                    {app.adminNote}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {app.status === 'approved' ? (
              <Button
                label={ar ? 'افتح لوحة متجرك' : 'Open my store dashboard'}
                onPress={openStore}
                loading={opening}
                style={{ marginTop: spacing.md }}
              />
            ) : null}
          </View>

          {needsProduct ? (
            <View style={[styles.card, styles.banner, { borderColor: colors.y }]}>
              <View style={[styles.bannerRow, dirContainer]}>
                <Text style={styles.bannerIcon}>📦</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.bannerTitle, dirStyle]}>
                    {ar ? 'خطوة أخيرة: أضف أول منتج' : 'One last step: add your first product'}
                  </Text>
                  <Text style={[styles.bannerBody, dirStyle]}>
                    {ar
                      ? 'لازم يكون عندك منتج واحد على الأقل منشور علشان نقدر نوافق على متجرك. طلبك هيفضل قيد المراجعة لحد ما تضيفه.'
                      : 'You need at least one live product before we can approve your store. Your application stays under review until you add one.'}
                  </Text>
                </View>
              </View>
              <Button
                label={ar ? 'أضف منتج الآن' : 'Add a product now'}
                onPress={() => router.push('/products/add')}
                style={{ marginTop: spacing.md }}
              />
            </View>
          ) : null}

          {editable ? (
            <View style={styles.card}>
              <Input
                label={ar ? 'اسم المتجر *' : 'Store Name *'}
                value={name}
                onChangeText={setName}
                placeholder={t.storeName}
                leftIcon={<Ionicons name="business-outline" size={18} color={colors.subtle} />}
              />

              <View style={styles.field}>
                <Text style={[styles.label, dirStyle]}>
                  {ar ? 'وصف المتجر' : 'Store Description'}
                </Text>
                <TextInput
                  style={[styles.textarea, dirStyle]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={
                    ar
                      ? 'نبذة عن متجرك، المنتجات التي تبيعها...'
                      : 'About your store, products you sell...'
                  }
                  placeholderTextColor={colors.subtle}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <FileUpload
                label={ar ? 'شعار المتجر (Logo) *' : 'Store Logo *'}
                value={logo}
                onChange={setLogo}
                aspect="square"
                hint={ar ? 'JPG · PNG · WebP · حجم أقصى 5 MB' : 'JPG · PNG · WebP · Max 5 MB'}
              />

              <FileUpload
                label={ar ? 'صورة الغلاف (Cover)' : 'Cover Photo'}
                value={cover}
                onChange={setCover}
                aspect="wide"
                hint={
                  ar
                    ? 'يُفضَّل 1200 × 300 · JPG · PNG · WebP'
                    : 'Recommended 1200 × 300 · JPG · PNG · WebP'
                }
              />

              {msg && (
                <View
                  style={[
                    styles.msgBox,
                    dirContainer,
                    {
                      backgroundColor: msg.ok ? colors.greenBg : colors.redBg,
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
                label={ar ? 'إعادة إرسال الطلب' : 'Resubmit application'}
                onPress={handleResubmit}
                loading={saving}
              />
            </View>
          ) : msg?.ok ? (
            <View
              style={[
                styles.msgBox,
                styles.standaloneMsg,
                dirContainer,
                { backgroundColor: colors.greenBg, borderColor: colors.green },
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.green} />
              <Text style={[styles.msgText, { color: colors.green }]}>{msg.text}</Text>
            </View>
          ) : null}

          {/* Live preview */}
          <Text style={[styles.previewHeading, dirStyle]}>
            {ar ? 'معاينة المتجر' : 'STORE PREVIEW'}
          </Text>
          <View style={styles.previewCard}>
            <View style={styles.previewCover}>
              {previewCover ? (
                <Image
                  source={{ uri: previewCover }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.previewCoverEmoji}>🖼</Text>
              )}
            </View>
            <View style={styles.previewBody}>
              <View style={[styles.previewRow, dirContainer]}>
                <View style={styles.previewLogo}>
                  {previewLogo ? (
                    <Image
                      source={{ uri: previewLogo }}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.previewLogoEmoji}>🏪</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.previewName, dirStyle]} numberOfLines={1}>
                    {name || (ar ? 'اسم المتجر' : 'Store Name')}
                  </Text>
                  <Text style={[styles.previewBadge, dirStyle]}>
                    {ar ? '🏪 متجر' : '🏪 Store'}
                  </Text>
                </View>
              </View>
              {description ? (
                <Text style={[styles.previewDescription, dirStyle]}>
                  {description.slice(0, 100)}
                  {description.length > 100 ? '...' : ''}
                </Text>
              ) : null}
            </View>
          </View>
        </>
      )}
    </DashboardLayout>
  )
}

const makeStyles = (colors: ThemeColors, dark: boolean) => StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  pageHeading: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.heading,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    ...(dark ? null : shadow.ss),
  },
  banner: {
    marginBottom: spacing.md,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bannerIcon: {
    fontSize: 26,
    lineHeight: 32,
  },
  bannerTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.heading,
    marginBottom: 4,
  },
  bannerBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 22,
  },
  reasonBox: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reasonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.heading,
  },
  reasonNote: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
  },
  emptyState: {
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
    color: colors.muted,
    textAlign: 'center',
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  textarea: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
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
  standaloneMsg: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  msgText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  previewHeading: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    ...(dark ? null : shadow.ss),
  },
  previewCover: {
    height: 90,
    backgroundColor: colors.dk2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  previewCoverEmoji: {
    fontSize: 28,
    opacity: 0.25,
    color: colors.white,
  },
  previewBody: {
    padding: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  previewLogo: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: colors.yl,
    borderWidth: 2,
    borderColor: colors.y,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  previewLogoEmoji: {
    fontSize: 20,
  },
  previewName: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.heading,
  },
  previewBadge: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  previewDescription: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 20,
  },
})
