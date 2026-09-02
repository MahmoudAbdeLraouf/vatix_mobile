import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { BottomTabBar } from '@/components/BottomTabBar'
import { MultiImageUpload, ImageItem } from '@/components/MultiImageUpload'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/auth'
import { useLocale } from '@/contexts/locale'
import {
  Brand,
  Category,
  CreateProductInput,
  LocationNode,
  Product,
  getBrands,
  getCategories,
  getLocations,
  localeName,
} from '@/lib/api'
import { authErrorMessage, authFetch, authPost } from '@/lib/auth'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

const DRAFT_KEY = 'vatix_product_draft'
const STORE_LIMIT = 20
const CLIENT_LIMIT = 5

interface Draft {
  title: string
  description: string
  price: string
  condition: string
  categoryId: number | null
  brandId: number | null
  locationId: number | null
  images: ImageItem[]
  showPhone: boolean
}

type IonName = React.ComponentProps<typeof Ionicons>['name']

export default function AddProductScreen() {
  const { user } = useAuth()
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const dirStyle = {
    textAlign: ar ? ('right' as const) : ('left' as const),
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
  }
  // Force an LTR flex context and reverse row order so the icon lands on the
  // right and text sits to its left — independent of whether the parent's
  // `direction: 'rtl'` from LocaleProvider actually propagates through
  // KeyboardAvoidingView / ScrollView (which is unreliable on Expo Go).
  const rowDir = ar
    ? { direction: 'ltr' as const, flexDirection: 'row-reverse' as const }
    : null

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [condition, setCondition] = useState<string>('new')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [brandId, setBrandId] = useState<number | null>(null)
  const [locationId, setLocationId] = useState<number | null>(null)
  const [images, setImages] = useState<ImageItem[]>([])
  const [showPhone, setShowPhone] = useState(true)

  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [locations, setLocations] = useState<LocationNode[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [publishedId, setPublishedId] = useState<number | string | null>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const hydrated = useRef(false)
  const scrollRef = useRef<ScrollView>(null)
  const scrollOffsetRef = useRef(0)

  const limit = user?.isStore ? STORE_LIMIT : CLIENT_LIMIT

  useEffect(() => {
    Promise.all([getCategories(), getBrands(), getLocations()]).then(([cats, brs, locs]) => {
      setCategories(cats.filter(c => c.isActive))
      setBrands(brs.filter(b => b.isActive))
      setLocations(locs.filter(l => l.isActive))
    })
  }, [])

  useEffect(() => {
    SecureStore.getItemAsync(DRAFT_KEY)
      .then((raw) => {
        if (!raw) return
        try {
          const d = JSON.parse(raw) as Partial<Draft>
          if (d.title) setTitle(d.title)
          if (d.description) setDescription(d.description)
          if (d.price) setPrice(d.price)
          if (d.condition) setCondition(d.condition)
          if (typeof d.categoryId === 'number') setCategoryId(d.categoryId)
          if (typeof d.brandId === 'number') setBrandId(d.brandId)
          if (typeof d.locationId === 'number') setLocationId(d.locationId)
          if (Array.isArray(d.images)) {
            setImages(d.images.filter((i): i is ImageItem => !!i && !!i.url && !i.uploading))
          }
          if (typeof d.showPhone === 'boolean') setShowPhone(d.showPhone)
        } catch {
          // Corrupt draft — ignore
        }
      })
      .finally(() => { hydrated.current = true })
  }, [])

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvt, (e) => {
      const kbHeight = e.endCoordinates?.height ?? 0
      setKeyboardHeight(kbHeight)
      // Give the layout a beat to grow paddingBottom before scrolling.
      setTimeout(() => {
        const focused = TextInput.State.currentlyFocusedInput?.() as
          | { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void }
          | null
        if (!focused?.measureInWindow) return
        focused.measureInWindow((_x, y, _w, h) => {
          const screenHeight = Dimensions.get('window').height
          const inputBottom = y + h
          const keyboardTop = screenHeight - kbHeight
          const gap = keyboardTop - 40 - inputBottom
          if (gap < 0) {
            scrollRef.current?.scrollTo({
              y: Math.max(0, scrollOffsetRef.current - gap),
              animated: true,
            })
          }
        })
      }, 50)
    })
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardHeight(0)
    })
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    const timer = setTimeout(() => {
      const draft: Draft = {
        title,
        description,
        price,
        condition,
        categoryId,
        brandId,
        locationId,
        images: images.filter((i) => i.url && !i.uploading),
        showPhone,
      }
      SecureStore.setItemAsync(DRAFT_KEY, JSON.stringify(draft)).catch(() => {})
    }, 400)
    return () => clearTimeout(timer)
  }, [title, description, price, condition, categoryId, brandId, locationId, images, showPhone])

  const categoryOptions = categories.map(c => ({
    value: String(c.id),
    label: localeName(c.translations, locale),
  }))
  const brandOptions = brands.map(b => ({
    value: String(b.id),
    label: localeName(b.translations, locale),
  }))
  const locationOptions = locations.map(l => ({
    value: String(l.id),
    label: localeName(l.translations, locale),
  }))

  const uploading = images.some((i) => i.uploading)

  const conditions = useMemo<{ key: string; label: string; icon: IonName; hint: string }[]>(
    () => [
      {
        key: 'new',
        label: t.conditionNew,
        icon: 'sparkles-outline',
        hint: ar ? 'لم يُستخدم من قبل' : 'Never used',
      },
      {
        key: 'used_excellent',
        label: t.conditionUsedExcellent,
        icon: 'ribbon-outline',
        hint: ar ? 'كالجديد' : 'Like new',
      },
      {
        key: 'used_good',
        label: t.conditionUsedGood,
        icon: 'thumbs-up-outline',
        hint: ar ? 'يعمل بشكل ممتاز' : 'Works great',
      },
      {
        key: 'used_acceptable',
        label: t.conditionUsedAcceptable,
        icon: 'construct-outline',
        hint: ar ? 'به علامات استخدام' : 'Signs of use',
      },
    ],
    [ar, t],
  )

  const uploadedCount = images.filter((i) => i.url && !i.uploading).length
  const readyPct = Math.min(
    100,
    Math.round(
      ((title.trim() ? 1 : 0) +
        (price.trim() && Number(price) > 0 ? 1 : 0) +
        (categoryId ? 1 : 0) +
        (uploadedCount > 0 ? 1 : 0)) *
        25,
    ),
  )

  const handleSubmit = useCallback(async () => {
    setError('')
    if (!title.trim()) {
      setError(t.requiredField)
      return
    }
    const numPrice = parseFloat(price)
    if (!price || isNaN(numPrice) || numPrice <= 0) {
      setError(t.requiredField)
      return
    }
    if (!categoryId) {
      setError(t.requiredField)
      return
    }
    if (uploading) {
      setError(t.waitForUploadsToFinish)
      return
    }

    setSubmitting(true)
    try {
      const mine = await authFetch<Product[]>('/products/mine')
      if ((mine?.length ?? 0) >= limit) {
        setError(t.maxAdsReached(limit))
        setSubmitting(false)
        return
      }

      const payload: CreateProductInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        condition: condition as CreateProductInput['condition'],
        price: numPrice,
        categoryId,
        brandId: brandId ?? undefined,
        locationId: locationId ?? undefined,
        showPhone,
        images: images
          .filter((img) => img.url && !img.uploading)
          .map((img, i) => ({ url: img.url, sortOrder: i })),
      }

      const created = await authPost<{ id?: number | string }>('/products', payload)
      await SecureStore.deleteItemAsync(DRAFT_KEY).catch(() => {})
      setPublishedId(created?.id ?? '')
    } catch (e: unknown) {
      setError(authErrorMessage(e, t))
    } finally {
      setSubmitting(false)
    }
  }, [brandId, categoryId, condition, description, images, limit, locationId, price, showPhone, t, title, uploading])

  const goPromote = useCallback(() => {
    const id = publishedId
    setPublishedId(null)
    if (id) {
      router.replace(`/dashboard/promote?resumeProductId=${id}`)
    } else {
      router.replace('/dashboard/promote')
    }
  }, [publishedId])

  const goMyAds = useCallback(() => {
    setPublishedId(null)
    router.replace('/dashboard/my-ads')
  }, [])

  return (
    <DashboardLayout title={t.addProduct} scroll={false} contentPadding={false} bottomBar={<BottomTabBar />}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'android' && { paddingBottom: spacing.xxl + keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y }}
        scrollEventThrottle={16}
      >
          {/* Hero card */}
          <View style={styles.hero}>
            <View style={styles.heroAccent} />
            <View style={[styles.heroRow, rowDir]}>
              <View style={styles.heroIcon}>
                <Ionicons name="pricetag" size={22} color={colors.dk} />
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={[styles.heroTitle, dirStyle]} numberOfLines={1}>
                  {ar ? 'اعرض منتجك' : 'List your product'}
                </Text>
                <Text style={[styles.heroSubtitle, dirStyle]} numberOfLines={2}>
                  {ar
                    ? 'صور واضحة وسعر عادل = مبيعات أسرع'
                    : 'Clear photos and a fair price sell fastest'}
                </Text>
              </View>
            </View>

            <View style={styles.heroDivider} />

            <View style={[styles.progressRow, rowDir]}>
              <Text style={[styles.progressLabel, dirStyle]}>
                {ar ? 'جاهزية الإعلان' : 'Listing readiness'}
              </Text>
              <Text style={[styles.progressPct, dirStyle]}>{readyPct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${readyPct}%` }]} />
            </View>
          </View>

          {/* Photos */}
          <View style={styles.card}>
            <SectionHeader
              icon="images-outline"
              title={t.addPhotos}
              subtitle={ar ? 'حتى 8 صور — أول صورة هي الرئيسية' : 'Up to 8 photos — first is the main'}
              dirStyle={dirStyle}
              rowDir={rowDir}
            />
            <MultiImageUpload images={images} onChange={setImages} />
          </View>

          {/* Basics */}
          <View style={styles.card}>
            <SectionHeader
              icon="document-text-outline"
              title={ar ? 'التفاصيل' : 'Details'}
              subtitle={ar ? 'عنوان وسعر واضحان' : 'A clear title and price'}
              dirStyle={dirStyle}
              rowDir={rowDir}
            />

            <Input
              label={t.productTitle}
              value={title}
              onChangeText={setTitle}
              placeholder={t.productTitle}
              maxLength={120}
            />

            {/* Price with EGP badge */}
            <View style={[styles.fieldLabelRow, rowDir]}>
              <Text style={[styles.fieldLabel, dirStyle]}>
                {t.price}
              </Text>
            </View>
            <View style={[styles.priceWrap, rowDir]}>
              <View style={styles.egpBadge}>
                <Text style={[styles.egpText, dirStyle]}>{t.egp}</Text>
              </View>
              <View style={styles.priceInputWrap}>
                <Input
                  value={price}
                  onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  keyboardType="numeric"
                  style={styles.priceInputInner}
                />
              </View>
            </View>
          </View>

          {/* Condition */}
          <View style={styles.card}>
            <SectionHeader
              icon="options-outline"
              title={t.condition}
              subtitle={ar ? 'ساعد المشترين على معرفة الحالة' : 'Help buyers know what to expect'}
              dirStyle={dirStyle}
              rowDir={rowDir}
            />
            <View style={styles.conditionGrid}>
              {conditions.map((c) => {
                const active = condition === c.key
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCondition(c.key)}
                    style={({ pressed }) => [
                      styles.conditionTile,
                      rowDir,
                      active && styles.conditionTileActive,
                      pressed && !active && { backgroundColor: colors.g50 },
                    ]}
                  >
                    <View
                      style={[
                        styles.conditionIcon,
                        active && styles.conditionIconActive,
                      ]}
                    >
                      <Ionicons
                        name={c.icon}
                        size={18}
                        color={active ? colors.dk : colors.g500}
                      />
                    </View>
                    <View style={styles.conditionTextWrap}>
                      <Text
                        style={[
                          styles.conditionLabel,
                          active && styles.conditionLabelActive,
                          dirStyle,
                        ]}
                        numberOfLines={1}
                      >
                        {c.label}
                      </Text>
                      <Text style={[styles.conditionHint, dirStyle]} numberOfLines={1}>
                        {c.hint}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        active && styles.radioActive,
                      ]}
                    >
                      {active ? (
                        <Ionicons name="checkmark" size={12} color={colors.dk} />
                      ) : null}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* Classification */}
          <View style={styles.card}>
            <SectionHeader
              icon="grid-outline"
              title={ar ? 'التصنيف' : 'Classification'}
              subtitle={ar ? 'يساعد على عرض منتجك للمشترين المناسبين' : 'Helps the right buyers find you'}
              dirStyle={dirStyle}
              rowDir={rowDir}
            />

            <SearchableSelect
              label={t.category}
              placeholder={t.selectCategory}
              options={categoryOptions}
              value={categoryId != null ? String(categoryId) : ''}
              onChange={(v) => setCategoryId(v ? Number(v) : null)}
              style={styles.selectSpacer}
            />

            <SearchableSelect
              label={t.brand}
              placeholder={t.selectBrand}
              options={brandOptions}
              value={brandId != null ? String(brandId) : ''}
              onChange={(v) => setBrandId(v ? Number(v) : null)}
              style={styles.selectSpacer}
            />

            <SearchableSelect
              label={t.location}
              placeholder={t.selectLocation}
              options={locationOptions}
              value={locationId != null ? String(locationId) : ''}
              onChange={(v) => setLocationId(v ? Number(v) : null)}
            />
          </View>

          {/* Description */}
          <View style={styles.card}>
            <SectionHeader
              icon="reader-outline"
              title={t.description}
              subtitle={ar ? 'اذكر المميزات والحالة والملحقات' : 'Mention features, condition, accessories'}
              dirStyle={dirStyle}
              rowDir={rowDir}
            />
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder={ar ? 'اكتب وصف المنتج...' : 'Describe your product...'}
              multiline
              numberOfLines={5}
              maxLength={2000}
              style={dirStyle}
            />
            <Text style={[styles.charCount, dirStyle]}>
              {description.length} / 2000
            </Text>
          </View>

          {/* Contact preferences */}
          <View style={styles.card}>
            <SectionHeader
              icon="call-outline"
              title={ar ? 'التواصل' : 'Contact'}
              subtitle={ar ? 'اختر كيف يتواصل معك المشترون' : 'Choose how buyers reach you'}
              dirStyle={dirStyle}
              rowDir={rowDir}
            />
            <View style={[styles.toggleRow, rowDir]}>
              <View style={styles.toggleIcon}>
                <Ionicons name="phone-portrait-outline" size={18} color={colors.dk} />
              </View>
              <View style={styles.toggleTextWrap}>
                <Text style={[styles.toggleTitle, dirStyle]}>{t.showPhone}</Text>
                <Text style={[styles.toggleHint, dirStyle]}>
                  {ar
                    ? 'يظهر رقمك للمشترين للاتصال المباشر'
                    : 'Buyers can see your number to call directly'}
                </Text>
              </View>
              <Switch
                value={showPhone}
                onValueChange={setShowPhone}
                trackColor={{ false: colors.g300, true: colors.y }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.g300}
              />
            </View>
          </View>

          {/* Error banner */}
          {error ? (
            <View style={[styles.errorBox, rowDir]}>
              <Ionicons name="alert-circle" size={18} color={colors.red} />
              <Text style={[styles.errorText, dirStyle]}>{error}</Text>
            </View>
          ) : null}

          <Button
            label={submitting ? (ar ? 'جارٍ النشر...' : 'Publishing...') : t.publish}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || uploading}
            variant="cta"
            leftIcon={<Ionicons name="rocket" size={18} color={colors.dk} />}
            style={styles.submitBtn}
          />

          <View style={[styles.termsHintRow, rowDir]}>
            <Text style={[styles.termsHint, dirStyle]}>
              {ar
                ? 'بالنشر أنت توافق على شروط استخدام Vatix'
                : 'By publishing you agree to Vatix terms of use'}
            </Text>
          </View>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={publishedId !== null}
        onRequestClose={goMyAds}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalCheck}>
                <Ionicons name="checkmark" size={32} color={colors.dk} />
              </View>
              <Text style={[styles.modalTitle, dirStyle]}>
                {ar ? 'تم نشر إعلانك بنجاح! 🎉' : 'Your ad is live! 🎉'}
              </Text>
              <Text style={[styles.modalSubtitle, dirStyle]}>
                {ar
                  ? 'إعلانك أصبح متاحاً للمشترين الآن. لعرض أفضل وبيع أسرع، رشّح إعلانك للترقية.'
                  : 'Your ad is now visible to buyers. For faster sales and better visibility, promote it.'}
              </Text>
            </View>

            <View style={styles.promoteBox}>
              <Text style={styles.promoteEmoji}>🚀</Text>
              <View style={styles.promoteTextWrap}>
                <Text style={[styles.promoteTitle, dirStyle]}>
                  {ar ? 'رشّح إعلانك للترقية' : 'Promote your ad'}
                </Text>
                <Text style={[styles.promoteHint, dirStyle]}>
                  {ar
                    ? 'ظهور في أعلى نتائج البحث · مشاهدات أكثر · شارة "مميز" على الإعلان.'
                    : 'Top of search results · up to 5× more views · a "Featured" badge.'}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button
                label={`🚀  ${ar ? 'ترقية الإعلان الآن' : 'Promote Now'}`}
                onPress={goPromote}
                variant="cta"
              />
              <Button
                label={ar ? 'لاحقاً — عرض إعلاناتي' : 'Later — View my ads'}
                onPress={goMyAds}
                variant="outline"
              />
            </View>
          </View>
        </View>
      </Modal>
    </DashboardLayout>
  )
}

interface SectionHeaderProps {
  icon: IonName
  title: string
  subtitle?: string
  dirStyle: { textAlign: 'left' | 'right'; writingDirection: 'rtl' | 'ltr' }
  rowDir?: { flexDirection: 'row-reverse' } | null
}

function SectionHeader({ icon, title, subtitle, dirStyle, rowDir }: SectionHeaderProps) {
  return (
    <View style={[styles.sectionHeader, rowDir]}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={16} color={colors.dk} />
      </View>
      <View style={styles.sectionTextWrap}>
        <Text style={[styles.sectionTitle, dirStyle]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, dirStyle]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },

  /* HERO */
  hero: {
    backgroundColor: colors.dk,
    borderRadius: radius.xl,
    padding: spacing.md,
    overflow: 'hidden',
    position: 'relative',
    ...shadow.sm,
  },
  heroAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.y,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 6,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontFamily: fonts.black,
    fontSize: 17,
    color: colors.white,
  },
  heroSubtitle: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g300,
    lineHeight: 17,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.g300,
  },
  progressPct: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.y,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.y,
    borderRadius: 3,
  },

  /* CARDS */
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.g200,
    ...shadow.ss,
  },
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
    borderRadius: radius.sm,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTextWrap: { flex: 1 },
  sectionTitle: {
    fontFamily: fonts.black,
    fontSize: 15,
    color: colors.dk,
  },
  sectionSubtitle: {
    marginTop: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
    lineHeight: 15,
  },

  /* FIELD */
  fieldLabelRow: {
    flexDirection: 'row',
    width: '100%',
  },
  fieldLabel: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g700,
    marginBottom: spacing.xs,
  },

  /* PRICE */
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  egpBadge: {
    minWidth: 62,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.yl,
    borderWidth: 1.5,
    borderColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  egpText: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.dk,
  },
  priceInputWrap: {
    flex: 1,
  },
  priceInputInner: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.dk,
    // Numeric prices render LTR regardless of UI locale.
    textAlign: 'left',
    writingDirection: 'ltr',
  },

  /* CONDITION */
  conditionGrid: {
    gap: spacing.sm,
  },
  conditionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.g200,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.white,
  },
  conditionTileActive: {
    borderColor: colors.y,
    backgroundColor: colors.yl,
  },
  conditionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.g100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionIconActive: {
    backgroundColor: colors.y,
  },
  conditionTextWrap: {
    flex: 1,
  },
  conditionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g700,
  },
  conditionLabelActive: {
    fontFamily: fonts.black,
    color: colors.dk,
  },
  conditionHint: {
    marginTop: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.g300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.y,
    backgroundColor: colors.y,
  },

  /* SELECTS */
  selectSpacer: {
    marginBottom: spacing.md,
  },

  /* DESCRIPTION */
  charCount: {
    marginTop: -spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g400,
  },

  /* TOGGLE */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.g50,
    borderWidth: 1,
    borderColor: colors.g200,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.yl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.dk,
  },
  toggleHint: {
    marginTop: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g500,
    lineHeight: 15,
  },

  /* ERROR */
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.rl,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.red,
  },

  /* SUBMIT */
  submitBtn: {
    marginTop: spacing.xs,
  },
  termsHintRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: spacing.xs,
  },
  termsHint: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.g400,
  },

  /* SUCCESS MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,43,91,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.g200,
    overflow: 'hidden',
    ...shadow.sl,
  },
  modalHeader: {
    backgroundColor: colors.yl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + 4,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  modalCheck: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.y,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm + 4,
    ...shadow.sm,
  },
  modalTitle: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.dk,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g600,
    textAlign: 'center',
    lineHeight: 19,
  },
  promoteBox: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.yl,
    borderWidth: 1.5,
    borderColor: colors.y,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  promoteEmoji: {
    fontSize: 24,
    lineHeight: 26,
  },
  promoteTextWrap: {
    flex: 1,
  },
  promoteTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.dk,
    marginBottom: 3,
  },
  promoteHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.g700,
    lineHeight: 17,
  },
  modalActions: {
    padding: spacing.lg,
    gap: spacing.sm + 2,
  },
})
