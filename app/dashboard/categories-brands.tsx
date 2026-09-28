import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { useLocale } from '@/contexts/locale'
import { authErrorMessage, authFetch, authPatch } from '@/lib/auth'
import { localeName, type Brand, type Category } from '@/lib/api'
import { colors, fonts, radius, shadow, spacing } from '@/constants/theme'

type Msg = { ok: boolean; text: string } | null

type StoreProfileRelations = {
  categories: Category[]
  brands: Brand[]
}

export default function CategoriesBrandsScreen() {
  const { t, locale } = useLocale()
  const ar = locale === 'ar'
  const dirContainer = ar ? { direction: 'rtl' as const } : null
  const dirStyle = {
    writingDirection: ar ? ('rtl' as const) : ('ltr' as const),
    textAlign: 'auto' as const,
  }

  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedCats, setSelectedCats] = useState<Set<number>>(new Set())
  const [selectedBrands, setSelectedBrands] = useState<Set<number>>(new Set())

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [cats, brs, profile] = await Promise.all([
        authFetch<Category[]>('/categories'),
        authFetch<Brand[]>('/brands'),
        authFetch<StoreProfileRelations>('/stores/me/profile'),
      ])
      setCategories((cats ?? []).filter(c => c.isActive))
      setBrands((brs ?? []).filter(b => b.isActive))
      setSelectedCats(new Set((profile?.categories ?? []).map(c => c.id)))
      setSelectedBrands(new Set((profile?.brands ?? []).map(b => b.id)))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function toggleCat(id: number) {
    setSelectedCats(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleBrand(id: number) {
    setSelectedBrands(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      await authPatch('/stores/me', {
        categoryIds: [...selectedCats],
        brandIds: [...selectedBrands],
      })
      setMsg({ ok: true, text: t.categoriesBrandsPage.savedSuccess })
    } catch (err: unknown) {
      setMsg({ ok: false, text: authErrorMessage(err, t) || t.categoriesBrandsPage.saveError })
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout title={t.categoriesBrandsPage.headline}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.y} size="large" />
          </View>
        ) : loadError ? (
          <ErrorState kind="network" onRetry={load} style={styles.center} />
        ) : (
          <View style={[styles.card, dirContainer]}>
            <Text style={[styles.cardTitle, dirStyle]}>
              {t.categoriesBrandsPage.headline}
            </Text>
            <Text style={[styles.hint, dirStyle]}>
              {t.categoriesBrandsPage.description}
            </Text>

            <Section
              label={t.categoriesBrandsPage.categoriesLabel}
              count={selectedCats.size}
              countLabel={t.categoriesBrandsPage.selectedLabel}
              dirContainer={dirContainer}
              dirStyle={dirStyle}
            >
              {categories.length === 0 ? (
                <Text style={[styles.emptyInline, dirStyle]}>
                  {t.categoriesBrandsPage.noCategories}
                </Text>
              ) : (
                <View style={[styles.pillWrap, dirContainer]}>
                  {categories.map(cat => {
                    const active = selectedCats.has(cat.id)
                    return (
                      <Pill
                        key={cat.id}
                        active={active}
                        label={localeName(cat.translations, locale)}
                        onPress={() => toggleCat(cat.id)}
                      />
                    )
                  })}
                </View>
              )}
            </Section>

            <Section
              label={t.categoriesBrandsPage.brandsLabel}
              count={selectedBrands.size}
              countLabel={t.categoriesBrandsPage.selectedLabel}
              dirContainer={dirContainer}
              dirStyle={dirStyle}
            >
              {brands.length === 0 ? (
                <Text style={[styles.emptyInline, dirStyle]}>
                  {t.categoriesBrandsPage.noBrands}
                </Text>
              ) : (
                <View style={[styles.pillWrap, dirContainer]}>
                  {brands.map(br => {
                    const active = selectedBrands.has(br.id)
                    return (
                      <Pill
                        key={br.id}
                        active={active}
                        label={localeName(br.translations, locale)}
                        onPress={() => toggleBrand(br.id)}
                      />
                    )
                  })}
                </View>
              )}
            </Section>

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
              label={saving ? t.categoriesBrandsPage.saving : t.categoriesBrandsPage.saveButton}
              onPress={handleSave}
              loading={saving}
            />
          </View>
        )}
      </ScrollView>
    </DashboardLayout>
  )
}

function Section({
  label,
  count,
  countLabel,
  dirContainer,
  dirStyle,
  children,
}: {
  label: string
  count: number
  countLabel: string
  dirContainer: { direction: 'rtl' } | null
  dirStyle: { writingDirection: 'rtl' | 'ltr'; textAlign: 'auto' }
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHead, dirContainer]}>
        <Text style={[styles.sectionLabel, dirStyle]}>{label}</Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{count} {countLabel}</Text>
        </View>
      </View>
      {children}
    </View>
  )
}

function Pill({
  active,
  label,
  onPress,
}: {
  active: boolean
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        active
          ? { backgroundColor: colors.y, borderColor: colors.y }
          : { backgroundColor: 'transparent', borderColor: colors.g300 },
      ]}
    >
      <Text
        style={[
          styles.pillText,
          { color: active ? colors.dk : colors.g700 },
        ]}
      >
        {active ? '✓ ' : ''}{label}
      </Text>
    </Pressable>
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dk,
  },
  countPill: {
    backgroundColor: colors.yl,
    borderColor: colors.y,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.dk,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  emptyInline: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.g500,
    paddingVertical: spacing.sm,
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
