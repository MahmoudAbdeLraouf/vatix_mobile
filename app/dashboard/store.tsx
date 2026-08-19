import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FileUpload } from '@/components/ui/FileUpload'
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect'
import { useLocale } from '@/contexts/locale'
import { authErrorMessage, authFetch, authPatch } from '@/lib/auth'
import { getLocations, imgUrl, localeName, type LocationNode, type UserProfile } from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

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
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('')
  const [cover, setCover] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [locationId, setLocationId] = useState('')

  const isStorePlus = profile?.type?.toUpperCase() === 'STORE_PLUS'

  useEffect(() => {
    (async () => {
      try {
        const [prof, locs] = await Promise.all([
          authFetch<UserProfile>('/user/profile'),
          getLocations().catch(() => [] as LocationNode[]),
        ])
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
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const locationOptions: SelectOption[] = useMemo(
    () =>
      locations.map(l => ({
        value: String(l.id),
        label: localeName(l.translations, locale) || `#${l.id}`,
        sub: locationSubLabel(l.type, ar),
      })),
    [locations, locale, ar],
  )

  async function handleSave() {
    if (!name.trim()) {
      setMsg({ ok: false, text: ar ? 'اسم المتجر مطلوب' : 'Store name is required' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await authPatch('/stores/me', {
        name: name.trim(),
        description: description.trim() || undefined,
        logo: logo.trim() || undefined,
        cover: cover.trim() || undefined,
        websiteUrl: isStorePlus ? websiteUrl.trim() || undefined : undefined,
        locationId: locationId ? Number(locationId) : undefined,
      })
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
                leftIcon={<Ionicons name="business-outline" size={18} color={colors.g400} />}
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
                  placeholderTextColor={colors.g400}
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

              {isStorePlus && (
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
                    placeholderTextColor={colors.g400}
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
              )}

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
                      {isStorePlus
                        ? '⭐ Store Plus'
                        : ar
                          ? '🏪 متجر'
                          : '🏪 Store'}
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

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  pageHeading: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.dk,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    padding: spacing.lg,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    ...shadow.ss,
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
    color: colors.g500,
    textAlign: 'center',
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g700,
    marginBottom: spacing.xs,
  },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g300,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.g900,
  },
  textarea: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.g300,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.g900,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
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
    color: colors.g500,
    letterSpacing: 0.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  previewCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    overflow: 'hidden',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    ...shadow.ss,
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
    color: colors.dk,
  },
  previewBadge: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.g500,
    marginTop: 2,
  },
  previewDescription: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g600,
    lineHeight: 20,
  },
})
