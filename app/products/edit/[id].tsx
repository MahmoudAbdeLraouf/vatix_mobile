import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { MultiImageUpload, ImageItem } from '@/components/MultiImageUpload'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Button } from '@/components/ui/Button'
import { useLocale } from '@/contexts/locale'
import {
  Brand,
  Category,
  CreateProductInput,
  LocationNode,
  getBrands,
  getCategories,
  getLocations,
  getProduct,
  isExpiredResource,
  localeName,
} from '@/lib/api'
import { authPatch } from '@/lib/auth'
import { colors, fonts, radius, spacing } from '@/constants/theme'

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const productId = Number(id)
  const { t, locale } = useLocale()
  const ar = locale === 'ar'

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

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!productId || Number.isNaN(productId)) {
      setLoading(false)
      return
    }
    let cancelled = false
    Promise.all([getCategories(), getBrands(), getLocations(), getProduct(productId)])
      .then(([cats, brs, locs, product]) => {
        if (cancelled) return
        setCategories(cats.filter(c => c.isActive))
        setBrands(brs.filter(b => b.isActive))
        setLocations(locs.filter(l => l.isActive))
        if (isExpiredResource(product)) {
          setError(ar ? 'انتهى اشتراكك — لا يمكن تعديل المنتج' : 'Subscription expired — product cannot be edited')
          return
        }
        setTitle(product.title)
        setDescription(product.description ?? '')
        setPrice(String(product.price))
        setCondition(product.condition || 'new')
        setCategoryId(product.category?.id ?? null)
        setBrandId(product.brand?.id ?? null)
        setLocationId(product.location?.id ?? null)
        setShowPhone(product.showPhone)
        setImages(
          [...product.images]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((pi) => ({ url: pi.url })),
        )
      })
      .catch(() => {
        if (!cancelled) setError(ar ? 'تعذر تحميل المنتج' : 'Failed to load product')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId, ar])

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
      setError(ar ? 'يرجى الانتظار حتى تكتمل الصور' : 'Please wait for uploads to finish')
      return
    }

    setSubmitting(true)
    try {
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

      await authPatch(`/products/${productId}`, payload)
      router.back()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.serverError)
    } finally {
      setSubmitting(false)
    }
  }, [ar, brandId, categoryId, condition, description, images, locationId, price, productId, showPhone, t, title, uploading])

  const conditions: { key: string; label: string }[] = [
    { key: 'new', label: t.conditionNew },
    { key: 'used_excellent', label: t.conditionUsedExcellent },
    { key: 'used_good', label: t.conditionUsedGood },
    { key: 'used_acceptable', label: t.conditionUsedAcceptable },
  ]

  const screenTitle = ar ? 'تعديل المنتج' : 'Edit Product'

  if (loading) {
    return (
      <DashboardLayout title={screenTitle}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.y} size="large" />
        </View>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title={screenTitle} scroll={false} contentPadding={false}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          <View style={styles.section}>
            <Text style={[styles.label, { textAlign: ar ? 'right' : 'left' }]}>
              {t.addPhotos}
            </Text>
            <MultiImageUpload images={images} onChange={setImages} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { textAlign: ar ? 'right' : 'left' }]}>
              {t.productTitle}
            </Text>
            <TextInput
              style={[styles.input, { textAlign: ar ? 'right' : 'left' }]}
              value={title}
              onChangeText={setTitle}
              placeholder={t.productTitle}
              placeholderTextColor={colors.g400}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { textAlign: ar ? 'right' : 'left' }]}>
              {t.price} ({t.egp})
            </Text>
            <TextInput
              style={[styles.input, { textAlign: ar ? 'right' : 'left' }]}
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              placeholderTextColor={colors.g400}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { textAlign: ar ? 'right' : 'left' }]}>
              {t.condition}
            </Text>
            <View style={styles.conditionList}>
              {conditions.map((c, i) => (
                <Pressable
                  key={c.key}
                  style={[
                    styles.conditionRow,
                    condition === c.key && styles.conditionRowActive,
                    i < conditions.length - 1 && styles.conditionRowBorder,
                  ]}
                  onPress={() => setCondition(c.key)}
                >
                  <Text
                    style={[
                      styles.conditionRowText,
                      condition === c.key && styles.conditionRowTextActive,
                      { textAlign: ar ? 'right' : 'left' },
                    ]}
                  >
                    {c.label}
                  </Text>
                  {condition === c.key ? (
                    <Ionicons name="checkmark" size={18} color={colors.y} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>

          <SearchableSelect
            label={t.category}
            placeholder={t.selectCategory}
            options={categoryOptions}
            value={categoryId != null ? String(categoryId) : ''}
            onChange={(v) => setCategoryId(v ? Number(v) : null)}
            style={styles.section}
          />

          <SearchableSelect
            label={t.brand}
            placeholder={t.selectBrand}
            options={brandOptions}
            value={brandId != null ? String(brandId) : ''}
            onChange={(v) => setBrandId(v ? Number(v) : null)}
            style={styles.section}
          />

          <SearchableSelect
            label={t.location}
            placeholder={t.selectLocation}
            options={locationOptions}
            value={locationId != null ? String(locationId) : ''}
            onChange={(v) => setLocationId(v ? Number(v) : null)}
            style={styles.section}
          />

          <View style={styles.section}>
            <Text style={[styles.label, { textAlign: ar ? 'right' : 'left' }]}>
              {t.description}
            </Text>
            <TextInput
              style={[styles.input, styles.textarea, { textAlign: ar ? 'right' : 'left' }]}
              value={description}
              onChangeText={setDescription}
              placeholder={t.description}
              placeholderTextColor={colors.g400}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { textAlign: ar ? 'right' : 'left' }]}>
              {t.showPhone}
            </Text>
            <Switch
              value={showPhone}
              onValueChange={setShowPhone}
              trackColor={{ false: colors.g300, true: colors.y }}
              thumbColor={colors.white}
            />
          </View>

          {error ? (
            <Text style={[styles.error, { textAlign: ar ? 'right' : 'left' }]}>{error}</Text>
          ) : null}

          <Button
            label={ar ? 'حفظ التغييرات' : 'Save Changes'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || uploading}
            style={styles.submitBtn}
          />
      </ScrollView>
    </DashboardLayout>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: { marginBottom: spacing.lg },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.g700,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.g300,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.g900,
    backgroundColor: colors.white,
  },
  textarea: {
    height: 100,
    paddingTop: spacing.sm,
  },
  conditionList: {
    borderWidth: 1,
    borderColor: colors.g300,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  conditionRowActive: { backgroundColor: colors.yl },
  conditionRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.g200 },
  conditionRowText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.g700,
    flex: 1,
  },
  conditionRowTextActive: { fontFamily: fonts.semiBold, color: colors.dk },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.g200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    gap: spacing.md,
  },
  switchLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.g700,
    flex: 1,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.red,
    marginBottom: spacing.md,
  },
  submitBtn: { marginTop: spacing.sm },
})
