import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { FileUpload } from '@/components/ui/FileUpload'
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect'
import { useLocale } from '@/contexts/locale'
import { authErrorMessage, authFetch, authPatch } from '@/lib/auth'
import {
  getLocations,
  imgUrl,
  localeName,
  type LocationNode,
  type StoreVerificationView,
  type UserProfile,
} from '@/lib/api'
import { fonts, radius, shadow, spacing, type ThemeColors } from '@/constants/theme'
import { useTheme } from '@/contexts/theme'

type Msg = { ok: boolean; text: string } | null

function locationSubLabel(type: string, ar: boolean): string {
  const t = type?.toLowerCase()
  if (t === 'governorate') return ar ? 'محافظة' : 'Governorate'
  if (t === 'district') return ar ? 'حي' : 'District'
  if (t === 'area') return ar ? 'منطقة' : 'Area'
  return ar ? 'دولة' : 'Country'
}

export default function StoreInfoScreen() {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const { colors, isDark } = useTheme()
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark])
  const dirContainer = ar ? { direction: 'rtl' as const } : null
  // Canonical RTL pattern (see settings.tsx / FileUpload.tsx): under inherited
  // RTL, `textAlign: 'right'` double-flips. `textAlign: 'auto'` resolves to the
  // start edge of the inherited direction, so text right-aligns in Arabic.
  const dirStyle = {
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [locations, setLocations] = useState<LocationNode[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [hasOpenRequest, setHasOpenRequest] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('')
  const [cover, setCover] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [locationId, setLocationId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [prof, locs, ver] = await Promise.all([
        authFetch<UserProfile>('/user/profile'),
        getLocations().catch(() => [] as LocationNode[]),
        // Hint only (rename warning): a failure just means "no open request".
        authFetch<StoreVerificationView>('/stores/me/verification').catch(() => null),
      ])
      const reqStatus = ver?.request?.status
      setHasOpenRequest(reqStatus === 'draft' || reqStatus === 'pending')
      if (prof) {
        setProfile(prof)
        const sp = prof.storeProfile
        if (sp) {
          setName(sp.name ?? '')
          setDescription(sp.description ?? '')
          setLogo(sp.logo ?? '')
          setCover(sp.cover ?? '')
          setWebsiteUrl(sp.websiteUrl ?? '')
          setLocationId(sp.locationId != null ? String(sp.locationId) : '')
        }
      }
      setLocations((locs ?? []).filter(l => l.isActive))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const locationOptions: SelectOption[] = useMemo(
    () =>
      locations.map(l => ({
        value: String(l.id),
        label: localeName(l.translations, locale) || `#${l.id}`,
        sub: locationSubLabel(l.type, ar),
      })),
    [locations, locale, ar],
  )

  function handleSave() {
    if (!name.trim()) {
      setMsg({ ok: false, text: ar ? 'اسم المتجر مطلوب' : 'Store name is required' })
      return
    }
    // Renaming a verified store revokes its badge server-side, so confirm first.
    const current = profile?.storeProfile
    const renaming = name.trim() !== (current?.name ?? '').trim()
    if (renaming && (current?.verifiedAt || hasOpenRequest)) {
      Alert.alert(current?.verifiedAt ? t.verified.renameWarning : t.verified.renameWarningOpenRequest, undefined, [
        { text: t.cancel, style: 'cancel' },
        { text: t.confirm, onPress: () => { void doSave() } },
      ])
      return
    }
    void doSave()
  }

  async function doSave() {
    setSaving(true)
    setMsg(null)
    try {
      await authPatch('/stores/me', {
        name: name.trim(),
        description: description.trim() || undefined,
        logo: logo.trim() || undefined,
        cover: cover.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        locationId: locationId ? Number(locationId) : undefined,
      })
      // Keep local state in step: a rename drops the verified badge (and the hint/confirm with it).
      setProfile(prev =>
        prev?.storeProfile
          ? {
              ...prev,
              storeProfile: {
                ...prev.storeProfile,
                name: name.trim(),
                ...(name.trim() !== (prev.storeProfile.name ?? '').trim()
                  ? { verifiedAt: null, verifiedChecks: null }
                  : null),
              },
            }
          : prev,
      )
      setMsg({
        ok: true,
        text: ar ? 'تم حفظ بيانات المتجر بنجاح ✓' : 'Store info saved successfully ✓',
      })
    } catch (err: unknown) {
      setMsg({ ok: false, text: authErrorMessage(err, t) })
    } finally {
      setSaving(false)
    }
  }

  const previewLogo = imgUrl(logo)
  const previewCover = imgUrl(cover)

  return (
    <DashboardLayout title={t.storeInfo}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.y} size="large" />
          </View>
        ) : loadError ? (
          <ErrorState kind="network" onRetry={load} style={styles.center} />
        ) : !profile?.storeProfile ? (
          <View style={styles.card}>
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🏪</Text>
              <Text style={styles.emptyText}>
                {ar
                  ? 'هذه الصفحة متاحة فقط لأصحاب المتاجر.'
                  : 'This page is only available for store owners.'}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={[styles.pageHeading, dirStyle]}>
              {ar ? 'معلومات المتجر 🏪' : 'Store Info 🏪'}
            </Text>

            <View style={styles.card}>
              <Input
                label={ar ? 'اسم المتجر *' : 'Store Name *'}
                value={name}
                onChangeText={setName}
                placeholder={t.storeName}
                leftIcon={<Ionicons name="business-outline" size={18} color={colors.subtle} />}
              />
              {profile.storeProfile.verifiedAt ? (
                <Text style={[styles.hint, dirStyle]}>{t.verified.renameWarning}</Text>
              ) : hasOpenRequest ? (
                <Text style={[styles.hint, dirStyle]}>{t.verified.renameWarningOpenRequest}</Text>
              ) : null}

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

              <SearchableSelect
                label={ar ? 'موقع المتجر' : 'Store Location'}
                options={locationOptions}
                value={locationId}
                onChange={setLocationId}
                placeholder={ar ? 'اختر موقع المتجر' : 'Choose store location'}
              />

              <View style={styles.field}>
                <Text style={[styles.label, dirStyle]}>
                  {ar ? 'رابط الموقع الخارجي' : 'External Website URL'}
                </Text>
                <TextInput
                  // URLs render LTR regardless of UI locale.
                  style={[styles.input, { textAlign: 'left', writingDirection: 'ltr' }]}
                  value={websiteUrl}
                  onChangeText={setWebsiteUrl}
                  placeholder="https://example.com"
                  placeholderTextColor={colors.subtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <Text style={[styles.hint, dirStyle]}>
                  {ar
                    ? 'اترك الحقل فارغاً لاستخدام صفحة المتجر الافتراضية من Vatix.'
                    : 'Leave blank to use your default Vatix-hosted store page.'}
                </Text>
              </View>

              <FileUpload
                label={ar ? 'شعار المتجر (Logo)' : 'Store Logo'}
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
                label={ar ? 'حفظ التغييرات' : 'Save Changes'}
                onPress={handleSave}
                loading={saving}
              />
            </View>

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
                    <Text
                      style={[styles.previewName, dirStyle]}
                      numberOfLines={1}
                    >
                      {name || (ar ? 'اسم المتجر' : 'Store Name')}
                    </Text>
                    <Text
                      style={[styles.previewBadge, dirStyle]}
                    >
                      {ar ? '🏪 متجر' : '🏪 Store'}
                    </Text>
                  </View>
                </View>
                {description ? (
                  <Text
                    style={[styles.previewDescription, dirStyle]}
                  >
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
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
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
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
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
